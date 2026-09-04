#!/usr/bin/env python3
"""
Adds real Governor candidates onto the existing "2026 US Midterm Elections"
election's Governor seats, for every state whose fetch-candidates Edge
Function handler is confirmed live (see docs/ELECTION_DATA_SOURCES.md's "USA
— Governor + state legislature" section for which states that is today).

Unlike start_us_2026_midterms.py, this does NOT query the FEC — the FEC has
no Governor data at all (state office, never federally filed). It calls the
already-deployed `fetch-candidates` Supabase Edge Function instead (the same
one the admin UI's "Fetch candidates" button calls), then reuses
start_us_2026_midterms.py's own build_seat_and_candidates_sql() to write the
result — same officeholder-dedup + party-matching + idempotency guarantees,
no logic duplicated.

Usage:
  python3 scripts/add_governor_candidates.py run --states ID,CT,HI
  python3 scripts/add_governor_candidates.py run   # every state with a Governor seat

Requires DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
(reads all three straight out of .env.local if not set in the environment).
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from start_us_2026_midterms import (  # noqa: E402
    ELECTION_NAME,
    build_seat_and_candidates_sql,
    log,
    normalize_candidate_name,
    psql_run,
    psql_scalar,
    sql_str,
)

ROLE_TITLE = "Governor"


def load_env_local(repo_root):
    path = os.path.join(repo_root, ".env.local")
    out = {}
    if not os.path.exists(path):
        return out
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            out[k.strip()] = v.strip()
    return out


def fetch_candidates_for_seat(supabase_url, anon_key, seat_id):
    req = urllib.request.Request(
        f"{supabase_url}/functions/v1/fetch-candidates",
        data=json.dumps({"seatId": seat_id}).encode(),
        headers={"Authorization": f"Bearer {anon_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"status": "error", "error": f"HTTP {e.code}: {e.read().decode()[:200]}"}


def get_election_id(db_url):
    out = psql_scalar(db_url, f"SELECT id FROM public.elections WHERE name = {sql_str(ELECTION_NAME)};")
    if not out:
        raise RuntimeError(f"'{ELECTION_NAME}' does not exist yet.")
    return out


def cmd_run(args):
    db_url = args.db_url
    supabase_url = args.supabase_url
    anon_key = args.anon_key
    states = {s.strip().upper() for s in args.states.split(",")} if args.states else None

    election_id = get_election_id(db_url)
    rows = psql_scalar(
        db_url,
        f"""
        SELECT es.id || '|' || ms.id || '|' || ms.code
        FROM public.election_seats es
        JOIN public.map_shapes ms ON ms.id = es.map_shape_id
        WHERE es.election_id = {sql_str(election_id)} AND es.role_title = {sql_str(ROLE_TITLE)}
        ORDER BY ms.code;
        """,
    ).splitlines()
    seats = [tuple(r.split("|")) for r in rows if r]
    if states:
        seats = [s for s in seats if s[2] in states]

    log(f"Checking {len(seats)} Governor seat(s) via fetch-candidates...")
    added, unsupported, errors = 0, [], []
    for seat_id, map_shape_id, state in seats:
        result = fetch_candidates_for_seat(supabase_url, anon_key, seat_id)
        status = result.get("status")
        if status != "ok":
            if status in ("unsupported", "manual_only", None):
                unsupported.append(state)
            else:
                errors.append(f"{state}: {result.get('error', status)}")
            continue
        cands = result.get("candidates", [])
        if not cands:
            continue
        pairs = [(normalize_candidate_name(c["name"]) if "," in c["name"] else c["name"], c.get("party")) for c in cands]
        sql = build_seat_and_candidates_sql(db_url, election_id, int(map_shape_id), ROLE_TITLE, pairs, result.get("sourceUrl", ""))
        psql_run(db_url, sql)
        added += len(pairs)
        log(f"  {state}: {len(pairs)} candidate(s) via {result.get('sourceUrl', '?')}")

    log("=" * 60)
    log(f"TOTAL: {added} candidate(s) processed across {len(seats) - len(unsupported) - len(errors)} state(s).")
    if unsupported:
        log(f"No live-fetch handler yet ({len(unsupported)}): {', '.join(sorted(unsupported))}")
    if errors:
        log(f"Errored ({len(errors)}): {', '.join(errors)}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env = load_env_local(repo_root)
    p.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    p.add_argument("--supabase-url", default=os.environ.get("NEXT_PUBLIC_SUPABASE_URL", env.get("NEXT_PUBLIC_SUPABASE_URL")))
    p.add_argument("--anon-key", default=os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")))
    sub = p.add_subparsers(dest="command", required=True)

    r = sub.add_parser("run", help="Fetch and add Governor candidates for every state with a live handler")
    r.add_argument("--states", default=None, help="Comma-separated USPS state codes to restrict to.")
    r.set_defaults(func=cmd_run)

    args = p.parse_args()
    if not args.db_url:
        sys.exit("No database URL. Pass --db-url or set DATABASE_URL.")
    if not args.supabase_url or not args.anon_key:
        sys.exit("Missing Supabase URL/anon key. Pass --supabase-url/--anon-key or check .env.local.")
    args.func(args)


if __name__ == "__main__":
    main()
