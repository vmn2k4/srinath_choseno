#!/usr/bin/env python3
"""
India Lok Sabha (MP) Ingestion
Populates office_holders for 536 of 543 Lok Sabha constituencies (7 Assam/J&K seats
skipped -- their post-2008-delimitation boundaries aren't in our LGD-sourced map_shapes
yet, see docs/adding-india-politicians.md), then auto-creates linked Ghost Profiles +
Politician Wall pages for each -- same pattern as populate-national-and-province-heads.py
and populate-canadian-municipal.py.

Source: Wikipedia's "List of members of the 18th Lok Sabha" raw wikitext (parsed directly,
not via a summarizing fetch -- see docs/adding-india-politicians.md for the parser
details and the real bugs it caught: an alliance-name/party-name template confusion, a
British/American spelling variant, and 2 one-off unlinked-name formatting exceptions).
Matched to map_shapes by constituency name (523 exact after normalization, 13 more via a
verified fuzzy match, 2 manual overrides for Puducherry/Andaman's differently-spelled
shapes) -- 536/543 total, all cross-checked against real per-state seat counts.
"""

import json
import subprocess

DB_URL = "postgresql://postgres.qlzyfdwrkcxyqapewxwg:pa.8tX5%2BHh%2FGZn2@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
DATA_PATH = "/private/tmp/claude-501/-Users-vmn2k4-Coding-Choseno/27f12aa1-d34c-4f8e-9286-c033c4f6b217/scratchpad/india/mps/loksabha_mps_matched.json"


def sql_val(v):
    if v is None or not str(v).strip():
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def run_psql(sql):
    res = subprocess.run(["psql", DB_URL, "-c", sql], capture_output=True, text=True)
    if res.returncode != 0:
        print("psql error:", res.stderr)
        raise SystemExit(1)
    print(res.stdout)


def main():
    records = json.load(open(DATA_PATH))
    print(f"Upserting {len(records)} India Lok Sabha MP office_holders records...")

    value_tuples = ",\n".join(
        f"({r['map_shape_id']}, {sql_val(r['name'])}, {sql_val(r['party'])}, "
        f"{sql_val('MP for ' + r['constituency'])})"
        for r in records
    )

    upsert_sql = f"""
BEGIN;

CREATE TEMP TABLE staging_mps (
  map_shape_id bigint,
  full_name text,
  political_party text,
  bio text
) ON COMMIT DROP;

INSERT INTO staging_mps VALUES
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
FROM staging_mps s
JOIN map_shapes ms ON s.map_shape_id = ms.id
JOIN election_role_types ert ON ert.country = ms.country AND ert.boundary_type = ms.boundary_type AND ert.role_key = 'mp'
LEFT JOIN political_parties pp ON pp.country = ms.country AND pp.name = s.political_party
ORDER BY s.map_shape_id, ert.id, s.full_name
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
  political_party_id = EXCLUDED.political_party_id,
  bio = EXCLUDED.bio,
  updated_at = NOW();

COMMIT;
"""
    run_psql(upsert_sql)

    print("Creating linked Ghost Profiles & Politician Walls for new MPs...")
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
      AND ert.role_key = 'mp'
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
  RAISE NOTICE 'Created % ghost profile walls for India Lok Sabha MPs!', counter;
END $$;
"""
    run_psql(ghost_sql)
    print("Done.")


if __name__ == "__main__":
    main()
