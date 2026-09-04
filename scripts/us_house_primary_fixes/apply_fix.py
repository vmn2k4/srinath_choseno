#!/usr/bin/env python3
"""
python3 apply_fix.py <truth_module.py> <db_export.txt> <out.sql>

truth_module.py must define:
  NOMINEES = {district_int: [(full_name, "Democratic"|"Republican"|...), ...]}
  FORCE_DELETE = {district_int: {full_name_in_db, ...}}   # optional, for name collisions

db_export.txt: pipe-delimited `code|seat_id|full_name|candidate_id` lines
  (code's last 2 chars are parsed as the district number).
"""
import sys
import importlib.util
import unicodedata

ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"
PARTY_IDS = {"Democratic": 8, "Republican": 9, "Independent": None, "Libertarian": None, "Green": None}


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def norm_last(full_name):
    parts = full_name.replace(",", " ").replace(".", " ").split()
    return strip_accents(parts[-1].lower()) if parts else ""


def matches(last, token):
    a, b = strip_accents(last.lower()), strip_accents(token.lower())
    return a == b or a in b or b in a


def sql_str(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"


truth_path, db_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
spec = importlib.util.spec_from_file_location("truth", truth_path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
NOMINEES = mod.NOMINEES
FORCE_DELETE = getattr(mod, "FORCE_DELETE", {})

rows = []
with open(db_path) as f:
    for line in f:
        line = line.strip()
        if line:
            rows.append(tuple(line.split("|")))

by_district = {}
for code, seat_id, name, cand_id in rows:
    d = int(code[-2:])
    by_district.setdefault(d, []).append((seat_id, name, cand_id))

deletes = []
matched_tokens = {}
seat_id_by_district = {}
for d, entries in by_district.items():
    seat_id_by_district[d] = entries[0][0]
    truth = NOMINEES.get(d)
    if truth is None:
        continue
    matched_tokens[d] = set()
    forced = FORCE_DELETE.get(d, set())
    for seat_id, name, cand_id in entries:
        last = norm_last(name)
        hit = None
        for full_name, party in truth:
            tok = norm_last(full_name)
            if matches(last, tok):
                hit = tok
                break
        if hit and name not in forced:
            matched_tokens[d].add(hit)
        else:
            deletes.append((cand_id, d, name))

missing = []  # (seat_id, full_name, party)
for d, truth in NOMINEES.items():
    seat_id = seat_id_by_district.get(d)
    if not seat_id:
        continue
    got = matched_tokens.get(d, set())
    for full_name, party in truth:
        tok = norm_last(full_name)
        if tok not in got:
            missing.append((seat_id, full_name, party))

sql = ["BEGIN;"]
if deletes:
    ids = ",".join(f"'{c}'" for c, _, _ in deletes)
    sql.append(f"DELETE FROM public.election_candidates WHERE id IN ({ids});")

if missing:
    sql.append("CREATE TEMP TABLE new_stub (seat_id uuid, name text, party_id bigint, stub_id uuid) ON COMMIT DROP;")
    values = []
    for seat_id, name, party in missing:
        pid = PARTY_IDS.get(party)
        values.append(f"({sql_str(seat_id)},{sql_str(name)},{sql_str(pid)},gen_random_uuid())")
    sql.append("INSERT INTO new_stub (seat_id, name, party_id, stub_id) VALUES " + ",\n".join(values) + ";")
    sql.append(
        "INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) "
        "SELECT stub_id, 'politician', name, true, 'USA', gen_random_uuid() FROM new_stub;"
    )
    sql.append("INSERT INTO public.politician_profiles (id, political_party_id) SELECT stub_id, party_id FROM new_stub;")
    sql.append(
        f"INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) "
        f"SELECT seat_id, stub_id, 'approved', now(), {sql_str(ADMIN_ID)} FROM new_stub;"
    )
sql.append("COMMIT;")

with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")

print(f"Deletes: {len(deletes)}")
for c, d, n in deletes:
    print(f"  DEL D{d} {n}")
print(f"Missing: {len(missing)}")
for seat_id, name, party in missing:
    print(f"  ADD {name} ({party})")
print(f"\nSQL written to {out_path}")
