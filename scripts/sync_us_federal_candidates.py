#!/usr/bin/env python3
"""
US federal candidate sync tool -- pulls from the FEC's OpenFEC API and
loads results into us_federal_election_candidates.

Unlike Canada (an HTML page to scrape, per riding or per election), the
FEC publishes a real, documented, stable REST API
(https://api.open.fec.gov/developers/) -- there's no URL/event id to
discover at all. A query is fully identified by (cycle, office, state,
district):

  office=H (House)      needs state + district
  office=S (Senate)      needs state
  office=P (President)   nationwide, no state/district

map_shapes.code for USA/Federal rows is the 4-digit GEOID (2-digit state
FIPS + 2-digit district, e.g. "0601" = California's 1st). STATE_FIPS below
converts that to the 2-letter USPS abbreviation the FEC API expects.
President has no single associated map_shapes row (nationwide race), so
those rows get map_shape_id = NULL.

Get a free API key at https://api.data.gov/signup/ for real use --
DEMO_KEY works but is rate-limited to ~30 req/hour/IP.

Requires only the Python standard library plus `psql` on PATH.

Usage:
  python3 scripts/sync_us_federal_candidates.py sync --cycle 2026 --office H
  python3 scripts/sync_us_federal_candidates.py sync --cycle 2026 --office S
  python3 scripts/sync_us_federal_candidates.py sync --cycle 2028 --office P

Connection: reads DATABASE_URL from the environment by default, or pass
--db-url. FEC key: reads FEC_API_KEY from the environment (default
DEMO_KEY), or pass --api-key.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
import urllib.parse

USER_AGENT = "Mozilla/5.0 (compatible; ChosenoCandidateSync/1.0)"
API_BASE = "https://api.open.fec.gov/v1/candidates/"
REQUEST_DELAY_SECONDS = 0.3

# 2-digit Census state FIPS -> USPS abbreviation, for the ~50 states + DC
# and the voting territories the FEC also covers.
STATE_FIPS = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
    "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
    "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
    "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
    "54": "WV", "55": "WI", "56": "WY", "60": "AS", "66": "GU", "69": "MP",
    "72": "PR", "78": "VI",
}


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


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


def fetch_candidates(api_key, *, cycle, office, state=None, district=None):
    """Paginates through every result for one FEC query."""
    results, page = [], 1
    while True:
        params = {"api_key": api_key, "cycle": cycle, "office": office, "per_page": 100, "page": page}
        if state:
            params["state"] = state
        if district:
            params["district"] = district
        url = API_BASE + "?" + urllib.parse.urlencode(params)
        data = fetch_json(url)
        results.extend(data["results"])
        if page >= data["pagination"]["pages"]:
            break
        page += 1
        time.sleep(REQUEST_DELAY_SECONDS)
    return results


def source_url(cycle, office, state=None, district=None):
    params = {"cycle": cycle, "office": office}
    if state:
        params["state"] = state
    if district:
        params["district"] = district
    return "https://www.fec.gov/data/candidates/?" + urllib.parse.urlencode(params)


def upsert_candidates(db_url, cycle, office, map_shape_id, candidates, url):
    count = 0
    for c in candidates:
        # Only currently-active filings -- FEC keeps every candidate who
        # has ever filed for the office under this query, going back
        # decades, unless narrowed by candidate_status.
        if c.get("candidate_status") != "C":
            continue
        psql(
            db_url,
            f"""
            INSERT INTO public.us_federal_election_candidates
                (cycle, office, map_shape_id, fec_candidate_id, candidate_name, party_name,
                 candidate_status, incumbent_challenge, source_url)
            VALUES ({cycle}, {sql_str(office)}, {map_shape_id if map_shape_id else 'NULL'},
                    {sql_str(c['candidate_id'])}, {sql_str(c['name'])}, {sql_str(c.get('party_full'))},
                    {sql_str(c.get('candidate_status'))}, {sql_str(c.get('incumbent_challenge'))}, {sql_str(url)})
            ON CONFLICT (cycle, office, map_shape_id, fec_candidate_id)
            DO UPDATE SET candidate_name = EXCLUDED.candidate_name, party_name = EXCLUDED.party_name,
                          candidate_status = EXCLUDED.candidate_status,
                          incumbent_challenge = EXCLUDED.incumbent_challenge,
                          source_url = EXCLUDED.source_url, scraped_at = now();
            """,
        )
        count += 1
    return count


def cmd_sync(args):
    db_url, api_key = args.db_url, args.api_key

    if args.office == "P":
        log(f"Fetching President candidates for cycle {args.cycle}...")
        candidates = fetch_candidates(api_key, cycle=args.cycle, office="P")
        url = source_url(args.cycle, "P")
        n = upsert_candidates(db_url, args.cycle, "P", None, candidates, url)
        log(f"Done. {n} active President candidate row(s) upserted.")
        return

    if args.office == "S":
        rows = psql(
            db_url,
            "SELECT id, code FROM public.map_shapes WHERE country='USA' AND boundary_type='State' AND retired_at IS NULL ORDER BY code;",
            tuples_only=True,
        ).strip().splitlines()
        shapes = [tuple(r.split("|")) for r in rows if r]
        log(f"Syncing Senate candidates for cycle {args.cycle} across {len(shapes)} state(s)...")
        total = 0
        for map_shape_id, state in shapes:
            time.sleep(REQUEST_DELAY_SECONDS)
            candidates = fetch_candidates(api_key, cycle=args.cycle, office="S", state=state)
            url = source_url(args.cycle, "S", state=state)
            n = upsert_candidates(db_url, args.cycle, "S", map_shape_id, candidates, url)
            if n:
                log(f"  {state}: {n} candidate(s)")
            total += n
        log(f"Done. {total} active Senate candidate row(s) upserted.")
        return

    # office == 'H'
    rows = psql(
        db_url,
        "SELECT id, code, properties->>'statefp' FROM public.map_shapes WHERE country='USA' AND boundary_type='Federal' AND retired_at IS NULL ORDER BY code;",
        tuples_only=True,
    ).strip().splitlines()
    shapes = [tuple(r.split("|")) for r in rows if r]
    log(f"Syncing House candidates for cycle {args.cycle} across {len(shapes)} district(s)...")
    total, skipped = 0, 0
    for map_shape_id, geoid, statefp in shapes:
        state = STATE_FIPS.get(statefp)
        if not state:
            skipped += 1
            continue
        district = geoid[2:]  # GEOID = 2-digit state FIPS + 2-digit district
        time.sleep(REQUEST_DELAY_SECONDS)
        candidates = fetch_candidates(api_key, cycle=args.cycle, office="H", state=state, district=district)
        url = source_url(args.cycle, "H", state=state, district=district)
        n = upsert_candidates(db_url, args.cycle, "H", map_shape_id, candidates, url)
        if n:
            log(f"  {state}-{district}: {n} candidate(s)")
        total += n
    log(f"Done. {total} active House candidate row(s) upserted ({skipped} district(s) skipped -- unrecognized state FIPS, likely a territory).")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    p.add_argument("--api-key", default=os.environ.get("FEC_API_KEY", "DEMO_KEY"))
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("sync", help="Fetch and store candidates for one office/cycle")
    s.add_argument("--cycle", type=int, required=True, help="FEC election cycle, e.g. 2026")
    s.add_argument("--office", required=True, choices=["H", "S", "P"], help="H=House, S=Senate, P=President")
    s.set_defaults(func=cmd_sync)

    args = p.parse_args()
    if not args.db_url:
        sys.exit("No database URL. Pass --db-url or set DATABASE_URL.")
    args.func(args)


if __name__ == "__main__":
    main()
