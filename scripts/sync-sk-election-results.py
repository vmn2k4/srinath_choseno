#!/usr/bin/env python3
"""
Saskatchewan Municipal Sync — Mayors/Reeves & Councillors

Source of truth for Saskatchewan: the Government of Saskatchewan's own
official Municipal Directory (saskatchewan.ca/government/municipal-
administration/municipal-directory), maintained by the Ministry of
Government Relations. Unlike BC/NB/QC there is no single bulk export --
each municipality has its own detail page (schema.org Person microdata per
official, `itemprop="jobTitle"`), reached only by crawling 9 category
listing pages (City, Town, Village, Resort Village, Rural Municipality,
Northern Town, Northern Village, Northern Hamlet, Northern Saskatchewan
Administration District) for the ~761 municipality GUIDs, then fetching
each one. Not the OpenNorth Represent API, which populate-canadian-
municipal.py uses for the rest of Canada -- Saskatchewan only had 26
current officeholders out of 951 map_shapes rows from that source before
this.

Rural Municipalities elect a "Reeve" instead of a "Mayor" -- mapped to the
same MAYOR_ROLE_ID (the same convention scripts/populate-canadian-
municipal.py already uses for reeves/wardens elsewhere in Canada).
Northern Saskatchewan Administration District entries and any other
unrecognized job title are skipped rather than guessed at.

Matching is scoped to Saskatchewan via shape_containers throughout -- see
OFFICE_HOLDERS_DATA_GUIDE.md for why an unscoped name match is not safe
(the BC/Mackenzie-County cross-province incident).

Usage: python3 scripts/sync-sk-election-results.py [--apply] [--workers N]
"""

import argparse
import html
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from curl_cffi import requests

DB_URI = "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres"

MAYOR_ROLE_ID = "3855aeb9-c840-4d81-bb83-66cad128ea8c"
COUNCILLOR_ROLE_ID = "6d2e3815-05d9-4784-b220-1d73140b5bf3"

BASE_URL = "https://www.saskatchewan.ca/government/municipal-administration/municipal-directory"
CATEGORIES = {
    "City": "EECE932F-A982-441E-BE43-15284F844A3B",
    "Town": "85115645-9031-4901-AB02-C46DBF5DB80D",
    "Village": "01D1F43B-DDCD-474A-BD0D-3EA1F1064754",
    "Resort Village": "7E3631AA-2282-4EBD-9CC0-2FD923B3709D",
    "Rural Municipality": "A468E4A2-F785-4EB8-9297-C8C15F3EB175",
    "Northern Town": "EE02E6E4-0961-4D5F-9C5C-0900C7726FA0",
    "Northern Village": "D3A50179-9697-4F4E-ACB9-D9D8292E490C",
    "Northern Hamlet": "A66B830C-589F-4478-90B0-ABB9C018456C",
    "Northern Saskatchewan Administration District": "283A2047-51F2-42D4-832C-7313EC4F3A1F",
}

JOB_TITLE_TO_ROLE = {
    "mayor": MAYOR_ROLE_ID,
    "reeve": MAYOR_ROLE_ID,
    "councillor": COUNCILLOR_ROLE_ID,
    "council member": COUNCILLOR_ROLE_ID,
    "alderman": COUNCILLOR_ROLE_ID,
}


def normalize_municipal_name(s):
    """
    A Rural Municipality and the same-named Town/Village at its centre are
    two genuinely different Saskatchewan municipalities that legitimately
    share a base name (e.g. the Town of Aberdeen and the RM of Aberdeen No.
    373 both exist) -- so unlike other provinces' normalizers, the RM's
    number is kept as part of the key instead of stripped, specifically so
    the pair doesn't collide down to one ambiguous key.
    """
    if not s:
        return ""
    s = s.lower()
    rm_match = re.search(r"no\.?\s*(\d+)\s*$", s)
    is_rm = "rural municipality" in s or bool(rm_match)
    # Saskatchewan's own directory names RMs as a suffix -- "Aberdeen,
    # Rural Municipality No. 373" -- not the prefix style ("RM of
    # Aberdeen") map_shapes sometimes uses.
    s = re.sub(r",?\s*rural municipality\s*(no\.?\s*\d+)?\s*$", "", s)
    s = re.sub(
        r"^(city|town|township|municipality|village|resort village of|rm of|northern village of|northern hamlet of|district of)\s+(of\s+)?",
        "",
        s,
    )
    if is_rm and rm_match:
        s = re.sub(r"\s*no\.?\s*\d+\s*$", "", s) + f" no {rm_match.group(1)}"
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


def fetch_municipality_list():
    print("Crawling Saskatchewan's Municipal Directory category pages...")
    entries = []  # (guid, name)
    for cat, guid in CATEGORIES.items():
        r = requests.get(f"{BASE_URL}?c={{{guid}}}", impersonate="chrome")
        items = re.findall(r"directory\?s=\{([0-9A-F-]+)\}\">\s*([^<]+?)\s*</a>", r.text)
        entries.extend((guid, html.unescape(name)) for guid, name in items)
        print(f"  {cat}: {len(items)}")
    print(f"Total municipalities found: {len(entries)}")
    return entries


def fetch_officials(guid, name):
    try:
        r = requests.get(f"{BASE_URL}?s={{{guid}}}", impersonate="chrome", timeout=20)
        officials = []
        # Each official is a schema.org Person block: first name, last name,
        # then an itemprop="jobTitle" span -- in that literal order in the
        # markup (verified against Moose Jaw's page).
        for m in re.finditer(
            r'itemtype="http://schema\.org/Person"[^>]*>.*?<div class="info">\s*([^<]+?)\s*<span itemprop="jobTitle">([^<]+)</span>',
            r.text,
            re.S,
        ):
            name_block = re.sub(r"\s+", " ", m.group(1)).strip()
            job_title = m.group(2).strip()
            if name_block:
                officials.append((name_block, job_title))
        return (name, officials, None)
    except Exception as e:
        return (name, [], str(e))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--workers", type=int, default=20)
    args = parser.parse_args()

    entries = fetch_municipality_list()

    print(f"Fetching {len(entries)} municipality detail pages ({args.workers} concurrent workers)...")
    officials_by_muni = {}
    errors = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(fetch_officials, guid, name): name for guid, name in entries}
        done = 0
        for fut in as_completed(futures):
            name, officials, err = fut.result()
            done += 1
            if done % 100 == 0:
                print(f"  ...{done}/{len(entries)}")
            if err:
                errors.append((name, err))
            elif officials:
                officials_by_muni[name] = officials
    print(f"Fetched officials for {len(officials_by_muni)} municipalities ({len(errors)} fetch errors).")
    if errors:
        print(f"Fetch errors (not silently dropped): {errors[:20]}")

    print("Loading map_shapes (Municipal, Saskatchewan only, active)...")
    shapes = run_sql("""
        SELECT ms.id, ms.name FROM map_shapes ms
        JOIN shape_containers sc ON sc.map_shape_id = ms.id
        JOIN map_shapes p ON p.id = sc.container_shape_id AND p.name = 'Saskatchewan'
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
    unrecognized_titles = set()
    for muni, officials in officials_by_muni.items():
        shape_id = shape_by_norm.get(normalize_municipal_name(muni))
        if not shape_id:
            unmatched_munis.append(muni)
            continue
        for name, title in officials:
            role_id = JOB_TITLE_TO_ROLE.get(title.lower())
            if not role_id:
                unrecognized_titles.add(title)
                continue
            winners_by_shape.setdefault(shape_id, []).append((role_id, name))

    total_winners = sum(len(v) for v in winners_by_shape.values())
    print(f"Matched {total_winners} officeholders across {len(winners_by_shape)} Saskatchewan municipalities.")
    if unmatched_munis:
        print(f"{len(unmatched_munis)} municipalities had no matching map_shapes row -- not silently dropped:")
        for m in sorted(unmatched_munis)[:60]:
            print(f"  {m}")
        if len(unmatched_munis) > 60:
            print(f"  ... and {len(unmatched_munis) - 60} more")
    if dupes:
        print(f"map_shapes has duplicate names for {len(dupes)} Saskatchewan municipalities -- excluded entirely rather than guessed at: {sorted(dupes)}")
    if unrecognized_titles:
        print(f"Unrecognized job titles (not mapped to a role, skipped): {sorted(unrecognized_titles)}")

    sql = ["BEGIN;"]
    sql.append("""
CREATE TEMP TABLE staging_sk_winners (
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
            value_rows.append(f"({shape_id}, '{role_id}', '{safe_name}', '{BASE_URL}')")
    sql.append("INSERT INTO staging_sk_winners VALUES\n" + ",\n".join(value_rows) + ";")

    sql.append("""
UPDATE office_holders oh
SET is_current = false, term_ended_at = CURRENT_DATE, updated_at = NOW()
WHERE oh.is_current = true
  AND EXISTS (SELECT 1 FROM staging_sk_winners s WHERE s.map_shape_id = oh.map_shape_id)
  AND NOT EXISTS (
    SELECT 1 FROM staging_sk_winners s
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
FROM staging_sk_winners s
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
    JOIN staging_sk_winners s ON s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
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
  RAISE NOTICE 'SK sync: created % new ghost profile walls, linked % to existing profiles.', created_count, linked_count;
END $$;
""")
    sql.append("COMMIT;")
    full_sql = "\n".join(sql)

    out_path = "/Users/vmn2k4/Coding/Choseno/scripts/sk-election-results-sync.sql"
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
