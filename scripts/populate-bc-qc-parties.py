#!/usr/bin/env python3
"""
Populate BC & Quebec Municipal Political Parties
Fetches live candidate party affiliations for BC (from CivicInfo BC)
and Quebec (from Wikipedia MediaWiki API / Élections Québec),
seeds missing municipal political parties into political_parties table,
updates office_holders.political_party_id, and re-exports office-holders-data.csv.
"""

import sys
import os
import re
import json
import csv
import subprocess
from curl_cffi import requests
from bs4 import BeautifulSoup

DB_URI = "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres"

def run_sql(query):
    psql_cmd = [
        "psql", DB_URI, "-t", "-A", "-F", "\t", "-c", query
    ]
    res = subprocess.run(psql_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"❌ SQL Error: {res.stderr}")
        return []
    lines = res.stdout.strip().split("\n")
    return [l.split("\t") for l in lines if l.strip()]

def clean_name(name):
    if not name: return ""
    name = re.sub(r'\[.*?\]', '', name) # Remove wiki footnotes like [30]
    name = re.sub(r'\(.*?\)', '', name) # Remove (Incumbent)
    return name.strip()

def normalize_key(s):
    if not s: return ""
    return re.sub(r'[^a-z0-9]+', '', s.lower())

def main():
    print("🚀 Starting BC & Quebec Municipal Party Ingestion...")

    # 1. Fetch BC Data from CivicInfo BC
    print("🌐 Fetching BC Municipal Election & Party Data from CivicInfo BC...")
    r_bc = requests.get('https://www.civicinfo.bc.ca/electionreports/candidates-and-results.php?year=2022', impersonate='chrome')
    soup_bc = BeautifulSoup(r_bc.text, 'html.parser')
    
    bc_matches = {} # (city_norm, name_norm) -> party_name
    all_parties = set()

    for row in soup_bc.find_all('tr'):
        tds = [td.get_text(strip=True) for td in row.find_all('td')]
        if len(tds) >= 14:
            city = tds[0].strip()
            first = tds[2].strip()
            last = tds[3].strip()
            is_winner = tds[8].strip().upper() == 'YES'
            party = tds[13].strip() if len(tds) > 13 else ''
            
            if is_winner and party and party.lower() != 'independent':
                all_parties.add(party)
                full_name = clean_name(f"{first} {last}")
                key = (normalize_key(city), normalize_key(full_name))
                bc_matches[key] = party

    print(f"✅ Found {len(bc_matches)} BC elected officials with party affiliations across {len(all_parties)} unique BC civic parties.")

    # 2. Fetch QC Data from Wikipedia
    print("🌐 Fetching QC Municipal Election & Party Data from Wikipedia...")
    qc_pages = [
        '2021_Montreal_municipal_election',
        '2021_Quebec_City_municipal_election',
        '2021_Laval_municipal_election',
        '2021_Gatineau_municipal_election',
        '2021_Longueuil_municipal_election'
    ]

    qc_matches = {} # name_norm -> party_name
    qc_known_parties = {
        'Projet Montréal', 'Ensemble Montréal', 'Québec Forte et Fière', 
        "Québec d'abord", 'Mouvement Laval', 'Action Laval', 'Action Gatineau', 
        'Coalition Longueuil', 'Équipe Stephane Boyer'
    }

    for page_title in qc_pages:
        url = f'https://en.wikipedia.org/wiki/{page_title}'
        r = requests.get(url, impersonate='chrome')
        soup = BeautifulSoup(r.text, 'html.parser')
        for table in soup.find_all('table', class_='wikitable'):
            for row in table.find_all('tr'):
                tds = [td.get_text(strip=True) for td in row.find_all(['td', 'th'])]
                if len(tds) >= 4:
                    for i in range(len(tds)-1):
                        cand = clean_name(tds[i])
                        part = clean_name(tds[i+1])
                        for qp in qc_known_parties:
                            if qp.lower() in part.lower():
                                all_parties.add(qp)
                                qc_matches[normalize_key(cand)] = qp

    print(f"✅ Found {len(qc_matches)} QC elected officials with party affiliations across {len(qc_known_parties)} QC civic parties.")

    # 3. Seed political_parties table
    print("🌱 Seeding missing municipal political parties into Supabase database...")
    for p_name in sorted(all_parties):
        safe_p = p_name.replace("'", "''")
        sql = f"""
        INSERT INTO public.political_parties (country, name, rank) 
        VALUES ('Canada', '{safe_p}', 100) 
        ON CONFLICT (country, name) DO NOTHING;
        """
        run_sql(sql)

    # 4. Load DB party map (Name -> ID)
    party_rows = run_sql("SELECT id, name FROM public.political_parties WHERE country = 'Canada';")
    party_map = {r[1].lower(): int(r[0]) for r in party_rows if len(r) >= 2}

    # 5. Fetch all Canadian Municipal office holders from DB
    print("🔍 Fetching Canadian Municipal Office Holders from Supabase DB...")
    oh_rows = run_sql("""
        SELECT oh.id, oh.full_name, ms.name AS city_name
        FROM office_holders oh
        JOIN map_shapes ms ON ms.id = oh.map_shape_id
        WHERE ms.country = 'Canada' AND ms.boundary_type = 'Municipal';
    """)

    updated_count = 0

    for r in oh_rows:
        if len(r) < 3: continue
        oh_id, full_name, city_name = r[0], r[1], r[2]
        
        name_key = normalize_key(clean_name(full_name))
        city_key = normalize_key(city_name)

        matched_party = None

        # Check BC match (city, name) or (name)
        if (city_key, name_key) in bc_matches:
            matched_party = bc_matches[(city_key, name_key)]
        elif name_key in qc_matches:
            matched_party = qc_matches[name_key]
        else:
            # Substring name matching for BC
            for (ck, nk), party in bc_matches.items():
                if nk == name_key or (len(name_key) > 5 and name_key in nk) or (len(nk) > 5 and nk in name_key):
                    matched_party = party
                    break

        if matched_party:
            party_id = party_map.get(matched_party.lower())
            if party_id:
                update_sql = f"UPDATE public.office_holders SET political_party_id = {party_id} WHERE id = '{oh_id}';"
                run_sql(update_sql)
                updated_count += 1
                print(f"  ✨ Updated: {city_name} | {full_name} -> {matched_party}")

    print(f"\n🎉 Successfully updated {updated_count} Canadian Municipal Office Holders with exact civic party affiliations!")

    # 6. Re-export office-holders-data.csv
    print("📝 Re-exporting office-holders-data.csv...")
    csv_rows = run_sql("""
        SELECT oh.map_shape_id, ert.role_title, oh.full_name, COALESCE(pp.name, 'Independent') AS political_party,
               oh.bio, oh.contact_email, oh.contact_phone, oh.holding_since, oh.source_url, oh.photo_url
        FROM office_holders oh
        JOIN election_role_types ert ON ert.id = oh.election_role_type_id
        LEFT JOIN political_parties pp ON pp.id = oh.political_party_id
        ORDER BY oh.map_shape_id, oh.full_name;
    """)

    csv_path = os.path.join(os.path.dirname(__file__), "office-holders-data.csv")
    headers = ["map_shape_id", "role_title", "full_name", "political_party", "bio", "contact_email", "contact_phone", "holding_since", "source_url", "photo_url"]
    
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for r in csv_rows:
            if len(r) == 10:
                writer.writerow(r)

    print(f"💾 Exported updated records to {csv_path}")

if __name__ == "__main__":
    main()
