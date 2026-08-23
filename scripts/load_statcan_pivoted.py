#!/usr/bin/env python3
"""
Load the pivoted StatCan census JSON (scripts/data/statcan_pivoted.json) into
map_shapes.census_data, matching on (country='Canada', boundary_type, code).

Special handling:
  - Municipal: code = 7-digit CSDUID, direct match to map_shapes.code
  - Province:  code = 2-digit PRUID, direct match to map_shapes.code
  - National:  map_shapes has one row (boundary_type='National', code IS NULL) —
               matched by name='Canada' instead of code.
"""
import json
import os
import sys
import psycopg2
from psycopg2.extras import execute_batch

INPUT_JSON = "scripts/data/statcan_pivoted.json"


def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    with open(INPUT_JSON, encoding="utf-8") as f:
        data = json.load(f)

    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()

    # --- Municipal & Province: match by code ---
    for boundary_type in ("Municipal", "Province"):
        rows = [
            (json.dumps(entry["census_data"]), boundary_type, code)
            for code, entry in data.get(boundary_type, {}).items()
        ]
        sql = """
            UPDATE public.map_shapes
            SET census_data = %s
            WHERE country = 'Canada' AND boundary_type = %s AND code = %s
        """
        execute_batch(cursor, sql, rows, page_size=200)
        conn.commit()
        print(f"{boundary_type}: attempted {len(rows)} updates")

    # --- National: match by name (code is NULL for the single Canada row) ---
    national = data.get("National", {})
    if national:
        entry = next(iter(national.values()))
        cursor.execute(
            """
            UPDATE public.map_shapes
            SET census_data = %s
            WHERE country = 'Canada' AND boundary_type = 'National'
            """,
            (json.dumps(entry["census_data"]),),
        )
        conn.commit()
        print(f"National: attempted {cursor.rowcount} updates")

    # --- Verification ---
    cursor.execute(
        """
        SELECT boundary_type, count(*) total, count(census_data) with_data
        FROM public.map_shapes
        WHERE country = 'Canada' AND boundary_type IN ('Municipal', 'Province', 'National')
        GROUP BY boundary_type
        ORDER BY boundary_type
        """
    )
    print("\n--- Coverage ---")
    for row in cursor.fetchall():
        print(f"{row[0]}: {row[2]}/{row[1]} have census_data")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
