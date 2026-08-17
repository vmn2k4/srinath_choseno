#!/usr/bin/env python3
"""
Import New Brunswick's post-2023-reform Local Government boundaries and
retire the obsolete pre-reform ones they replace.

Root cause this fixes: every New Brunswick "Municipal" row in map_shapes
came from a single 2021 Census Subdivisions upload (StatCan's
lcsd000b21a_e.shp) -- i.e. frozen before NB's Jan 1, 2023 local governance
reform, which collapsed ~340 legacy entities into 89 new ones (77 local
governments + 12 rural districts). That produced two symptoms:
  - 33 of the reform's new municipality names (Arcadia, Tantramar,
    Bois-Joli, etc.) had no map_shapes row at all.
  - Names that DID carry over (Moncton, Rothesay, Saint Andrews,
    Woodstock, ...) existed as TWO rows each -- not an accidental
    double-import, but two genuinely different pre-reform entities (e.g.
    the old city core and a separate surrounding parish) that the reform
    merged into one new municipality. Neither old row alone is the correct
    current boundary.

Source: GeoNB / Government of New Brunswick's official "Local Governments
/ Gouvernements locaux" open dataset (effective 2023-01-01), covering all
77 local governments (rural districts are a separate, smaller dataset --
not imported here since they elect advisory committees, not a
mayor/council, and aren't covered by office_holders yet):
  https://gnb.socrata.com/GeoNB/Local-Governments-Gouvernements-locaux/sqh9-kfnn

Old boundaries are retired (retired_at = NOW()), never deleted -- same
principle as office_holders' is_current: nothing referencing the old rows
(shape_containers, any historical office_holders rows) breaks, and the app
already filters retired_at IS NULL everywhere that matters (see
src/lib/services/boundaries.ts).

Usage: python3 scripts/import-nb-local-governments-2023.py [--apply]
"""

import argparse
import json
import subprocess
from curl_cffi import requests

DB_URI = "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres"
GEOJSON_URL = "https://gnb.socrata.com/resource/hs7r-gqqv.geojson"
NB_PROVINCE_SHAPE_ID = 22949
OLD_NB_UPLOAD_ID = "3037b87c-48f4-4da2-9d31-d651d1a8b91f"  # lcsd000b21a_e.shp (2021 Census Subdivisions), New Brunswick portion


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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    print("Fetching GeoNB's official Local Governments dataset...")
    r = requests.get(GEOJSON_URL, impersonate="chrome")
    data = r.json()
    features = data["features"]
    print(f"Fetched {len(features)} local government boundaries.")

    # Create the upload row first and read its id back -- everything else
    # in this script (the map_shapes it inserts, the shape_containers rows,
    # the retirement query) needs to reference this exact id.
    if args.apply:
        upload_rows = run_sql(f"""
            INSERT INTO boundary_uploads (id, name, country, boundary_type, expected_count, created_at, completed_at)
            VALUES (gen_random_uuid(), 'New Brunswick Local Governments (2023 Reform, GeoNB hs7r-gqqv)', 'Canada', 'Municipal', {len(features)}, NOW(), NOW())
            RETURNING id;
        """)
        upload_id = upload_rows[0][0]
        print(f"Created boundary_uploads row: {upload_id}")
    else:
        upload_id = "00000000-0000-0000-0000-000000000000"  # placeholder for the dry-run SQL preview only

    insert_sql = ["BEGIN;"]
    shape_id_placeholders = []
    for i, feat in enumerate(features):
        props = feat["properties"]
        name = props.get("official_e") or props.get("name")
        code = str(props.get("id") or "")
        geom_json = json.dumps(feat["geometry"]).replace("'", "''")
        props_json = json.dumps(props).replace("'", "''")
        safe_name = name.replace("'", "''")
        insert_sql.append(f"""
INSERT INTO map_shapes (country, boundary_type, name, code, properties, geom, upload_id, created_at)
VALUES ('Canada', 'Municipal', '{safe_name}', '{code}', '{props_json}'::jsonb,
        ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{geom_json}'), 4326)), '{upload_id}', NOW());
""")
    # No manual shape_containers insert here: trg_reconcile_shape_containers
    # (AFTER INSERT/UPDATE on map_shapes) already recomputes containment
    # spatially for every new row, and does the equivalent cleanup
    # automatically when retired_at is set below -- a hand-rolled insert
    # here just raced the trigger and hit its own conflicts.
    insert_sql.append(f"""
UPDATE map_shapes
SET retired_at = NOW()
WHERE upload_id = '{OLD_NB_UPLOAD_ID}'
  AND retired_at IS NULL
  AND id IN (
    SELECT ms.id FROM map_shapes ms
    JOIN shape_containers sc ON sc.map_shape_id = ms.id
    WHERE sc.container_shape_id = {NB_PROVINCE_SHAPE_ID}
  );
""")
    insert_sql.append("COMMIT;")
    full_sql = "\n".join(insert_sql)

    out_path = "/Users/vmn2k4/Coding/Choseno/scripts/nb-local-government-import.sql"
    with open(out_path, "w") as f:
        f.write(full_sql)
    print(f"Wrote generated SQL ({len(features)} shapes) to {out_path}")

    if args.apply:
        print(f"Applying to database (upload_id={upload_id})...")
        subprocess.run(["psql", DB_URI, "-f", out_path], check=True)
        print("Done.")
    else:
        print("Dry run only (no --apply passed) -- review the SQL file, then re-run with --apply.")


if __name__ == "__main__":
    main()
