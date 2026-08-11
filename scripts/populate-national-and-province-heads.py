#!/usr/bin/env python3
"""
National & Provincial Head-of-Government Ingestion
Populates office_holders for Canada's Prime Minister + all 13 provincial/
territorial Premiers, and the USA's President, then auto-creates linked Ghost
Profiles + Politician Wall pages for each -- same pattern as
populate-canadian-municipal.py's ghost-wall creation step. Governors were
already populated (and already have walls) by populate-all-office-holders.py.

Source: web research current as of Aug 2026 (pm.gc.ca, whitehouse.gov,
Wikipedia's "List of current first ministers of Canada"). Party names are
normalized to this app's existing political_parties catalog using the same
lossy keyword heuristic already used throughout scripts/ (provincial parties
with no federal-level keyword match -- Saskatchewan Party, Yukon Party,
Coalition Avenir Quebec, non-partisan consensus government -- fall back to
'Independent', consistent with prior MLA imports).
"""

import subprocess

DB_URL = "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres"

# (map_shape_id, role_title, full_name, political_party, bio, source_url)
RECORDS = [
    # -- Canada: Prime Minister (National shape) --
    (62894, "Prime Minister", "Mark Carney", "Liberal Party",
     "Prime Minister of Canada", "https://www.pm.gc.ca/en"),

    # -- Canada: Premiers (Province container shapes) --
    (22947, "Premier", "Danielle Smith", "Conservative Party", "Premier of Alberta", None),
    (22954, "Premier", "David Eby", "New Democratic Party (NDP)", "Premier of British Columbia", None),
    (22945, "Premier", "Wab Kinew", "New Democratic Party (NDP)", "Premier of Manitoba", None),
    (22949, "Premier", "Susan Holt", "Liberal Party", "Premier of New Brunswick", None),
    (22952, "Premier", "Tony Wakeham", "Conservative Party", "Premier of Newfoundland and Labrador", None),
    (22950, "Premier", "R.J. Simpson", "Independent", "Premier of the Northwest Territories", None),
    (22951, "Premier", "Tim Houston", "Conservative Party", "Premier of Nova Scotia", None),
    (22956, "Premier", "John Main", "Independent", "Premier of Nunavut", None),
    (22955, "Premier", "Doug Ford", "Conservative Party", "Premier of Ontario", None),
    (22944, "Premier", "Rob Lantz", "Conservative Party", "Premier of Prince Edward Island", None),
    (22953, "Premier", "Christine Fréchette", "Independent", "Premier of Quebec", None),
    (22946, "Premier", "Scott Moe", "Independent", "Premier of Saskatchewan", None),
    (22948, "Premier", "Currie Dixon", "Independent", "Premier of Yukon", None),

    # -- USA: President (National shape) --
    (62895, "President", "Donald J. Trump", "Republican Party",
     "President of the United States", "https://www.whitehouse.gov"),
]

# Keep verified public contact data separate from the seed tuples so a rerun
# cannot overwrite it with NULL values.
OFFICIAL_CONTACT_PHONES = {
    "Bob Ferguson": "360-902-4111",
}


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
    print(f"Upserting {len(RECORDS)} national/provincial head-of-government records...")

    value_tuples = ",\n".join(
        f"({m}, {sql_val(r)}, {sql_val(n)}, {sql_val(p)}, {sql_val(b)}, {sql_val(u)})"
        for m, r, n, p, b, u in RECORDS
    )

    upsert_sql = f"""
BEGIN;

CREATE TEMP TABLE staging_heads (
  map_shape_id bigint,
  role_title text,
  full_name text,
  political_party text,
  bio text,
  source_url text
) ON COMMIT DROP;

INSERT INTO staging_heads VALUES
{value_tuples};

INSERT INTO office_holders (
  map_shape_id, election_role_type_id, full_name, political_party_id,
  bio, source_url, updated_at
)
SELECT DISTINCT ON (s.map_shape_id, ert.id, s.full_name)
  s.map_shape_id,
  ert.id,
  s.full_name,
  pp.id,
  NULLIF(s.bio, ''),
  NULLIF(s.source_url, ''),
  NOW()
FROM staging_heads s
JOIN map_shapes ms ON s.map_shape_id = ms.id
JOIN election_role_types ert ON ert.country = ms.country AND ert.boundary_type = ms.boundary_type AND ert.role_title = s.role_title
LEFT JOIN political_parties pp ON pp.country = ms.country AND pp.name ILIKE s.political_party
ORDER BY s.map_shape_id, ert.id, s.full_name
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
  political_party_id = EXCLUDED.political_party_id,
  bio = EXCLUDED.bio,
  source_url = EXCLUDED.source_url,
  updated_at = NOW();

UPDATE office_holders oh
SET contact_phone = c.contact_phone,
    updated_at = NOW()
FROM (VALUES
  {", ".join(f"({sql_val(name)}, {sql_val(phone)})" for name, phone in OFFICIAL_CONTACT_PHONES.items())}
) AS c(full_name, contact_phone)
WHERE oh.full_name = c.full_name
  AND NULLIF(BTRIM(oh.contact_phone), '') IS NULL;

COMMIT;
"""
    run_psql(upsert_sql)

    print("Creating linked Ghost Profiles & Politician Walls for new heads-of-government...")
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
      AND ert.role_key IN ('prime_minister', 'premier', 'president')
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
  RAISE NOTICE 'Created % ghost profile walls for national/provincial heads of government!', counter;
END $$;
"""
    run_psql(ghost_sql)
    print("Done.")


if __name__ == "__main__":
    main()
