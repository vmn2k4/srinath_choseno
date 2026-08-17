#!/usr/bin/env python3
"""
Canadian Municipal Office Holders Ingestion Pipeline
Fetches Mayors & Councillors across Canadian Municipalities from OpenNorth API,
maps them to PostGIS map_shapes, upserts into office_holders DB table,
and auto-creates linked Ghost Profiles + Politician Wall pages.
"""

import sys
import os
import re
import json
import csv
import subprocess
import urllib.request

def normalize_name(s):
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r'^(city|town|township|municipality|ville|district|borough|county|region|village|rm of|resort village of|district of)\s+(of\s+)?', '', s)
    s = re.sub(r'\s+(city|town|township|municipality|ville|district|borough|county|region|village)$', '', s)
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return s.strip()

PROVINCES = [
    'British Columbia', 'Alberta', 'Saskatchewan', 'Manitoba', 'Ontario',
    'Quebec', 'New Brunswick', 'Nova Scotia', 'Prince Edward Island',
    'Newfoundland and Labrador', 'Yukon', 'Northwest Territories', 'Nunavut',
]

def extract_csd_code(rep):
    # OpenNorth's boundary_url is /boundaries/census-subdivisions/<code>/ for
    # about half of municipal reps (some use custom ward-level boundary sets
    # instead) -- when present it's an exact StatCan CSD code, the same
    # numbering our map_shapes.code column uses for the 2021 Census
    # Subdivisions upload. Its first 2 digits ARE the province/territory, so
    # matching on it sidesteps the whole cross-province name-collision
    # problem entirely instead of just scoping around it.
    bu = ((rep.get('related') or {}).get('boundary_url')) or ''
    m = re.search(r'census-subdivisions/(\d+)/?$', bu)
    return m.group(1) if m else None

def extract_province(rep):
    # representative_set_name is inconsistently formatted -- some carry the
    # province ("British Columbia municipal councils"), many don't ("Stratford
    # Town Council", "Clarington Municipal Council") -- so this is a
    # best-effort secondary signal, not a guarantee every rep gets scoped.
    set_name = (rep.get('representative_set_name') or '')
    for prov in PROVINCES:
        if prov.lower() in set_name.lower():
            return prov
    return None

def sql_val(val):
    if val is None or val == '':
        return 'NULL'
    clean = str(val).replace("'", "''")
    return f"'{clean}'"

def main():
    print("🚀 Fetching Canadian Municipal map shapes from database...")
    psql_cmd = [
        "psql",
        "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres",
        "-t", "-A", "-F", "\t",
        "-c", """
            SELECT ms.id, ms.name, ms.code, p.name
            FROM map_shapes ms
            LEFT JOIN shape_containers sc ON sc.map_shape_id = ms.id
            LEFT JOIN map_shapes p ON p.id = sc.container_shape_id AND p.boundary_type = 'Province'
            WHERE ms.country = 'Canada' AND ms.boundary_type = 'Municipal' AND ms.retired_at IS NULL;
        """
    ]
    res = subprocess.run(psql_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("❌ Error querying map_shapes:", res.stderr)
        sys.exit(1)

    muni_shapes = {}
    code_to_id = {}
    # (province, normalized name) -> shape_id -- primary name-based match
    province_norm_to_id = {}
    # normalized name -> list of shape_ids -- last-resort fallback, only
    # used when a name is unambiguous nationally (exactly one candidate).
    # Names collide across provinces constantly (Victoria: BC/MB/NL/PEI;
    # Woodstock: NB/NL/ON; Richmond, Hope, Armstrong all repeat too) --
    # guessing among multiple candidates is exactly what silently attached
    # real BC officeholders to other provinces' shapes before this fix.
    norm_to_ids = {}
    for line in res.stdout.strip().split('\n'):
        if not line.strip():
            continue
        parts = line.split('\t')
        if len(parts) >= 2:
            s_id = int(parts[0])
            s_name = parts[1].strip()
            s_code = parts[2].strip() if len(parts) > 2 else ''
            s_province = parts[3].strip() if len(parts) > 3 else ''
            muni_shapes[s_id] = s_name
            if s_code:
                code_to_id[s_code] = s_id
            norm = normalize_name(s_name)
            if norm:
                norm_to_ids.setdefault(norm, []).append(s_id)
                if s_province:
                    province_norm_to_id[(s_province, norm)] = s_id

    print(f"Loaded {len(muni_shapes)} Canadian Municipal shapes from database.")

    # 2. Fetch representatives from OpenNorth API
    print("🌐 Fetching Canadian Municipal Mayors & Councillors from OpenNorth API...")
    url = "https://represent.opennorth.ca/representatives/?limit=1000"
    all_reps = []
    
    while url:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode())
                objs = data.get('objects', [])
                all_reps.extend(objs)
                next_url = data.get('meta', {}).get('next')
                if next_url:
                    url = "https://represent.opennorth.ca" + next_url if not next_url.startswith('http') else next_url
                else:
                    url = None
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            break

    print(f"Total OpenNorth Representatives Fetched: {len(all_reps)}")

    records = []
    matched_count = 0
    unmatched_count = 0

    for rep in all_reps:
        office_raw = (rep.get('elected_office') or '').strip()
        # Filter for municipal offices
        if office_raw in ['MP', 'MLA', 'MPP', 'MHA']:
            continue

        is_mayor = office_raw.lower() in ['mayor', 'lord mayor', 'maire', 'maire de la ville de montréal', "maire d'arrondissement", 'reeve', 'warden', 'regional chair', 'chair']
        role_title = 'Mayor' if is_mayor else 'Councillor'
        role_type_id = '3855aeb9-c840-4d81-bb83-66cad128ea8c' if is_mayor else '6d2e3815-05d9-4784-b220-1d73140b5bf3'

        full_name = (rep.get('name') or '').strip()
        if not full_name:
            continue

        # Determine target municipality name
        dist_name = (rep.get('district_name') or '').strip()
        set_name = (rep.get('representative_set_name') or '').strip()

        # Clean set_name (e.g., "Vancouver City Council" -> "Vancouver")
        clean_set = re.sub(r'\s+(city|town|township|district|county|regional)\s+(council|administration)$', '', set_name, flags=re.IGNORECASE).strip()
        clean_set = re.sub(r'\s+council$', '', clean_set, flags=re.IGNORECASE).strip()

        target_shape_id = None
        norm_dist = normalize_name(dist_name)
        norm_set = normalize_name(clean_set)

        # Tier 1: exact StatCan census-subdivision code -- unambiguous by
        # construction, sidesteps name collisions entirely. Available for
        # roughly half of reps (OpenNorth uses custom ward-level boundary
        # sets, not a plain CSD reference, for the rest).
        csd_code = extract_csd_code(rep)
        if csd_code and csd_code in code_to_id:
            target_shape_id = code_to_id[csd_code]
        else:
            # Tier 2: province-scoped name match, when representative_set_name
            # carries a recognizable province (not all of them do).
            province = extract_province(rep)
            if province:
                target_shape_id = province_norm_to_id.get((province, norm_dist)) or province_norm_to_id.get((province, norm_set))
            # Tier 3: unscoped exact name match, ONLY if that name is
            # unambiguous nationally (exactly one shape has it) -- no
            # substring fallback. A name with multiple candidates and no
            # province signal is left unmatched rather than guessed at.
            if not target_shape_id:
                for norm_k in (norm_dist, norm_set):
                    candidates = norm_to_ids.get(norm_k) or []
                    if len(candidates) == 1:
                        target_shape_id = candidates[0]
                        break

        if target_shape_id:
            matched_count += 1
            offices = rep.get('offices', [])
            tel = offices[0].get('tel', '') if offices else ''
            email = rep.get('email', '')
            source_url = rep.get('source_url') or rep.get('url') or rep.get('personal_url') or ''
            photo_url = rep.get('photo_url', '')
            party = rep.get('party_name') or 'Independent'
            city_name = muni_shapes[target_shape_id]
            bio = f"{role_title} for {city_name}"

            records.append({
                'map_shape_id': target_shape_id,
                'role_title': role_title,
                'role_type_id': role_type_id,
                'full_name': full_name,
                'political_party': party,
                'bio': bio,
                'contact_email': email,
                'contact_phone': tel,
                'holding_since': '',
                'source_url': source_url,
                'photo_url': photo_url
            })
        else:
            unmatched_count += 1

    print(f"🎉 Matched {matched_count} Canadian Municipal Office Holders across {len(set(r['map_shape_id'] for r in records))} cities/towns!")
    print(f"Unmatched: {unmatched_count}")

    # Append to office-holders-data.csv
    csv_file = "/Users/vmn2k4/Coding/Choseno/scripts/office-holders-data.csv"
    existing_headers = None
    if os.path.exists(csv_file):
        with open(csv_file, 'r', encoding='utf8') as f:
            reader = csv.reader(f)
            existing_headers = next(reader, None)

    with open(csv_file, 'a', encoding='utf8', newline='') as f:
        writer = csv.writer(f)
        if not existing_headers:
            writer.writerow(['map_shape_id', 'role_title', 'full_name', 'political_party', 'bio', 'contact_email', 'contact_phone', 'holding_since', 'source_url', 'photo_url'])
        for r in records:
            writer.writerow([
                r['map_shape_id'],
                r['role_title'],
                r['full_name'],
                r['political_party'],
                r['bio'],
                r['contact_email'],
                r['contact_phone'],
                r['holding_since'],
                r['source_url'],
                r['photo_url']
            ])

    print(f"Updated CSV at {csv_file}")

    # Generate SQL import
    value_tuples = []
    for r in records:
        value_tuples.append(f"({r['map_shape_id']}, {sql_val(r['role_type_id'])}, {sql_val(r['full_name'])}, {sql_val(r['political_party'])}, {sql_val(r['bio'])}, {sql_val(r['contact_email'])}, {sql_val(r['contact_phone'])}, {sql_val(r['holding_since'])}, {sql_val(r['source_url'])}, {sql_val(r['photo_url'])})")

    join_tuples = ',\n'.join(value_tuples)
    sql_file = "/Users/vmn2k4/Coding/Choseno/scripts/muni_import.sql"
    with open(sql_file, 'w', encoding='utf8') as f_sql:
        f_sql.write("""
BEGIN;

CREATE TEMP TABLE staging_muni_holders (
  map_shape_id bigint,
  election_role_type_id uuid,
  full_name text,
  political_party text,
  bio text,
  contact_email text,
  contact_phone text,
  holding_since text,
  source_url text,
  photo_url text
) ON COMMIT DROP;

INSERT INTO staging_muni_holders VALUES
""" + join_tuples + """
;

-- Retire outgoing holders BEFORE upserting: any currently-marked-current
-- officeholder for a (map_shape_id, election_role_type_id) this fetch
-- covers, whose name doesn't appear in this fetch's results for that same
-- seat, lost their seat (or the API no longer lists them for it) and is
-- retired rather than left dangling as a stale "current" row. This is what
-- makes a re-run of this script actually pick up an election result instead
-- of just adding the winner alongside whoever it fetched last time --
-- see 20260816000000_office_holder_term_lifecycle.sql for why retire
-- in place instead of delete/overwrite.
UPDATE office_holders oh
SET is_current = false, term_ended_at = CURRENT_DATE, updated_at = NOW()
WHERE oh.is_current = true
  AND EXISTS (
    SELECT 1 FROM staging_muni_holders s
    WHERE s.map_shape_id = oh.map_shape_id AND s.election_role_type_id = oh.election_role_type_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM staging_muni_holders s
    WHERE s.map_shape_id = oh.map_shape_id
      AND s.election_role_type_id = oh.election_role_type_id
      AND s.full_name = oh.full_name
  );

INSERT INTO office_holders (
  map_shape_id,
  election_role_type_id,
  full_name,
  political_party_id,
  bio,
  contact_email,
  contact_phone,
  holding_since,
  source_url,
  photo_url,
  is_current,
  term_ended_at,
  updated_at
)
SELECT DISTINCT ON (s.map_shape_id, s.election_role_type_id, s.full_name)
  s.map_shape_id,
  s.election_role_type_id,
  s.full_name,
  pp.id AS political_party_id,
  NULLIF(s.bio, ''),
  NULLIF(s.contact_email, ''),
  NULLIF(s.contact_phone, ''),
  CASE WHEN s.holding_since IS NOT NULL AND s.holding_since != '' THEN s.holding_since::date ELSE NULL END,
  NULLIF(s.source_url, ''),
  NULLIF(s.photo_url, ''),
  true,
  NULL,
  NOW()
FROM staging_muni_holders s
LEFT JOIN political_parties pp ON pp.country = 'Canada' AND pp.name ILIKE s.political_party
ORDER BY s.map_shape_id, s.election_role_type_id, s.full_name
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
  political_party_id = EXCLUDED.political_party_id,
  bio = EXCLUDED.bio,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  source_url = EXCLUDED.source_url,
  photo_url = EXCLUDED.photo_url,
  -- A name that matches an existing (map_shape_id, election_role_type_id,
  -- full_name) row is, by definition, still being reported for this seat --
  -- re-affirm current in case this is the same person un-retiring (re-won
  -- after a prior loss) rather than a continuously-serving incumbent.
  is_current = true,
  term_ended_at = NULL,
  updated_at = NOW();

COMMIT;
""")

    print(f"Executing SQL import for {len(records)} Canadian Municipal records...")
    psql_import = [
        "psql",
        "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres",
        "-f", sql_file
    ]
    res = subprocess.run(psql_import, capture_output=True, text=True)
    if res.returncode != 0:
        print("❌ SQL Import Error:", res.stderr)
        sys.exit(1)

    print("✅ SQL Import complete! Now creating linked Ghost Profiles & Politician Walls...")

    # Create Ghost Profiles & Politician Walls for all newly inserted unlinked municipal office holders
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
      oh.id as office_holder_id,
      oh.full_name,
      oh.bio,
      oh.photo_url,
      oh.political_party_id,
      ms.country,
      ms.name as boundary_name,
      ms.boundary_type,
      ert.role_title
    FROM office_holders oh
    JOIN map_shapes ms ON oh.map_shape_id = ms.id
    JOIN election_role_types ert ON oh.election_role_type_id = ert.id
    WHERE oh.linked_profile_id IS NULL AND ms.boundary_type = 'Municipal'
  LOOP
    new_profile_id := gen_random_uuid();
    new_ghost_id := gen_random_uuid();

    INSERT INTO profiles (
      id,
      role,
      full_name,
      country,
      constituency,
      designation,
      current_ghost_id,
      updated_at
    ) VALUES (
      new_profile_id,
      'politician',
      r.full_name,
      r.country,
      r.boundary_name,
      r.role_title,
      new_ghost_id,
      NOW()
    );

    INSERT INTO politician_profiles (
      id,
      political_target_role,
      target_boundary_type,
      target_boundary_name,
      bio,
      avatar_url,
      political_party_id,
      created_at,
      updated_at
    ) VALUES (
      new_profile_id,
      r.role_title,
      r.boundary_type,
      r.boundary_name,
      r.bio,
      r.photo_url,
      r.political_party_id,
      NOW(),
      NOW()
    ) ON CONFLICT (id) DO UPDATE SET
      avatar_url = EXCLUDED.avatar_url,
      bio = EXCLUDED.bio,
      target_boundary_name = EXCLUDED.target_boundary_name;

    UPDATE office_holders
    SET linked_profile_id = new_profile_id
    WHERE id = r.office_holder_id;

    counter := counter + 1;
  END LOOP;
  RAISE NOTICE 'Created % ghost profile walls for Canadian Municipal office holders!', counter;
END $$;
"""
    psql_ghost = [
        "psql",
        "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres",
        "-c", ghost_sql
    ]
    res = subprocess.run(psql_ghost, capture_output=True, text=True)
    if res.returncode != 0:
        print("❌ Ghost creation error:", res.stderr)
    else:
        print(res.stdout)

    print("🎉 CANADIAN MUNICIPAL INGESTION COMPLETE!")

if __name__ == "__main__":
    main()
