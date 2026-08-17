#!/usr/bin/env python3
"""
Newfoundland and Labrador Municipal Sync — Mayors

Source of truth for NL: the Department of Municipal and Community
Affairs' official "Directory of Towns, ICGs and Cities" PDF (gov.nl.ca),
dated March 16, 2026 -- reflects the results of NL's Nov 2025 general
municipal election (confirmed by diffing against the December 2024
edition: several mayors changed, e.g. Admirals Beach's Elaine Doody ->
Michelle Dalton, Arnold's Cove's Basil Daley -> John Barrett). Not the
OpenNorth Represent API, which populate-canadian-municipal.py uses for the
rest of Canada -- NL only had 20 current officeholders out of 372
map_shapes rows from that source before this.

Uses pdfplumber's extract_table() rather than word-position heuristics --
a lesson from the Manitoba attempt earlier this session, where manual
column-cropping and row-clustering on a similar-looking PDF silently
truncated and misattributed names in ways that weren't caught until after
being applied to production. This directory has real table gridlines, so
extract_table() handles wrapped cells (e.g. "Deborah Windsor-\nHynes")
correctly without that risk.

Coverage is Mayor only -- this directory has no councillor column at all
(unlike BC/NB/QC/SK/PEI). Still a real improvement (20 -> hundreds of
mayors), but incomplete; a full council roster would need a different
source per community, not attempted here.

Matching is scoped to Newfoundland and Labrador via shape_containers
throughout -- see OFFICE_HOLDERS_DATA_GUIDE.md for why an unscoped name
match is not safe.

Usage: python3 scripts/sync-nl-election-results.py [--apply]
"""

import argparse
import re
import subprocess
import pdfplumber
from curl_cffi import requests

DB_URI = "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres"

MAYOR_ROLE_ID = "3855aeb9-c840-4d81-bb83-66cad128ea8c"

PDF_URL = "https://www.gov.nl.ca/mca/files/Newfoundland-and-Labrador-Directory-of-Towns-ICGs-and-Cities-as-of-March-16-2026.pdf"
SOURCE_URL = "https://www.gov.nl.ca/mca/municipal-directory/"


def normalize_municipal_name(s):
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r"^(town of|city of|community of)\s+", "", s)
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


def clean_cell(v):
    return re.sub(r"\s+", " ", (v or "")).strip()


def parse_pdf(path):
    munis = {}
    with pdfplumber.open(path) as pdf:
        header = None
        for page in pdf.pages:
            for table in page.extract_tables():
                for row in table:
                    cells = [clean_cell(c) for c in row]
                    if not cells or not cells[0]:
                        continue
                    if cells[0] == "Community Name":
                        header = cells
                        continue
                    name, mayor = cells[0], cells[2] if len(cells) > 2 else ""
                    if name and mayor and mayor.lower() not in ("vacant", "-", "n/a", "tbd"):
                        munis[name] = mayor
    return munis


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    print("Fetching NL's Directory of Towns, ICGs and Cities PDF...")
    r = requests.get(PDF_URL, impersonate="chrome")
    pdf_path = "/tmp/nl_directory.pdf"
    with open(pdf_path, "wb") as f:
        f.write(r.content)

    munis = parse_pdf(pdf_path)
    print(f"Parsed mayors for {len(munis)} communities.")

    print("Loading map_shapes (Municipal, Newfoundland and Labrador only, active)...")
    shapes = run_sql("""
        SELECT ms.id, ms.name FROM map_shapes ms
        JOIN shape_containers sc ON sc.map_shape_id = ms.id
        JOIN map_shapes p ON p.id = sc.container_shape_id AND p.name = 'Newfoundland and Labrador'
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
    for muni, mayor in munis.items():
        shape_id = shape_by_norm.get(normalize_municipal_name(muni))
        if not shape_id:
            unmatched_munis.append(muni)
            continue
        winners_by_shape[shape_id] = [(MAYOR_ROLE_ID, mayor)]

    total_winners = sum(len(v) for v in winners_by_shape.values())
    print(f"Matched {total_winners} mayors across {len(winners_by_shape)} NL communities.")
    if unmatched_munis:
        print(f"{len(unmatched_munis)} communities had no matching map_shapes row -- not silently dropped:")
        for m in sorted(unmatched_munis)[:60]:
            print(f"  {m}")
        if len(unmatched_munis) > 60:
            print(f"  ... and {len(unmatched_munis) - 60} more")
    if dupes:
        print(f"map_shapes has duplicate names for {len(dupes)} NL communities -- excluded entirely rather than guessed at: {sorted(dupes)}")

    single_word = [m for shape_id, w in winners_by_shape.items() for role, m in w if " " not in m.strip()]
    if single_word:
        print(f"WARNING: {len(single_word)} single-word mayor names parsed (possible truncation, review before applying): {single_word}")

    sql = ["BEGIN;"]
    sql.append("""
CREATE TEMP TABLE staging_nl_winners (
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
            value_rows.append(f"({shape_id}, '{role_id}', '{safe_name}', '{SOURCE_URL}')")
    sql.append("INSERT INTO staging_nl_winners VALUES\n" + ",\n".join(value_rows) + ";")

    sql.append("""
UPDATE office_holders oh
SET is_current = false, term_ended_at = CURRENT_DATE, updated_at = NOW()
WHERE oh.is_current = true
  AND EXISTS (SELECT 1 FROM staging_nl_winners s WHERE s.map_shape_id = oh.map_shape_id)
  AND NOT EXISTS (
    SELECT 1 FROM staging_nl_winners s
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
FROM staging_nl_winners s
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
    JOIN staging_nl_winners s ON s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
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
  RAISE NOTICE 'NL sync: created % new ghost profile walls, linked % to existing profiles.', created_count, linked_count;
END $$;
""")
    sql.append("COMMIT;")
    full_sql = "\n".join(sql)

    out_path = "/Users/vmn2k4/Coding/Choseno/scripts/nl-election-results-sync.sql"
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
