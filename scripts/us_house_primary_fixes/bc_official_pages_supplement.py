#!/usr/bin/env python3
"""Supplement pass 2026-09-06: real candidates confirmed directly on each
city's OWN official election page (surrey.ca, vancouver.ca, burnaby.ca,
coquitlam.ca, tol.ca) -- these publish live, rolling nomination lists that
run ahead of the province-wide LECFA PDF during the Sept 1-11 window.
Also fixes one duplicate profile this same investigation surfaced: Rob
Stutt (Surrey) was minted as a fresh stub on 2026-09-06's LECFA pass
without checking Surrey's own officeholders first -- he's a sitting
councillor with an existing profile that never got used."""
import sys

ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"

NEW_PARTIES = []  # none needed -- city pages checked this pass didn't state party affiliation

# --- fix: Rob Stutt duplicate from the 2026-09-06 LECFA pass ---
# election_candidates.politician_id 716ff97a-... (fresh stub, no officeholder
# link) -> 65827d31-... (his real, existing officeholder-linked profile).
STUTT_STUB_PROFILE = "716ff97a-a8a7-4509-8856-d5bb56cf5de7"
STUTT_REAL_PROFILE = "65827d31-b427-4ebc-94c5-dc4ef3335bef"

# (seat_id, name, party_name_or_None)
STUB = [
    # Surrey councillor (surrey.ca/.../candidates-office-of-councillor)
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Jesse Aajohl", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Debra Antifaev", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Gail Beszedes", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Janet Brown", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Leanna Chatwin", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Bilal Cheema", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Isaac Daniel", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Ollivor Dickson", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Rahul Gill", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Jasroop Gosal", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Youssef Khattab", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Brad Kielmann", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Vera LeFranc", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Gagan Nahal", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Enrique Ponce de Leon", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Jimmy Rico", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Werner Spangehl", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Clint Stewart", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Rona Tepper", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Miguel Ting", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Lily Tsi", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Shina Vermani", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Mila Wong-Kabush", None),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "James Yu", None),
    # Surrey Mayor
    ("40c371c5-1098-4351-ac2e-ed2cba922799", "Troy Van-Vliet", None),
    # Vancouver Mayor (vancouver.ca/your-government/2026-candidates-mayor.aspx)
    ("deb74440-dd43-475e-9166-bd2c921d5c91", "Muhammad Ahmad", None),
    # Burnaby councillor (burnaby.ca/.../office-of-councillor-candidate-profiles)
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Neil Chapman", None),
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Daniel Chen", None),
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Larry Chin", None),
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Gulam Firdos", None),
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Martin Kendell", None),
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Cindy Lee", None),
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Ragina Naidu", None),
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Rea Park", None),
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Tara Shushtarian", None),
    # Coquitlam councillor (coquitlam.ca/1205/Candidate-Summaries)
    ("8e26193f-60fb-43a9-b263-028195334245", "Abdi Behzad", None),
    ("8e26193f-60fb-43a9-b263-028195334245", "Ali Cina", None),
    ("8e26193f-60fb-43a9-b263-028195334245", "Harvey Su", None),
    ("8e26193f-60fb-43a9-b263-028195334245", "Kash Tayal", None),
    ("8e26193f-60fb-43a9-b263-028195334245", "Rosalinda Thorleifson", None),
    ("8e26193f-60fb-43a9-b263-028195334245", "Lili Tran", None),
    # Coquitlam SD43 trustee
    ("5195b31e-97f2-4b03-b658-b6b90d376449", "Rachel Drager", None),
    ("5195b31e-97f2-4b03-b658-b6b90d376449", "Shreya Qazi", None),
    # Langley SD35 trustee (tol.ca/.../about-the-candidates.aspx names a
    # different person than the LECFA-sourced Celene Hoag already in the
    # system -- SD35 elects 5 trustees, so both are plausibly real and
    # simply filed with different municipalities in the same district)
    ("60f27447-52f0-40be-a90f-a3f3a49e29b6", "Tina Patterson", None),
]

# (seat_id, existing_profile_id) -- confirmed sitting officeholders
# re-filing, matched on the exact map_shape_id + name.
LINKED = [
    ("40c371c5-1098-4351-ac2e-ed2cba922799", "673efede-1b98-465c-9528-64f43b857b09"),  # Surrey Mayor - Linda Annis
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "c23ff6cf-46ab-4ead-8533-98c9a8314f6e"),  # Surrey Councillor - Gordon Hepner
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "ef0848ed-5854-4a47-ad5a-4f9b064a3e30"),  # Surrey Councillor - Harry Bains
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "f7695818-1444-4552-a117-a70a249a64ba"),  # Surrey Councillor - Mike Bose
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "b721c0e9-3c97-47bc-9ccc-aaf163ce2a33"),  # Burnaby Councillor - Joe Keithley
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "98a6913e-b3a6-4c65-a85e-fc478983269f"),  # Burnaby Councillor - James Wang
]

sql = ["BEGIN;"]

# Fix Rob Stutt duplicate first: repoint his election_candidates row to his
# real profile, then remove the stray stub profile entirely.
sql.append(
    f"UPDATE public.election_candidates SET politician_id = '{STUTT_REAL_PROFILE}' "
    f"WHERE politician_id = '{STUTT_STUB_PROFILE}';"
)
sql.append(f"DELETE FROM public.politician_profiles WHERE id = '{STUTT_STUB_PROFILE}';")
sql.append(f"DELETE FROM public.profiles WHERE id = '{STUTT_STUB_PROFILE}';")

if NEW_PARTIES:
    values = ",\n".join(f"('{c}','{n}')" for c, n in NEW_PARTIES)
    sql.append(
        "INSERT INTO public.political_parties (country, name)\n"
        f"SELECT v.country, v.name FROM (VALUES {values}) AS v(country, name)\n"
        "WHERE NOT EXISTS (SELECT 1 FROM public.political_parties p WHERE p.country=v.country AND p.name=v.name);"
    )

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

sql.append("CREATE TEMP TABLE new_stub (seat_id uuid, name text, party_name text, stub_id uuid) ON COMMIT DROP;")
values = []
for seat_id, name, party in STUB:
    values.append(f"({qstr(seat_id)},{qstr(name)},{qstr(party)},gen_random_uuid())")
sql.append("INSERT INTO new_stub (seat_id, name, party_name, stub_id) VALUES " + ",\n".join(values) + ";")

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

if LINKED:
    link_values = ",\n".join(
        f"({qstr(s)},{qstr(p)},'approved',now(),{qstr(ADMIN_ID)})" for s, p in LINKED
    )
    sql.append(
        "INSERT INTO public.election_candidates "
        "(seat_id, politician_id, status, submitted_at, added_by_election_admin_id)\n"
        f"VALUES {link_values};"
    )

sql.append("COMMIT;")

out_path = sys.argv[1] if len(sys.argv) > 1 else "bc_official_pages_supplement.sql"
with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"STUB: {len(STUB)}  LINKED: {len(LINKED)}  (+ 1 duplicate-profile fix: Rob Stutt)")
print(f"SQL written to {out_path}")
