#!/usr/bin/env python3
"""Fix: Surrey and Burnaby School Trustee pages were never checked in
earlier BC passes (only Mayor/Councillor were), surfaced by a user
spot-check on 2026-09-09. Also fixes a second duplicate-profile bug of the
same shape as Rob Stutt (Sept 6): Kristin Schnider (Burnaby SD41) was
minted as a fresh stub without checking Burnaby's own officeholders --
she's a sitting Board Chair with an existing, unused profile."""
import sys

ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"
NEW_PARTIES = ["Our Surrey"]

SCHNIDER_STUB_PROFILE = "b7f8c652-e0ee-402e-9c58-12a22c57aa3a"
SCHNIDER_REAL_PROFILE = "efd22732-9228-4264-89cf-9452be96c25a"

SD36_SURREY_SEAT = "496873af-b915-4556-a90b-c6a2efff415a"
SD41_BURNABY_SEAT = "78212b91-2bb4-4e68-9d4f-f9548d8102b0"

STUB = [
    # Surrey SD36 (surrey.ca/.../candidates-office-of-school-trustee)
    (SD36_SURREY_SEAT, "Harjit Bhullar", None),
    (SD36_SURREY_SEAT, "Amrit Birring", None),
    (SD36_SURREY_SEAT, "Michelle Ceniza", "SURREY NOW"),
    (SD36_SURREY_SEAT, "Gurleen K Chahal", None),
    (SD36_SURREY_SEAT, "Noor Cheema", None),
    (SD36_SURREY_SEAT, "Vanessa Gilera", "SURREY NOW"),
    (SD36_SURREY_SEAT, "Kyle Jones", "Our Surrey"),
    (SD36_SURREY_SEAT, "Meena Kochher", None),
    (SD36_SURREY_SEAT, "Afzalur Rahman", None),
    (SD36_SURREY_SEAT, "Vincent Tighe", "SURREY NOW"),
    (SD36_SURREY_SEAT, "Venson Wang", "SURREY NOW"),
    (SD36_SURREY_SEAT, "Anne Whitmore", "Our Surrey"),
    # Burnaby SD41 (burnaby.ca/.../office-of-school-trustees-candidate-profiles)
    # -- Bill Brassington and Jen Mezei are officeholder-linked, see LINKED.
    (SD41_BURNABY_SEAT, "Stephen Andrada", "BCA - Burnaby Citizens Association"),
    (SD41_BURNABY_SEAT, "Hillary Bergshoeff", "BCA - Burnaby Citizens Association"),
    (SD41_BURNABY_SEAT, "Jen Jang", "Burnaby Green Party"),
    (SD41_BURNABY_SEAT, "Paul Kwon", "BCA - Burnaby Citizens Association"),
    (SD41_BURNABY_SEAT, "Jasmine Nicholsfigueiredo", "Burnaby Green Party"),
]

LINKED = [
    (SD41_BURNABY_SEAT, "04cde9a0-6d23-42c0-bc17-981c32f24c82"),  # Bill Brassington
    (SD41_BURNABY_SEAT, "6d2417d6-b915-491c-9fd2-cce737fdee34"),  # Jen Mezei
]

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

sql = ["BEGIN;"]

# Fix Kristin Schnider duplicate first.
sql.append(
    f"UPDATE public.election_candidates SET politician_id = '{SCHNIDER_REAL_PROFILE}' "
    f"WHERE politician_id = '{SCHNIDER_STUB_PROFILE}';"
)
sql.append(f"DELETE FROM public.politician_profiles WHERE id = '{SCHNIDER_STUB_PROFILE}';")
sql.append(f"DELETE FROM public.profiles WHERE id = '{SCHNIDER_STUB_PROFILE}';")

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

out_path = sys.argv[1] if len(sys.argv) > 1 else "school_trustee_fix.sql"
with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"STUB: {len(STUB)}  LINKED: {len(LINKED)}  +1 duplicate-profile fix (Kristin Schnider)")
print(f"SQL written to {out_path}")
