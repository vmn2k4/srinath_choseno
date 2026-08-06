#!/usr/bin/env python3
"""
US Municipal Office Holders Ingestion Pipeline
Fetches Mayors & Council Members across US Municipalities from OpenStates Open-Data
and US Cities Open Datasets, maps them to PostGIS map_shapes,
upserts into office_holders DB table, and auto-creates linked Ghost Profiles + Politician Walls.
"""

import sys
import os
import re
import json
import csv
import glob
import subprocess
import yaml

STATE_FIPS = {
    'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08',
    'CT': '09', 'DE': '10', 'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16',
    'IL': '17', 'IN': '18', 'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22',
    'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
    'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34',
    'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39', 'OK': '40',
    'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45', 'SD': '46', 'TN': '47',
    'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54',
    'WI': '55', 'WY': '56', 'DC': '11', 'PR': '72'
}

STATE_FIPS_REV = {v: k for k, v in STATE_FIPS.items()}

def normalize_name(s):
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r'^(city|town|township|municipality|village|borough|county|charter township of|city of|town of|village of)\s+', '', s)
    s = re.sub(r'\s+(city|town|township|municipality|village|borough|county)$', '', s)
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return s.strip()

def sql_val(val):
    if val is None or val == '':
        return 'NULL'
    clean = str(val).replace("'", "''")
    return f"'{clean}'"

def main():
    print("🚀 Fetching US Municipal map shapes from database...")
    psql_cmd = [
        "psql",
        "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres",
        "-t", "-A", "-F", "\t",
        "-c", "SELECT id, name, properties->>'STATEFP' as state_fips FROM map_shapes WHERE country = 'USA' AND boundary_type = 'Municipal';"
    ]
    res = subprocess.run(psql_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("❌ Error querying map_shapes:", res.stderr)
        sys.exit(1)

    muni_shapes = {}
    state_norm_to_ids = {} # (state_code, norm_name) -> list of shape_ids
    norm_to_ids = {} # fallback norm_name -> list of shape_ids

    for line in res.stdout.strip().split('\n'):
        if not line.strip():
            continue
        parts = line.split('\t')
        if len(parts) >= 2:
            s_id = int(parts[0])
            s_name = parts[1].strip()
            state_fips = parts[2].strip() if len(parts) > 2 else ''
            state_code = STATE_FIPS_REV.get(state_fips, '')

            muni_shapes[s_id] = (s_name, state_code)
            norm = normalize_name(s_name)

            if norm:
                if state_code:
                    key = (state_code, norm)
                    state_norm_to_ids.setdefault(key, []).append(s_id)
                norm_to_ids.setdefault(norm, []).append(s_id)

    print(f"Loaded {len(muni_shapes)} US Municipal shapes from database.")

    # Parse OpenStates municipal files
    openstates_dir = "scripts/openstates_people/data"
    muni_files = glob.glob(f"{openstates_dir}/*/municipalities/*.yml")
    print(f"Found {len(muni_files)} OpenStates US Municipal YAML files...")

    records = []
    matched_count = 0
    unmatched_count = 0

    for fpath in muni_files:
        try:
            with open(fpath, 'r', encoding='utf8') as f:
                data = yaml.safe_load(f)
                if not data:
                    continue

                full_name = data.get('name', '').strip()
                if not full_name:
                    continue

                roles = data.get('roles', [])
                if not roles:
                    continue

                role_obj = roles[0]
                role_type_str = role_obj.get('type', 'mayor').lower()
                is_mayor = role_type_str in ['mayor', 'executive']
                role_title = 'Mayor' if is_mayor else 'Council Member'
                role_type_id = '53d611c8-f1c1-4d4d-8eaa-17711992d33e' if is_mayor else '3ecded5c-50b4-48cb-8bb9-1ec54d638e8e'

                juris = role_obj.get('jurisdiction', '')
                state_code = ''
                city_name = ''

                if '/state:' in juris:
                    state_code = juris.split('/state:')[1].split('/')[0].upper()
                if '/place:' in juris:
                    raw_place = juris.split('/place:')[1].split('/')[0]
                    city_name = raw_place.replace('_', ' ').title()

                if not city_name:

                    parts = fpath.split(os.sep)
                    if len(parts) >= 3:
                        state_code = parts[-3].upper()

                norm_city = normalize_name(city_name)
                target_shape_id = None

                # 1. State + Exact City match
                if state_code and (state_code, norm_city) in state_norm_to_ids:
                    target_shape_id = state_norm_to_ids[(state_code, norm_city)][0]
                elif norm_city in norm_to_ids:
                    target_shape_id = norm_to_ids[norm_city][0]
                else:
                    # Fallback partial match
                    for (st, norm_k), s_ids in state_norm_to_ids.items():
                        if st == state_code and (norm_k in norm_city or norm_city in norm_k):
                            target_shape_id = s_ids[0]
                            break

                if target_shape_id:
                    matched_count += 1
                    email = data.get('email', '')
                    offices = data.get('offices', [])
                    tel = ''
                    if offices:
                        tel = offices[0].get('voice', '')
                    
                    links = data.get('links', [])
                    sources = data.get('sources', [])
                    source_url = ''
                    if links:
                        source_url = links[0].get('url', '')
                    elif sources:
                        source_url = sources[0].get('url', '')

                    photo_url = data.get('image', '') or data.get('photo_url', '')
                    party = data.get('party', '') or 'Nonpartisan'
                    city_display, st_display = muni_shapes[target_shape_id]
                    bio = f"{role_title} of {city_display}" + (f", {st_display}" if st_display else "")

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
        except Exception as e:
            print(f"Error parsing {fpath}: {e}")

    # Additional major US city council members dataset
    print("🏙️ Supplementing major US City Mayors & Council Members...")
    major_us_officials = [
        # New York City
        (33937, 'Mayor', '53d611c8-f1c1-4d4d-8eaa-17711992d33e', 'Eric Adams', 'Democratic Party', 'Mayor of New York City', 'e-adams@cityhall.nyc.gov', '212-788-3000', 'https://www.nyc.gov/office-of-the-mayor/', 'https://www.nyc.gov/assets/home/images/mayor/eric-adams.jpg'),
        (33937, 'Council Member', '3ecded5c-50b4-48cb-8bb9-1ec54d638e8e', 'Adrienne Adams', 'Democratic Party', 'Speaker of New York City Council (District 28)', 'speakeradams@council.nyc.gov', '212-788-7210', 'https://council.nyc.gov/district-28/', 'https://council.nyc.gov/district-28/wp-content/uploads/sites/28/2022/01/speaker-adams.jpg'),
        (33937, 'Council Member', '3ecded5c-50b4-48cb-8bb9-1ec54d638e8e', 'Keith Powers', 'Democratic Party', 'New York City Council Member (District 4)', 'kpowers@council.nyc.gov', '212-818-0580', 'https://council.nyc.gov/district-4/', 'https://council.nyc.gov/district-4/wp-content/uploads/sites/4/2018/01/powers.jpg'),
        (33937, 'Council Member', '3ecded5c-50b4-48cb-8bb9-1ec54d638e8e', 'Justin Brannan', 'Democratic Party', 'New York City Council Member (District 47)', 'jbrannan@council.nyc.gov', '718-748-5200', 'https://council.nyc.gov/district-47/', 'https://council.nyc.gov/district-47/wp-content/uploads/sites/47/2018/01/brannan.jpg'),
        
        # Los Angeles
        (35992, 'Mayor', '53d611c8-f1c1-4d4d-8eaa-17711992d33e', 'Karen Bass', 'Democratic Party', 'Mayor of Los Angeles', 'mayor.helpdesk@lacity.org', '213-978-0600', 'https://mayor.lacity.gov/', 'https://mayor.lacity.gov/sites/g/files/wph1781/files/2022-12/karen-bass.jpg'),
        (35992, 'Council Member', '3ecded5c-50b4-48cb-8bb9-1ec54d638e8e', 'Marqueece Harris-Dawson', 'Democratic Party', 'President of Los Angeles City Council (District 8)', 'councilmember.harris-dawson@lacity.org', '213-473-7008', 'https://councildistrict8.lacity.gov/', 'https://councildistrict8.lacity.gov/sites/g/files/wph1781/files/2022-12/mhd.jpg'),
        (35992, 'Council Member', '3ecded5c-50b4-48cb-8bb9-1ec54d638e8e', 'Eunisses Hernandez', 'Democratic Party', 'Los Angeles City Council Member (District 1)', 'councilmember.hernandez@lacity.org', '213-473-7001', 'https://cd1.lacity.gov/', 'https://cd1.lacity.gov/sites/g/files/wph1781/files/2022-12/hernandez.jpg'),
        (35992, 'Council Member', '3ecded5c-50b4-48cb-8bb9-1ec54d638e8e', 'Katy Yaroslavsky', 'Democratic Party', 'Los Angeles City Council Member (District 5)', 'councilmember.yaroslavsky@lacity.org', '213-473-7005', 'https://cd5.lacity.gov/', 'https://cd5.lacity.gov/sites/g/files/wph1781/files/2022-12/katy.jpg'),

        # Chicago
        (30998, 'Mayor', '53d611c8-f1c1-4d4d-8eaa-17711992d33e', 'Brandon Johnson', 'Democratic Party', 'Mayor of Chicago', 'lettertomayor@cityofchicago.org', '312-744-3300', 'https://www.chicago.gov/city/en/depts/mayor.html', 'https://www.chicago.gov/content/dam/city/depts/mayor/images/brandon-johnson.jpg'),
        (30998, 'Council Member', '3ecded5c-50b4-48cb-8bb9-1ec54d638e8e', 'Daniel La Spata', 'Democratic Party', 'Chicago Alderperson (1st Ward)', 'ward01@cityofchicago.org', '773-278-9201', 'https://the1stward.com/', 'https://the1stward.com/images/laspata.jpg'),
        (30998, 'Council Member', '3ecded5c-50b4-48cb-8bb9-1ec54d638e8e', 'Brian Hopkins', 'Democratic Party', 'Chicago Alderperson (2nd Ward)', 'ward02@cityofchicago.org', '312-643-2299', 'https://aldermanhopkins.com/', 'https://aldermanhopkins.com/images/hopkins.jpg'),
        
        # Houston
        (33937, 'Mayor', '53d611c8-f1c1-4d4d-8eaa-17711992d33e', 'John Whitmire', 'Democratic Party', 'Mayor of Houston', 'mayor@houstontx.gov', '832-393-1000', 'https://www.houstontx.gov/mayor/', 'https://www.houstontx.gov/mayor/images/john-whitmire.jpg'),
        
        # Phoenix
        (30600, 'Mayor', '53d611c8-f1c1-4d4d-8eaa-17711992d33e', 'Kate Gallego', 'Democratic Party', 'Mayor of Phoenix', 'mayor.gallego@phoenix.gov', '602-262-7111', 'https://www.phoenix.gov/mayor', 'https://www.phoenix.gov/mayorsite/Documents/kate-gallego.jpg'),

        # Philadelphia
        (34125, 'Mayor', '53d611c8-f1c1-4d4d-8eaa-17711992d33e', 'Cherelle Parker', 'Democratic Party', 'Mayor of Philadelphia', 'cherelle.parker@phila.gov', '215-686-2181', 'https://www.phila.gov/executive-branch/mayor/', 'https://www.phila.gov/media/20240102143000/cherelle-parker.jpg'),

        # San Antonio
        (37158, 'Mayor', '53d611c8-f1c1-4d4d-8eaa-17711992d33e', 'Ron Nirenberg', 'Nonpartisan', 'Mayor of San Antonio', 'mayor.ronnirenberg@sanantonio.gov', '210-207-7060', 'https://www.sanantonio.gov/mayor', 'https://www.sanantonio.gov/Portals/0/Files/Mayor/ron-nirenberg.jpg'),

        # San Diego
        (35849, 'Mayor', '53d611c8-f1c1-4d4d-8eaa-17711992d33e', 'Todd Gloria', 'Democratic Party', 'Mayor of San Diego', 'mayortoddgloria@sandiego.gov', '619-236-6330', 'https://www.sandiego.gov/mayor', 'https://www.sandiego.gov/sites/default/files/gloria.jpg'),

        # Dallas
        (40256, 'Mayor', '53d611c8-f1c1-4d4d-8eaa-17711992d33e', 'Eric Johnson', 'Republican Party', 'Mayor of Dallas', 'eric.johnson@dallascityhall.com', '214-670-4054', 'https://dallascityhall.com/government/citymayor', 'https://dallascityhall.com/government/citymayor/PublishingImages/johnson.jpg'),

        # Austin
        (30600, 'Mayor', '53d611c8-f1c1-4d4d-8eaa-17711992d33e', 'Kirk Watson', 'Democratic Party', 'Mayor of Austin', 'kirk.watson@austintexas.gov', '512-974-2250', 'https://www.austintexas.gov/department/mayor-watson', 'https://www.austintexas.gov/sites/default/files/watson.jpg'),

        # San Jose
        (33226, 'Mayor', '53d611c8-f1c1-4d4d-8eaa-17711992d33e', 'Matt Mahan', 'Democratic Party', 'Mayor of San Jose', 'mayormahan@sanjoseca.gov', '408-535-4800', 'https://www.sanjoseca.gov/your-government/departments-offices/mayor-and-council/mayor-matt-mahan', 'https://www.sanjoseca.gov/home/showpublishedimage/11550/638084224747200000'),

        # Seattle
        (37753, 'Mayor', '53d611c8-f1c1-4d4d-8eaa-17711992d33e', 'Bruce Harrell', 'Democratic Party', 'Mayor of Seattle', 'bruce.harrell@seattle.gov', '206-684-4000', 'https://www.seattle.gov/mayor', 'https://www.seattle.gov/images/mayor-harrell.jpg'),

        # Miami
        (37592, 'Mayor', '53d611c8-f1c1-4d4d-8eaa-17711992d33e', 'Francis Suarez', 'Republican Party', 'Mayor of Miami', 'fsuarez@miamigov.com', '305-250-5300', 'https://www.miamigov.com/My-Government/Officials/Mayor-Francis-Suarez', 'https://www.miamigov.com/files/assets/public/v/1/mayor-suarez.jpg'),
    ]

    for item in major_us_officials:
        records.append({
            'map_shape_id': item[0],
            'role_title': item[1],
            'role_type_id': item[2],
            'full_name': item[3],
            'political_party': item[4],
            'bio': item[5],
            'contact_email': item[6],
            'contact_phone': item[7],
            'holding_since': '',
            'source_url': item[8],
            'photo_url': item[9]
        })

    print(f"🎉 Matched {matched_count} US Municipal Office Holders from OpenStates!")
    print(f"Total US Municipal Records Compiled: {len(records)}")

    # Append to office-holders-data.csv
    csv_file = "/Users/vmn2k4/Coding/Choseno/scripts/office-holders-data.csv"
    with open(csv_file, 'a', encoding='utf8', newline='') as f:
        writer = csv.writer(f)
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
    sql_file = "/Users/vmn2k4/Coding/Choseno/scripts/us_muni_import.sql"
    with open(sql_file, 'w', encoding='utf8') as f_sql:
        f_sql.write("""
BEGIN;

CREATE TEMP TABLE staging_us_muni_holders (
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

INSERT INTO staging_us_muni_holders VALUES
""" + join_tuples + """
;

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
  NOW()
FROM staging_us_muni_holders s
LEFT JOIN political_parties pp ON pp.country = 'USA' AND pp.name ILIKE s.political_party
ORDER BY s.map_shape_id, s.election_role_type_id, s.full_name
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
  political_party_id = EXCLUDED.political_party_id,
  bio = EXCLUDED.bio,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  source_url = EXCLUDED.source_url,
  photo_url = EXCLUDED.photo_url,
  updated_at = NOW();

COMMIT;
""")

    print(f"Executing SQL import for {len(records)} US Municipal records...")
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

    # Create Ghost Profiles & Politician Walls for all newly inserted unlinked US municipal office holders
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
    WHERE oh.linked_profile_id IS NULL AND ms.country = 'USA' AND ms.boundary_type = 'Municipal'
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
  RAISE NOTICE 'Created % ghost profile walls for US Municipal office holders!', counter;
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

    print("🎉 US MUNICIPAL INGESTION COMPLETE!")

if __name__ == "__main__":
    main()
