#!/usr/bin/env python3
"""
Ontario provincial candidate sync tool -- pulls from Elections Ontario's
Voter Information Service API and loads results into
provincial_election_events / provincial_election_candidates (province='ON').

Unlike BC and Manitoba (HTML to scrape), Ontario's VIS
(voterinformationservice.elections.on.ca) is backed by a real JSON API --
found by digging through Wayback Machine snapshots from Ontario's Feb 27,
2025 general election, since the live endpoints 404 outside an active
election (confirmed: /api/election/10/electoral-district/1, live during
that election, 404s today).

Two endpoints matter:
  GET /api/electoral-district-search/en/all-with-election
    Always live (200 right now, even with no active election). Lists every
    riding; each entry gets an "election" key (with electionId/name/
    pollingDay/isByElection) *only* while an election is actually running.
    This is the discovery mechanism -- no guessing, no Wayback needed once
    you know to poll this.
  GET /api/election/{electionId}/electoral-district/{districtId}
    Full candidate list (firstName, lastName, partyNameEnglish, sometimes
    websiteUrl) for one riding in one election. Only resolves while that
    electionId is the live one.

map_shapes.code for Ontario's Provincial rows (124 of them,
properties ? 'ed_id') is already Ontario's own numeric district id
(confirmed: code=1 is Ajax, matching electoralDistrictId=1) -- matching is
a direct numeric join, no name-matching needed.

**This one is genuinely election-period-only** -- unlike Manitoba, nothing
here resolves once the campaign ends. Run `discover` periodically (e.g.
weekly); it costs one cheap, always-live request and no-ops until Ontario
actually calls an election.

Requires only the Python standard library plus `psql` on PATH.

Usage:
  python3 scripts/sync_ontario_candidates.py discover
  python3 scripts/sync_ontario_candidates.py sync --event-id <uuid>

Connection: reads DATABASE_URL from the environment by default, or pass
--db-url.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

USER_AGENT = "Mozilla/5.0 (compatible; ChosenoCandidateSync/1.0)"
BASE = "https://voterinformationservice.elections.on.ca"
ALL_WITH_ELECTION_URL = f"{BASE}/api/electoral-district-search/en/all-with-election"
REQUEST_DELAY_SECONDS = 0.3


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip":
            import gzip
            data = gzip.decompress(data)
        return json.loads(data.decode("utf-8"))


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


def cmd_discover(args):
    db_url = args.db_url
    log(f"Checking {ALL_WITH_ELECTION_URL} for an active election...")
    rows = fetch_json(ALL_WITH_ELECTION_URL)
    active = next((r for r in rows if "election" in r), None)
    if not active:
        log("No active election right now -- nothing to register. Re-run this periodically.")
        return

    election = active["election"]
    election_id = election["electionId"]
    url = f"{BASE}/api/election/{election_id}/electoral-district/"
    existing = psql(
        db_url,
        f"SELECT id FROM public.provincial_election_events WHERE province='ON' AND source_url = {sql_str(url)};",
        tuples_only=True,
    ).strip()
    if existing:
        log(f"{election['name']} (electionId={election_id}) already registered -> {existing}")
        return

    event_id = psql(
        db_url,
        f"""
        INSERT INTO public.provincial_election_events (province, name, source_url, event_date)
        VALUES ('ON', {sql_str(election['name'])}, {sql_str(url)}, {sql_str(election['pollingDay'][:10])})
        RETURNING id;
        """,
        tuples_only=True,
    ).strip()
    log(f"Registered: {election['name']} (electionId={election_id}) -> id={event_id}. Run `sync --event-id {event_id}` to load candidates.")


def parse_district_candidates(data):
    ed = data.get("electoralDistrict", {})
    out = []
    for c in ed.get("candidates", []):
        first, last = c.get("firstName", "").strip(), c.get("lastName", "").strip()
        name = f"{first.title()} {last.title()}".strip()
        if not name:
            continue
        out.append({"name": name, "party": c.get("partyNameEnglish")})
    return out


def cmd_sync(args):
    db_url = args.db_url
    row = psql(
        db_url,
        f"SELECT source_url FROM public.provincial_election_events WHERE id = {sql_str(args.event_id)};",
        tuples_only=True,
    ).strip()
    if not row:
        sys.exit(f"No provincial_election_events row with id {args.event_id}. Run `discover` first.")
    # source_url = ".../api/election/{electionId}/electoral-district/"
    election_id = row.rstrip("/").rsplit("/", 2)[1]

    shape_rows = psql(
        db_url,
        "SELECT id, code FROM public.map_shapes WHERE country='Canada' AND boundary_type='Provincial' AND properties ? 'ed_id' AND retired_at IS NULL ORDER BY code::int;",
        tuples_only=True,
    ).strip().splitlines()
    shapes = [tuple(r.split("|")) for r in shape_rows if r]
    log(f"Syncing electionId={election_id} across {len(shapes)} riding(s)...")

    total, missing = 0, 0
    for map_shape_id, code in shapes:
        url = f"{BASE}/api/election/{election_id}/electoral-district/{code}"
        time.sleep(REQUEST_DELAY_SECONDS)
        try:
            data = fetch_json(url)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                missing += 1
                continue
            raise
        candidates = parse_district_candidates(data)
        if not candidates:
            continue
        for c in candidates:
            psql(
                db_url,
                f"""
                INSERT INTO public.provincial_election_candidates
                    (election_event_id, map_shape_id, candidate_name, party_name)
                VALUES ({sql_str(args.event_id)}, {map_shape_id}, {sql_str(c['name'])}, {sql_str(c['party'])})
                ON CONFLICT (election_event_id, map_shape_id, candidate_name)
                DO UPDATE SET party_name = EXCLUDED.party_name, scraped_at = now();
                """,
            )
            total += 1
        log(f"  ED={code}: {len(candidates)} candidate(s)")

    log(f"Done. {total} candidate row(s) upserted ({missing} riding(s) returned 404 -- electionId may have expired mid-run).")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    sub = p.add_subparsers(dest="command", required=True)

    d = sub.add_parser("discover", help="Check for an active election and register it")
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
