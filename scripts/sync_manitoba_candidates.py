#!/usr/bin/env python3
"""
Manitoba provincial candidate sync tool -- scrapes Elections Manitoba and
loads results into provincial_election_events / provincial_election_candidates
(province='MB').

The best of the provincial sources found so far: electionsmanitoba.ca
publishes a single page (electionsmanitoba.ca/en/Voting/Candidates/<slug>)
whose "Select an event" dropdown lists every election Elections Manitoba
has ever tracked -- past general elections *and* by-elections -- by a
human-readable slug (e.g. "43rdGE", "The Pas-Kameesak"). `discover` reads
that dropdown directly, so there's no guessing involved the way there is
for BC.

The actual data comes from POSTing to /en/Voting/_FilterCandidates with
that slug (verified live: a blank `edid` returns every electoral
division's candidates for that event in one request -- no need to loop
per-division). map_shapes.code for Manitoba's Provincial rows is already
the exact numeric electoral-division id Elections Manitoba itself uses
(e.g. 101 = Agassiz) -- but the candidates response only gives division
*names*, so matching is by name (properties->>'ednameen') the same way
BC matches by name.

Confirmed live as of this writing: "The Pas-Kameesak" is an open
by-election with real confirmed candidates -- this source is NOT
election-period-only the way Ontario/Quebec seem to be; Elections
Manitoba keeps every past event's data permanently queryable too.

Requires only the Python standard library plus `psql` on PATH.

Usage:
  # Read the event dropdown and register any new elections.
  python3 scripts/sync_manitoba_candidates.py discover

  # Pull every candidate for one registered event.
  python3 scripts/sync_manitoba_candidates.py sync --event-id <uuid>

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
import unicodedata
import urllib.parse
import urllib.request
import urllib.error

USER_AGENT = "Mozilla/5.0 (compatible; ChosenoCandidateSync/1.0)"
BASE = "https://www.electionsmanitoba.ca"
CANDIDATES_PAGE = f"{BASE}/en/Voting/Candidates/43rdGE"  # any valid slug works to load the dropdown
FILTER_URL = f"{BASE}/en/Voting/_FilterCandidates"

EVENT_OPTION_RE = re.compile(
    r'<select id="EventShortName"[^>]*>(.*?)</select>', re.DOTALL
)
OPTION_RE = re.compile(r'<option value="([^"]*)">([^<]*)</option>')

CANDIDATE_BLOCK_RE = re.compile(
    r'<span class="name"><strong>Name: </strong>([^<]+)</span>.*?'
    r'<span class="party"><strong>Affiliation: </strong>([^<]*)</span>.*?'
    r'<span class="division"><strong>ED: </strong>([^<]+)</span>.*?'
    r'<span class="status"><strong>Status:</strong>\s*([^<]+)</span>',
    re.DOTALL,
)


def fetch(url, data=None):
    req = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(data).encode() if data else None,
        headers={"User-Agent": USER_AGENT},
        method="POST" if data else "GET",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


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


def fold_accents(text):
    """Manitoba's English-language candidate page inconsistently strips
    accents from a couple of French division names (e.g. "La Verendrye"
    vs. our "La Vérendrye") -- match accent-insensitively rather than
    trying to guess which ones."""
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


def sql_str(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def cmd_discover(args):
    db_url = args.db_url
    log(f"Fetching {CANDIDATES_PAGE} for the event list...")
    page = fetch(CANDIDATES_PAGE)
    m = EVENT_OPTION_RE.search(page)
    if not m:
        sys.exit("Couldn't find the EventShortName dropdown -- page structure may have changed.")
    events = OPTION_RE.findall(m.group(1))
    if not events:
        sys.exit("Dropdown found but no options parsed.")

    for slug, label in events:
        url = f"{BASE}/en/Voting/Candidates/{urllib.parse.quote(slug)}"
        existing = psql(
            db_url,
            f"SELECT id FROM public.provincial_election_events WHERE province='MB' AND source_url = {sql_str(url)};",
            tuples_only=True,
        ).strip()
        if existing:
            log(f"{label} ({slug}) already registered -> {existing}")
            continue
        event_id = psql(
            db_url,
            f"""
            INSERT INTO public.provincial_election_events (province, name, source_url)
            VALUES ('MB', {sql_str(html.unescape(label).strip())}, {sql_str(url)})
            RETURNING id;
            """,
            tuples_only=True,
        ).strip()
        log(f"Registered: {label} ({slug}) -> id={event_id}. Run `sync --event-id {event_id}` to load candidates.")


def cmd_sync(args):
    db_url = args.db_url
    row = psql(
        db_url,
        f"SELECT source_url FROM public.provincial_election_events WHERE id = {sql_str(args.event_id)};",
        tuples_only=True,
    ).strip()
    if not row:
        sys.exit(f"No provincial_election_events row with id {args.event_id}. Run `discover` first.")
    slug = urllib.parse.unquote(row.rsplit("/", 1)[-1])

    log(f"Fetching candidates for event slug '{slug}'...")
    body = fetch(FILTER_URL, data={"EventShortName": slug, "edid": "", "ptid": "", "status": "", "sortby": "1"})
    candidates = CANDIDATE_BLOCK_RE.findall(body)
    if not candidates:
        log("No candidates found -- either nothing confirmed yet for this event, or the page structure changed.")
        return
    log(f"Parsed {len(candidates)} candidate row(s).")

    shape_rows = psql(
        db_url,
        "SELECT id, properties->>'ednameen' FROM public.map_shapes WHERE country='Canada' AND boundary_type='Provincial' AND properties ? 'ednameen' AND retired_at IS NULL;",
        tuples_only=True,
    ).strip().splitlines()
    shapes_by_name = {}
    for line in shape_rows:
        shape_id, name = line.split("|", 1)
        shapes_by_name[fold_accents(name.strip())] = shape_id

    inserted, unmatched = 0, set()
    for raw_name, party, division, status in candidates:
        name = re.sub(r"\s+", " ", html.unescape(raw_name)).strip()
        # "LAST, First" -> "First Last", matching the display convention
        # used elsewhere in the app (and in the other jurisdictions' data).
        if "," in name:
            last, first = name.split(",", 1)
            name = f"{first.strip()} {last.strip()}"
        party = re.sub(r"\s+", " ", html.unescape(party)).strip()
        division = re.sub(r"\s+", " ", html.unescape(division)).strip()
        shape_id = shapes_by_name.get(fold_accents(division))
        if not shape_id:
            unmatched.add(division)
            continue
        psql(
            db_url,
            f"""
            INSERT INTO public.provincial_election_candidates
                (election_event_id, map_shape_id, candidate_name, party_name)
            VALUES ({sql_str(args.event_id)}, {shape_id}, {sql_str(name)}, {sql_str(party or None)})
            ON CONFLICT (election_event_id, map_shape_id, candidate_name)
            DO UPDATE SET party_name = EXCLUDED.party_name, scraped_at = now();
            """,
        )
        inserted += 1

    log(f"Done. {inserted} candidate row(s) upserted.")
    if unmatched:
        log(f"WARNING: {len(unmatched)} division name(s) had no matching map_shapes row: {', '.join(sorted(unmatched))}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    sub = p.add_subparsers(dest="command", required=True)

    d = sub.add_parser("discover", help="Read the event dropdown and register any new elections")
    d.set_defaults(func=cmd_discover)

    s = sub.add_parser("sync", help="Pull every candidate for a registered event")
    s.add_argument("--event-id", required=True, help="provincial_election_events.id from `discover`")
    s.set_defaults(func=cmd_sync)

    args = p.parse_args()
    if not args.db_url:
        sys.exit("No database URL. Pass --db-url or set DATABASE_URL.")
    args.func(args)


if __name__ == "__main__":
    main()
