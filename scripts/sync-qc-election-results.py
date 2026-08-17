#!/usr/bin/env python3
"""
Quebec Municipal Sync — Mayors & Councillors

Source of truth for Quebec: the Ministère des Affaires municipales et de
l'Habitation (MAMH)'s official, continuously-updated open-data "Répertoire
des municipalités" -- specifically the `MUN.csv` resource, which lists
every Quebec municipality with its current mayor (`maire`) and up to 75
councillors (`con1`..`con75`) by name, already resolved -- no vote-count
parsing needed, unlike BC/NB.
  https://www.donneesquebec.ca/recherche/dataset/repertoire-des-municipalites-du-quebec

Not the OpenNorth Represent API, which populate-canadian-municipal.py uses
for the rest of Canada and which the BC/NB investigations showed is stale
and prone to cross-province name collisions. Validated directly on
2026-08-17 against real results: Montréal (Soraya Martinez Ferrada) and
Sherbrooke (Marie-Claude Bibeau) both matched the confirmed outcome of
Quebec's Nov 2, 2025 general municipal election exactly.

Matching is scoped to Quebec specifically via shape_containers -- never an
unscoped, cross-province name match (see the BC/Mackenzie-County incident
in OFFICE_HOLDERS_DATA_GUIDE.md for why that's not optional). Quebec's own
municipal code (mcode, a 5-digit MAMH code) does not correspond to
map_shapes.code (a 7-digit StatCan census-subdivision code from a
different numbering system), so this is a name match, not a code match --
scoping by province is what keeps it safe.

Usage: python3 scripts/sync-qc-election-results.py [--apply]
"""

import argparse
import csv
import io
import re
import subprocess
from curl_cffi import requests

DB_URI = "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres"

MAYOR_ROLE_ID = "3855aeb9-c840-4d81-bb83-66cad128ea8c"
COUNCILLOR_ROLE_ID = "6d2e3815-05d9-4784-b220-1d73140b5bf3"

MUN_CSV_URL = "https://donneesouvertes.affmunqc.net/repertoire/MUN.csv"
SOURCE_URL = "https://www.donneesquebec.ca/recherche/dataset/repertoire-des-municipalites-du-quebec"

MAX_COUNCILLORS = 75


def normalize_municipal_name(s):
    if not s:
        return ""
    s = s.lower()
    s = re.sub(
        r"^(ville|municipalit[eé]|village|paroisse|canton|cant\.|ville de|village de)\s+(de\s+|d[\']\s*|du\s+|des\s+)?",
        "",
        s,
    )
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


def fetch_mun_csv():
    print("Fetching MAMH's Répertoire des municipalités (MUN.csv)...")
    r = requests.get(MUN_CSV_URL, impersonate="chrome")
    r.encoding = "utf-8-sig"
    rows = list(csv.DictReader(io.StringIO(r.text)))
    print(f"Parsed {len(rows)} municipalities.")
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    rows = fetch_mun_csv()

    print("Loading map_shapes (Municipal, Quebec only, active)...")
    shapes = run_sql("""
        SELECT ms.id, ms.name FROM map_shapes ms
        JOIN shape_containers sc ON sc.map_shape_id = ms.id
        JOIN map_shapes p ON p.id = sc.container_shape_id AND p.name = 'Quebec'
        WHERE ms.boundary_type = 'Municipal' AND ms.retired_at IS NULL;
    """)
    # Group by normalized name first so a genuine duplicate (two shapes
    # sharing a name -- confirmed same root cause as New Brunswick: both
    # come from the single 2021 Census Subdivisions upload, and are two
    # real pre-merger entities like a town and its surrounding rural
    # municipality, not an accidental double-import) is excluded entirely
    # rather than arbitrarily picking one and silently risking the same
    # kind of wrong-shape write the BC/Mackenzie-County incident caused.
    norm_to_ids = {}
    for sid, name in shapes:
        norm_to_ids.setdefault(normalize_municipal_name(name), []).append((sid, name))
    shape_by_norm = {}
    dupes = set()
    for norm, entries in norm_to_ids.items():
        if len(entries) == 1:
            shape_by_norm[norm] = entries[0][0]
        else:
            dupes.add(entries[0][1])

    winners_by_shape = {}
    unmatched_munis = []
    for row in rows:
        muni = (row.get("munnom") or "").strip()
        if not muni:
            continue
        shape_id = shape_by_norm.get(normalize_municipal_name(muni))
        if not shape_id:
            unmatched_munis.append(muni)
            continue

        winners = []
        mayor = (row.get("maire") or "").strip()
        if mayor and mayor != "Poste Vacant":
            winners.append((MAYOR_ROLE_ID, mayor))
        for i in range(1, MAX_COUNCILLORS + 1):
            name = (row.get(f"con{i}") or "").strip()
            if name and name != "Poste Vacant":
                winners.append((COUNCILLOR_ROLE_ID, name))

        if winners:
            winners_by_shape[shape_id] = winners

    total_winners = sum(len(v) for v in winners_by_shape.values())
    print(f"Matched {total_winners} officeholders across {len(winners_by_shape)} Quebec municipalities.")
    if unmatched_munis:
        print(f"{len(unmatched_munis)} municipalities from MUN.csv have no matching map_shapes row -- not silently dropped:")
        for m in sorted(unmatched_munis)[:60]:
            print(f"  {m}")
        if len(unmatched_munis) > 60:
            print(f"  ... and {len(unmatched_munis) - 60} more")
    if dupes:
        print(f"map_shapes has duplicate names for {len(dupes)} Quebec municipalities (same root cause as New Brunswick -- both copies are real pre-merger entities, e.g. a town + its surrounding rural municipality, from the same 2021 Census upload). Excluded entirely rather than guessed at; also counted in the unmatched list above: {sorted(dupes)}")

    sql = ["BEGIN;"]
    sql.append("""
CREATE TEMP TABLE staging_qc_winners (
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
    sql.append("INSERT INTO staging_qc_winners VALUES\n" + ",\n".join(value_rows) + ";")

    # Retired on (shape, name, role) -- not (shape, name) alone -- see
    # OFFICE_HOLDERS_DATA_GUIDE.md / the Hope BC "Victor Smith" incident for
    # why matching by name only leaves a stale wrong-role row behind.
    sql.append("""
UPDATE office_holders oh
SET is_current = false, term_ended_at = CURRENT_DATE, updated_at = NOW()
WHERE oh.is_current = true
  AND EXISTS (SELECT 1 FROM staging_qc_winners s WHERE s.map_shape_id = oh.map_shape_id)
  AND NOT EXISTS (
    SELECT 1 FROM staging_qc_winners s
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
FROM staging_qc_winners s
ORDER BY s.map_shape_id, s.election_role_type_id, s.full_name
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
  source_url = EXCLUDED.source_url,
  is_current = true,
  term_ended_at = NULL,
  updated_at = NOW();
""")

    # Ghost Profile + Politician Wall, with the same wall_slug/name-collision
    # handling as the BC/NB scripts (find-and-link an existing profile
    # instead of blind-inserting a duplicate).
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
    JOIN staging_qc_winners s ON s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
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
  RAISE NOTICE 'QC sync: created % new ghost profile walls, linked % to existing profiles.', created_count, linked_count;
END $$;
""")
    sql.append("COMMIT;")
    full_sql = "\n".join(sql)

    out_path = "/Users/vmn2k4/Coding/Choseno/scripts/qc-election-results-sync.sql"
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
