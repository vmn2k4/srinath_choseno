#!/usr/bin/env python3
"""
Northwest Territories Municipal Sync — Mayors/Chiefs & Councillors

Source of truth for NWT: the Department of Municipal and Community
Affairs' own official per-community pages (maca.gov.nt.ca), listed from
the "Community Contact Listing" index (33 communities). Each page has
structured fields for "Community Leader" (Mayor/Chief/Mayor+Chief
depending on governance structure) and "Councilors". NWT had zero current
officeholders before this -- OpenNorth doesn't cover the territory.

Matching is scoped to Northwest Territories via shape_containers
throughout -- see OFFICE_HOLDERS_DATA_GUIDE.md for why an unscoped name
match is not safe.

Usage: python3 scripts/sync-nt-election-results.py [--apply]
"""

import argparse
import re
import subprocess
from curl_cffi import requests

DB_URI = "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres"

MAYOR_ROLE_ID = "3855aeb9-c840-4d81-bb83-66cad128ea8c"
COUNCILLOR_ROLE_ID = "6d2e3815-05d9-4784-b220-1d73140b5bf3"

LISTING_URL = "https://www.maca.gov.nt.ca/en/community-contact-listing"
BASE_URL = "https://www.maca.gov.nt.ca"


def normalize_municipal_name(s):
    if not s:
        return ""
    s = s.lower()
    # Dene-language place names use characters outside a-z (Ł, ı̨, etc.)
    # that plain [^a-z0-9] stripping would delete instead of transliterate
    # -- "Łutselk'e" -> " utselk e" (dropped leading L) vs map_shapes'
    # plain-ASCII "Lutselk'e" -> "lutselk e", a silent mismatch rather than
    # an equal one. Map the specific characters seen in NWT community names
    # to their closest ASCII letter before the generic strip below.
    for src, dst in [("ł", "l"), ("ı̨", "i"), ("į", "i"), ("é", "e"), ("è", "e"), ("ę", "e")]:
        s = s.replace(src, dst)
    s = re.sub(r"^(hamlet of|town of|city of|village of|charter community of)\s+", "", s)
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


def fetch_community_links():
    r = requests.get(LISTING_URL, impersonate="chrome")
    links = sorted(set(re.findall(r'href="(/en/content/[^"]+)"', r.text)))
    return links


def clean_title(name):
    # Titles stack -- "Her Worship Mayor Dana Fergusson" has TWO prefixes
    # to strip, not one -- a single non-repeated re.sub only removed the
    # first and left "Mayor Dana Fergusson" literally in the name (caught
    # live: 16 of 29 matched NWT communities had "Mayor "/"Chief " baked
    # into full_name before this fix). Loop until nothing more strips.
    prev = None
    while prev != name:
        prev = name
        name = re.sub(r"^(her worship|his worship|mayor|chief|senior administrative officer|sao)\.?\s+", "", name, flags=re.I).strip()
    return name


def fetch_officials(path):
    r = requests.get(BASE_URL + path, impersonate="chrome", timeout=20)
    name_match = re.search(r'<h1[^>]*>([^<]+)</h1>', r.text)
    community = name_match.group(1).strip() if name_match else path.rsplit("/", 1)[-1]

    winners = []
    leader_m = re.search(r'field-community-leader field-type-text[^>]*>.*?<div class="field-item even">([^<]+)</div>', r.text, re.S)
    if leader_m:
        for role_word, role_id in [("mayor", MAYOR_ROLE_ID), ("chief", MAYOR_ROLE_ID)]:
            if role_word in leader_m.group(1).lower():
                winners.append((role_id, clean_title(leader_m.group(1))))
                break

    for m in re.finditer(r'field-councilor-name field-type-text field-label-hidden">.*?<div class="field-item even">([^<]+)</div>', r.text, re.S):
        winners.append((COUNCILLOR_ROLE_ID, m.group(1).strip()))

    return community, winners


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    print("Fetching NWT community list...")
    links = fetch_community_links()
    print(f"Found {len(links)} communities.")

    munis = {}
    for path in links:
        community, winners = fetch_officials(path)
        if winners:
            munis[community] = winners
    print(f"Fetched officials for {len(munis)} communities.")

    print("Loading map_shapes (Municipal, Northwest Territories only, active)...")
    shapes = run_sql("""
        SELECT ms.id, ms.name FROM map_shapes ms
        JOIN shape_containers sc ON sc.map_shape_id = ms.id
        JOIN map_shapes p ON p.id = sc.container_shape_id AND p.name = 'Northwest Territories'
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
    print(f"Matched {total_winners} officeholders across {len(winners_by_shape)} NWT communities.")
    if unmatched_munis:
        print(f"Unmatched (not silently dropped): {unmatched_munis}")
    if dupes:
        print(f"map_shapes has duplicate names for {len(dupes)} NWT communities -- excluded entirely rather than guessed at: {sorted(dupes)}")
    single_word = [n for w in winners_by_shape.values() for role, n in w if " " not in n.strip()]
    if single_word:
        print(f"WARNING: single-word names parsed (possible truncation, review before applying): {single_word}")

    sql = ["BEGIN;"]
    sql.append("""
CREATE TEMP TABLE staging_nt_winners (
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
            value_rows.append(f"({shape_id}, '{role_id}', '{safe_name}', '{LISTING_URL}')")
    sql.append("INSERT INTO staging_nt_winners VALUES\n" + ",\n".join(value_rows) + ";")

    sql.append("""
UPDATE office_holders oh
SET is_current = false, term_ended_at = CURRENT_DATE, updated_at = NOW()
WHERE oh.is_current = true
  AND EXISTS (SELECT 1 FROM staging_nt_winners s WHERE s.map_shape_id = oh.map_shape_id)
  AND NOT EXISTS (
    SELECT 1 FROM staging_nt_winners s
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
FROM staging_nt_winners s
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
    JOIN staging_nt_winners s ON s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
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
  RAISE NOTICE 'NT sync: created % new ghost profile walls, linked % to existing profiles.', created_count, linked_count;
END $$;
""")
    sql.append("COMMIT;")
    full_sql = "\n".join(sql)

    out_path = "/Users/vmn2k4/Coding/Choseno/scripts/nt-election-results-sync.sql"
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
