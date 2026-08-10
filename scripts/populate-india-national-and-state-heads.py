#!/usr/bin/env python3
"""
India Prime Minister + State/UT Chief Ministers Ingestion
Populates office_holders for India's Prime Minister (National placeholder shape) and
the 31 states/UTs that have a Chief Minister (State container shapes), then
auto-creates linked Ghost Profiles + Politician Wall pages for each -- same pattern as
populate-national-and-province-heads.py's Canada/USA heads-of-government ingestion.

Source: web research current as of Aug 2026 (Wikipedia's "List of current Indian chief
ministers", cross-checked against independent searches for the most surprising entries --
Kerala, Karnataka, and Delhi -- since a Wikipedia table extraction is not infallible.
Found and corrected one real error this way: Delhi's Rekha Gupta is BJP, not AAP, per
independent news sources (BJP won the 2025 Delhi election ending AAP's decade-long rule).
Kerala (V. D. Satheesan/UDF, since 18 May 2026) and Karnataka (D. K. Shivakumar/INC, since
3 June 2026) both looked surprising but were independently confirmed as real, recent
government changes -- not extraction errors.

5 UTs have no Chief Minister at all (administered directly by a President-appointed
Administrator/Lieutenant Governor, not an elected head of government): Andaman & Nicobar,
Chandigarh, Dadra & Nagar Haveli and Daman & Diu, Ladakh, Lakshadweep. Correctly excluded
below, not a data gap.
"""

import subprocess

DB_URL = "postgresql://postgres.qlzyfdwrkcxyqapewxwg:pa.8tX5%2BHh%2FGZn2@aws-1-us-east-2.pooler.supabase.com:5432/postgres"

# (map_shape_id, role_title, full_name, political_party, bio, source_url)
RECORDS = [
    # -- India: Prime Minister (National shape) --
    (90197, "Prime Minister", "Narendra Modi", "Bharatiya Janata Party",
     "Prime Minister of India", "https://www.pmindia.gov.in"),

    # -- India: Chief Ministers (State container shapes) --
    (63416, "Chief Minister", "N. Chandrababu Naidu", "Telugu Desam Party", "Chief Minister of Andhra Pradesh", None),
    (63374, "Chief Minister", "Pema Khandu", "Bharatiya Janata Party", "Chief Minister of Arunachal Pradesh", None),
    (63407, "Chief Minister", "Himanta Biswa Sarma", "Bharatiya Janata Party", "Chief Minister of Assam", None),
    (63399, "Chief Minister", "Samrat Choudhary", "Janata Dal (United)", "Chief Minister of Bihar", None),
    (63402, "Chief Minister", "Vishnu Deo Sai", "Bharatiya Janata Party", "Chief Minister of Chhattisgarh", None),
    (63357, "Chief Minister", "Rekha Gupta", "Bharatiya Janata Party", "Chief Minister of Delhi", None),
    (63358, "Chief Minister", "Pramod Sawant", "Bharatiya Janata Party", "Chief Minister of Goa", None),
    (63428, "Chief Minister", "Bhupendrabhai Patel", "Bharatiya Janata Party", "Chief Minister of Gujarat", None),
    (63394, "Chief Minister", "Nayab Singh Saini", "Bharatiya Janata Party", "Chief Minister of Haryana", None),
    (63376, "Chief Minister", "Sukhvinder Singh Sukhu", "Indian National Congress", "Chief Minister of Himachal Pradesh", None),
    (63366, "Chief Minister", "Omar Abdullah", "Jammu & Kashmir National Conference", "Chief Minister of Jammu and Kashmir", None),
    (63396, "Chief Minister", "Hemant Soren", "Jharkhand Mukti Morcha", "Chief Minister of Jharkhand", None),
    (63413, "Chief Minister", "D. K. Shivakumar", "Indian National Congress", "Chief Minister of Karnataka", None),
    (63383, "Chief Minister", "V. D. Satheesan", "Indian National Congress", "Chief Minister of Kerala", None),
    (63442, "Chief Minister", "Mohan Yadav", "Bharatiya Janata Party", "Chief Minister of Madhya Pradesh", None),
    (63425, "Chief Minister", "Devendra Fadnavis", "Bharatiya Janata Party", "Chief Minister of Maharashtra", None),
    (63368, "Chief Minister", "Yumnam Khemchand Singh", "Bharatiya Janata Party", "Chief Minister of Manipur", None),
    (63387, "Chief Minister", "Conrad Sangma", "National Peoples Party", "Chief Minister of Meghalaya", None),
    (63385, "Chief Minister", "Lalduhoma", "Zoram Peoples Movement", "Chief Minister of Mizoram", None),
    (63372, "Chief Minister", "Neiphiu Rio", "Naga Peoples Front", "Chief Minister of Nagaland", None),
    (63410, "Chief Minister", "Mohan Charan Majhi", "Bharatiya Janata Party", "Chief Minister of Odisha", None),
    (63360, "Chief Minister", "N. Rangaswamy", "All India N.R. Congress", "Chief Minister of Puducherry", None),
    (63391, "Chief Minister", "Bhagwant Mann", "Aam Aadmi Party", "Chief Minister of Punjab", None),
    (63420, "Chief Minister", "Bhajan Lal Sharma", "Bharatiya Janata Party", "Chief Minister of Rajasthan", None),
    (63364, "Chief Minister", "Prem Singh Tamang", "Sikkim Krantikari Morcha", "Chief Minister of Sikkim", None),
    (63405, "Chief Minister", "C. Joseph Vijay", "Tamilaga Vettri Kazhagam", "Chief Minister of Tamil Nadu", None),
    (63389, "Chief Minister", "Revanth Reddy", "Indian National Congress", "Chief Minister of Telangana", None),
    (63381, "Chief Minister", "Manik Saha", "Bharatiya Janata Party", "Chief Minister of Tripura", None),
    (63432, "Chief Minister", "Yogi Adityanath", "Bharatiya Janata Party", "Chief Minister of Uttar Pradesh", None),
    (63378, "Chief Minister", "Pushkar Singh Dhami", "Bharatiya Janata Party", "Chief Minister of Uttarakhand", None),
    (63437, "Chief Minister", "Suvendu Adhikari", "Bharatiya Janata Party", "Chief Minister of West Bengal", None),
]


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
    print(f"Upserting {len(RECORDS)} India national/state head-of-government records...")

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
      AND ms.country = 'India'
      AND ert.role_key IN ('prime_minister', 'chief_minister')
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
  RAISE NOTICE 'Created % ghost profile walls for India national/state heads of government!', counter;
END $$;
"""
    run_psql(ghost_sql)
    print("Done.")


if __name__ == "__main__":
    main()
