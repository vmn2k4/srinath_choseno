#!/usr/bin/env python3
"""Reusable template for adding a multi-ward Ontario city's candidates,
established on Toronto (see on_sept9_toronto.py and
docs/CANDIDATE_DATA_PULL_LOG.md "Full active-elections sweep" section for
the full rationale: no ward polygon data exists for any Canadian city, so
wards are name-only placeholder map_shapes -- candidates group correctly
by ward, "Find my district" resolves to the city only until real
boundaries are imported later).

Usage: python3 on_multiward_city.py <data.json>

data.json shape:
{
  "city": "Ottawa",
  "mayor_seat_id": "<existing Mayor election_seats.id for this city>",
  "old_councillor_seat_id": "<existing generic Councillor election_seats.id, deleted if present and empty>",
  "mayor": ["First Last", ...],
  "wards": [{"ward": "Ward 1 - Some Name", "names": ["First Last", ...]}, ...]
}

Names must already be "First Last" order (convert "Last, First" style
sources -- e.g. Toronto's own list -- before writing the JSON).
"""
import json
import sys

ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"
ONTARIO_ELECTION = "2026 Ontario Municipal Elections"

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 on_multiward_city.py <data.json>")
        sys.exit(1)
    with open(sys.argv[1]) as f:
        data = json.load(f)

    city = data["city"]
    sql = ["BEGIN;"]

    if data.get("old_councillor_seat_id"):
        sql.append(f"DELETE FROM public.election_seats WHERE id = '{data['old_councillor_seat_id']}' "
                    f"AND NOT EXISTS (SELECT 1 FROM public.election_candidates WHERE seat_id = '{data['old_councillor_seat_id']}');")

    sql.append(f"""
DO $$
DECLARE
  v_election_id uuid;
  v_ward_shape_id bigint;
  v_seat_id uuid;
  v_stub_id uuid;
BEGIN
  SELECT id INTO v_election_id FROM public.elections WHERE name = {qstr(ONTARIO_ELECTION)};
""")

    body = []
    for ward in data["wards"]:
        ward_shape_name = f"{city} {ward['ward']}"
        body.append(f"""
  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', {qstr(ward_shape_name)})
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;
""")
        for name in ward["names"]:
            body.append(f"""
  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', {qstr(name)}, true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower({qstr(name)} || '-councillor-' || {qstr(ward_shape_name)}), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), {qstr(ADMIN_ID)});
""")

    for name in data.get("mayor", []):
        body.append(f"""
  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', {qstr(name)}, true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower({qstr(name)} || '-mayor-' || {qstr(city)}), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ({qstr(data["mayor_seat_id"])}, v_stub_id, 'approved', now(), {qstr(ADMIN_ID)});
""")

    n_councillors = sum(len(w["names"]) for w in data["wards"])
    body.append(f"  RAISE NOTICE '{city}: {len(data['wards'])} wards, {n_councillors} councillor + {len(data.get('mayor', []))} mayor candidates added';")
    body.append("END $$;")
    sql.append("\n".join(body))
    sql.append("COMMIT;")

    out_path = sys.argv[1].replace(".json", ".sql")
    with open(out_path, "w") as f:
        f.write("\n".join(sql) + "\n")
    print(f"{city}: {len(data['wards'])} wards, {n_councillors} councillor, {len(data.get('mayor', []))} mayor")
    print(f"SQL written to {out_path}")

if __name__ == "__main__":
    main()
