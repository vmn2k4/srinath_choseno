#!/usr/bin/env python3
"""
BC Election Results Sync — Municipal Councils & School Trustees

Source of truth for BC: CivicInfo BC's own official general-local-election
results table (candidates-and-results.php?year=<YEAR>), filtered to
is_winner == 'YES' -- NOT the OpenNorth Represent API that
populate-canadian-municipal.py uses for the rest of Canada.

Why: OpenNorth's BC municipal data is stale. Verified directly against
Maple Ridge -- OpenNorth's API still returned Mike Morden as mayor and the
outgoing 2018-2022 council long after the Oct 2022 election (see
20260816000000_office_holder_term_lifecycle.sql for the full trace). This
CivicInfo results feed was cross-checked against Maple Ridge's own
"Meet Your Council" page (mapleridge.ca) and SD42's own "Board of
Education" page (sd42.ca) on 2026-08-17 and matched both exactly -- every
mayor, councillor, and school trustee, verbatim.

This also covers something the OpenNorth pipeline never did at all: BC
school district trustees. Supersedes two prior scripts that fetched this
same URL but only used it to patch political_party_id on rows a different
pipeline had already created (fast-populate-bc-qc.py,
populate-bc-qc-parties.py -- literal duplicates of each other, both from
commit 807261d, never deduplicated), and the hardcoded BC_TRUSTEES dict in
populate-bc-school-trustees.py (a frozen manual snapshot with no
source_url, no freshness tracking, and no way to tell a stale entry from a
current one -- exactly the failure class this script exists to fix).

School board CHAIR is deliberately NOT sourced from this feed: chair is
not itself on the ballot, trustees elect their own chair from among
themselves after being sworn in. CHAIR_OVERRIDES below is a small,
manually-curated map of (district code -> currently-known chair), carried
forward from the old hardcoded dict as a bootstrap. It still needs
periodic reverification per district (e.g. against each district's
"Board of Education" page) -- this script only guards against assigning
chair to someone who isn't even a winning trustee this cycle; it can't
independently confirm the board actually re-elected that person as chair.

Usage:
  python3 scripts/sync-bc-election-results.py [--year YEAR] [--apply]

  --year   CivicInfo election year to sync from (default: 2022, the most
           recent BC general local election at the time this script was
           written). BC's next general local election is Oct 2026 --
           once CivicInfo publishes certified results, re-run with
           --year 2026.
  --apply  Actually run the generated SQL against the database. Without
           it, the script only fetches/parses/prints a summary and writes
           the SQL to scripts/bc-election-results-sync.sql for review.
"""

import argparse
import re
import subprocess
from curl_cffi import requests
from bs4 import BeautifulSoup

DB_URI = "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres"

MAYOR_ROLE_ID = "3855aeb9-c840-4d81-bb83-66cad128ea8c"
COUNCILLOR_ROLE_ID = "6d2e3815-05d9-4784-b220-1d73140b5bf3"
TRUSTEE_ROLE_ID = "a03ac924-f894-4d7e-bb7f-152bcf23255e"
CHAIR_ROLE_ID = "84d05e6a-2411-4b3f-94aa-f45069425a54"

# CivicInfo's "Level" column values that map to our boundary_type='Municipal'.
# Excludes 'Regional District', 'Commission', 'Park Board', 'Islands Trust' --
# none of those have a corresponding boundary_type in map_shapes today, same
# scope populate-canadian-municipal.py already sticks to.
MUNICIPAL_LEVELS = {
    "District", "City", "Village", "Town", "Township",
    "Regional Municipality", "Island Municipality",
    "Mountain Resort Municipality", "Resort Municipality",
}

# Bootstrapped from populate-bc-school-trustees.py's hardcoded BC_TRUSTEES
# dict (the "role": "chair" entries) -- see module docstring on why this
# can't be sourced from the election results themselves, and why it still
# needs periodic manual reverification rather than being treated as
# permanently authoritative.
CHAIR_OVERRIDES = {
    "5": "Doug McPhee", "6": "Amber Byklum", "8": "Lenora Trenaman",
    "10": "Stephen Gascon", "19": "Wendy Rota", "20": "Catherine Zaitsoff",
    "22": "Mark Olsen", "23": "Lee-Ann Tiede", "27": "Ciel Patenaude",
    "28": "Tony Goulet", "33": "Willow Reichelt", "34": "Shirley Wilson",
    "35": "Candy Ashdown", "36": "Laurie Larsen", "37": "Val Windsor",
    "38": "Debbie Tablotney", "39": "Victoria Jung", "40": "Maya Russell",
    "41": "Bill Brassington", "42": "Elaine Yamamoto", "43": "Michael Thomas",
    "44": "Kulvir Mann", "45": "Carolyn Broady", "46": "Amanda Amaral",
    "47": "Jaclyn Miller", "48": "Rebecca Barley", "49": "Terry Weber",
    "50": "Dana Moraes", "51": "Rose Zitko", "52": "Kate Toye",
    "53": "Monique Harrington", "54": "Jennifer Williams", "57": "Craig Brennan",
    "58": "Gordon Swan", "59": "Chad Anderson", "60": "Helen Gilbert",
    "61": "Nicole Duncan", "62": "Amanda Dowhy", "63": "Tim Dunford",
    "64": "Tisha Boulter", "67": "James Palanio", "68": "Greg Keller",
    "69": "Eve Flynn", "70": "Pam Craig", "71": "Michelle Waite",
    "72": "Kat Eddy", "73": "Heather Grieve", "74": "Carmen Ranta",
    "75": "Shelley Carter", "78": "Cathy Speth", "79": "Cathy Schmidt",
    "81": "Mike Gilbert", "82": "Shar McCrory", "83": "Amanda Krebs",
    "84": "Arlene Fehr", "85": "Leightan Wishart", "87": "Yvonne Tashoots",
    "91": "Adele Gooding",
}


def clean_name(name):
    if not name:
        return ""
    name = re.sub(r"\[.*?\]", "", name)
    name = re.sub(r"\(.*?\)", "", name)
    return name.strip()


def normalize_municipal_name(s):
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r"^(city|town|township|municipality|ville|district|borough|county|region|village|rm of|resort village of|district of)\s+(of\s+)?", "", s)
    s = re.sub(r"\s+(city|town|township|municipality|ville|district|borough|county|region|village)$", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return s.strip()


def normalize_school_name(s):
    if not s:
        return ""
    # map_shapes stores school districts as "SD42 - Maple Ridge-Pitt
    # Meadows"; CivicInfo's district column is just "Maple Ridge-Pitt
    # Meadows" -- strip the "SDxx - " prefix before comparing.
    s = re.sub(r"^SD\d+\s*-\s*", "", s, flags=re.IGNORECASE)
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return s.strip()


def run_sql(sql, capture=True):
    cmd = ["psql", DB_URI]
    if capture:
        cmd += ["-t", "-A", "-F", "\t"]
    cmd += ["-c", sql]
    res = subprocess.run(cmd, capture_output=capture, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"psql error: {res.stderr}")
    if capture:
        return [l.split("\t") for l in res.stdout.strip().split("\n") if l.strip()]
    return None


def fetch_election_rows(year):
    print(f"Fetching CivicInfo BC {year} general local election results...")
    r = requests.get(
        f"https://www.civicinfo.bc.ca/electionreports/candidates-and-results.php?year={year}",
        impersonate="chrome",
    )
    soup = BeautifulSoup(r.text, "html.parser")
    rows = []
    for row in soup.find_all("tr"):
        tds = [td.get_text(strip=True) for td in row.find_all("td")]
        if len(tds) >= 14:
            rows.append(tds)
    print(f"Parsed {len(rows)} candidate rows.")
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", default="2022")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    rows = fetch_election_rows(args.year)

    # Scoped to British Columbia specifically -- NOT "WHERE country='Canada'"
    # unscoped. Municipality names collide across provinces constantly
    # (Victoria: BC/MB/NL/PEI; Woodstock: NB/NL/ON; Richmond, Hope,
    # Armstrong, Mackenzie all repeat too) and this feed is BC-only by
    # definition, so any name that happened to resolve to a different
    # province's shape was always wrong. Confirmed this had already silently
    # written real BC officeholders (Hope, Richmond, Armstrong, and via the
    # substring-fallback match below, Mackenzie -> Alberta's "Mackenzie
    # County") onto other provinces' shapes -- see
    # scripts/fix-bc-cross-province-misassignment.sql for the cleanup.
    print("Loading map_shapes (Municipal + School District, British Columbia only)...")
    muni_shapes = run_sql("""
        SELECT ms.id, ms.name FROM map_shapes ms
        JOIN shape_containers sc ON sc.map_shape_id = ms.id
        JOIN map_shapes p ON p.id = sc.container_shape_id AND p.name = 'British Columbia'
        WHERE ms.boundary_type = 'Municipal' AND ms.retired_at IS NULL;
    """)
    school_shapes = run_sql("""
        SELECT ms.id, ms.name, ms.code FROM map_shapes ms
        JOIN shape_containers sc ON sc.map_shape_id = ms.id
        JOIN map_shapes p ON p.id = sc.container_shape_id AND p.name = 'British Columbia'
        WHERE ms.boundary_type = 'School District' AND ms.retired_at IS NULL;
    """)

    muni_by_norm = {normalize_municipal_name(name): sid for sid, name in muni_shapes}
    school_by_norm = {normalize_school_name(name): sid for sid, name, code in school_shapes}
    # id -> code, NOT code -> id: map_shapes has duplicate `code` values for at
    # least 25 BC school districts (e.g. id 132034 is correctly "SD42 - Maple
    # Ridge-Pitt Meadows", but a second row, id 132257, is named "Border Land"
    # yet also carries code='42' -- a data bug in map_shapes itself, separate
    # from this script). Winners are matched by name above and are already
    # pinned to the right id; going id -> code for the chair lookup keeps that
    # correctness instead of reintroducing the collision by going code -> id.
    school_id_to_code = {sid: code for sid, name, code in school_shapes}

    print("Loading political_parties (Canada)...")
    party_rows = run_sql("SELECT id, name FROM political_parties WHERE country='Canada';")
    party_map = {name.lower(): int(pid) for pid, name in party_rows}

    # winners_by_shape[shape_id] -> list of dicts: {full_name, role_id, party, votes, source_url}
    winners_by_shape = {}
    new_parties = set()
    unmatched = []

    for tds in rows:
        level, first, last, is_winner, party = tds[1], tds[2], tds[3], tds[8], tds[13]
        if is_winner != "YES":
            continue
        full_name = clean_name(f"{first} {last}")
        if not full_name:
            continue

        role_title = tds[7]
        if level in MUNICIPAL_LEVELS and role_title in ("MAYOR", "COUNCILLOR"):
            shape_id = muni_by_norm.get(normalize_municipal_name(tds[0]))
            role_id = MAYOR_ROLE_ID if role_title == "MAYOR" else COUNCILLOR_ROLE_ID
        elif level == "School District" and role_title == "TRUSTEE":
            shape_id = school_by_norm.get(normalize_school_name(tds[0]))
            role_id = TRUSTEE_ROLE_ID  # possibly promoted to CHAIR_ROLE_ID below
        else:
            continue

        if not shape_id:
            unmatched.append((level, tds[0], full_name))
            continue

        if party and party.lower() != "independent":
            new_parties.add(party)

        winners_by_shape.setdefault(shape_id, []).append({
            "full_name": full_name,
            "role_id": role_id,
            "party": party or None,
        })

    # Promote the curated chair for each school district, if that name
    # actually won a trustee seat this cycle (never invent a chair who
    # isn't even a winner).
    for shape_id, winners in winners_by_shape.items():
        code = school_id_to_code.get(shape_id)
        chair_name = CHAIR_OVERRIDES.get(code) if code else None
        if not chair_name:
            continue
        for w in winners:
            if w["role_id"] == TRUSTEE_ROLE_ID and normalize_school_name(w["full_name"]) == normalize_school_name(chair_name):
                w["role_id"] = CHAIR_ROLE_ID
                break

    total_winners = sum(len(v) for v in winners_by_shape.values())
    print(f"Matched {total_winners} winners across {len(winners_by_shape)} BC shapes (municipal + school).")
    if unmatched:
        print(f"{len(unmatched)} winning rows could not be matched to a map_shape (no boundary on file, or name mismatch) -- not silently dropped, listed below:")
        for level, name, person in unmatched[:40]:
            print(f"  [{level}] {name} -- {person}")
        if len(unmatched) > 40:
            print(f"  ... and {len(unmatched) - 40} more")

    sql = ["BEGIN;"]

    if new_parties:
        sql.append("-- Seed any civic parties not already in political_parties")
        for p in sorted(new_parties):
            safe_p = p.replace("'", "''")
            sql.append(f"INSERT INTO public.political_parties (country, name, rank) VALUES ('Canada', '{safe_p}', 100) ON CONFLICT (country, name) DO NOTHING;")

    sql.append("""
CREATE TEMP TABLE staging_bc_winners (
  map_shape_id bigint,
  election_role_type_id uuid,
  full_name text,
  political_party_id bigint,
  source_url text
) ON COMMIT DROP;
""")

    source_url = f"https://www.civicinfo.bc.ca/electionreports/candidates-and-results.php?year={args.year}"
    value_rows = []
    for shape_id, winners in winners_by_shape.items():
        for w in winners:
            party_id = party_map.get((w["party"] or "").lower())
            party_sql = str(party_id) if party_id else "NULL"
            safe_name = w["full_name"].replace("'", "''")
            value_rows.append(f"({shape_id}, '{w['role_id']}', '{safe_name}', {party_sql}, '{source_url}')")

    sql.append("INSERT INTO staging_bc_winners VALUES\n" + ",\n".join(value_rows) + ";")

    # Retire anyone no longer a winner for a shape this sync covers. Matched
    # on (map_shape_id, full_name) only -- not also election_role_type_id --
    # so a role change for the same person (trustee -> chair) is handled by
    # the upsert below instead of leaving a stale duplicate row behind.
    sql.append("""
UPDATE office_holders oh
SET is_current = false, term_ended_at = CURRENT_DATE, updated_at = NOW()
WHERE oh.is_current = true
  AND EXISTS (SELECT 1 FROM staging_bc_winners s WHERE s.map_shape_id = oh.map_shape_id)
  AND NOT EXISTS (
    -- Matched on (shape, name, role), not just (shape, name): retiring by
    -- name alone left a stale row behind whenever a re-run's fresh data
    -- confirmed someone in a DIFFERENT role than an old row already on
    -- file for them (e.g. Hope BC had Victor Smith as both a stale
    -- Councillor row and the freshly-confirmed Mayor -- the Councillor
    -- row survived because "Victor Smith" matched *something* in the
    -- fresh set, just not that role). Matching on role too still handles
    -- genuine role changes correctly: the old role's row won't be in the
    -- fresh set for that role and gets retired, the new role gets its own
    -- inserted row from the upsert below.
    SELECT 1 FROM staging_bc_winners s
    WHERE s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
      AND s.election_role_type_id = oh.election_role_type_id
  );
""")

    sql.append("""
INSERT INTO office_holders (
  map_shape_id, election_role_type_id, full_name, political_party_id,
  bio, source_url, is_current, term_ended_at, updated_at
)
SELECT DISTINCT ON (s.map_shape_id, s.election_role_type_id, s.full_name)
  s.map_shape_id, s.election_role_type_id, s.full_name, s.political_party_id,
  (SELECT ert.role_title FROM election_role_types ert WHERE ert.id = s.election_role_type_id) || ' for ' ||
  (SELECT ms.name FROM map_shapes ms WHERE ms.id = s.map_shape_id),
  s.source_url, true, NULL, NOW()
FROM staging_bc_winners s
ORDER BY s.map_shape_id, s.election_role_type_id, s.full_name
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
  political_party_id = EXCLUDED.political_party_id,
  source_url = EXCLUDED.source_url,
  is_current = true,
  term_ended_at = NULL,
  updated_at = NOW();
""")

    # Ghost Profile + Politician Wall for anyone newly inserted (mirrors the
    # same block in populate-canadian-municipal.py / fix-maple-ridge-officeholders.sql),
    # but first checks for an existing profile under the same wall_slug --
    # politician_profiles.wall_slug is UNIQUE, and at BC-wide scale (unlike
    # the single-city Maple Ridge fix) name collisions across different
    # shapes/roles are real (hit "dennis-buchanan-mayor" already existing on
    # the first full run). Link to the existing profile instead of erroring
    # out the whole batch on a duplicate insert.
    sql.append("""
DO $$
DECLARE
  r RECORD;
  new_profile_id UUID;
  new_ghost_id UUID;
  existing_profile_id UUID;
  computed_slug TEXT;
  created_count INT := 0;
  linked_count INT := 0;
BEGIN
  FOR r IN
    SELECT oh.id as office_holder_id, oh.full_name, oh.bio, oh.political_party_id,
           ms.country, ms.name as boundary_name, ms.boundary_type, ert.role_title
    FROM office_holders oh
    JOIN map_shapes ms ON oh.map_shape_id = ms.id
    JOIN election_role_types ert ON oh.election_role_type_id = ert.id
    JOIN staging_bc_winners s ON s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
    WHERE oh.linked_profile_id IS NULL
  LOOP
    computed_slug := lower(regexp_replace(regexp_replace(r.full_name || '-' || r.role_title, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));

    SELECT pp.id INTO existing_profile_id
    FROM politician_profiles pp
    WHERE pp.wall_slug = computed_slug
    LIMIT 1;

    IF existing_profile_id IS NULL THEN
      SELECT p.id INTO existing_profile_id
      FROM profiles p
      WHERE p.role = 'politician' AND lower(p.full_name) = lower(r.full_name)
        AND p.constituency = r.boundary_name
      LIMIT 1;
    END IF;

    IF existing_profile_id IS NOT NULL THEN
      UPDATE office_holders SET linked_profile_id = existing_profile_id WHERE id = r.office_holder_id;
      linked_count := linked_count + 1;
    ELSE
      new_profile_id := gen_random_uuid();
      new_ghost_id := gen_random_uuid();
      INSERT INTO profiles (id, role, full_name, country, constituency, designation, current_ghost_id, updated_at)
      VALUES (new_profile_id, 'politician', r.full_name, r.country, r.boundary_name, r.role_title, new_ghost_id, NOW());
      INSERT INTO politician_profiles (id, political_target_role, target_boundary_type, target_boundary_name, bio, political_party_id, wall_slug, created_at, updated_at)
      VALUES (new_profile_id, r.role_title, r.boundary_type, r.boundary_name, r.bio, r.political_party_id, computed_slug, NOW(), NOW());
      UPDATE office_holders SET linked_profile_id = new_profile_id WHERE id = r.office_holder_id;
      created_count := created_count + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'BC sync: created % new ghost profile walls, linked % to existing profiles.', created_count, linked_count;
END $$;
""")

    sql.append("COMMIT;")
    full_sql = "\n".join(sql)

    out_path = "/Users/vmn2k4/Coding/Choseno/scripts/bc-election-results-sync.sql"
    with open(out_path, "w") as f:
        f.write(full_sql)
    print(f"Wrote generated SQL to {out_path}")

    if args.apply:
        print("Applying to database...")
        subprocess.run(["psql", DB_URI, "-f", out_path], check=True)
        print("Done.")
    else:
        print("Dry run only (no --apply passed) -- review the SQL file, then re-run with --apply.")


if __name__ == "__main__":
    main()
