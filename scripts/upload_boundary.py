#!/usr/bin/env python3
"""
Boundary upload tool for Choseno's map_shapes table.

Loads a shapefile (or anything ogr2ogr reads), reprojects it to WGS84,
analyzes vertex-count complexity, recommends a cutoff, and loads it into
the database in resumable batches — mirroring the tiered approach used
for the 2021 Census Subdivision / Advance Polling District imports.

Requires `ogr2ogr` and `psql` on PATH. No Python packages beyond the
standard library.

Examples:
  # Just analyze — no DB writes, no confirmation needed.
  python3 scripts/upload_boundary.py data/muni.shp \\
      --country Canada --type Municipal --name-field CSDNAME --analyze-only

  # Real upload (will print the vertex report and ask to confirm first).
  python3 scripts/upload_boundary.py data/muni.shp \\
      --country Canada --type Municipal --name "2021 Census Subdivisions" \\
      --name-field CSDNAME --code-field CSDUID

  # Resume an interrupted upload — safe to re-run, already-loaded shapes
  # are skipped automatically (matched by code).
  python3 scripts/upload_boundary.py data/muni.shp \\
      --country Canada --type Municipal --resume <upload_id> \\
      --name-field CSDNAME --code-field CSDUID

Connection: reads DATABASE_URL from the environment by default (a plain
postgres:// URL), or pass --db-url. Never put a password directly on the
command line if this history is shared — prefer the env var.
"""

import argparse
import os
import subprocess
import sys
import time
import uuid

DEFAULT_VERTEX_CUTOFF = 100_000
DEFAULT_BATCH_SIZE = 200
MEDIUM_TIER_TIMEOUT = "150s"


def run(cmd, check=True):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{result.stderr.strip()}")
    return result


def psql(db_url, sql, tuples_only=False, timeout=None):
    cmd = ["psql", db_url, "-v", "ON_ERROR_STOP=1"]
    if tuples_only:
        cmd += ["-t", "-A"]
    full_sql = sql
    if timeout:
        full_sql = f"SET statement_timeout = '{timeout}';\n{sql}"
    cmd += ["-c", full_sql]
    return run(cmd).stdout


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def analyze(db_url, staging_table, cutoff, name_col=None):
    stats_raw = psql(
        db_url,
        f"""
        SELECT count(*),
               min(v), max(v),
               round(avg(v)),
               percentile_cont(0.5) WITHIN GROUP (ORDER BY v),
               count(*) FILTER (WHERE v > {cutoff})
        FROM (SELECT ST_NPoints(geom) AS v FROM {staging_table}) x;
        """,
        tuples_only=True,
    ).strip()
    total, vmin, vmax, vavg, vmedian, over_cutoff = stats_raw.split("|")

    buckets = [
        (0, 1_000), (1_000, 5_000), (5_000, 20_000),
        (20_000, 50_000), (50_000, 100_000), (100_000, 500_000),
        (500_000, None),
    ]
    print("\nVertex distribution:")
    print(f"  {'range':>20}  {'count':>8}")
    for lo, hi in buckets:
        if hi is None:
            cond = f"v > {lo}"
            label = f">{lo:,}"
        else:
            cond = f"v > {lo} AND v <= {hi}"
            label = f"{lo:,}-{hi:,}"
        cnt = psql(
            db_url,
            f"SELECT count(*) FROM (SELECT ST_NPoints(geom) AS v FROM {staging_table}) x WHERE {cond};",
            tuples_only=True,
        ).strip()
        print(f"  {label:>20}  {cnt:>8}")

    print(f"\nTotal features: {total}")
    print(f"Vertices — min: {vmin}  max: {vmax}  mean: {vavg}  median: {vmedian}")
    print(f"\nRecommendation: {over_cutoff} shape(s) exceed {cutoff:,} vertices and would be slow/risky to insert as-is.")

    if int(over_cutoff) > 0 and name_col:
        rows = psql(
            db_url,
            f"""
            SELECT ST_NPoints(geom) AS v, {name_col} AS name
            FROM {staging_table}
            WHERE ST_NPoints(geom) > {cutoff}
            ORDER BY v DESC
            LIMIT 20;
            """,
            tuples_only=True,
        ).strip()
        print(f"\nShapes over the cutoff (showing up to 20 of {over_cutoff}, largest first):")
        for line in rows.splitlines():
            v, name = line.split("|", 1)
            print(f"  {int(v):>10,} vertices  {name}")

    return int(total), int(over_cutoff)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("shapefile", help="Path to the source file (.shp, .geojson, etc. — anything ogr2ogr reads)")
    p.add_argument("--country", required=True)
    p.add_argument("--type", required=True, dest="boundary_type", help="Boundary type — must already be registered in country_boundary_types")
    p.add_argument("--name-field", required=True, help="Source attribute field to use as the boundary's display name")
    p.add_argument("--code-field", default=None, help="Source attribute field to use as the boundary's code (optional)")
    p.add_argument("--select-fields", default=None, help="Comma-separated list of source fields to load (default: all). Use this to work around field-precision errors from ogr2ogr.")
    p.add_argument("--name", default=None, help="Label for this upload batch (defaults to the filename)")
    p.add_argument("--db-url", default=os.environ.get("DATABASE_URL"), help="Postgres connection string (default: $DATABASE_URL)")
    p.add_argument("--vertex-cutoff", type=int, default=DEFAULT_VERTEX_CUTOFF, help=f"Skip shapes above this vertex count (default {DEFAULT_VERTEX_CUTOFF:,})")
    p.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help=f"Batch size for the bulk (low-complexity) tier (default {DEFAULT_BATCH_SIZE})")
    p.add_argument("--analyze-only", action="store_true", help="Print the vertex report and exit — no database writes")
    p.add_argument("--resume", default=None, metavar="UPLOAD_ID", help="Continue a previously started upload_id instead of creating a new batch")
    p.add_argument("--yes", action="store_true", help="Skip the confirmation prompt")
    args = p.parse_args()

    if not args.db_url:
        sys.exit("No database URL. Pass --db-url or set DATABASE_URL.")
    if not os.path.exists(args.shapefile):
        sys.exit(f"File not found: {args.shapefile}")

    upload_id = args.resume or str(uuid.uuid4())
    staging_table = f"staging_{upload_id.replace('-', '_')}"
    upload_name = args.name or os.path.basename(args.shapefile)

    # --- Load / reuse staging table ---
    existing = psql(args.db_url, f"SELECT to_regclass('public.{staging_table}');", tuples_only=True).strip()
    if existing and existing != "":
        log(f"Reusing existing staging table {staging_table} (resuming).")
    else:
        log(f"Loading and reprojecting {args.shapefile} into {staging_table}...")
        cmd = [
            "ogr2ogr", "-f", "PostgreSQL", f"PG:{_pg_conninfo(args.db_url)}",
            args.shapefile, "-t_srs", "EPSG:4326",
            "-nln", staging_table, "-lco", "GEOMETRY_NAME=geom",
            "-nlt", "MULTIPOLYGON", "-overwrite",
        ]
        if args.select_fields:
            cmd += ["-select", args.select_fields]
        result = run(cmd, check=False)
        if result.returncode != 0:
            sys.exit(
                "ogr2ogr failed to load the file:\n" + result.stderr +
                "\n\nIf this mentions a numeric field overflow, retry with "
                "--select-fields to drop the offending attribute (commonly "
                "SHAPE_Area / SHAPE_Leng)."
            )
        log("Loaded.")

    # --- Field name normalization (ogr2ogr lowercases column names) ---
    name_col = args.name_field.lower()
    code_col = args.code_field.lower() if args.code_field else None

    # --- Analysis ---
    total, over_cutoff = analyze(args.db_url, staging_table, args.vertex_cutoff, name_col)
    print()

    if args.analyze_only:
        log("Analyze-only mode — no changes made, staging table left in place for a real run.")
        return

    type_registered = psql(
        args.db_url,
        f"SELECT 1 FROM public.country_boundary_types WHERE country = {_sql_str(args.country)} AND type_name = {_sql_str(args.boundary_type)};",
        tuples_only=True,
    ).strip()
    if not type_registered:
        sys.exit(
            f"'{args.boundary_type}' isn't registered for {args.country} in country_boundary_types yet "
            "(admin panel → Boundary Types, or insert it directly). Nothing was written; rerun once it exists."
        )

    if not args.resume:
        # Register the upload batch and ensure it isn't accidentally duplicated.
        psql(
            args.db_url,
            f"""
            INSERT INTO public.boundary_uploads (id, name, country, boundary_type, expected_count)
            VALUES ('{upload_id}', {_sql_str(upload_name)}, {_sql_str(args.country)}, {_sql_str(args.boundary_type)}, {total});
            """,
        )
        log(f"Created upload batch {upload_id} ('{upload_name}').")
    else:
        log(f"Resuming upload batch {upload_id}.")

    if not args.yes:
        will_load = total - over_cutoff
        answer = input(
            f"About to load {will_load} shape(s) (skipping {over_cutoff} over the "
            f"{args.vertex_cutoff:,}-vertex cutoff). Continue? [y/N] "
        )
        if answer.strip().lower() != "y":
            print("Aborted. Staging table and upload batch left in place — rerun with --resume "
                  f"{upload_id} to continue later.")
            return

    code_expr = f"s.{code_col}::text" if code_col else "NULL"
    properties_expr = f"to_jsonb(s) - 'geom' - 'ogc_fid'"

    def insert_sql(where_extra, geom_expr="ST_Multi(ST_CollectionExtract(ST_MakeValid(s.geom), 3))"):
        already_done = (
            f"AND NOT EXISTS (SELECT 1 FROM public.map_shapes ms "
            f"WHERE ms.upload_id = '{upload_id}' AND ms.code IS NOT DISTINCT FROM {code_expr})"
            if code_col else ""
        )
        return f"""
            INSERT INTO public.map_shapes (country, boundary_type, name, code, properties, geom, upload_id)
            SELECT {_sql_str(args.country)}, {_sql_str(args.boundary_type)}, s.{name_col}, {code_expr},
                   {properties_expr}, {geom_expr}::geometry(MultiPolygon, 4326), '{upload_id}'
            FROM {staging_table} s
            WHERE {where_extra} {already_done};
        """

    def current_count():
        return psql(
            args.db_url,
            f"SELECT count(*) FROM public.map_shapes WHERE upload_id = '{upload_id}';",
            tuples_only=True,
        ).strip()

    # --- Tier 1: normal complexity, batched ---
    log("Tier 1: normal-complexity shapes, batched...")
    ogc_fid_range = psql(args.db_url, f"SELECT min(ogc_fid), max(ogc_fid) FROM {staging_table};", tuples_only=True).strip()
    fid_min, fid_max = (int(x) for x in ogc_fid_range.split("|"))
    for start in range(fid_min, fid_max + 1, args.batch_size):
        end = start + args.batch_size - 1
        try:
            psql(args.db_url, insert_sql(f"s.ogc_fid BETWEEN {start} AND {end} AND ST_NPoints(s.geom) <= 5000"))
        except RuntimeError as e:
            log(f"Batch {start}-{end} FAILED: {e}")
            log(f"Safe to rerun with: --resume {upload_id} (already-inserted shapes are skipped automatically)")
            sys.exit(1)
        log(f"Progress: {current_count()} / {total} inserted so far")

    # --- Tier 2: medium complexity, one at a time ---
    medium_fids = psql(
        args.db_url,
        f"SELECT ogc_fid FROM {staging_table} WHERE ST_NPoints(geom) > 5000 AND ST_NPoints(geom) <= {args.vertex_cutoff} ORDER BY ST_NPoints(geom);",
        tuples_only=True,
    ).splitlines()
    if medium_fids and medium_fids[0]:
        log(f"Tier 2: {len(medium_fids)} medium-complexity shapes, one at a time...")
        for fid in medium_fids:
            try:
                psql(args.db_url, insert_sql(f"s.ogc_fid = {fid}"), timeout=MEDIUM_TIER_TIMEOUT)
            except RuntimeError as e:
                log(f"Shape ogc_fid={fid} FAILED: {e}")
                log(f"Safe to rerun with: --resume {upload_id} (already-inserted shapes are skipped automatically)")
                sys.exit(1)
        log(f"Progress: {current_count()} / {total} inserted so far")

    skipped = psql(
        args.db_url,
        f"SELECT count(*) FROM {staging_table} WHERE ST_NPoints(geom) > {args.vertex_cutoff};",
        tuples_only=True,
    ).strip()

    final_count = current_count()
    invalid = psql(
        args.db_url,
        f"SELECT count(*) FILTER (WHERE NOT ST_IsValid(geom)) FROM public.map_shapes WHERE upload_id = '{upload_id}';",
        tuples_only=True,
    ).strip()

    psql(args.db_url, f"UPDATE public.boundary_uploads SET completed_at = now() WHERE id = '{upload_id}';")

    print()
    log(f"Done. {final_count} shapes loaded, {invalid} invalid, {skipped} skipped (over {args.vertex_cutoff:,} vertices).")
    log(f"Upload batch id: {upload_id}")

    psql(args.db_url, f"DROP TABLE IF EXISTS {staging_table};")
    log("Staging table dropped.")


def _pg_conninfo(db_url):
    """ogr2ogr's PG: driver wants space-separated key=value, not a URL."""
    from urllib.parse import urlparse, unquote

    u = urlparse(db_url)
    parts = [f"host={u.hostname}", f"port={u.port or 5432}", f"dbname={(u.path or '/postgres').lstrip('/')}"]
    if u.username:
        parts.append(f"user={unquote(u.username)}")
    if u.password:
        parts.append(f"password={unquote(u.password)}")
    parts.append("sslmode=require")
    # Raw staging COPY has no tiering yet (that only applies to the map_shapes
    # insert below) — a single very complex geometry (e.g. Arctic coastline)
    # can otherwise blow past the pooler's default statement_timeout mid-COPY.
    parts.append("options='-c statement_timeout=1800000'")
    return " ".join(parts)


def _sql_str(value):
    return "'" + value.replace("'", "''") + "'"


if __name__ == "__main__":
    main()
