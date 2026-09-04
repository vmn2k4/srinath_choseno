#!/usr/bin/env python3
"""
Refreshes the "2026 US Midterm Elections" candidate rolls against live FEC
data: adds anyone newly filed since the last run (same idempotent logic
start_us_2026_midterms.py already has — re-running that script's `run`
command alone already covers this half), AND — new here — detects and
removes candidates who are no longer an active FEC filer for their seat
(i.e. dropped out / withdrew / lost a primary and stopped filing), which
start_us_2026_midterms.py has never done: it only ever adds, never removes.

Reuses start_us_2026_midterms.py's own helpers directly (fetch_candidates,
normalize_candidate_name, psql_scalar/psql_run, STATE_FIPS, etc.) rather than
re-implementing FEC-querying or SQL-building — see docs/US_MIDTERM_CANDIDATE_
REFRESH.md for the full writeup of why this needed a second script instead of
extending the first one in place.

Only ever touches candidate rows this pipeline itself added
(added_by_election_admin_id = ADMIN_PROFILE_ID) — never an officeholder-linked
row, a self-registered politician's own application, or anything an admin
added by hand through the UI. A seat losing its last dropped-out candidate is
left as an empty seat (not deleted) — matches how a real seat can legitimately
have zero declared candidates early in a cycle.

Usage:
  python3 scripts/refresh_us_2026_candidates.py run --office H|S|both --cycle 2026 [--states CA,TX,...]

Requires DATABASE_URL and FEC_API_KEY, same as start_us_2026_midterms.py.
"""

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from start_us_2026_midterms import (  # noqa: E402
    ADMIN_PROFILE_ID,
    ELECTION_NAME,
    REQUEST_DELAY_SECONDS,
    STATE_FIPS,
    build_seat_and_candidates_sql,
    fetch_candidates,
    log,
    normalize_candidate_name,
    psql_run,
    psql_scalar,
    sql_str,
)


def get_election_id(db_url):
    out = psql_scalar(db_url, f"SELECT id FROM public.elections WHERE name = {sql_str(ELECTION_NAME)};")
    if not out:
        raise RuntimeError(f"'{ELECTION_NAME}' does not exist yet -- run start_us_2026_midterms.py first.")
    return out


def remove_dropped_out(db_url, seat_id, current_names_lower):
    """
    Deletes any election_candidates row on this seat that (a) this pipeline
    added (added_by_election_admin_id = ADMIN_PROFILE_ID) and (b) whose
    profile name is no longer in the fresh FEC active-candidate list for this
    seat. Returns the list of removed names (for logging -- this is the
    actual "who dropped out" answer).
    """
    rows = psql_scalar(
        db_url,
        f"""
        SELECT p.id || '|' || p.full_name
        FROM public.election_candidates ec
        JOIN public.profiles p ON p.id = ec.politician_id
        WHERE ec.seat_id = {sql_str(seat_id)}
          AND ec.added_by_election_admin_id = {sql_str(ADMIN_PROFILE_ID)};
        """,
    ).splitlines()
    dropped = []
    for row in rows:
        if not row:
            continue
        pid, name = row.split("|", 1)
        if name.strip().lower() not in current_names_lower:
            dropped.append(name)
            # remove_candidate()'s own logic, run directly since this is a
            # bulk service-role script, not an authenticated admin session --
            # same DELETE that RPC performs after its permission check.
            psql_run(db_url, f"DELETE FROM public.election_candidates WHERE seat_id = {sql_str(seat_id)} AND politician_id = {sql_str(pid)};")
    return dropped


def run_office(db_url, api_key, election_id, office, cycle, states=None):
    role_title = "U.S. Representative" if office == "H" else "U.S. Senator"
    boundary_type = "Federal" if office == "H" else "State"

    if office == "H":
        rows = psql_scalar(
            db_url,
            """
            SELECT id || '|' || (properties->>'statefp') || '|' || code
            FROM public.map_shapes
            WHERE country='USA' AND boundary_type='Federal' AND retired_at IS NULL
              AND properties->>'statefp' NOT IN ('11','60','66','69','72','78')
            ORDER BY code;
            """,
        ).splitlines()
        shapes = [tuple(r.split("|")) for r in rows if r]
        if states:
            shapes = [s for s in shapes if STATE_FIPS.get(s[1]) in states]
    else:
        rows = psql_scalar(
            db_url,
            "SELECT id, code FROM public.map_shapes WHERE country='USA' AND boundary_type='State' AND retired_at IS NULL ORDER BY code;",
        ).splitlines()
        shapes = [tuple(r.split("|")) for r in rows if r]
        if states:
            shapes = [s for s in shapes if s[1] in states]

    log(f"Refreshing {len(shapes)} {role_title} seat(s) for cycle {cycle}...")
    added, dropped_total, checked = 0, 0, 0
    all_dropped = []
    for shape in shapes:
        time.sleep(REQUEST_DELAY_SECONDS)
        try:
            if office == "H":
                map_shape_id, statefp, geoid = shape
                state = STATE_FIPS.get(statefp)
                if not state:
                    continue
                district = geoid[-2:]
                cands = fetch_candidates(api_key, cycle=cycle, office="H", state=state, district=district)
                label = f"{state}-{district}"
            else:
                map_shape_id, state = shape
                cands = fetch_candidates(api_key, cycle=cycle, office="S", state=state)
                label = state

            current_names = [normalize_candidate_name(c["name"]) for c in cands]
            current_names_lower = {n.strip().lower() for n in current_names}

            seat_id = psql_scalar(
                db_url,
                f"SELECT id FROM public.election_seats WHERE election_id = {sql_str(election_id)} AND map_shape_id = {map_shape_id} AND role_title = {sql_str(role_title)};",
            )
            checked += 1

            if not seat_id:
                # No seat yet (this district/state never had an active
                # candidate before) -- create it now if it does today, same
                # as the original script's behavior.
                if not cands:
                    continue
                pairs = [(normalize_candidate_name(c["name"]), c.get("party_full")) for c in cands]
                sql = build_seat_and_candidates_sql(db_url, election_id, map_shape_id, role_title, pairs, "")
                psql_run(db_url, sql)
                added += len(pairs)
                log(f"  {label}: NEW seat, {len(pairs)} candidate(s)")
                continue

            # Existing seat: add anyone new, remove anyone no longer active.
            existing_names = set(
                n.strip().lower()
                for n in psql_scalar(
                    db_url,
                    f"""
                    SELECT p.full_name FROM public.election_candidates ec
                    JOIN public.profiles p ON p.id = ec.politician_id
                    WHERE ec.seat_id = {sql_str(seat_id)};
                    """,
                ).splitlines()
                if n
            )
            new_pairs = [
                (normalize_candidate_name(c["name"]), c.get("party_full"))
                for c in cands
                if normalize_candidate_name(c["name"]).strip().lower() not in existing_names
            ]
            if new_pairs:
                sql = build_seat_and_candidates_sql(db_url, election_id, map_shape_id, role_title, new_pairs, "")
                psql_run(db_url, sql)
                added += len(new_pairs)

            dropped = remove_dropped_out(db_url, seat_id, current_names_lower)
            if dropped:
                dropped_total += len(dropped)
                all_dropped.extend(f"{label}: {n}" for n in dropped)

            if new_pairs or dropped:
                log(f"  {label}: +{len(new_pairs)} new, -{len(dropped)} dropped out")
        except Exception as e:
            log(f"  {shape}: FAILED ({e})")
            continue

    log(f"{role_title} refresh done. {checked} seat(s) checked, {added} candidate(s) added, {dropped_total} dropped out.")
    if all_dropped:
        log("Dropped out:")
        for line in all_dropped:
            log(f"  - {line}")
    return added, dropped_total, all_dropped


def cmd_run(args):
    db_url, api_key = args.db_url, args.api_key
    states = {s.strip().upper() for s in args.states.split(",")} if args.states else None
    election_id = get_election_id(db_url)
    log(f"Election row: {election_id} ({ELECTION_NAME})")

    offices = ["H", "S"] if args.office == "both" else [args.office]
    total_added, total_dropped, all_dropped = 0, 0, []
    for office in offices:
        a, d, dropped_list = run_office(db_url, api_key, election_id, office, args.cycle, states=states)
        total_added += a
        total_dropped += d
        all_dropped.extend(dropped_list)

    log("=" * 60)
    log(f"TOTAL: {total_added} candidate(s) added, {total_dropped} dropped out.")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    p.add_argument("--api-key", default=os.environ.get("FEC_API_KEY", "DEMO_KEY"))
    sub = p.add_subparsers(dest="command", required=True)

    r = sub.add_parser("run", help="Refresh candidate rolls: add new filers, remove dropped-out ones")
    r.add_argument("--cycle", type=int, default=2026)
    r.add_argument("--office", choices=["H", "S", "both"], default="both")
    r.add_argument("--states", default=None, help="Comma-separated USPS state codes to restrict this run to.")
    r.set_defaults(func=cmd_run)

    args = p.parse_args()
    if not args.db_url:
        sys.exit("No database URL. Pass --db-url or set DATABASE_URL.")
    args.func(args)


if __name__ == "__main__":
    main()
