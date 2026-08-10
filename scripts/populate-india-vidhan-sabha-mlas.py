#!/usr/bin/env python3
"""
India Vidhan Sabha (MLA) Ingestion — per-state, run once per state's matched MLA JSON.

Usage: python3 scripts/populate-india-vidhan-sabha-mlas.py <matched_mlas.json> "<State Name>"

Each state's Wikipedia "Nth <State> Assembly" article is parsed separately (unlike Lok
Sabha's single unified list) since state assemblies aren't all elected on the same cycle.
See docs/adding-india-politicians.md for the full per-state parsing notes, table-structure
quirks found, and match results.

Auto-adds any party name in the matched data that isn't already in political_parties
(country='India') before the office_holders upsert, since each state surfaces its own
regional parties that a national seed list can't fully anticipate ahead of time.
"""

import json
import subprocess
import sys

DB_URL = "postgresql://postgres.qlzyfdwrkcxyqapewxwg:pa.8tX5%2BHh%2FGZn2@aws-1-us-east-2.pooler.supabase.com:5432/postgres"


def sql_val(v):
    if v is None or not str(v).strip():
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def run_psql(sql, capture=True):
    res = subprocess.run(["psql", DB_URL, "-c", sql], capture_output=capture, text=True)
    if res.returncode != 0:
        print("psql error:", res.stderr)
        raise SystemExit(1)
    if capture:
        print(res.stdout)
    return res.stdout if capture else None


def main():
    if len(sys.argv) != 3:
        print("Usage: populate-india-vidhan-sabha-mlas.py <matched_mlas.json> '<State Name>'")
        raise SystemExit(1)

    data_path, state_name = sys.argv[1], sys.argv[2]
    records = json.load(open(data_path))
    print(f"[{state_name}] {len(records)} matched MLA records")

    parties = sorted(set(r['party'] for r in records if r.get('party')))
    party_values = ",\n".join(f"('India', {sql_val(p)}, 999)" for p in parties)
    run_psql(f"""
INSERT INTO political_parties (country, name, rank) VALUES
{party_values}
ON CONFLICT (country, name) DO NOTHING;
""")

    value_tuples = ",\n".join(
        f"({r['map_shape_id']}, {sql_val(r['name'])}, {sql_val(r['party'])}, "
        f"{sql_val('MLA for ' + r['constituency'] + ', ' + state_name)})"
        for r in records
    )

    upsert_sql = f"""
BEGIN;

CREATE TEMP TABLE staging_mlas (
  map_shape_id bigint,
  full_name text,
  political_party text,
  bio text
) ON COMMIT DROP;

INSERT INTO staging_mlas VALUES
{value_tuples};

INSERT INTO office_holders (
  map_shape_id, election_role_type_id, full_name, political_party_id, bio, updated_at
)
SELECT DISTINCT ON (s.map_shape_id, ert.id, s.full_name)
  s.map_shape_id,
  ert.id,
  s.full_name,
  pp.id,
  s.bio,
  NOW()
FROM staging_mlas s
JOIN map_shapes ms ON s.map_shape_id = ms.id
JOIN election_role_types ert ON ert.country = ms.country AND ert.boundary_type = ms.boundary_type AND ert.role_key = 'mla'
LEFT JOIN political_parties pp ON pp.country = ms.country AND pp.name = s.political_party
ORDER BY s.map_shape_id, ert.id, s.full_name
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
  political_party_id = EXCLUDED.political_party_id,
  bio = EXCLUDED.bio,
  updated_at = NOW();

COMMIT;
"""
    run_psql(upsert_sql)

    ghost_sql = """
DO $$
DECLARE
  r RECORD;
  new_profile_id UUID;
  new_ghost_id UUID;
  counter INT := 0;
BEGIN
  FOR r IN
    SELECT
      oh.id AS office_holder_id,
      oh.full_name,
      oh.bio,
      oh.photo_url,
      oh.political_party_id,
      ms.country,
      ms.name AS boundary_name,
      ms.boundary_type,
      ert.role_title
    FROM office_holders oh
    JOIN map_shapes ms ON oh.map_shape_id = ms.id
    JOIN election_role_types ert ON oh.election_role_type_id = ert.id
    WHERE oh.linked_profile_id IS NULL
      AND ms.country = 'India'
      AND ert.role_key = 'mla'
  LOOP
    new_profile_id := gen_random_uuid();
    new_ghost_id := gen_random_uuid();

    INSERT INTO profiles (
      id, role, full_name, country, constituency, designation, current_ghost_id, updated_at
    ) VALUES (
      new_profile_id, 'politician', r.full_name, r.country, r.boundary_name, r.role_title, new_ghost_id, NOW()
    );

    INSERT INTO politician_profiles (
      id, political_target_role, target_boundary_type, target_boundary_name,
      bio, avatar_url, political_party_id, created_at, updated_at
    ) VALUES (
      new_profile_id, r.role_title, r.boundary_type, r.boundary_name,
      r.bio, r.photo_url, r.political_party_id, NOW(), NOW()
    ) ON CONFLICT (id) DO UPDATE SET
      avatar_url = EXCLUDED.avatar_url,
      bio = EXCLUDED.bio,
      target_boundary_name = EXCLUDED.target_boundary_name;

    UPDATE office_holders SET linked_profile_id = new_profile_id WHERE id = r.office_holder_id;

    counter := counter + 1;
  END LOOP;
  RAISE NOTICE 'Created % new ghost profile walls for MLAs!', counter;
END $$;
"""
    run_psql(ghost_sql)
    print(f"[{state_name}] Done.")


if __name__ == "__main__":
    main()
