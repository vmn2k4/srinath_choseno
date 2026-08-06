import os, sys, re, json, csv, urllib.request, zipfile, subprocess

db_url = "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres"

def clean_str(s):
    if not s: return ""
    import unicodedata
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.lower().replace('œ', 'oe').replace('æ', 'ae')

fips_to_state = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE",
  "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS",
  "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY",
  "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC",
  "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY", "72": "PR", "11": "DC"
}

def map_party(p, country):
    if not p: return "Independent"
    p_lower = p.lower()
    if country == "Canada":
        if "liberal" in p_lower: return "Liberal Party"
        if "conservative" in p_lower: return "Conservative Party"
        if "ndp" in p_lower or "new democratic" in p_lower: return "New Democratic Party (NDP)"
        if "bloc" in p_lower: return "Bloc Québécois"
        if "green" in p_lower: return "Green Party"
        if "people" in p_lower: return "People's Party of Canada"
        return "Independent"
    else:
        if "democrat" in p_lower: return "Democratic Party"
        if "republican" in p_lower or "gop" in p_lower: return "Republican Party"
        if "libertarian" in p_lower: return "Libertarian Party"
        if "green" in p_lower: return "Green Party"
        return "Independent"

def main():
    print("🚀 Fetching database map shapes via psql...")
    cmd = ['psql', db_url, '-t', '-A', '-c', "SELECT id, country, boundary_type, name, code, properties FROM map_shapes;"]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, text=True)
    lines = p.stdout.strip().split('\n')
    print(f"Loaded {len(lines)} total map shapes from DB.")

    can_fed_map = {}
    can_prov_map = {}
    us_state_map = {}
    us_fed_map = {}
    us_senate_map = {}
    us_house_map = {}

    for line in lines:
        if not line: continue
        parts = line.split('|')
        if len(parts) < 6: continue
        s_id = int(parts[0])
        country = parts[1]
        b_type = parts[2]
        name = parts[3]
        code = parts[4]
        props_raw = parts[5]

        clean_n = clean_str(re.sub(r'[^a-zA-Z0-9]', '', name))

        if country == 'Canada' and b_type == 'Federal':
            can_fed_map[clean_n] = s_id
        elif country == 'Canada' and b_type == 'Provincial':
            can_prov_map[clean_n] = s_id
        elif country == 'USA' and b_type == 'State':
            us_state_map[code.upper()] = s_id
            us_state_map[name.upper()] = s_id
        elif country == 'USA' and b_type == 'Federal':
            code_str = str(code).zfill(4)
            st_fips = code_str[:2]
            dist_num = int(code_str[2:]) if code_str[2:].isdigit() else 0
            st_abbr = fips_to_state.get(st_fips)
            if st_abbr:
                us_fed_map[f"{st_abbr}-{dist_num}"] = s_id
        elif country == 'USA' and b_type == 'State Senate':
            stusps_m = re.search(r'"stusps":\s*"([A-Z]{2})"', props_raw)
            if stusps_m:
                st = stusps_m.group(1)
                code_str = str(code).zfill(5)
                dist_num = code_str[2:].lstrip('0') or '0'
                us_senate_map[(st, dist_num)] = s_id
        elif country == 'USA' and b_type == 'State House':
            stusps_m = re.search(r'"stusps":\s*"([A-Z]{2})"', props_raw)
            if stusps_m:
                st = stusps_m.group(1)
                code_str = str(code).zfill(5)
                dist_num = code_str[2:].lstrip('0') or '0'
                us_house_map[(st, dist_num)] = s_id

    records = []

    # 1. Canadian Federal MPs
    print("Fetching Canadian Federal MPs (OpenNorth)...")
    req = urllib.request.urlopen("https://represent.opennorth.ca/representatives/house-of-commons/?limit=500")
    mps = json.loads(req.read().decode('utf-8')).get('objects', [])
    for mp in mps:
        cn = clean_str(re.sub(r'[^a-zA-Z0-9]', '', mp.get('district_name', '')))
        s_id = can_fed_map.get(cn)
        if s_id:
            offices = mp.get('offices', [])
            tel = offices[0].get('tel', '') if offices else ''
            records.append({
                'map_shape_id': s_id,
                'role_title': 'MP',
                'full_name': mp.get('name'),
                'political_party': map_party(mp.get('party_name'), 'Canada'),
                'bio': f"Member of Parliament for {mp.get('district_name')}",
                'contact_email': mp.get('email', ''),
                'contact_phone': tel,
                'holding_since': '',
                'source_url': mp.get('url') or mp.get('source_url') or '',
                'photo_url': mp.get('photo_url', '')
            })

    # 2. Canadian Provincial MLAs
    print("Fetching Canadian Provincial MLAs (OpenNorth)...")
    prov_eps = [
        ("bc-legislature", "MLA"),
        ("ontario-legislature", "MPP"),
        ("alberta-legislature", "MLA"),
        ("manitoba-legislature", "MLA"),
        ("pei-legislature", "MLA"),
        ("yukon-legislature", "MLA"),
        ("northwest-territories-legislature", "MLA"),
        ("nova-scotia-legislature", "MLA"),
        ("newfoundland-labrador-legislature", "MHA"),
        ("saskatchewan-legislature", "MLA"),
        ("new-brunswick-legislature", "MLA")
    ]
    for ep_slug, role_t in prov_eps:
        try:
            req = urllib.request.urlopen(f"https://represent.opennorth.ca/representatives/{ep_slug}/?limit=500")
            mlas = json.loads(req.read().decode('utf-8')).get('objects', [])
            for m in mlas:
                cn = clean_str(re.sub(r'[^a-zA-Z0-9]', '', m.get('district_name', '')))
                s_id = can_prov_map.get(cn)
                if s_id:
                    offices = m.get('offices', [])
                    tel = offices[0].get('tel', '') if offices else ''
                    records.append({
                        'map_shape_id': s_id,
                        'role_title': role_t,
                        'full_name': m.get('name'),
                        'political_party': map_party(m.get('party_name'), 'Canada'),
                        'bio': f"{role_t} for {m.get('district_name')}",
                        'contact_email': m.get('email', ''),
                        'contact_phone': tel,
                        'holding_since': '',
                        'source_url': m.get('url') or m.get('source_url') or '',
                        'photo_url': m.get('photo_url', '')
                    })
        except Exception as e:
            print(f"Error fetching {ep_slug}: {e}")

    # 3. US Governors & US Congress
    print("Fetching US Governors & Congress dataset...")
    us_govs = [
      ("AL", "Kay Ivey", "Republican Party", "https://governor.alabama.gov"),
      ("AK", "Mike Dunleavy", "Republican Party", "https://gov.alaska.gov"),
      ("AZ", "Katie Hobbs", "Democratic Party", "https://azgovernor.gov"),
      ("AR", "Sarah Huckabee Sanders", "Republican Party", "https://governor.arkansas.gov"),
      ("CA", "Gavin Newsom", "Democratic Party", "https://www.gov.ca.gov"),
      ("CO", "Jared Polis", "Democratic Party", "https://www.colorado.gov/governor"),
      ("CT", "Ned Lamont", "Democratic Party", "https://portal.ct.gov/office-of-the-governor"),
      ("DE", "Matt Meyer", "Democratic Party", "https://governor.delaware.gov"),
      ("FL", "Ron DeSantis", "Republican Party", "https://www.flgov.com"),
      ("GA", "Brian Kemp", "Republican Party", "https://gov.georgia.gov"),
      ("HI", "Josh Green", "Democratic Party", "https://governor.hawaii.gov"),
      ("ID", "Brad Little", "Republican Party", "https://gov.idaho.gov"),
      ("IL", "JB Pritzker", "Democratic Party", "https://gov.illinois.gov"),
      ("IN", "Mike Braun", "Republican Party", "https://www.in.gov/gov"),
      ("IA", "Kim Reynolds", "Republican Party", "https://governor.iowa.gov"),
      ("KS", "Laura Kelly", "Democratic Party", "https://governor.kansas.gov"),
      ("KY", "Andy Beshear", "Democratic Party", "https://governor.ky.gov"),
      ("LA", "Jeff Landry", "Republican Party", "https://gov.louisiana.gov"),
      ("ME", "Janet Mills", "Democratic Party", "https://www.maine.gov/governor"),
      ("MD", "Wes Moore", "Democratic Party", "https://governor.maryland.gov"),
      ("MA", "Maura Healey", "Democratic Party", "https://www.mass.gov/orgs/office-of-the-governor"),
      ("MI", "Gretchen Whitmer", "Democratic Party", "https://www.michigan.gov/whitmer"),
      ("MN", "Tim Walz", "Democratic Party", "https://mn.gov/governor"),
      ("MS", "Tate Reeves", "Republican Party", "https://governorreeves.ms.gov"),
      ("MO", "Mike Kehoe", "Republican Party", "https://governor.mo.gov"),
      ("MT", "Greg Gianforte", "Republican Party", "https://governor.mt.gov"),
      ("NE", "Jim Pillen", "Republican Party", "https://governor.nebraska.gov"),
      ("NV", "Joe Lombardo", "Republican Party", "https://gov.nv.gov"),
      ("NH", "Kelly Ayotte", "Republican Party", "https://www.governor.nh.gov"),
      ("NJ", "Phil Murphy", "Democratic Party", "https://nj.gov/governor"),
      ("NM", "Michelle Lujan Grisham", "Democratic Party", "https://www.governor.state.nm.us"),
      ("NY", "Kathy Hochul", "Democratic Party", "https://www.governor.ny.gov"),
      ("NC", "Josh Stein", "Democratic Party", "https://governor.nc.gov"),
      ("ND", "Kelly Armstrong", "Republican Party", "https://www.governor.nd.gov"),
      ("OH", "Mike DeWine", "Republican Party", "https://governor.ohio.gov"),
      ("OK", "Kevin Stitt", "Republican Party", "https://oklahoma.gov/governor.html"),
      ("OR", "Tina Kotek", "Democratic Party", "https://www.oregon.gov/gov"),
      ("PA", "Josh Shapiro", "Democratic Party", "https://www.governor.pa.gov"),
      ("RI", "Dan McKee", "Democratic Party", "https://governor.ri.gov"),
      ("SC", "Henry McMaster", "Republican Party", "https://governor.sc.gov"),
      ("SD", "Kristi Noem", "Republican Party", "https://governor.sd.gov"),
      ("TN", "Bill Lee", "Republican Party", "https://www.tn.gov/governor.html"),
      ("TX", "Greg Abbott", "Republican Party", "https://gov.texas.gov"),
      ("UT", "Spencer Cox", "Republican Party", "https://governor.utah.gov"),
      ("VT", "Phil Scott", "Republican Party", "https://governor.vermont.gov"),
      ("VA", "Glenn Youngkin", "Republican Party", "https://www.governor.virginia.gov"),
      ("WA", "Bob Ferguson", "Democratic Party", "https://governor.wa.gov"),
      ("WV", "Patrick Morrisey", "Republican Party", "https://governor.wv.gov"),
      ("WI", "Tony Evers", "Democratic Party", "https://evers.wi.gov"),
      ("WY", "Mark Gordon", "Republican Party", "https://governor.wyo.gov")
    ]
    for st_abbr, gov_n, gov_p, gov_url in us_govs:
        s_id = us_state_map.get(st_abbr)
        if s_id:
            records.append({
                'map_shape_id': s_id,
                'role_title': 'Governor',
                'full_name': gov_n,
                'political_party': gov_p,
                'bio': f"Governor of {st_abbr}",
                'contact_email': '',
                'contact_phone': '',
                'holding_since': '',
                'source_url': gov_url,
                'photo_url': ''
            })

    req = urllib.request.urlopen("https://unitedstates.github.io/congress-legislators/legislators-current.json")
    legislators = json.loads(req.read().decode('utf-8'))
    for leg in legislators:
        terms = leg.get('terms', [])
        if not terms: continue
        last_t = terms[-1]
        name_obj = leg.get('name', {})
        full_n = name_obj.get('official_full') or f"{name_obj.get('first', '')} {name_obj.get('last', '')}".strip()
        party_n = map_party(last_t.get('party'), 'USA')

        if last_t.get('type') == 'sen':
            st = last_t.get('state')
            s_id = us_state_map.get(st)
            if s_id:
                records.append({
                    'map_shape_id': s_id,
                    'role_title': 'U.S. Senator',
                    'full_name': full_n,
                    'political_party': party_n,
                    'bio': f"U.S. Senator representing {st}",
                    'contact_email': last_t.get('contact_form', ''),
                    'contact_phone': last_t.get('phone', ''),
                    'holding_since': last_t.get('start', ''),
                    'source_url': last_t.get('url', ''),
                    'photo_url': ''
                })
        elif last_t.get('type') == 'rep':
            st = last_t.get('state')
            dist = last_t.get('district', 0)
            s_id = us_fed_map.get(f"{st}-{dist}")
            if s_id:
                records.append({
                    'map_shape_id': s_id,
                    'role_title': 'U.S. Representative',
                    'full_name': full_n,
                    'political_party': party_n,
                    'bio': f"U.S. Representative for {st} Congressional District {dist}",
                    'contact_email': last_t.get('contact_form', ''),
                    'contact_phone': last_t.get('phone', ''),
                    'holding_since': last_t.get('start', ''),
                    'source_url': last_t.get('url', ''),
                    'photo_url': ''
                })

    # 4. US State Senate and US State House (OpenStates dataset)
    print("Parsing OpenStates dataset for US State Senate & State House...")
    zip_path = '/Users/vmn2k4/.gemini/antigravity-ide/brain/805020c7-5fb8-4f32-9700-35f2af3604c8/scratch/openstates.zip'
    if os.path.exists(zip_path):
        with zipfile.ZipFile(zip_path, 'r') as z:
            leg_files = [f for f in z.namelist() if '/legislature/' in f and f.endswith('.yml')]
            for f in leg_files:
                content = z.read(f).decode('utf-8')
                name_m = re.search(r'^name:\s*(.+)$', content, re.MULTILINE)
                type_m = re.search(r'type:\s*(upper|lower)', content)
                dist_m = re.search(r'district:\s*[\'\"]?([^\'\"]+)[\'\"]?', content)
                jur_m = re.search(r'state:([a-z]{2})', content)
                party_m = re.search(r'name:\s*(Democratic|Republican|Independent|Libertarian|Green)', content)
                email_m = re.search(r'^email:\s*(.+)$', content, re.MULTILINE)
                image_m = re.search(r'^image:\s*(.+)$', content, re.MULTILINE)
                url_m = re.search(r'url:\s*(https?://[^\s]+)', content)
                voice_m = re.search(r'voice:\s*([0-9\-\(\)\s]+)', content)

                if name_m and type_m and dist_m and jur_m:
                    st = jur_m.group(1).upper()
                    d_str = dist_m.group(1).strip().lstrip('0') or '0'
                    t = type_m.group(1)
                    full_n = name_m.group(1).strip()
                    party_n = map_party(party_m.group(1).strip() if party_m else 'Independent', 'USA')
                    email_v = email_m.group(1).strip() if email_m else ''
                    image_v = image_m.group(1).strip() if image_m else ''
                    url_v = url_m.group(1).strip() if url_m else ''
                    phone_v = voice_m.group(1).strip() if voice_m else ''

                    if t == 'upper':
                        s_id = us_senate_map.get((st, d_str))
                        if s_id:
                            records.append({
                                'map_shape_id': s_id,
                                'role_title': 'State Senator',
                                'full_name': full_n,
                                'political_party': party_n,
                                'bio': f"State Senator for {st} District {d_str}",
                                'contact_email': email_v,
                                'contact_phone': phone_v,
                                'holding_since': '',
                                'source_url': url_v,
                                'photo_url': image_v
                            })
                    elif t == 'lower':
                        s_id = us_house_map.get((st, d_str))
                        if s_id:
                            records.append({
                                'map_shape_id': s_id,
                                'role_title': 'State Representative',
                                'full_name': full_n,
                                'political_party': party_n,
                                'bio': f"State Representative for {st} District {d_str}",
                                'contact_email': email_v,
                                'contact_phone': phone_v,
                                'holding_since': '',
                                'source_url': url_v,
                                'photo_url': image_v
                            })

    print(f"\n🎉 TOTAL RECITES COMPILED ACROSS ALL TIERS: {len(records)}")

    # Write to CSV
    csv_path = "/Users/vmn2k4/Coding/Choseno/scripts/office-holders-data.csv"
    fieldnames = ['map_shape_id', 'role_title', 'full_name', 'political_party', 'bio', 'contact_email', 'contact_phone', 'holding_since', 'source_url', 'photo_url']
    with open(csv_path, 'w', newline='', encoding='utf-8') as f_out:
        writer = csv.DictWriter(f_out, fieldnames=fieldnames)
        writer.writeheader()
        for r in records:
            writer.writerow(r)

    print(f"Saved CSV to {csv_path}")

    # SQL bulk import execution
    print("Generating bulk import SQL statement...")
    def sql_val(v):
        if not v or not str(v).strip(): return "NULL"
        return "'" + str(v).replace("'", "''") + "'"

    value_tuples = []
    for r in records:
        value_tuples.append(f"({r['map_shape_id']}, {sql_val(r['role_title'])}, {sql_val(r['full_name'])}, {sql_val(r['political_party'])}, {sql_val(r['bio'])}, {sql_val(r['contact_email'])}, {sql_val(r['contact_phone'])}, {sql_val(r['holding_since'])}, {sql_val(r['source_url'])}, {sql_val(r['photo_url'])})")

    join_tuples = ',\n'.join(value_tuples)
    sql_file = "/Users/vmn2k4/Coding/Choseno/scripts/staging_import.sql"
    with open(sql_file, 'w', encoding='utf8') as f_sql:
        f_sql.write("""
BEGIN;
TRUNCATE TABLE office_holders RESTART IDENTITY;

CREATE TEMP TABLE staging_office_holders (
  map_shape_id bigint,
  role_title text,
  full_name text,
  political_party text,
  bio text,
  contact_email text,
  contact_phone text,
  holding_since text,
  source_url text,
  photo_url text
) ON COMMIT DROP;

INSERT INTO staging_office_holders VALUES
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
SELECT DISTINCT ON (s.map_shape_id, ert.id)
  s.map_shape_id,
  ert.id AS election_role_type_id,
  s.full_name,
  pp.id AS political_party_id,
  NULLIF(s.bio, ''),
  NULLIF(s.contact_email, ''),
  NULLIF(s.contact_phone, ''),
  CASE WHEN s.holding_since IS NOT NULL AND s.holding_since != '' THEN s.holding_since::date ELSE NULL END,
  NULLIF(s.source_url, ''),
  NULLIF(s.photo_url, ''),
  NOW()
FROM staging_office_holders s
JOIN map_shapes ms ON s.map_shape_id = ms.id
JOIN election_role_types ert ON ert.country = ms.country AND ert.boundary_type = ms.boundary_type AND ert.role_title = s.role_title
LEFT JOIN political_parties pp ON pp.country = ms.country AND pp.name = s.political_party
ORDER BY s.map_shape_id, ert.id, s.full_name
ON CONFLICT (map_shape_id, election_role_type_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  political_party_id = EXCLUDED.political_party_id,
  bio = EXCLUDED.bio,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  holding_since = EXCLUDED.holding_since,
  source_url = EXCLUDED.source_url,
  photo_url = EXCLUDED.photo_url,
  updated_at = NOW();

COMMIT;
""")

    print(f"Executing SQL import via psql for {len(records)} records...")
    subprocess.run(['psql', db_url, '-f', sql_file], check=True)
    if os.path.exists(sql_file): os.remove(sql_file)

    p_count = subprocess.run(['psql', db_url, '-t', '-A', '-c', "SELECT COUNT(*) FROM office_holders;"], stdout=subprocess.PIPE, text=True)
    print(f"\n✅ COMPLETE SUCCESS! Database now contains {p_count.stdout.strip()} active office holders!")

if __name__ == "__main__":
    main()
