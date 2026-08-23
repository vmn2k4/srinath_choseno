#!/usr/bin/env python3
"""
Stream StatCan's long-format 2021 Census Profile CSV (98-401-X2021005, ~2.6GB, 14.3M rows)
and pivot the characteristics we care about into a compact per-geography JSON file.

Input format (one row per characteristic per geography):
  CENSUS_YEAR,DGUID,ALT_GEO_CODE,GEO_LEVEL,GEO_NAME,...,CHARACTERISTIC_ID,CHARACTERISTIC_NAME,...,C1_COUNT_TOTAL,...

GEO_LEVEL values used: 'Country', 'Province', 'Territory', 'Census subdivision'
ALT_GEO_CODE: 7-digit CSDUID for municipalities, 2-digit PRUID for provinces/territories, '01' for Canada.

Output: scripts/data/statcan_pivoted.json
  { "Municipal": { "<CSDUID>": {name, census_data...} },
    "Province":  { "<PRUID>":  {name, census_data...} },
    "National":  { "01": {name, census_data...} } }
"""

import csv
import json
import sys

INPUT_CSV = "scripts/data/statcan_full_extracted/98-401-X2021005_English_CSV_data.csv"
OUTPUT_JSON = "scripts/data/statcan_pivoted.json"

# Characteristic IDs we want, mapped to output field names.
CHAR_MAP = {
    "1": "population_2021",
    "2": "population_2016",
    "3": "population_growth_pct",
    "4": "total_private_dwellings",
    "5": "private_dwellings_occupied",
    "6": "population_density",
    "7": "land_area_km2",
    "40": "median_age",
    "41": "_total_occupied_dwellings",  # base for owner/renter %, not output directly
    "50": "_total_private_households",  # base
    "56": "population_in_private_households",
    "57": "household_avg_size",
    "243": "median_household_income",
    "252": "average_household_income",
    "345": "low_income_pct",
    "1415": "_owner_count",
    "1416": "_renter_count",
    "1483": "owner_with_mortgage_pct",
    "1484": "owner_spending_30pct_on_shelter_pct",
    "1486": "median_monthly_shelter_owned",
    "1487": "average_monthly_shelter_owned",
    "1492": "renter_spending_30pct_on_shelter_pct",
    "1494": "median_monthly_shelter_rented",
    "1495": "average_monthly_shelter_rented",
    "2228": "participation_rate",
    "2229": "employment_rate",
    "2230": "unemployment_rate",
    "383": "_total_official_language_knowledge",  # base
    "384": "_english_only_count",
    "385": "_french_only_count",
}

GEO_LEVEL_TO_BOUNDARY_TYPE = {
    "Census subdivision": "Municipal",
    "Province": "Province",
    "Territory": "Province",  # territories use the same boundary_type as provinces in map_shapes
    "Country": "National",
}


def parse_value(raw):
    """Parse a StatCan value cell: strip commas, handle '...'/'x'/'F'/'-' suppression markers."""
    if raw is None:
        return None
    v = raw.strip()
    if v in ("", "...", "x", "F", "-", "..", "N"):
        return None
    v = v.replace(",", "")
    try:
        if "." in v:
            return float(v)
        return int(v)
    except ValueError:
        return None


def main():
    # geo_data[boundary_type][code] = {"name": ..., "fields": {...}}
    geo_data = {"Municipal": {}, "Province": {}, "National": {}}

    print(f"Streaming {INPUT_CSV} ...", file=sys.stderr)
    row_count = 0
    matched_count = 0

    with open(INPUT_CSV, encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        idx = {h: i for i, h in enumerate(header)}
        i_geo_level = idx["GEO_LEVEL"]
        i_geo_code = idx["ALT_GEO_CODE"]
        i_geo_name = idx["GEO_NAME"]
        i_char_id = idx["CHARACTERISTIC_ID"]
        i_value = idx["C1_COUNT_TOTAL"]

        for row in reader:
            row_count += 1
            if row_count % 2_000_000 == 0:
                print(f"  ...{row_count:,} rows processed", file=sys.stderr)

            geo_level = row[i_geo_level]
            boundary_type = GEO_LEVEL_TO_BOUNDARY_TYPE.get(geo_level)
            if boundary_type is None:
                continue

            char_id = row[i_char_id]
            field_name = CHAR_MAP.get(char_id)
            if field_name is None:
                continue

            matched_count += 1
            code = row[i_geo_code]
            name = row[i_geo_name]
            value = parse_value(row[i_value])

            bucket = geo_data[boundary_type].setdefault(code, {"name": name, "fields": {}})
            bucket["fields"][field_name] = value

    print(f"Done: {row_count:,} rows scanned, {matched_count:,} matched characteristics", file=sys.stderr)

    # Post-process: compute derived percentages, drop internal "_" helper fields
    output = {"Municipal": {}, "Province": {}, "National": {}}
    for boundary_type, geos in geo_data.items():
        for code, entry in geos.items():
            f = entry["fields"]
            census_data = {
                "source": "StatCan 2021 Census Profile",
                "updated_at": "2026-08-23",
                "boundary_type": boundary_type,
            }
            for k, v in f.items():
                if k.startswith("_"):
                    continue
                if v is not None:
                    census_data[k] = v

            # Derived: owner-occupied %
            total_dwellings = f.get("_total_occupied_dwellings")
            owner_count = f.get("_owner_count")
            if total_dwellings and owner_count is not None and total_dwellings > 0:
                census_data["owner_occupied_pct"] = round(100 * owner_count / total_dwellings, 1)

            # Derived: households (use total private households characteristic)
            households = f.get("_total_private_households")
            if households is not None:
                census_data["households"] = households

            # Derived: English/French knowledge %
            total_lang = f.get("_total_official_language_knowledge")
            eng = f.get("_english_only_count")
            fr = f.get("_french_only_count")
            if total_lang and total_lang > 0:
                if eng is not None:
                    census_data["official_language_en_only_pct"] = round(100 * eng / total_lang, 1)
                if fr is not None:
                    census_data["official_language_fr_only_pct"] = round(100 * fr / total_lang, 1)

            output[boundary_type][code] = {"name": entry["name"], "census_data": census_data}

    with open(OUTPUT_JSON, "w", encoding="utf-8") as out:
        json.dump(output, out)

    for bt, geos in output.items():
        print(f"{bt}: {len(geos)} geographies pivoted", file=sys.stderr)
    print(f"Wrote {OUTPUT_JSON}", file=sys.stderr)


if __name__ == "__main__":
    main()
