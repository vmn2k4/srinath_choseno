#!/usr/bin/env python3
"""
Extract USA census/demographic data from public Census Bureau bulk files (no API key needed):

  1. Population Estimates Program (PEP) subcounty file — population by place & state
     scripts/data/sub-est2024.csv (SUMLEV 162 = place, 040 = state)
     Source: https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv

  2. SAIPE (Small Area Income and Poverty Estimates) — median household income & poverty
     rate at STATE level only (SAIPE does not publish place-level estimates; place-level
     income would require the ACS API, which needs a key — skipped here per user direction
     to use public/no-key sources and accept partial coverage).
     scripts/data/saipe_est23all.txt
     Source: https://www2.census.gov/programs-surveys/saipe/datasets/2023/2023-state-and-county/est23all.txt

Output: scripts/data/usa_pivoted.json
  { "Municipal": { "<7-digit STATE+PLACE FIPS>": {name, census_data...} },
    "State":     { "<2-letter USPS abbrev>":     {name, census_data...} } }
"""
import csv
import json
import sys

PEP_CSV = "scripts/data/sub-est2024.csv"
SAIPE_TXT = "scripts/data/saipe_est23all.txt"
OUTPUT_JSON = "scripts/data/usa_pivoted.json"

# Standard FIPS state code -> USPS postal abbreviation
FIPS_TO_USPS = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
    "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
    "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
    "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
    "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
    "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
    "55": "WI", "56": "WY", "72": "PR",
}


def extract_population():
    """Parse PEP subcounty file -> population by place (SUMLEV 162) and state (SUMLEV 040)."""
    municipal = {}
    state = {}

    with open(PEP_CSV, encoding="latin-1", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sumlev = row["SUMLEV"]
            name = row["NAME"]
            pop_2024 = row.get("POPESTIMATE2024")
            pop_2020 = row.get("ESTIMATESBASE2020")

            def to_int(v):
                try:
                    return int(v)
                except (TypeError, ValueError):
                    return None

            pop_2024_i = to_int(pop_2024)
            pop_2020_i = to_int(pop_2020)

            if sumlev == "162":  # Incorporated place / CDP (whole place, no county split)
                code = row["STATE"] + row["PLACE"]  # 7-digit: 2-digit state FIPS + 5-digit place FIPS
                growth_pct = None
                if pop_2020_i and pop_2024_i and pop_2020_i > 0:
                    growth_pct = round(100 * (pop_2024_i - pop_2020_i) / pop_2020_i, 2)
                municipal[code] = {
                    "name": name,
                    "census_data": {
                        "source": "US Census Bureau Population Estimates Program (Vintage 2024)",
                        "updated_at": "2026-08-23",
                        "boundary_type": "Municipal",
                        "population_2024": pop_2024_i,
                        "population_2020": pop_2020_i,
                        "population_growth_pct": growth_pct,
                    },
                }
            elif sumlev == "040":  # State
                fips = row["STATE"]
                usps = FIPS_TO_USPS.get(fips)
                if not usps:
                    continue
                growth_pct = None
                if pop_2020_i and pop_2024_i and pop_2020_i > 0:
                    growth_pct = round(100 * (pop_2024_i - pop_2020_i) / pop_2020_i, 2)
                state[usps] = {
                    "name": name,
                    "census_data": {
                        "source": "US Census Bureau Population Estimates Program (Vintage 2024)",
                        "updated_at": "2026-08-23",
                        "boundary_type": "State",
                        "population_2024": pop_2024_i,
                        "population_2020": pop_2020_i,
                        "population_growth_pct": growth_pct,
                    },
                }

    return municipal, state


def extract_saipe_state_income(state_dict):
    """Parse SAIPE fixed-width-ish file, merge median income + poverty rate into state_dict (state-level only)."""
    with open(SAIPE_TXT, encoding="latin-1") as f:
        for line in f:
            parts = line.split()
            if len(parts) < 23:
                continue
            state_fips = parts[0]
            county_fips = parts[1]
            if county_fips != "0":
                continue  # skip county rows, state-level only
            if state_fips == "00":
                continue  # skip US national row

            usps = FIPS_TO_USPS.get(state_fips)
            if not usps or usps not in state_dict:
                continue

            try:
                poverty_count = int(parts[2])
                poverty_rate = float(parts[5])
                median_income = int(parts[20])
            except (ValueError, IndexError):
                continue

            state_dict[usps]["census_data"]["poverty_rate"] = poverty_rate
            state_dict[usps]["census_data"]["median_household_income"] = median_income
            state_dict[usps]["census_data"]["_saipe_poverty_count"] = poverty_count


def main():
    print("Extracting population from PEP subcounty file...", file=sys.stderr)
    municipal, state = extract_population()
    print(f"  {len(municipal)} places, {len(state)} states", file=sys.stderr)

    print("Merging SAIPE state-level income/poverty...", file=sys.stderr)
    extract_saipe_state_income(state)

    # Drop internal helper fields
    for s in state.values():
        s["census_data"].pop("_saipe_poverty_count", None)

    output = {"Municipal": municipal, "State": state}
    with open(OUTPUT_JSON, "w", encoding="utf-8") as out:
        json.dump(output, out)

    print(f"Wrote {OUTPUT_JSON}", file=sys.stderr)
    print(f"Municipal: {len(municipal)}, State: {len(state)}", file=sys.stderr)


if __name__ == "__main__":
    main()
