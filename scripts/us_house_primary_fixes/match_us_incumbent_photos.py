#!/usr/bin/env python3
"""Reusable template for the "US incumbent photo" match, 2026-09-09.

Finds candidates in our system who are ALSO a sitting member of Congress
or a sitting Governor, and generates a COALESCE-safe SQL UPDATE to fill
their avatar_url/photo_url from an official, public-domain government
photo -- without any per-candidate web search.

Matching is done at SEAT-LEVEL precision on purpose:
  - U.S. Representative: (state, district, last name) triple
  - U.S. Senator / Governor: (state, last name) pair
A name-only or state-only match was tried first and rejected: it produced
real false positives from unrelated same-name people in other
jurisdictions (see docs/CANDIDATE_DATA_PULL_LOG.md, "System-wide photo
push" section, for the specific cases caught). Don't loosen this matching
key without re-reading that section.

### How to re-run this (three steps, only the first two need the browser
since this sandbox's Bash has no outbound internet access):

1. Fetch the current Congress roster (Browser tool, `javascript_tool`):
   ```js
   const res = await fetch('https://unitedstates.github.io/congress-legislators/legislators-current.json');
   const data = await res.json();
   const slim = data.map(m => {
     const term = m.terms[m.terms.length-1];
     return {
       bioguide: m.id.bioguide, first: m.name.first, last: m.name.last,
       full: m.name.first + ' ' + m.name.last, type: term.type,
       state: term.state, district: term.district !== undefined ? term.district : null
     };
   });
   JSON.stringify(slim);
   ```
   Save the result (it'll usually overflow to a tool-result file -- unwrap
   it, see the Sept 9 session transcript for the exact double-JSON-decode
   needed) as `legislators.json` next to this script.

2. Fetch current governors (Browser tool, navigate to
   https://en.wikipedia.org/wiki/List_of_current_United_States_governors,
   then `javascript_tool`):
   ```js
   const t = document.querySelectorAll('table.wikitable')[0];
   const rows = Array.from(t.querySelectorAll('tr')).slice(1);
   const out = rows.map(r => {
     const cells = r.querySelectorAll('td, th');
     const state = cells[0]?.querySelector('a')?.textContent.trim();
     const img = cells[1]?.querySelector('img');
     let src = img ? img.src : null;
     if (src && src.startsWith('//')) src = 'https:' + src;
     if (src) src = src.replace(/\/\d+px-/, '/400px-');
     const name = cells[2]?.textContent.trim();
     return {state, name, img: src};
   }).filter(x => x.state);
   JSON.stringify(out);
   ```
   Save as `governors.json` next to this script.

3. Run this script: `python3 match_us_incumbent_photos.py`. It queries
   the live DB directly for every US House/Senate/Governor candidate
   missing a photo, matches against the two files above, and writes
   `us_incumbent_photos.sql` -- review it, then apply with
   `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f us_incumbent_photos.sql`
   and re-run the standing orphan-check query from the main doc.
"""
import json
import os
import subprocess

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres.qlzyfdwrkcxyqapewxwg:pa.8tX5%2BHh%2FGZn2@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
)

FIPS = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC",
    "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT",
    "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY", "60": "AS", "66": "GU", "69": "MP",
    "72": "PR", "78": "VI",
}

QUERY = r"""
select p.id, p.full_name, es.role_title, ms.code, ms.name
from election_candidates ec
join profiles p on p.id = ec.politician_id
join election_seats es on es.id = ec.seat_id
join elections e on e.id = es.election_id
join map_shapes ms on ms.id = es.map_shape_id
left join politician_profiles pp on pp.id = p.id
where e.name = '2026 US Midterm Elections'
  and es.role_title in ('U.S. Representative', 'U.S. Senator', 'Governor')
  and (pp.avatar_url is null or pp.avatar_url = '');
"""

def fetch_missing():
    out = subprocess.run(
        ["psql", DB_URL, "-t", "-A", "-F", "\t", "-c", QUERY],
        capture_output=True, text=True, check=True,
    ).stdout
    rows = []
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) == 5:
            rows.append(parts)
    return rows

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "legislators.json")) as f:
        legs = json.load(f)
    with open(os.path.join(here, "governors.json")) as f:
        govs = json.load(f)
    gov_by_state = {g["state"]: g for g in govs}

    rep_index, sen_index = {}, {}
    for l in legs:
        if l["type"] == "rep":
            rep_index.setdefault((l["state"], l["district"]), []).append(l)
        else:
            sen_index.setdefault(l["state"], []).append(l)

    congress_matches, gov_matches, no_match = [], [], []
    for pid, full_name, role, code, seat_name in fetch_missing():
        last = full_name.strip().split()[-1].lower()
        if role == "U.S. Representative" and len(code) >= 4:
            st = FIPS.get(code[:2])
            try:
                dist = int(code[2:4])
            except ValueError:
                dist = None
            for c in rep_index.get((st, dist), []):
                if c["last"].lower() == last:
                    congress_matches.append((pid, c["bioguide"]))
                    break
            else:
                no_match.append((pid, full_name, role))
        elif role == "U.S. Senator":
            st = code.strip().upper()
            for c in sen_index.get(st, []):
                if c["last"].lower() == last:
                    congress_matches.append((pid, c["bioguide"]))
                    break
            else:
                no_match.append((pid, full_name, role))
        elif role == "Governor":
            g = gov_by_state.get(seat_name)
            if g and g["name"].strip().split()[-1].lower() == last:
                gov_matches.append((pid, g["img"]))
            else:
                no_match.append((pid, full_name, role))

    sql = ["BEGIN;"]
    for pid, bioguide in congress_matches:
        url = f"https://unitedstates.github.io/images/congress/450x550/{bioguide}.jpg"
        sql.append(
            f"UPDATE public.politician_profiles SET "
            f"avatar_url = COALESCE(avatar_url, {qstr(url)}), "
            f"photo_url = COALESCE(photo_url, {qstr(url)}) WHERE id = '{pid}';"
        )
    for pid, img_url in gov_matches:
        sql.append(
            f"UPDATE public.politician_profiles SET "
            f"avatar_url = COALESCE(avatar_url, {qstr(img_url)}), "
            f"photo_url = COALESCE(photo_url, {qstr(img_url)}) WHERE id = '{pid}';"
        )
    sql.append("COMMIT;")

    out_path = os.path.join(here, "us_incumbent_photos.sql")
    with open(out_path, "w") as f:
        f.write("\n".join(sql) + "\n")
    print(f"Congress matched: {len(congress_matches)}  Governors matched: {len(gov_matches)}  "
          f"No match (challenger/not currently in office): {len(no_match)}")
    print(f"SQL written to {out_path}")

if __name__ == "__main__":
    main()
