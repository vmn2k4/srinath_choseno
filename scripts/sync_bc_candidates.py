#!/usr/bin/env python3
"""
BC provincial candidate sync tool -- scrapes Elections BC and loads results
into provincial_election_events / provincial_election_candidates.

Unlike Elections Canada's federal VIS (see sync_federal_candidates.py),
Elections BC doesn't expose a per-riding URL or an opaque event id to
discover. Instead, each election gets exactly ONE page listing every
riding's candidates in a single HTML table
(elections.bc.ca/<election-slug>/candidate-list/), filterable client-side
by a JS dropdown -- we just parse the underlying <table id="candidates_table">
directly and ignore the JS.

The slug is predictable ahead of time because BC has a fixed-date election
law: the last general election was "2024-provincial-election"; the next is
expected October 2028, so "2028-provincial-election" is the first guess
`discover` will try. That page won't exist until Elections BC actually
publishes it (some time after the writ drops), so `discover` is meant to
be re-run periodically as the election approaches, not once.

Districts are matched to map_shapes by exact name (Canada/Provincial rows
carry a BC-specific `ed_abbreviation` property -- see the query in
scoped_bc_shapes() -- since the Provincial boundary_type also holds other
provinces' ridings under different property shapes).

Requires only the Python standard library plus `psql` on PATH.

Usage:
  # Try known/guessed URL slugs and register any that resolve.
  python3 scripts/sync_bc_candidates.py discover

  # Or point it at a specific slug once you know it.
  python3 scripts/sync_bc_candidates.py discover --slug 2028-provincial-election

  # Parse and store candidates for a registered event.
  python3 scripts/sync_bc_candidates.py sync --event-id <uuid from discover's output>

Connection: reads DATABASE_URL from the environment by default, or pass
--db-url.
"""

import argparse
import html
import os
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error

USER_AGENT = "Mozilla/5.0 (compatible; ChosenoCandidateSync/1.0)"
BASE = "https://elections.bc.ca"

TABLE_ROW_RE = re.compile(
    r'<td[^>]*>([^<]*)</td>\s*<td[^>]*>(\d*)</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>',
)


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.getcode(), resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def psql(db_url, sql, tuples_only=False):
    cmd = ["psql", db_url, "-v", "ON_ERROR_STOP=1"]
    if tuples_only:
        cmd += ["-t", "-A"]
    cmd += ["-c", sql]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"psql failed:\n{result.stderr.strip()}")
    return result.stdout


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def sql_str(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def guess_slugs():
    """BC's fixed election-date law makes the next general election's year
    predictable; by-elections don't follow this pattern and have to be
    passed explicitly via --slug."""
    year = int(time.strftime("%Y"))
    # Fixed-date elections land in Oct of election years, next-in-cycle
    # after the last known one (2024) is +4y, +8y, etc.
    candidates = []
    y = 2024
    while y <= year + 4:
        y += 4
        candidates.append(f"{y}-provincial-election")
    return candidates


def cmd_discover(args):
    db_url = args.db_url
    slugs = [args.slug] if args.slug else guess_slugs()
    for slug in slugs:
        url = f"{BASE}/{slug}/candidate-list/"
        status, body = fetch(url)
        if status != 200 or 'id="candidates_table"' not in body:
            log(f"{url} -> not available yet (HTTP {status})")
            continue
        existing = psql(
            db_url,
            f"SELECT id FROM public.provincial_election_events WHERE province='BC' AND source_url = {sql_str(url)};",
            tuples_only=True,
        ).strip()
        if existing:
            log(f"{url} already registered as event {existing}.")
            continue
        name = slug.replace("-", " ").title()
        event_id = psql(
            db_url,
            f"""
            INSERT INTO public.provincial_election_events (province, name, source_url)
            VALUES ('BC', {sql_str(name)}, {sql_str(url)})
            RETURNING id;
            """,
            tuples_only=True,
        ).strip()
        log(f"Registered new event: {name} ({url}) -> id={event_id}. Run `sync --event-id {event_id}` to load candidates.")


def parse_candidate_table(html_body):
    """The table's real columns (see the hidden th's in the source) are:
    Districts (hidden), Sort Column (hidden), Electoral District,
    Candidate Ballot Name, Affiliation."""
    rows = []
    for district, _sort, _district_repeat, name, party in TABLE_ROW_RE.findall(html_body):
        district = re.sub(r"\s+", " ", html.unescape(district)).strip()
        name = re.sub(r"\s+", " ", html.unescape(name)).strip()
        party = re.sub(r"\s+", " ", html.unescape(party)).strip()
        if not district or not name:
            continue
        rows.append({"district": district, "name": name, "party": party})
    return rows


def cmd_sync(args):
    db_url = args.db_url
    event = psql(
        db_url,
        f"SELECT source_url FROM public.provincial_election_events WHERE id = {sql_str(args.event_id)};",
        tuples_only=True,
    ).strip()
    if not event:
        sys.exit(f"No provincial_election_events row with id {args.event_id}. Run `discover` first.")
    url = event

    log(f"Fetching {url}...")
    status, body = fetch(url)
    if status != 200:
        sys.exit(f"Fetch failed: HTTP {status}")

    rows = parse_candidate_table(body)
    if not rows:
        sys.exit("No candidate rows found -- the page structure may have changed; inspect it manually.")
    log(f"Parsed {len(rows)} candidate row(s) across all districts.")

    # BC's Provincial map_shapes rows carry an ed_abbreviation property
    # unique to this upload -- other provinces under boundary_type
    # 'Provincial' use different property shapes entirely.
    shape_rows = psql(
        db_url,
        "SELECT id, name FROM public.map_shapes WHERE country='Canada' AND boundary_type='Provincial' AND properties ? 'ed_abbreviation' AND retired_at IS NULL;",
        tuples_only=True,
    ).strip().splitlines()
    shapes_by_name = {}
    for line in shape_rows:
        shape_id, name = line.split("|", 1)
        shapes_by_name[name.strip()] = shape_id

    inserted, unmatched = 0, set()
    for row in rows:
        shape_id = shapes_by_name.get(row["district"])
        if not shape_id:
            unmatched.add(row["district"])
            continue
        psql(
            db_url,
            f"""
            INSERT INTO public.provincial_election_candidates
                (election_event_id, map_shape_id, candidate_name, party_name)
            VALUES ({sql_str(args.event_id)}, {shape_id}, {sql_str(row['name'])}, {sql_str(row['party'] or None)})
            ON CONFLICT (election_event_id, map_shape_id, candidate_name)
            DO UPDATE SET party_name = EXCLUDED.party_name, scraped_at = now();
            """,
        )
        inserted += 1

    log(f"Done. {inserted} candidate row(s) upserted.")
    if unmatched:
        log(f"WARNING: {len(unmatched)} district name(s) had no matching map_shapes row: {', '.join(sorted(unmatched))}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    sub = p.add_subparsers(dest="command", required=True)

    d = sub.add_parser("discover", help="Find and register a new election's candidate-list page")
    d.add_argument("--slug", help="Exact URL slug to try (default: guess from BC's fixed election-date cycle)")
    d.set_defaults(func=cmd_discover)

    s = sub.add_parser("sync", help="Parse and store candidates for a registered event")
    s.add_argument("--event-id", required=True, help="provincial_election_events.id from `discover`")
    s.set_defaults(func=cmd_sync)

    args = p.parse_args()
    if not args.db_url:
        sys.exit("No database URL. Pass --db-url or set DATABASE_URL.")
    args.func(args)


if __name__ == "__main__":
    main()
