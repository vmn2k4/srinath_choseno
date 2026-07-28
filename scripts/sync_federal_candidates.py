#!/usr/bin/env python3
"""
Federal candidate sync tool -- scrapes Elections Canada's Voter Information
Service (VIS) and loads results into federal_election_events /
federal_election_candidates.

Background (learned by probing the live site -- see commit message / PR
description for the full trail):

  - Every federal riding maps 1:1 to a map_shapes row via
    map_shapes.code == the riding's 5-digit ED number (Elections Canada
    calls it FED_NUM). PROV/PROVID are fully derivable from the ED's
    2-digit province prefix (see PROVINCE_BY_PREFIX below) -- nothing
    riding-specific needs to be hand-entered.
  - EV (and its companion EV_TYPE, always 6 for this view) identify the
    *election event* and are NOT derivable from the riding -- they're
    Elections Canada's own internal ID for that general election or
    by-election, shared by every riding voting in it.
  - EV is really only reliable to query while an election is upcoming or
    recently concluded. Elections Canada embeds the correct
    "Scripts/vis/Candidates?...EV=...&EV_TYPE=..." link on each riding's
    own page while that page lives under the *current* URL tree
    (content.aspx?section=ele&dir=<year>/<ED>&document=index). Once
    archived into the "pas" (past) tree, that link disappears -- and in
    testing, by-election EVs actually stopped resolving on the live VIS
    endpoint entirely a few months after the event concluded (general
    election EVs seem to stay live much longer -- the 45th GE's EV=99
    still resolved over a year later). Practical takeaway: run `discover`
    regularly (weekly is plenty) so new events get their EV captured
    *before* it goes stale, rather than trying to backfill later.
  - If an EV *has* gone stale, the Wayback Machine
    (web.archive.org/web/<ts>/<url>) often still has a snapshot of the
    riding's index page from while it was live, which is enough to recover
    the EV by hand -- see the four seeded rows in
    supabase/migrations/20260729000011_federal_election_candidates.sql.
    This script doesn't automate that fallback; it's a manual recovery
    step, not something to build a whole scraping mode around for what's
    normally a handful of rows.

Requires only the Python standard library (matches upload_boundary.py's
convention) plus `psql` on PATH.

Usage:
  # Discover new/upcoming election events and register them (metadata
  # only -- candidate_name rows come from `sync`). Safe to re-run; already
  # -known events are skipped.
  python3 scripts/sync_federal_candidates.py discover

  # Fetch candidates for one event (by EV) across every riding known to be
  # part of it -- all 343 for a general election, or just the handful
  # for a by-election (looked up from federal_election_events.name /
  # by re-discovering, or pass --ed explicitly).
  python3 scripts/sync_federal_candidates.py sync --ev 65 --ed 24018 35007 59022

  # Sync a general election across every current Federal riding.
  python3 scripts/sync_federal_candidates.py sync --ev 99 --all-ridings

Connection: reads DATABASE_URL from the environment by default (a plain
postgres:// URL), or pass --db-url.
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
REQUEST_DELAY_SECONDS = 0.5

# Elections Canada's 2-digit province prefix on every ED code -- fixed and
# well-documented, so PROV/PROVID never need to be stored per-district.
PROVINCE_BY_PREFIX = {
    "10": "NL", "11": "PE", "12": "NS", "13": "NB", "24": "QC", "35": "ON",
    "46": "MB", "47": "SK", "48": "AB", "59": "BC", "60": "YT", "61": "NT", "62": "NU",
}

CANDIDATES_URL = (
    "https://www.elections.ca/Scripts/vis/Candidates"
    "?L=e&ED={ed}&EV={ev}&EV_TYPE={ev_type}&PROV={prov}&PROVID={provid}&QID=-1&PAGEID=17"
)

# Matches the VIS link Elections Canada embeds on a riding's own page while
# it's under the live "current" URL tree.
VIS_LINK_RE = re.compile(
    r"Scripts/vis/[Cc]andidates\?L=e&(?:amp;)?ED=(\d+)&(?:amp;)?EV=(\d+)&(?:amp;)?EV_TYPE=(\d+)"
)

CANDIDATE_ROW_RE = re.compile(
    r'alt="(Elected candidate|Candidate)"[^>]*/>\s*&nbsp;([^<]+?)\s*</td>\s*<td>\s*([^<]+?)\s*</td>',
    re.DOTALL,
)

HEADER_INFO_RE = re.compile(
    r'<h3 class="HeaderInfo1">([^<]+)</h3>\s*<div class="HeaderInfo2">([^<]+)</div>'
)

NO_CANDIDATES_MARKER = "no candidates who have been officially confirmed"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.read().decode("utf-8", errors="replace")


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


def build_url(ed, ev, ev_type):
    prov = PROVINCE_BY_PREFIX.get(str(ed)[:2])
    if not prov:
        raise ValueError(f"Unrecognized province prefix for ED {ed}")
    return CANDIDATES_URL.format(ed=ed, ev=ev, ev_type=ev_type, prov=prov, provid=str(ed)[:2])


def cmd_discover(args):
    """Crawl the current 'upcoming elections' hub page(s) for embedded VIS
    links, registering any new election event found. Riding-level EV links
    only exist on this hub while the election is upcoming/current -- run
    this often."""
    hub_urls = args.hub_url or [
        f"https://www.elections.ca/content.aspx?section=ele&dir={time.strftime('%Y')}&document=index&lang=e",
    ]

    found_events = {}  # ev -> {ev_type, eds: set()}
    for hub_url in hub_urls:
        log(f"Fetching hub page: {hub_url}")
        html = fetch(hub_url)
        riding_links = set(re.findall(r'href="(/content\.aspx\?section=ele&(?:amp;)?dir=\d+/\d+&(?:amp;)?document=index&(?:amp;)?lang=e)"', html))
        riding_links = {link.replace("&amp;", "&") for link in riding_links}
        if not riding_links:
            log("  No riding links found on this hub page.")
            continue
        for link in riding_links:
            riding_url = "https://www.elections.ca" + link
            time.sleep(REQUEST_DELAY_SECONDS)
            riding_html = fetch(riding_url)
            m = VIS_LINK_RE.search(riding_html)
            if not m:
                log(f"  No VIS link on {riding_url} (skipping)")
                continue
            ed, ev, ev_type = m.group(1), int(m.group(2)), int(m.group(3))
            found_events.setdefault(ev, {"ev_type": ev_type, "eds": set()})
            found_events[ev]["eds"].add(ed)
            log(f"  {riding_url} -> ED={ed} EV={ev} EV_TYPE={ev_type}")

    if not found_events:
        log("No events discovered.")
        return

    db_url = args.db_url
    for ev, info in found_events.items():
        existing = psql(db_url, f"SELECT 1 FROM public.federal_election_events WHERE id = {ev};", tuples_only=True).strip()
        if existing:
            log(f"EV={ev} already registered, skipping metadata insert (EDs found: {sorted(info['eds'])}).")
            continue
        eds_label = ", ".join(sorted(info["eds"]))
        name = f"By-election ({eds_label})" if len(info["eds"]) <= 5 else f"Election EV={ev}"
        psql(
            db_url,
            f"""
            INSERT INTO public.federal_election_events (id, ev_type, name, is_general)
            VALUES ({ev}, {info['ev_type']}, {sql_str(name)}, {str(len(info['eds']) > 5).lower()});
            """,
        )
        log(f"Registered new event EV={ev} ({name}). Run `sync --ev {ev} --ed {' '.join(sorted(info['eds']))}` to load candidates.")


def parse_candidates(html_text):
    """Returns (riding_name, event_label, [{name, party, elected}]) or
    (None, None, []) if the page shows no confirmed candidates yet /
    doesn't resolve."""
    header = HEADER_INFO_RE.search(html_text)
    if not header:
        return None, None, []
    riding_name = html.unescape(header.group(1)).strip()
    event_label = html.unescape(header.group(2)).strip()
    if NO_CANDIDATES_MARKER in html_text:
        return riding_name, event_label, []
    candidates = []
    for status, name, party in CANDIDATE_ROW_RE.findall(html_text):
        candidates.append({
            "name": re.sub(r"\s+", " ", html.unescape(name)).strip(),
            "party": re.sub(r"\s+", " ", html.unescape(party)).strip(),
            "elected": status == "Elected candidate",
        })
    return riding_name, event_label, candidates


def cmd_sync(args):
    db_url = args.db_url
    event_row = psql(
        db_url,
        f"SELECT ev_type FROM public.federal_election_events WHERE id = {args.ev};",
        tuples_only=True,
    ).strip()
    if not event_row:
        sys.exit(f"Event EV={args.ev} isn't registered yet -- run `discover` first, or insert it manually.")
    ev_type = int(event_row)

    if args.all_ridings:
        rows = psql(
            db_url,
            "SELECT id, code FROM public.map_shapes WHERE country='Canada' AND boundary_type='Federal' AND retired_at IS NULL ORDER BY code;",
            tuples_only=True,
        ).strip().splitlines()
        shapes = [tuple(r.split("|")) for r in rows if r]
    else:
        if not args.ed:
            sys.exit("Pass --ed ED [ED ...] or --all-ridings.")
        placeholders = ",".join(sql_str(ed) for ed in args.ed)
        rows = psql(
            db_url,
            f"SELECT id, code FROM public.map_shapes WHERE country='Canada' AND boundary_type='Federal' AND retired_at IS NULL AND code IN ({placeholders}) ORDER BY code;",
            tuples_only=True,
        ).strip().splitlines()
        shapes = [tuple(r.split("|")) for r in rows if r]
        missing = set(args.ed) - {code for _, code in shapes}
        if missing:
            log(f"WARNING: no map_shapes row for ED(s): {', '.join(sorted(missing))} -- skipping those.")

    if not shapes:
        sys.exit("No matching Federal ridings found.")

    log(f"Syncing EV={args.ev} across {len(shapes)} riding(s)...")
    total_candidates = 0
    for map_shape_id, ed in shapes:
        url = build_url(ed, args.ev, ev_type)
        time.sleep(REQUEST_DELAY_SECONDS)
        html = fetch(url)
        riding_name, event_label, candidates = parse_candidates(html)
        if riding_name is None:
            log(f"  ED={ed}: page didn't resolve (EV may have expired) -- {url}")
            continue
        if not candidates:
            log(f"  ED={ed} ({riding_name}): no confirmed candidates yet")
            continue
        for c in candidates:
            psql(
                db_url,
                f"""
                INSERT INTO public.federal_election_candidates
                    (election_event_id, map_shape_id, candidate_name, party_name, elected, source_url)
                VALUES ({args.ev}, {map_shape_id}, {sql_str(c['name'])}, {sql_str(c['party'])}, {str(c['elected']).lower()}, {sql_str(url)})
                ON CONFLICT (election_event_id, map_shape_id, candidate_name)
                DO UPDATE SET party_name = EXCLUDED.party_name, elected = EXCLUDED.elected,
                              source_url = EXCLUDED.source_url, scraped_at = now();
                """,
            )
        total_candidates += len(candidates)
        log(f"  ED={ed} ({riding_name}): {len(candidates)} candidate(s)")

    log(f"Done. {total_candidates} candidate row(s) upserted for EV={args.ev}.")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db-url", default=os.environ.get("DATABASE_URL"), help="Postgres connection string (default: $DATABASE_URL)")
    sub = p.add_subparsers(dest="command", required=True)

    d = sub.add_parser("discover", help="Find and register new election events from Elections Canada's current hub page(s)")
    d.add_argument("--hub-url", action="append", help="Override the hub page(s) to crawl (default: this year's by-elections hub)")
    d.set_defaults(func=cmd_discover)

    s = sub.add_parser("sync", help="Fetch and store candidates for one registered election event")
    s.add_argument("--ev", type=int, required=True, help="Election event id (Elections Canada's EV)")
    s.add_argument("--ed", nargs="+", help="ED code(s) to sync (by-election: the 1-3 ridings involved)")
    s.add_argument("--all-ridings", action="store_true", help="Sync every current Federal riding (general election)")
    s.set_defaults(func=cmd_sync)

    args = p.parse_args()
    if not args.db_url:
        sys.exit("No database URL. Pass --db-url or set DATABASE_URL.")
    args.func(args)


if __name__ == "__main__":
    main()
