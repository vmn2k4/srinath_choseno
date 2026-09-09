#!/usr/bin/env python3
"""BC-wide recheck, 2026-09-09, part of a full sweep of all active
elections the user asked for. LECFA's PDF grew from 23 to 25 pages since
the last check (Sept 6/8) -- re-fetched and, per the standing methodology,
counted PDF rows per (jurisdiction, office) and compared against DB
candidate counts for the same pair (a fast, robust way to spot gaps
without needing a full column parse of every row -- see the row/column
ambiguity noted in this session's own scratch work). Any (jurisdiction,
office) where PDF count > DB count was checked by hand against the raw
PDF text for the actual names.

Found 14 real gaps across 8 municipalities, 5 of which (Elkford, Golden,
Lytton, Port Alice, Terrace, Trail) had ZERO candidates in our system for
that seat at all -- not just an undercount, a complete miss. All 14
individually verified against `office_holders` (map_shape_id + name):
6 are sitting officeholders re-filing (linked to their existing profile,
not stubbed) -- Bev Benson/Trail, Michie Vidal/Harrison Hot Springs, Adam
Etchart/Merritt, John Manuel/Golden, James Cordeiro/Terrace, Simon
Yu/Prince George Mayor.
"""
ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"

SEATS = {
    ("Central Saanich", "Councillor"): "4c449a9e-898d-41a5-8d3c-e97e973048cc",
    ("Chilliwack", "Councillor"): "be92d312-eb1f-4113-90e5-b022076e5f26",
    ("Maple Ridge", "Councillor"): "2b9bb4f1-171d-457d-8c77-a1485364a2a9",
    ("Nanaimo", "Councillor"): "10cdc667-621c-4af6-88c1-0bbe2b29912f",
    ("Prince George", "Mayor"): None,  # filled below via existing officeholder link only
    ("West Vancouver", "Councillor"): "675639f8-dff3-41e9-b664-ba3d15fb927c",
    ("Elkford", "Mayor"): "dc8121c3-fa88-46f5-b1ab-6d062ece5d6b",
    ("Golden", "Councillor"): None,  # link-only
    ("Lytton", "Councillor"): "9e144558-0bfb-46fd-b4c3-88e5205f54b3",
    ("Port Alice", "Councillor"): "03c4d7d4-087f-4278-b0e2-c7156807734d",
    ("Terrace", "Councillor"): "db2490c3-5b3c-4f93-97a9-0937ddd5ba4c",
    ("Trail", "Councillor"): None,  # link-only
    ("Harrison Hot Springs", "Councillor"): None,  # link-only
    ("Merritt", "Councillor"): None,  # link-only
    ("Golden", "Councillor"): "4fda670a-752d-43d7-9a83-99e0d1e83fd6",
}

# fresh stubs: (seat_key, name, party_name)
STUB = [
    (("Central Saanich", "Councillor"), "Anny Scoones", "Sustain OUR Central Saanich"),
    (("Chilliwack", "Councillor"), "Danielle Beausoleil", None),
    (("Maple Ridge", "Councillor"), "Bob D'Eith", "A Better Maple Ridge"),
    (("Nanaimo", "Councillor"), "Marnie Boers", None),
    (("West Vancouver", "Councillor"), "Sylvia Olson", None),
    (("Elkford", "Mayor"), "Mandy McGregor", None),
    (("Lytton", "Councillor"), "Kathryn Brooks", None),
    (("Port Alice", "Councillor"), "Neal Williams", None),
    (("Terrace", "Councillor"), "Joe Lavoie", None),
]

# officeholder links: (seat_key, existing_profile_id)
LINKED = [
    (("Trail", "Councillor"), "1aaf3e11-963c-4600-bce6-3d70c44ce0c3"),  # Bev Benson
    (("Harrison Hot Springs", "Councillor"), "5d1ebf2a-9535-4faf-aad2-1c33f57cf8cf"),  # Michie Vidal
    (("Merritt", "Councillor"), "857dd62e-1c14-4818-a599-bfac39cff0b0"),  # Adam Etchart
    (("Golden", "Councillor"), "4df4159b-8bae-47b9-a33f-194cba4cbef2"),  # John Manuel
    (("Terrace", "Councillor"), "7d8c2595-da2b-4d6f-bd12-1581b8743b61"),  # James Cordeiro
    (("Prince George", "Mayor"), "a6c1b617-924a-4893-8fa5-cd523f9d89c6"),  # Simon Yu
]

# Seats needed only for LINKED rows that weren't already in SEATS (Trail,
# Harrison Hot Springs, Merritt, Prince George Mayor) -- filled in by hand
# from the same election_seats query.
SEATS[("Trail", "Councillor")] = "6cb05a9a-07e8-45fd-b126-883833ab42c2"
SEATS[("Harrison Hot Springs", "Councillor")] = "e138a0ff-8753-4a01-a7cb-e70b60ab23f3"
SEATS[("Merritt", "Councillor")] = "6cd7b7af-4901-4037-8ce3-ef78778c27e6"
SEATS[("Prince George", "Mayor")] = "ea173600-a227-4dea-aa39-372da7672d6a"

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

sql = ["BEGIN;"]

sql.append("CREATE TEMP TABLE new_stub (seat_id uuid, name text, party_name text, stub_id uuid, wall_slug text) ON COMMIT DROP;")
vals = ",\n".join(
    f"({qstr(SEATS[key])},{qstr(name)},{qstr(party)},gen_random_uuid())" for key, name, party in STUB
)
sql.append("INSERT INTO new_stub (seat_id, name, party_name, stub_id) VALUES " + vals + ";")
sql.append("""
UPDATE new_stub ns SET wall_slug = base.slug FROM (
  SELECT ns2.stub_id,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.politician_profiles pp WHERE pp.wall_slug = regexp_replace(regexp_replace(lower(ns2.name || '-councillor'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
    ) THEN regexp_replace(regexp_replace(lower(ns2.name || '-councillor'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(ns2.stub_id::text, '-', ''), 6)
    ELSE regexp_replace(regexp_replace(lower(ns2.name || '-councillor'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
    END AS slug
  FROM new_stub ns2
) base WHERE base.stub_id = ns.stub_id;
""")
sql.append(
    "INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) "
    "SELECT stub_id, 'politician', name, true, 'Canada', gen_random_uuid() FROM new_stub;"
)
sql.append(
    "INSERT INTO public.politician_profiles (id, political_party_id, wall_slug) "
    "SELECT ns.stub_id, pp.id, ns.wall_slug FROM new_stub ns "
    "LEFT JOIN public.political_parties pp ON pp.country='Canada' AND pp.name = ns.party_name;"
)
sql.append(
    f"INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) "
    f"SELECT seat_id, stub_id, 'approved', now(), {qstr(ADMIN_ID)} FROM new_stub;"
)

link_values = ",\n".join(f"({qstr(SEATS[key])},{qstr(pid)},'approved',now(),{qstr(ADMIN_ID)})" for key, pid in LINKED)
sql.append(
    "INSERT INTO public.election_candidates "
    "(seat_id, politician_id, status, submitted_at, added_by_election_admin_id)\n"
    f"VALUES {link_values};"
)

sql.append("COMMIT;")

out_path = "bc_sept9_lecfa_recheck.sql"
with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"STUB: {len(STUB)}  LINKED: {len(LINKED)}")
print(f"SQL written to {out_path} -- REPLACE the 4 placeholder seat IDs before running!")
