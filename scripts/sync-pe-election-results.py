#!/usr/bin/env python3
"""
Prince Edward Island Municipal Sync — Mayors & Councillors

Source of truth for PEI: the Federation of PEI Municipalities' own
official Municipal Directory (fpeim.ca/municipal-directory/), a single
page with one accordion section per municipality with clean `<strong>
Mayor:</strong> Name` / `<strong>Councillors:</strong> Name, Name, ...`
markup. Not the OpenNorth Represent API, which populate-canadian-
municipal.py uses for the rest of Canada -- PEI only had 22 current
officeholders out of 97 map_shapes rows from that source before this.

Validated before applying: Charlottetown's mayor (Philip Brown) matched
confirmed real-world reporting -- elected 2018, re-elected 2022, running
again in the Nov 2, 2026 PEI general municipal election.

Deputy Mayor is a distinct elected councillor role, not duplicated in the
"Councillors" list (confirmed: Charlottetown's Deputy Mayor Alanna Jankov
does not also appear among its 9 listed councillors) -- included here as a
Councillor so they aren't silently dropped, since office_holders has no
separate "Deputy Mayor" role type.

Matching is scoped to PEI via shape_containers throughout -- see
OFFICE_HOLDERS_DATA_GUIDE.md for why an unscoped name match is not safe.

Usage: python3 scripts/sync-pe-election-results.py [--apply]
"""

import argparse
import html
import re
import subprocess
from curl_cffi import requests

DB_URI = "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres"

MAYOR_ROLE_ID = "3855aeb9-c840-4d81-bb83-66cad128ea8c"
COUNCILLOR_ROLE_ID = "6d2e3815-05d9-4784-b220-1d73140b5bf3"

DIRECTORY_URL = "https://fpeim.ca/municipal-directory/"


def normalize_municipal_name(s):
    if not s:
        return ""
    s = html.unescape(s).lower()
    s = s.replace("*", "")  # FPEIM marks some names with a trailing asterisk (footnote ref)
    s = re.sub(r"^(city of|town of|community of|municipality of)\s+", "", s)
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


def clean_names_list(text):
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text).strip()
    return [n.strip() for n in text.split(",") if n.strip()]


def fetch_directory():
    print("Fetching the Federation of PEI Municipalities directory...")
    r = requests.get(DIRECTORY_URL, impersonate="chrome")
    parts = re.split(r'wp-block-getwid-accordion__header-title">([^<]+)<', r.text)
    titles = parts[1::2]
    contents = parts[2::2]
    print(f"Found {len(titles)} municipality sections.")

    munis = {}
    for title, content in zip(titles, contents):
        name = html.unescape(title).replace("*", "").strip()
        winners = []
        m = re.search(r"<strong>Mayor:?</strong>&nbsp;([^<]+?)<br", content)
        if m:
            mayor = clean_names_list(m.group(1))
            if mayor:
                winners.append((MAYOR_ROLE_ID, mayor[0]))
        m = re.search(r"<strong>Deputy&nbsp;?Mayor:?</strong>&nbsp;([^<]+?)<br", content)
        if m:
            deputy = clean_names_list(m.group(1))
            if deputy:
                winners.append((COUNCILLOR_ROLE_ID, deputy[0]))
        m = re.search(r"<strong>Councillors:?</strong>&nbsp;([^<]+?)<br", content)
        if m:
            for c in clean_names_list(m.group(1)):
                winners.append((COUNCILLOR_ROLE_ID, c))
        if winners:
            munis[name] = winners
    return munis


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    munis = fetch_directory()
    print(f"Parsed officeholders for {len(munis)} municipalities.")

    print("Loading map_shapes (Municipal, PEI only, active)...")
    shapes = run_sql("""
        SELECT ms.id, ms.name FROM map_shapes ms
        JOIN shape_containers sc ON sc.map_shape_id = ms.id
        JOIN map_shapes p ON p.id = sc.container_shape_id AND p.name = 'Prince Edward Island'
        WHERE ms.boundary_type = 'Municipal' AND ms.retired_at IS NULL;
    """)
    norm_to_ids = {}
    for sid, name in shapes:
        norm_to_ids.setdefault(normalize_municipal_name(name), []).append((sid, name))
    shape_by_norm = {}
    dupes = set()
    for norm, sids in norm_to_ids.items():
        if len(sids) == 1:
            shape_by_norm[norm] = sids[0][0]
        else:
            dupes.add(sids[0][1])

    winners_by_shape = {}
    unmatched_munis = []
    for muni, winners in munis.items():
        shape_id = shape_by_norm.get(normalize_municipal_name(muni))
        if not shape_id:
            unmatched_munis.append(muni)
            continue
        winners_by_shape[shape_id] = winners

    total_winners = sum(len(v) for v in winners_by_shape.values())
    print(f"Matched {total_winners} officeholders across {len(winners_by_shape)} PEI municipalities.")
    if unmatched_munis:
        print(f"{len(unmatched_munis)} municipalities had no matching map_shapes row -- not silently dropped:")
        for m in sorted(unmatched_munis):
            print(f"  {m}")
    if dupes:
        print(f"map_shapes has duplicate names for {len(dupes)} PEI municipalities -- excluded entirely rather than guessed at: {sorted(dupes)}")

    sql = ["BEGIN;"]
    sql.append("""
CREATE TEMP TABLE staging_pe_winners (
  map_shape_id bigint,
  election_role_type_id uuid,
  full_name text,
  source_url text
) ON COMMIT DROP;
""")
    value_rows = []
    for shape_id, winners in winners_by_shape.items():
        for role_id, name in winners:
            safe_name = name.replace("'", "''")
            value_rows.append(f"({shape_id}, '{role_id}', '{safe_name}', '{DIRECTORY_URL}')")
    sql.append("INSERT INTO staging_pe_winners VALUES\n" + ",\n".join(value_rows) + ";")

    sql.append("""
UPDATE office_holders oh
SET is_current = false, term_ended_at = CURRENT_DATE, updated_at = NOW()
WHERE oh.is_current = true
  AND EXISTS (SELECT 1 FROM staging_pe_winners s WHERE s.map_shape_id = oh.map_shape_id)
  AND NOT EXISTS (
    SELECT 1 FROM staging_pe_winners s
    WHERE s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
      AND s.election_role_type_id = oh.election_role_type_id
  );
""")

    sql.append("""
INSERT INTO office_holders (
  map_shape_id, election_role_type_id, full_name, bio, source_url,
  is_current, term_ended_at, updated_at
)
SELECT DISTINCT ON (s.map_shape_id, s.election_role_type_id, s.full_name)
  s.map_shape_id, s.election_role_type_id, s.full_name,
  (SELECT ert.role_title FROM election_role_types ert WHERE ert.id = s.election_role_type_id) || ' for ' ||
  (SELECT ms.name FROM map_shapes ms WHERE ms.id = s.map_shape_id),
  s.source_url, true, NULL, NOW()
FROM staging_pe_winners s
ORDER BY s.map_shape_id, s.election_role_type_id, s.full_name
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
  source_url = EXCLUDED.source_url,
  is_current = true,
  term_ended_at = NULL,
  updated_at = NOW();
""")

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
    SELECT oh.id as office_holder_id, oh.full_name, oh.bio,
           ms.country, ms.name as boundary_name, ms.boundary_type, ert.role_title
    FROM office_holders oh
    JOIN map_shapes ms ON oh.map_shape_id = ms.id
    JOIN election_role_types ert ON oh.election_role_type_id = ert.id
    JOIN staging_pe_winners s ON s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
    WHERE oh.linked_profile_id IS NULL
  LOOP
    computed_slug := lower(regexp_replace(regexp_replace(r.full_name || '-' || r.role_title, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
    SELECT pp.id INTO existing_profile_id FROM politician_profiles pp WHERE pp.wall_slug = computed_slug LIMIT 1;
    IF existing_profile_id IS NULL THEN
      SELECT p.id INTO existing_profile_id FROM profiles p
      WHERE p.role = 'politician' AND lower(p.full_name) = lower(r.full_name) AND p.constituency = r.boundary_name
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
      INSERT INTO politician_profiles (id, political_target_role, target_boundary_type, target_boundary_name, bio, wall_slug, created_at, updated_at)
      VALUES (new_profile_id, r.role_title, r.boundary_type, r.boundary_name, r.bio, computed_slug, NOW(), NOW());
      UPDATE office_holders SET linked_profile_id = new_profile_id WHERE id = r.office_holder_id;
      created_count := created_count + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'PE sync: created % new ghost profile walls, linked % to existing profiles.', created_count, linked_count;
END $$;
""")
    sql.append("COMMIT;")
    full_sql = "\n".join(sql)

    out_path = "/Users/vmn2k4/Coding/Choseno/scripts/pe-election-results-sync.sql"
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
