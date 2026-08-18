#!/usr/bin/env python3
"""
Starts the "2026 US Midterm Elections" race in Choseno and populates it with
every currently-active FEC-filed candidate for US House (all 435 apportioned
districts) and US Senate (whichever states actually have a 2026 Class II /
special-election Senate race -- determined live from the FEC, not hardcoded).

This is the real, user-facing election feature (elections / election_seats /
election_candidates -- see docs/adding-india-politicians.md's sibling doc,
CLAUDE.md's layered-architecture doc, and supabase/migrations/20260724000000_
election_mode.sql), NOT the read-only us_federal_election_candidates cache
that scripts/sync_us_federal_candidates.py fills. Adding a candidate here
mirrors exactly what the add_unregistered_candidate() RPC does (see
supabase/migrations/20260802000002_unregistered_candidate_avatar.sql): a real
stub politician profile + Ghost Wall gets created and becomes publicly
visible, so this is admin-add-a-real-candidate, not a cache refresh.

"Confirmed candidate" here means "has an active FEC filing" (candidate_status
== 'C'), per user direction -- this is who's actually running right now, not
necessarily a decided primary winner in states whose primary hasn't happened
yet (in an undecided primary you may see multiple same-party candidates for
one seat).

A race (election_seat) is only created for a district/state that actually has
at least one active candidate -- no empty placeholder seats.

Idempotent / resumable: every INSERT is a real upsert or guarded by an
existence check, so re-running after an interruption just fills in what's
missing (see "seat upsert via ON CONFLICT ... RETURNING" and the per-candidate
NOT EXISTS check below).

Usage:
  python3 scripts/start_us_2026_midterms.py run --office H
  python3 scripts/start_us_2026_midterms.py run --office S
  python3 scripts/start_us_2026_midterms.py run --office both   # default

Requires DATABASE_URL (or --db-url) and FEC_API_KEY (or --api-key; DEMO_KEY
works but is capped at ~30 req/hour -- fine for a couple of districts, not
for a 435-district run). Requires only the Python standard library + `psql`
on PATH, matching scripts/sync_us_federal_candidates.py's convention.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

USER_AGENT = "Mozilla/5.0 (compatible; ChosenoMidtermStart/1.0)"
API_BASE = "https://api.open.fec.gov/v1/candidates/"
REQUEST_DELAY_SECONDS = 0.3

ELECTION_NAME = "2026 US Midterm Elections"
ELECTION_DATE = "2026-11-03"
# profiles.id for the admin account these bulk-added stub candidacies are
# attributed to (role='admin', matches how a human admin using the "Fetch
# candidates" -> "Add" button in ElectionsAdminClient.tsx would be recorded).
ADMIN_PROFILE_ID = "5b66563e-2674-4fed-b733-3e19955a166a"

STATE_FIPS = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
    "09": "CT", "10": "DE", "12": "FL", "13": "GA", "15": "HI",
    "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
    "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
    "54": "WV", "55": "WI", "56": "WY",
}
# DC + territories deliberately excluded -- office_holders only models
# 'U.S. Representative' for the 435 apportioned voting seats (confirmed live:
# zero office_holders rows with that role_key in DC/AS/GU/MP/PR/VI), so
# election_seats follows the same convention for consistency.

PARTY_NAME_OVERRIDES = {
    "DEMOCRATIC PARTY": "Democratic Party",
    "REPUBLICAN PARTY": "Republican Party",
    "LIBERTARIAN PARTY": "Libertarian Party",
    "GREEN PARTY": "Green Party",
    "INDEPENDENT": "Independent",
}
PARTY_NAME_SKIP = {"", "NONE", "UNKNOWN", "N/A", "UNAFFILIATED", "NON-PARTISAN", "NONPARTISAN"}


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_candidates(api_key, *, cycle, office, state=None, district=None):
    results, page = [], 1
    while True:
        params = {"api_key": api_key, "cycle": cycle, "office": office, "per_page": 100, "page": page}
        if state:
            params["state"] = state
        if district:
            params["district"] = district
        url = API_BASE + "?" + urllib.parse.urlencode(params)
        for attempt in range(5):
            try:
                data = fetch_json(url)
                break
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < 4:
                    log(f"  rate limited, sleeping 30s...")
                    time.sleep(30)
                    continue
                raise
            except (TimeoutError, urllib.error.URLError, ConnectionError) as e:
                if attempt < 4:
                    log(f"  network error ({e}), retrying in 5s...")
                    time.sleep(5)
                    continue
                raise
        results.extend(data["results"])
        if page >= data["pagination"]["pages"]:
            break
        page += 1
        time.sleep(REQUEST_DELAY_SECONDS)
    # candidate_status == 'C' alone is NOT enough -- confirmed live against
    # the real API that `cycle` is just a 2-year *filing-activity* window, not
    # "on the ballot this year": e.g. querying cycle=2026 for NY/CA/WA Senate
    # returns "active" (status C) candidates whose real election_years is
    # [2028] or earlier -- their committee is active during the 2025-2026
    # reporting period, but they are not actually running in 2026. Every
    # affected state incorrectly produced a "Senate race" out of pure filing
    # noise (50/50 states came back with >=1 result before this fix; only
    # ~33 have a real Class II or special 2026 Senate election). Must also
    # require the target cycle to actually be in the candidate's own
    # election_years.
    return [c for c in results if c.get("candidate_status") == "C" and cycle in (c.get("election_years") or [])]


def source_url(cycle, office, state=None, district=None):
    params = {"cycle": cycle, "office": office}
    if state:
        params["state"] = state
    if district:
        params["district"] = district
    return "https://www.fec.gov/data/candidates/?" + urllib.parse.urlencode(params)


def psql_run(db_url, sql):
    """Runs a (possibly multi-statement, \\gset/DO-block-using) script."""
    cmd = ["psql", db_url, "-v", "ON_ERROR_STOP=1", "-q"]
    result = subprocess.run(cmd, input=sql, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"psql failed:\n{result.stderr.strip()}\n--- sql ---\n{sql}")
    return result.stdout


def psql_scalar(db_url, sql):
    cmd = ["psql", db_url, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-q"]
    result = subprocess.run(cmd, input=sql, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"psql failed:\n{result.stderr.strip()}\n--- sql ---\n{sql}")
    return result.stdout.strip()


def sql_str(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def normalize_candidate_name(raw):
    """
    FEC candidate names come back as "LAST, FIRST MIDDLE" in all caps (e.g.
    "CRABTREE, CASEY" -- confirmed live via the admin UI's "Fetch candidates"
    against a real district). That's fine for the raw source data but reads
    badly on a public Ghost Wall profile, so reformat to "First Middle Last".
    Not perfect for suffixes (JR/III end up mid-name, e.g. "SMITH, JOHN JR"
    -> "John Jr Smith") or multi-word surnames with a mid-name comma -- an
    acceptable trade-off for a bulk import; the existing admin UI doesn't
    reformat at all, so this is already strictly better, not worse.
    """
    if not raw:
        return raw
    name = raw.strip()
    if "," not in name:
        return name.title()
    last, _, first = name.partition(",")
    return f"{first.strip()} {last.strip()}".strip().title()


def canonical_party_name(raw):
    if not raw:
        return None
    n = raw.strip()
    if n.upper() in PARTY_NAME_SKIP:
        return None
    if n.upper() in PARTY_NAME_OVERRIDES:
        return PARTY_NAME_OVERRIDES[n.upper()]
    return n.title()


def get_or_create_election(db_url):
    # elections.name has no UNIQUE constraint (confirmed against the real
    # schema), so "ON CONFLICT DO NOTHING" would silently insert a duplicate
    # row rather than catch anything -- use an explicit existence check
    # instead. Also handles the case where this election already exists as
    # 'draft' (e.g. created by hand through the admin UI, which always
    # starts a new election as 'draft' -- confirmed live) by advancing it,
    # same as clicking "Open Nominations" would; never downgrades an
    # election that's already further along (active/closed).
    psql_run(
        db_url,
        f"""
        INSERT INTO public.elections (name, election_date, status)
        SELECT {sql_str(ELECTION_NAME)}, {sql_str(ELECTION_DATE)}, 'nominations_open'
        WHERE NOT EXISTS (SELECT 1 FROM public.elections WHERE name = {sql_str(ELECTION_NAME)});

        UPDATE public.elections SET status = 'nominations_open'
        WHERE name = {sql_str(ELECTION_NAME)} AND status = 'draft';
        """,
    )
    out = psql_scalar(db_url, f"SELECT id FROM public.elections WHERE name = {sql_str(ELECTION_NAME)};")
    if not out:
        raise RuntimeError("Could not create or find the election row.")
    return out


def find_existing_officeholder_profile(db_url, map_shape_id, name):
    """
    Look for a profile already linked (via office_holders.linked_profile_id)
    to the CURRENT officeholder for this exact seat's map_shape_id, matching
    by name. If one exists, the new election_candidates row must point at
    THIS profile instead of minting a fresh stub -- otherwise a sitting
    officeholder who's also running for their own seat this cycle ends up
    with two independent, unlinked profiles (one from the officeholder
    import, one freshly created here).
    This is not a hypothetical: it happened for ~180 real candidates across
    an earlier run of this script before this check existed. See
    supabase/migrations/20260818000005_merge_officeholder_candidate_
    duplicate_profiles.sql for the one-time cleanup and its comment for the
    full root-cause writeup.
    """
    result = psql_scalar(
        db_url,
        f"""
        SELECT p.id FROM public.office_holders oh
        JOIN public.profiles p ON p.id = oh.linked_profile_id
        WHERE oh.map_shape_id = {map_shape_id} AND lower(p.full_name) = lower({sql_str(name)})
        LIMIT 1;
        """,
    )
    return result or None


def build_seat_and_candidates_sql(db_url, election_id, map_shape_id, role_title, candidates_with_party, source_url_val):
    """
    candidates_with_party: list of (candidate_name, party_name_or_None)
    Returns one multi-statement psql script that:
      1. Upserts the election_seat, \\gset's its id.
      2. For each candidate: if find_existing_officeholder_profile() finds a
         sitting officeholder for this seat with the same name, links the
         election_candidates row straight to THAT existing profile (no new
         profiles/politician_profiles rows at all). Otherwise, upserts the
         candidate's party (if any) and inserts a stub profile +
         politician_profiles + election_candidates row, each individually
         guarded by a "WHERE NOT EXISTS" so re-runs don't duplicate.
         (Deliberately no DO $$ ... $$ blocks here -- psql's \\gset/:'var'
         interpolation does not reach inside dollar-quoted bodies, confirmed
         the hard way against the real DB; the stub id is instead generated
         client-side in Python and inlined as a literal, so no server-side
         variable needs to cross that boundary at all.)
    """
    parts = [
        f"""
        INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
        VALUES ({sql_str(election_id)}, {map_shape_id}, {sql_str(role_title)})
        ON CONFLICT (election_id, map_shape_id, role_title) DO UPDATE SET role_title = EXCLUDED.role_title
        RETURNING id AS seat_id \\gset
        """
    ]
    for i, (name, party) in enumerate(candidates_with_party):
        not_exists_clause = f"""
                NOT EXISTS (
                  SELECT 1 FROM public.election_candidates ec
                  JOIN public.profiles p ON p.id = ec.politician_id
                  WHERE ec.seat_id = :'seat_id' AND lower(p.full_name) = lower({sql_str(name)})
                )"""

        existing_profile_id = find_existing_officeholder_profile(db_url, map_shape_id, name)
        if existing_profile_id:
            # Sitting officeholder running for their own seat -- link to
            # their existing profile instead of minting a second one.
            parts.append(
                f"""
                INSERT INTO public.election_candidates
                    (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
                SELECT :'seat_id', {sql_str(existing_profile_id)}, 'approved', now(), {sql_str(ADMIN_PROFILE_ID)}
                WHERE {not_exists_clause};
                """
            )
            continue

        canon = canonical_party_name(party)
        party_gset = f"party_id_{i}"
        if canon:
            parts.append(
                f"""
                INSERT INTO public.political_parties (country, name)
                VALUES ('USA', {sql_str(canon)})
                ON CONFLICT (country, name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id AS {party_gset} \\gset
                """
            )
            party_ref = f":{party_gset}"
        else:
            party_ref = "NULL"
        stub_id = str(uuid.uuid4())
        bio = None if canon else (f"Party (from FEC): {party}" if party else None)
        parts.append(
            f"""
            INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
            SELECT {sql_str(stub_id)}, 'politician', {sql_str(name)}, true, 'USA', gen_random_uuid()
            WHERE {not_exists_clause};

            INSERT INTO public.politician_profiles (id, political_party_id, bio)
            SELECT {sql_str(stub_id)}, {party_ref}, {sql_str(bio)}
            WHERE {not_exists_clause};

            INSERT INTO public.election_candidates
                (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
            SELECT :'seat_id', {sql_str(stub_id)}, 'approved', now(), {sql_str(ADMIN_PROFILE_ID)}
            WHERE {not_exists_clause};
            """
        )
    return "\n".join(parts)


def run_office(db_url, api_key, election_id, office, cycle, states=None):
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
        log(f"Checking {len(shapes)} US House district(s) for cycle {cycle}"
            f"{' (states: ' + ','.join(sorted(states)) + ')' if states else ''}...")
        seats_created, candidates_added, skipped = 0, 0, 0
        failed = []
        for map_shape_id, statefp, geoid in shapes:
            state = STATE_FIPS.get(statefp)
            if not state:
                skipped += 1
                continue
            district = geoid[-2:]
            time.sleep(REQUEST_DELAY_SECONDS)
            try:
                cands = fetch_candidates(api_key, cycle=cycle, office="H", state=state, district=district)
                if not cands:
                    continue
                pairs = [(normalize_candidate_name(c["name"]), c.get("party_full")) for c in cands]
                sql = build_seat_and_candidates_sql(
                    db_url, election_id, map_shape_id, "U.S. Representative", pairs,
                    source_url(cycle, "H", state=state, district=district),
                )
                psql_run(db_url, sql)
            except Exception as e:
                log(f"  {state}-{district}: FAILED ({e}) -- will need a re-run to pick this one up")
                failed.append(f"{state}-{district}")
                continue
            seats_created += 1
            candidates_added += len(pairs)
            log(f"  {state}-{district}: {len(pairs)} candidate(s)")
        log(f"House done. {seats_created} race(s) started, {candidates_added} candidate row(s) processed "
            f"({skipped} shape(s) skipped -- unrecognized FIPS).")
        if failed:
            log(f"House districts that FAILED and need a re-run: {', '.join(failed)}")
        return seats_created, candidates_added

    if office == "S":
        rows = psql_scalar(
            db_url,
            "SELECT id, code FROM public.map_shapes WHERE country='USA' AND boundary_type='State' AND retired_at IS NULL ORDER BY code;",
        ).splitlines()
        shapes = [tuple(r.split("|")) for r in rows if r]
        if states:
            shapes = [s for s in shapes if s[1] in states]
        log(f"Checking {len(shapes)} US state(s) for a 2026 Senate race"
            f"{' (states: ' + ','.join(sorted(states)) + ')' if states else ''}...")
        seats_created, candidates_added = 0, 0
        failed = []
        for map_shape_id, state in shapes:
            time.sleep(REQUEST_DELAY_SECONDS)
            try:
                cands = fetch_candidates(api_key, cycle=cycle, office="S", state=state)
                if not cands:
                    continue
                pairs = [(normalize_candidate_name(c["name"]), c.get("party_full")) for c in cands]
                sql = build_seat_and_candidates_sql(
                    db_url, election_id, map_shape_id, "U.S. Senator", pairs, source_url(cycle, "S", state=state),
                )
                psql_run(db_url, sql)
            except Exception as e:
                log(f"  {state}: FAILED ({e}) -- will need a re-run to pick this one up")
                failed.append(state)
                continue
            seats_created += 1
            candidates_added += len(pairs)
            log(f"  {state}: {len(pairs)} candidate(s)")
        log(f"Senate done. {seats_created} race(s) started, {candidates_added} candidate row(s) processed.")
        if failed:
            log(f"Senate states that FAILED and need a re-run: {', '.join(failed)}")
        return seats_created, candidates_added

    raise ValueError(office)


def cmd_run(args):
    db_url, api_key = args.db_url, args.api_key
    states = {s.strip().upper() for s in args.states.split(",")} if args.states else None
    before_parties = set(
        psql_scalar(db_url, "SELECT name FROM public.political_parties WHERE country='USA';").splitlines()
    )

    election_id = get_or_create_election(db_url)
    log(f"Election row: {election_id} ({ELECTION_NAME})")

    total_seats, total_candidates = 0, 0
    offices = ["H", "S"] if args.office == "both" else [args.office]
    for office in offices:
        s, c = run_office(db_url, api_key, election_id, office, args.cycle, states=states)
        total_seats += s
        total_candidates += c

    after_parties = set(
        psql_scalar(db_url, "SELECT name FROM public.political_parties WHERE country='USA';").splitlines()
    )
    new_parties = sorted(after_parties - before_parties)

    log("=" * 60)
    log(f"TOTAL: {total_seats} race(s) started, {total_candidates} candidate row(s) processed.")
    if new_parties:
        log(f"New US political parties added: {', '.join(new_parties)}")
    else:
        log("No new US political parties -- all matched existing rows.")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    p.add_argument("--api-key", default=os.environ.get("FEC_API_KEY", "DEMO_KEY"))
    sub = p.add_subparsers(dest="command", required=True)

    r = sub.add_parser("run", help="Start the election (if needed) and sync races + candidates")
    r.add_argument("--cycle", type=int, default=2026)
    r.add_argument("--office", choices=["H", "S", "both"], default="both")
    r.add_argument("--states", default=None,
                    help="Comma-separated USPS state codes to restrict this run to (for sharding "
                         "into parallel processes, e.g. --states AL,AK,AZ,AR). Default: all states.")
    r.set_defaults(func=cmd_run)

    args = p.parse_args()
    if not args.db_url:
        sys.exit("No database URL. Pass --db-url or set DATABASE_URL.")
    args.func(args)


if __name__ == "__main__":
    main()
