#!/usr/bin/env python3
"""BC School Trustee recheck, 2026-09-09, same LECFA re-fetch as
bc_sept9_lecfa_recheck.py -- separate script since it targets the School
Trustee election and a different office-keyword ("Board of Education")
in the PDF parse. Found SD33 - Chilliwack completely missing (0
candidates, 5 in LECFA) plus a gap of 1 in each of SD42 Maple Ridge-Pitt
Meadows (found 2 missing, not 1), SD48 Sea to Sky, SD58 Nicola-
Similkameen, SD68 Nanaimo-Ladysmith. Each district's `election_seats`
has two role_titles (School Trustee, Board Chair) -- LECFA's "Board of
Education Trustee" candidates map to the School Trustee seat, confirmed
against where each district's existing DB candidates already sit.
2 of 8 new names are sitting officeholders re-filing (linked, not
stubbed): Gordon Swan/SD58, Tania Brzovic/SD68.
"""
ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"

SEATS = {
    "SD33 - Chilliwack": "86ad72b7-5485-4aea-8a1e-ccf0074bb30b",
    "SD42 - Maple Ridge-Pitt Meadows": "0ff2755f-031f-4a8e-ad9f-f86f386432b1",
    "SD48 - Sea to Sky (Howe Sound)": "f467660b-73e0-4d76-9d21-734bcf5e0df5",
    "SD58 - Nicola-Similkameen": "958ea2ad-c5c7-49b6-a170-555e2e341d94",
}

# fresh stubs: (district, name)
STUB = [
    ("SD33 - Chilliwack", "Michael Carter"),
    ("SD33 - Chilliwack", "Marina Garmon"),
    ("SD33 - Chilliwack", "Hugh Hamilton"),
    ("SD33 - Chilliwack", "Christine Kruger"),
    ("SD33 - Chilliwack", "Cary Moore"),
    ("SD42 - Maple Ridge-Pitt Meadows", "Deepa Bissessur"),
    ("SD42 - Maple Ridge-Pitt Meadows", "Emily Haugen"),
    ("SD48 - Sea to Sky (Howe Sound)", "Lisa Turpin"),
]

# officeholder links: (district, existing_profile_id)
LINKED = [
    ("SD58 - Nicola-Similkameen", "d4eaf5a1-a4b0-43fd-b2cf-0b3ac635cc16"),  # Gordon Swan
    ("SD68 - Nanaimo-Ladysmith", "91ba7c47-503e-40ec-97ca-28a23ba2fcf5"),  # Tania Brzovic
]
SEATS["SD68 - Nanaimo-Ladysmith"] = "f9a7ddc0-9e90-4143-9932-84671a488368"

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

sql = ["BEGIN;"]

sql.append("CREATE TEMP TABLE new_stub (seat_id uuid, name text, stub_id uuid, wall_slug text) ON COMMIT DROP;")
vals = ",\n".join(f"({qstr(SEATS[d])},{qstr(n)},gen_random_uuid())" for d, n in STUB)
sql.append("INSERT INTO new_stub (seat_id, name, stub_id) VALUES " + vals + ";")
sql.append("""
UPDATE new_stub ns SET wall_slug = base.slug FROM (
  SELECT ns2.stub_id,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.politician_profiles pp WHERE pp.wall_slug = regexp_replace(regexp_replace(lower(ns2.name || '-school-trustee'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
    ) THEN regexp_replace(regexp_replace(lower(ns2.name || '-school-trustee'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(ns2.stub_id::text, '-', ''), 6)
    ELSE regexp_replace(regexp_replace(lower(ns2.name || '-school-trustee'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
    END AS slug
  FROM new_stub ns2
) base WHERE base.stub_id = ns.stub_id;
""")
sql.append(
    "INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) "
    "SELECT stub_id, 'politician', name, true, 'Canada', gen_random_uuid() FROM new_stub;"
)
sql.append(
    "INSERT INTO public.politician_profiles (id, wall_slug) "
    "SELECT stub_id, wall_slug FROM new_stub;"
)
sql.append(
    f"INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) "
    f"SELECT seat_id, stub_id, 'approved', now(), {qstr(ADMIN_ID)} FROM new_stub;"
)

link_values = ",\n".join(f"({qstr(SEATS[d])},{qstr(pid)},'approved',now(),{qstr(ADMIN_ID)})" for d, pid in LINKED)
sql.append(
    "INSERT INTO public.election_candidates "
    "(seat_id, politician_id, status, submitted_at, added_by_election_admin_id)\n"
    f"VALUES {link_values};"
)

sql.append("COMMIT;")

out_path = "bc_sept9_school_trustee_recheck.sql"
with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"STUB: {len(STUB)}  LINKED: {len(LINKED)}")
print(f"SQL written to {out_path}")
