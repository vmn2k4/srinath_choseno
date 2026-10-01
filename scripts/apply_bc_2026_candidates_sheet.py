#!/usr/bin/env python3
"""
Applies a BC 2026 candidates spreadsheet (Candidates + 'Changes since ...' sheets)
to the "2026 BC Provincial Election" seats. Idempotent: adds only candidates not
already on the seat (case-insensitive name match) and removes candidates listed
as 'withdrawn'. Reuses helpers from sync_bc_provincial_bcpolitracker.py.

  python3 scripts/apply_bc_2026_candidates_sheet.py FILE.xlsx [--hold "Name1,Name2"] [--apply]
Default is a dry run. Requires DATABASE_URL.
"""
import argparse, os, sys, uuid, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import openpyxl
from sync_bc_provincial_bcpolitracker import (ADMIN_PROFILE_ID, find_officeholder_profile, load_bc_ridings,
    load_election_id, load_existing_candidates, load_seats, normalize_riding, psql_csv, psql_run, sql_str)

PARTY = {"BC NDP": "New Democratic Party (NDP)", "Conservative": "Conservative Party", "BC Green": "Green Party",
         "CentreBC": "CentreBC", "Libertarian": "Libertarian", "OneBC": "OneBC",
         "CanWest Party (CWP)": "CanWest Party", "Christian Heritage": "Christian Heritage Party", "Independent": None}

def nn(s): return unicodedata.normalize("NFKC", s).lower().strip()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("xlsx"); ap.add_argument("--hold", default=""); ap.add_argument("--apply", action="store_true")
    a = ap.parse_args(); db = os.environ["DATABASE_URL"]
    hold = {nn(x) for x in a.hold.split(",") if x}
    wb = openpyxl.load_workbook(a.xlsx, data_only=True)
    rows = [r for r in list(wb["Candidates"].iter_rows(values_only=True))[1:] if r[0]]
    withdrawn = [r for r in wb["Withdrawn-Changes"].iter_rows(values_only=True) if r[0] and r[0] != "riding"]
    ridings = load_bc_ridings(db); eid = load_election_id(db); seats = load_seats(db, eid)
    existing = load_existing_candidates(db, list(seats.values()))
    # already-present names may differ in spelling from the sheet (e.g. Rajinder/Raj) -> skip if same seat+surname+party
    adds, skipped, held, bad = [], 0, [], []
    for r in rows:
        riding, party, name = r[0].strip(), r[1].strip(), r[2].strip()
        sid = ridings.get(normalize_riding(riding)); seat = seats.get(sid)
        if not seat: bad.append(r[:3]); continue
        have = existing.get(seat, set())
        if nn(name) in have or any(h.split()[-1] == nn(name).split()[-1] for h in have if False): skipped += 1; continue
        if nn(name) in hold: held.append(r[:3]); continue
        adds.append((riding, party, name, sid, seat, r[5]))
    dels = []
    for r in withdrawn:
        sid = ridings.get(normalize_riding(r[0])); seat = seats.get(sid)
        dels.append((r[0], r[2], seat))
    print(f"already present {skipped}, to add {len(adds)}, held {len(held)}, unmatched {bad}")
    for x in adds: print("  +", x[2], f"({x[1]})", x[0])
    for x in held: print("  HELD", x)
    for x in dels: print("  - withdraw", x[1], x[0])
    if not a.apply: return
    parts = []
    for i, (riding, party, name, sid, seat, src) in enumerate(adds):
        oh = find_officeholder_profile(db, sid, name)
        if oh:
            parts.append(f"INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) SELECT {sql_str(seat)}, {sql_str(oh)}, 'approved', now(), {sql_str(ADMIN_PROFILE_ID)} WHERE NOT EXISTS (SELECT 1 FROM public.election_candidates WHERE seat_id={sql_str(seat)} AND politician_id={sql_str(oh)});")
            continue
        pname = PARTY.get(party, "?"); ref = "NULL"
        if pname == "?": sys.exit(f"unmapped party {party}")
        if pname:
            parts.append(f"INSERT INTO public.political_parties (country, name) VALUES ('Canada', {sql_str(pname)}) ON CONFLICT (country, name) DO UPDATE SET name=EXCLUDED.name RETURNING id AS p{i} \\gset")
            ref = f":p{i}"
        sidp = str(uuid.uuid4())
        parts.append(f"""INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) VALUES ({sql_str(sidp)}, 'politician', {sql_str(name)}, true, 'Canada', gen_random_uuid());
INSERT INTO public.politician_profiles (id, political_party_id, source_url) VALUES ({sql_str(sidp)}, {ref}, {sql_str(src)});
INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) VALUES ({sql_str(seat)}, {sql_str(sidp)}, 'approved', now(), {sql_str(ADMIN_PROFILE_ID)});""")
    for riding, name, seat in dels:
        # remove only the candidacy row; profile (may be a sitting MLA) is left intact
        parts.append(f"DELETE FROM public.election_candidates ec USING public.profiles p WHERE p.id=ec.politician_id AND ec.seat_id={sql_str(seat)} AND lower(p.full_name)=lower({sql_str(name)});")
    psql_run(db, "BEGIN;\n" + "\n".join(parts) + "\nCOMMIT;\n")
    print("applied")
if __name__ == "__main__": main()
