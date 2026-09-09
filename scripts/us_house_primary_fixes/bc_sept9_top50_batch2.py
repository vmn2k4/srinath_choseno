#!/usr/bin/env python3
"""Top-50-BC-municipalities sweep, 2026-09-09 continued: Delta and Mission,
both with live official candidate pages. Also fixes 2 more duplicate-profile
bugs of the same shape as Rob Stutt/Kristin Schnider: Jag Gill (Mission
Mayor) and Linda Hamel (SD75 Trustee) were both minted as fresh stubs in
an earlier LECFA-wide pass without a per-city officeholder-dedup check."""
ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"

# duplicate fixes: (stub_profile_id, real_profile_id)
DUP_FIXES = [
    ("e809dee6-50d8-4a8a-8e92-87ab181b9ccf", "81bb5778-046a-4e5d-a270-db99d683ea0d"),  # Jag Gill
    ("18e6bfdc-c7b2-4fbe-8e43-7e968a5c7138", "432df643-7375-4e86-805b-e2b923fce93c"),  # Linda Hamel
]

DELTA_MAYOR = "9b448b3e-5a7f-4516-b1b0-51a490a3fc94"
DELTA_CLLR = "ee50d01e-c2ca-4753-b14b-4acc3c217c79"
MISSION_CLLR = "0cba1bcd-2059-436d-a115-1886b1a71314"
SD75_MISSION = "86f4d538-0ccc-4782-9b60-6e99ad955329"

STUB = [
    # Delta
    (DELTA_MAYOR, "Melissa Granum", "Delta First"),
    (DELTA_CLLR, "Jat Puri", "Delta First"),
    (DELTA_CLLR, "Leah Bach", "Delta First"),
    (DELTA_CLLR, "Tammy Hansen", "Delta First"),
    (DELTA_CLLR, "Sonya Sangster", "Achieving for Delta"),
    (DELTA_CLLR, "Ikjot Sandhu", "Achieving for Delta"),
    (DELTA_CLLR, "Jennyfer Cassar", "Achieving for Delta"),
    # Mission Councillor (Sandhu, Tilbury already correctly in DB)
    (MISSION_CLLR, "Jash Bains", None),
    (MISSION_CLLR, "Rob Jackson", None),
    (MISSION_CLLR, "Aman Khera", None),
    (MISSION_CLLR, "Steve McLay", None),
    (MISSION_CLLR, "Maria Polounine", None),
    # Mission SD75 School Trustee
    (SD75_MISSION, "Meena Saggu", None),
    (SD75_MISSION, "Jaquelyn Wickham", None),
]

LINKED = [
    (DELTA_MAYOR, "47e7b2fc-17d6-4c56-8a33-198e8ff01fd0"),   # George Harvie
    (DELTA_CLLR, "aa6ac772-6f8e-46af-9939-7c030da658ee"),    # Jessie Dosanjh
    (DELTA_CLLR, "8971461b-00c7-48b4-86e1-cfeb31f9c04d"),    # Alicia Guichon
    (MISSION_CLLR, "2696a0af-0027-4038-b3e0-087670cc55d3"),  # Mark Davies
    (MISSION_CLLR, "01c699aa-fbd6-4fa5-8880-f76909786cad"),  # Ken Herar
    (MISSION_CLLR, "21656ee0-48b7-4462-8f90-421fa95514eb"),  # Danny Plecas
]

NEW_PARTIES = ["Delta First", "Achieving for Delta"]

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

sql = ["BEGIN;"]

for stub_id, real_id in DUP_FIXES:
    sql.append(f"UPDATE public.election_candidates SET politician_id = '{real_id}' WHERE politician_id = '{stub_id}';")
    sql.append(f"DELETE FROM public.politician_profiles WHERE id = '{stub_id}';")
    sql.append(f"DELETE FROM public.profiles WHERE id = '{stub_id}';")

values = ",\n".join(f"('Canada',{qstr(n)})" for n in NEW_PARTIES)
sql.append(
    "INSERT INTO public.political_parties (country, name)\n"
    f"SELECT v.country, v.name FROM (VALUES {values}) AS v(country, name)\n"
    "WHERE NOT EXISTS (SELECT 1 FROM public.political_parties p WHERE p.country=v.country AND p.name=v.name);"
)

sql.append("CREATE TEMP TABLE new_stub (seat_id uuid, name text, party_name text, stub_id uuid) ON COMMIT DROP;")
vals = ",\n".join(f"({qstr(s)},{qstr(n)},{qstr(p)},gen_random_uuid())" for s, n, p in STUB)
sql.append("INSERT INTO new_stub (seat_id, name, party_name, stub_id) VALUES " + vals + ";")
sql.append(
    "INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) "
    "SELECT stub_id, 'politician', name, true, 'Canada', gen_random_uuid() FROM new_stub;"
)
sql.append(
    "INSERT INTO public.politician_profiles (id, political_party_id) "
    "SELECT ns.stub_id, pp.id FROM new_stub ns "
    "LEFT JOIN public.political_parties pp ON pp.country='Canada' AND pp.name = ns.party_name;"
)
sql.append(
    f"INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) "
    f"SELECT seat_id, stub_id, 'approved', now(), {qstr(ADMIN_ID)} FROM new_stub;"
)
link_values = ",\n".join(f"({qstr(s)},{qstr(p)},'approved',now(),{qstr(ADMIN_ID)})" for s, p in LINKED)
sql.append(
    "INSERT INTO public.election_candidates "
    "(seat_id, politician_id, status, submitted_at, added_by_election_admin_id)\n"
    f"VALUES {link_values};"
)
sql.append("COMMIT;")

with open("top50_batch2.sql", "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"DUP FIXES: {len(DUP_FIXES)}  STUB: {len(STUB)}  LINKED: {len(LINKED)}")
