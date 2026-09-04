#!/usr/bin/env python3
"""
python3 add_missing.py <missing_module.py> <seat_ids.txt> <out.sql>

missing_module.py must define:
  MISSING = {district_int: [(full_name, "Party Name As In political_parties.name"), ...]}
  NEW_PARTIES = ["Party Name", ...]   # optional -- parties not yet in political_parties(country='USA')

seat_ids.txt: pipe-delimited `code|seat_id` lines (code's last 2 chars are the district;
  for at-large states, seat_ids.txt has a single row and MISSING should use key 0)
"""
import sys, importlib.util

ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"

truth_path, seatids_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
spec = importlib.util.spec_from_file_location("truth", truth_path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
MISSING = mod.MISSING
NEW_PARTIES = getattr(mod, "NEW_PARTIES", [])

seat_by_district = {}
with open(seatids_path) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        code, seat_id = line.split("|")
        d = int(code[-2:])
        seat_by_district[d] = seat_id

def sql_str(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"

sql = ["BEGIN;"]

if NEW_PARTIES:
    values = ",\n".join(f"('USA', {sql_str(n)})" for n in NEW_PARTIES)
    sql.append(
        "INSERT INTO public.political_parties (country, name)\n"
        f"SELECT v.country, v.name FROM (VALUES {values}) AS v(country, name)\n"
        "WHERE NOT EXISTS (SELECT 1 FROM public.political_parties p WHERE p.country=v.country AND p.name=v.name);"
    )

rows = []
for d, entries in MISSING.items():
    seat_id = seat_by_district.get(d)
    if not seat_id:
        print(f"WARNING: no seat_id found for district {d}, skipping {entries}", file=sys.stderr)
        continue
    for name, party in entries:
        rows.append((seat_id, name, party))

if not rows:
    print("Nothing to add.")
    sys.exit(0)

sql.append("CREATE TEMP TABLE new_stub (seat_id uuid, name text, party_name text, stub_id uuid) ON COMMIT DROP;")
values = []
for seat_id, name, party in rows:
    values.append(f"({sql_str(seat_id)},{sql_str(name)},{sql_str(party)},gen_random_uuid())")
sql.append("INSERT INTO new_stub (seat_id, name, party_name, stub_id) VALUES " + ",\n".join(values) + ";")

sql.append(
    "INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) "
    "SELECT stub_id, 'politician', name, true, 'USA', gen_random_uuid() FROM new_stub;"
)
sql.append(
    "INSERT INTO public.politician_profiles (id, political_party_id) "
    "SELECT ns.stub_id, pp.id FROM new_stub ns "
    "LEFT JOIN public.political_parties pp ON pp.country='USA' AND pp.name = ns.party_name;"
)
sql.append(
    f"INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) "
    f"SELECT seat_id, stub_id, 'approved', now(), {sql_str(ADMIN_ID)} FROM new_stub;"
)
sql.append("COMMIT;")

with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")

print(f"Adding {len(rows)} candidates:")
for seat_id, name, party in rows:
    print(f"  ADD {name} ({party})")
print(f"\nSQL written to {out_path}")
