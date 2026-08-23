#!/usr/bin/env python3
"""
Load scripts/data/usa_pivoted.json into map_shapes.census_data using ONE bulk
UPDATE...FROM a temp staging table (fast), instead of thousands of individual
per-row UPDATEs in a single transaction (was taking 20+ min and growing
quadratically due to no index on `code` -- fixed now, but bulk is still the
right approach regardless of indexing).
"""
import io
import json
import os
import sys
import psycopg2

INPUT_JSON = "scripts/data/usa_pivoted.json"


def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    with open(INPUT_JSON, encoding="utf-8") as f:
        data = json.load(f)

    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()

    for boundary_type in ("Municipal", "State"):
        entries = data.get(boundary_type, {})
        if not entries:
            continue

        cursor.execute("CREATE TEMP TABLE census_staging (code text, census_data jsonb) ON COMMIT DROP")
        buf = io.StringIO()
        for code, entry in entries.items():
            # tab-delimited COPY, escape backslash/tab/newline in the JSON payload
            payload = json.dumps(entry["census_data"]).replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n")
            buf.write(f"{code}\t{payload}\n")
        buf.seek(0)
        cursor.copy_expert("COPY census_staging (code, census_data) FROM STDIN", buf)

        cursor.execute(
            """
            UPDATE public.map_shapes ms
            SET census_data = s.census_data
            FROM census_staging s
            WHERE ms.country = 'USA' AND ms.boundary_type = %s AND ms.code = s.code
            """,
            (boundary_type,),
        )
        updated = cursor.rowcount
        conn.commit()
        print(f"{boundary_type}: {updated} rows updated (of {len(entries)} candidates)")

    cursor.execute(
        """
        SELECT boundary_type, count(*) total, count(census_data) with_data
        FROM public.map_shapes
        WHERE country = 'USA' AND boundary_type IN ('Municipal', 'State')
        GROUP BY boundary_type ORDER BY boundary_type
        """
    )
    print("\n--- Coverage ---")
    for row in cursor.fetchall():
        print(f"{row[0]}: {row[2]}/{row[1]} have census_data")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
