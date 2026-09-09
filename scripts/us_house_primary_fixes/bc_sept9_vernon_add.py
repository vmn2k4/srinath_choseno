#!/usr/bin/env python3
ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"
MAYOR_SEAT = "f6992a2e-ded1-4ffa-bf91-c01cc7c6901c"
CLLR_SEAT = "9f80042f-4e5a-4653-9427-84dabdc60083"

STUB = [
    (MAYOR_SEAT, "Wayne Lippert", None),
    (CLLR_SEAT, "Robert Cook", None),
    (CLLR_SEAT, "Dauna Kennedy", None),
    (CLLR_SEAT, "Amy Klassen", None),
    (CLLR_SEAT, "Sarah Moorhouse", None),
    (CLLR_SEAT, "David Scarlatescu", None),
    (CLLR_SEAT, "Kari Statham", None),
    (CLLR_SEAT, "Diana Wilson", None),
]
LINKED = [
    (MAYOR_SEAT, "31b1767c-2259-46a6-b47a-fbfa52108e55"),  # Kari Gares
    (CLLR_SEAT, "4fcb0a84-03c9-4d51-b1b4-2ca975ba6e68"),   # Kelly Fehr
]

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

sql = ["BEGIN;"]
sql.append("CREATE TEMP TABLE new_stub (seat_id uuid, name text, stub_id uuid) ON COMMIT DROP;")
vals = ",\n".join(f"({qstr(s)},{qstr(n)},gen_random_uuid())" for s, n, _ in STUB)
sql.append("INSERT INTO new_stub (seat_id, name, stub_id) VALUES " + vals + ";")
sql.append(
    "INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) "
    "SELECT stub_id, 'politician', name, true, 'Canada', gen_random_uuid() FROM new_stub;"
)
sql.append(
    "INSERT INTO public.politician_profiles (id) SELECT stub_id FROM new_stub;"
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

with open("vernon_add.sql", "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"STUB: {len(STUB)}  LINKED: {len(LINKED)}")
