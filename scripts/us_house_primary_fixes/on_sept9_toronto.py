#!/usr/bin/env python3
"""Ontario municipal sweep, 2026-09-09, Toronto (population #1) -- the
first city processed in a top-population-down sweep the user asked for,
after finding **all 872 Ontario election_seats had zero candidates**
despite nominations having closed Aug 21, 2026. Ontario has no single
province-wide candidate registry like BC's LECFA PDF, so each city's own
official page has to be checked individually.

**New pattern established here, per explicit user decision**: Toronto
(and most large Ontario cities) elect councillors by ward, not
city-wide, but our schema only had one generic city-wide 'Councillor'
seat per Ontario municipality (same bucket-model as every other BC/ON
city). Checked first whether real ward boundary polygons exist anywhere
in the system to model this properly: **they don't** -- a `Ward`
boundary_type exists only for India (64k rows); zero Canadian ward
polygons exist anywhere, and Toronto's ~370 "Advance Polling District"
shapes are a different, unrelated federal/provincial voting-logistics
geography that doesn't align with municipal ward boundaries. User chose
(asked explicitly, twice, since this decision applies to every
multi-ward Ontario city going forward): create wards as **name-only
placeholder `map_shapes`** (no polygon) so candidates group correctly by
who they actually compete against, accepting that "Find my district"
will only resolve to the city, not the specific ward, until real ward
shapefiles are imported as a separate GIS project later.

Source: `https://www.toronto.ca/city-government/elections/2026-election/candidate-list/`
-- an official, per-office, per-ward table (Mayor / Councillor by ward /
Trustee tabs). Extracted Mayor (53) and Councillor (190 across 25 wards)
via the browser's own JS against the live page (see this session's
transcript for the extraction script -- walks the tab's DOM for
`<h2-4>Ward N...</h2-4>` headings followed by a `<table>`). **Trustee
races (TDSB/TCDSB/CSV/CSCM, ~100+ more candidates) intentionally NOT
included in this pass** -- scoped out to keep this city's insert
reviewable; a natural follow-up using the same page's `tabTrustee`.

No officeholder-dedup possible -- this session has never imported
Ontario municipal officeholders into `office_holders`, so every name here
is inserted as a fresh stub (name only, no bio/contact/photo/party --
Toronto's own list doesn't carry affiliation for most candidates, matches
LECFA-stub scope for a first pass). The old, now-superseded generic
city-wide 'Councillor' seat (0 candidates, 0 admins, confirmed unreferenced) is deleted in favour of the 25 ward seats below.
"""
import json

ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"
TORONTO_MAYOR_SEAT = "8b7c8685-4b29-4bd3-a00c-3ed130ba7c04"
TORONTO_OLD_COUNCILLOR_SEAT = "37950c72-5e71-4c65-96f9-799eef2ecac1"
ONTARIO_ELECTION = "2026 Ontario Municipal Elections"  # looked up by name in SQL

with open("/private/tmp/claude-501/-Users-vmn2k4-Coding-Choseno/068313de-b839-4eee-b3a5-5fdb7b68461d/scratchpad/toronto_data.json") as f:
    DATA = json.load(f)

def to_full_name(last_first: str) -> str:
    if "," not in last_first:
        return last_first.strip()
    last, first = last_first.split(",", 1)
    return f"{first.strip()} {last.strip()}"

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

sql = ["BEGIN;"]

# 1. Drop the now-superseded empty generic Councillor seat.
sql.append(f"DELETE FROM public.election_seats WHERE id = '{TORONTO_OLD_COUNCILLOR_SEAT}';")

# 2. Create 25 ward map_shapes (name-only, no geometry) + their seats,
# then stub-insert each ward's candidates, in one PL/pgSQL block.
sql.append(f"""
DO $$
DECLARE
  v_election_id uuid;
  v_ward_shape_id bigint;
  v_seat_id uuid;
  v_stub_id uuid;
  v_ward_name text;
  v_candidate_name text;
""")

body = ["BEGIN"]
body.append(f"  SELECT id INTO v_election_id FROM public.elections WHERE name = {qstr(ONTARIO_ELECTION)};")

for ward in DATA["wards"]:
    ward_label = ward["ward"].replace("Councillor ", "").strip()  # "Ward 1 - Etobicoke North"
    ward_shape_name = f"Toronto {ward_label}"
    body.append(f"""
  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', {qstr(ward_shape_name)})
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;
""")
    for name in ward["names"]:
        full_name = to_full_name(name)
        body.append(f"""
  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', {qstr(full_name)}, true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower({qstr(full_name)} || '-councillor-' || {qstr(ward_shape_name)}), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), {qstr(ADMIN_ID)});
""")

# 3. Mayor candidates -> existing Mayor seat.
for name in DATA["mayor"]:
    full_name = to_full_name(name)
    body.append(f"""
  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', {qstr(full_name)}, true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower({qstr(full_name)} || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ({qstr(TORONTO_MAYOR_SEAT)}, v_stub_id, 'approved', now(), {qstr(ADMIN_ID)});
""")

body.append(f"  RAISE NOTICE 'Toronto: 25 wards created, {sum(len(w['names']) for w in DATA['wards'])} councillor + {len(DATA['mayor'])} mayor candidates added';")
body.append("END $$;")
sql.append("\n".join(body))
sql.append("COMMIT;")

out_path = "on_sept9_toronto.sql"
with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"Wards: {len(DATA['wards'])}  Councillor candidates: {sum(len(w['names']) for w in DATA['wards'])}  Mayor candidates: {len(DATA['mayor'])}")
print(f"SQL written to {out_path}")
