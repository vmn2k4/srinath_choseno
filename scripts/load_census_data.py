#!/usr/bin/env python3
"""
Load census/demographic data from StatCan (Canada) and US Census Bureau into map_shapes.census_data JSONB column.

Usage:
  python3 scripts/load_census_data.py --help
  python3 scripts/load_census_data.py --country Canada --level Municipal --input census_profile_2021.csv
  python3 scripts/load_census_data.py --country USA --level Municipal --input usa_places_2020.csv

Data sources:
  CANADA:
    - Municipalities: https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/index.cfm
    - Provinces: Same portal, select "Provinces and territories"
    - Federal: Derived from provincial aggregates

  USA:
    - Municipalities (Places): https://data.census.gov (download as CSV)
    - States: Same portal
    - Federal: Derived from state aggregates
"""

import argparse
import json
import os
import sys
import csv
from typing import Dict, Any, Optional
import psycopg2
from psycopg2.extras import execute_batch
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class CensusDataLoader:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.conn = None
        self.cursor = None

    def connect(self):
        """Connect to database"""
        self.conn = psycopg2.connect(self.db_url)
        self.cursor = self.conn.cursor()
        logger.info("Connected to database")

    def close(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
            logger.info("Disconnected from database")

    def load_canada_municipalities(self, csv_file: str):
        """
        Load Canada municipality census data from StatCan CSV.
        StatCan Census Profile CSV structure (example columns):
          - GEO_CODE (7-digit CSDUID)
          - GEO_NAME
          - T1_COUNT_TOTAL (Population 2021)
          - T1_COUNT_MEN, T1_COUNT_WOMEN
          - Census_Median_Age
          - Census_Household_Count
          - Census_Median_HH_Income
          - Census_Owner_Occupied_Pct
          - Census_Unemployment_Rate
          ... (hundreds more)
        """
        logger.info(f"Loading Canada municipality census data from {csv_file}")

        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        updates = []
        for row in rows:
            try:
                geo_code = row.get('GEO_CODE', '').strip()
                if not geo_code or len(geo_code) != 7:
                    continue  # Skip invalid codes

                # Build census_data JSONB
                census_data = {
                    'source': 'StatCan 2021 Census Profile',
                    'updated_at': '2026-08-23',
                    'boundary_type': 'Municipal',
                }

                # Population
                if 'T1_COUNT_TOTAL' in row and row['T1_COUNT_TOTAL']:
                    try:
                        census_data['population_2021'] = int(row['T1_COUNT_TOTAL'].replace(',', ''))
                    except ValueError:
                        pass

                # Median age
                if 'Census_Median_Age' in row and row['Census_Median_Age']:
                    try:
                        census_data['median_age'] = float(row['Census_Median_Age'])
                    except ValueError:
                        pass

                # Households
                if 'Census_Household_Count' in row and row['Census_Household_Count']:
                    try:
                        census_data['households'] = int(row['Census_Household_Count'].replace(',', ''))
                    except ValueError:
                        pass

                # Median household income
                if 'Census_Median_HH_Income' in row and row['Census_Median_HH_Income']:
                    try:
                        census_data['median_household_income'] = int(
                            row['Census_Median_HH_Income'].replace(',', '').replace('$', '')
                        )
                    except ValueError:
                        pass

                # Owner-occupied percentage
                if 'Census_Owner_Occupied_Pct' in row and row['Census_Owner_Occupied_Pct']:
                    try:
                        census_data['owner_occupied_pct'] = float(row['Census_Owner_Occupied_Pct'])
                    except ValueError:
                        pass

                # Unemployment rate
                if 'Census_Unemployment_Rate' in row and row['Census_Unemployment_Rate']:
                    try:
                        census_data['unemployment_rate'] = float(row['Census_Unemployment_Rate'])
                    except ValueError:
                        pass

                # Labour participation
                if 'Census_Labour_Participation' in row and row['Census_Labour_Participation']:
                    try:
                        census_data['labour_participation_pct'] = float(row['Census_Labour_Participation'])
                    except ValueError:
                        pass

                updates.append((json.dumps(census_data), 'Canada', 'Municipal', geo_code))

            except Exception as e:
                logger.warning(f"Error processing row {row.get('GEO_CODE')}: {e}")
                continue

        self._bulk_update_census_data(updates)
        logger.info(f"Loaded {len(updates)} Canadian municipalities")

    def load_canada_provinces(self, csv_file: str):
        """Load Canada province census data. Similar to municipalities but province-level."""
        logger.info(f"Loading Canada province census data from {csv_file}")

        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        updates = []
        for row in rows:
            try:
                geo_code = row.get('GEO_CODE', '').strip()
                if not geo_code:
                    continue

                census_data = {
                    'source': 'StatCan 2021 Census Profile',
                    'updated_at': '2026-08-23',
                    'boundary_type': 'Province',
                }

                # Same fields as municipalities
                if 'T1_COUNT_TOTAL' in row and row['T1_COUNT_TOTAL']:
                    try:
                        census_data['population_2021'] = int(row['T1_COUNT_TOTAL'].replace(',', ''))
                    except ValueError:
                        pass

                if 'Census_Median_Age' in row and row['Census_Median_Age']:
                    try:
                        census_data['median_age'] = float(row['Census_Median_Age'])
                    except ValueError:
                        pass

                if 'Census_Median_HH_Income' in row and row['Census_Median_HH_Income']:
                    try:
                        census_data['median_household_income'] = int(
                            row['Census_Median_HH_Income'].replace(',', '').replace('$', '')
                        )
                    except ValueError:
                        pass

                updates.append((json.dumps(census_data), 'Canada', 'Province', geo_code))

            except Exception as e:
                logger.warning(f"Error processing row {row.get('GEO_CODE')}: {e}")
                continue

        self._bulk_update_census_data(updates)
        logger.info(f"Loaded {len(updates)} Canadian provinces")

    def load_usa_municipalities(self, csv_file: str):
        """
        Load USA municipality (Place) census data from US Census Bureau CSV.
        Expected columns from Census.gov download:
          - GEO_ID (format: "1600000US" + 5-digit GEOID)
          - NAME
          - POPULATION_2020
          - HOUSEHOLDS
          - MEDIAN_HOUSEHOLD_INCOME
          - MEDIAN_AGE
          - UNEMPLOYMENT_RATE
          - POVERTY_RATE
          - OWNER_OCCUPIED_PCT
          ... (more)
        """
        logger.info(f"Loading USA municipality census data from {csv_file}")

        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        updates = []
        for row in rows:
            try:
                # Extract 5-digit GEOID from "1600000US12345" format
                geo_id = row.get('GEO_ID', '').strip()
                if not geo_id or len(geo_id) < 5:
                    continue

                geoid = geo_id[-5:] if len(geo_id) >= 5 else None
                if not geoid:
                    continue

                census_data = {
                    'source': 'US Census Bureau ACS 5-Year 2022',
                    'updated_at': '2026-08-23',
                    'boundary_type': 'Municipal',
                }

                # Population
                if 'POPULATION_2020' in row and row['POPULATION_2020']:
                    try:
                        census_data['population_2020'] = int(row['POPULATION_2020'].replace(',', ''))
                    except ValueError:
                        pass

                # Households
                if 'HOUSEHOLDS' in row and row['HOUSEHOLDS']:
                    try:
                        census_data['households'] = int(row['HOUSEHOLDS'].replace(',', ''))
                    except ValueError:
                        pass

                # Median household income
                if 'MEDIAN_HOUSEHOLD_INCOME' in row and row['MEDIAN_HOUSEHOLD_INCOME']:
                    try:
                        census_data['median_household_income'] = int(
                            row['MEDIAN_HOUSEHOLD_INCOME'].replace(',', '').replace('$', '')
                        )
                    except ValueError:
                        pass

                # Median age
                if 'MEDIAN_AGE' in row and row['MEDIAN_AGE']:
                    try:
                        census_data['median_age'] = float(row['MEDIAN_AGE'])
                    except ValueError:
                        pass

                # Unemployment rate
                if 'UNEMPLOYMENT_RATE' in row and row['UNEMPLOYMENT_RATE']:
                    try:
                        census_data['unemployment_rate'] = float(row['UNEMPLOYMENT_RATE'])
                    except ValueError:
                        pass

                # Poverty rate
                if 'POVERTY_RATE' in row and row['POVERTY_RATE']:
                    try:
                        census_data['poverty_rate'] = float(row['POVERTY_RATE'])
                    except ValueError:
                        pass

                # Owner-occupied percentage
                if 'OWNER_OCCUPIED_PCT' in row and row['OWNER_OCCUPIED_PCT']:
                    try:
                        census_data['owner_occupied_pct'] = float(row['OWNER_OCCUPIED_PCT'])
                    except ValueError:
                        pass

                updates.append((json.dumps(census_data), 'USA', 'Municipal', geoid))

            except Exception as e:
                logger.warning(f"Error processing row {row.get('NAME')}: {e}")
                continue

        self._bulk_update_census_data(updates)
        logger.info(f"Loaded {len(updates)} USA municipalities")

    def load_usa_states(self, csv_file: str):
        """Load USA state census data."""
        logger.info(f"Loading USA state census data from {csv_file}")

        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        updates = []
        for row in rows:
            try:
                geo_code = row.get('STATE_CODE', '').strip()
                if not geo_code or len(geo_code) != 2:
                    continue

                census_data = {
                    'source': 'US Census Bureau ACS 5-Year 2022',
                    'updated_at': '2026-08-23',
                    'boundary_type': 'State',
                }

                # Population
                if 'POPULATION_2020' in row and row['POPULATION_2020']:
                    try:
                        census_data['population_2020'] = int(row['POPULATION_2020'].replace(',', ''))
                    except ValueError:
                        pass

                # Median income
                if 'MEDIAN_HOUSEHOLD_INCOME' in row and row['MEDIAN_HOUSEHOLD_INCOME']:
                    try:
                        census_data['median_household_income'] = int(
                            row['MEDIAN_HOUSEHOLD_INCOME'].replace(',', '').replace('$', '')
                        )
                    except ValueError:
                        pass

                # Median age
                if 'MEDIAN_AGE' in row and row['MEDIAN_AGE']:
                    try:
                        census_data['median_age'] = float(row['MEDIAN_AGE'])
                    except ValueError:
                        pass

                # Unemployment
                if 'UNEMPLOYMENT_RATE' in row and row['UNEMPLOYMENT_RATE']:
                    try:
                        census_data['unemployment_rate'] = float(row['UNEMPLOYMENT_RATE'])
                    except ValueError:
                        pass

                # Poverty
                if 'POVERTY_RATE' in row and row['POVERTY_RATE']:
                    try:
                        census_data['poverty_rate'] = float(row['POVERTY_RATE'])
                    except ValueError:
                        pass

                updates.append((json.dumps(census_data), 'USA', 'State', geo_code))

            except Exception as e:
                logger.warning(f"Error processing row {row.get('STATE_CODE')}: {e}")
                continue

        self._bulk_update_census_data(updates)
        logger.info(f"Loaded {len(updates)} USA states")

    def _bulk_update_census_data(self, updates):
        """Bulk update map_shapes.census_data via code column match"""
        if not updates:
            logger.warning("No data to update")
            return

        sql = """
            UPDATE public.map_shapes
            SET census_data = %s
            WHERE country = %s
              AND boundary_type = %s
              AND code = %s
        """

        try:
            execute_batch(self.cursor, sql, updates, page_size=100)
            self.conn.commit()
            logger.info(f"Updated {len(updates)} rows in map_shapes")
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Error updating census data: {e}")
            raise


def main():
    parser = argparse.ArgumentParser(
        description='Load census data from StatCan (Canada) or US Census Bureau into map_shapes.census_data'
    )
    parser.add_argument('--country', required=True, choices=['Canada', 'USA'], help='Country')
    parser.add_argument('--level', required=True, choices=['Municipal', 'Province', 'State', 'Federal'],
                        help='Geographic level')
    parser.add_argument('--input', required=True, help='Input CSV file path')
    parser.add_argument('--db', default=os.environ.get('DATABASE_URL'),
                        help='Database URL (default: $DATABASE_URL env var)')

    args = parser.parse_args()

    if not args.db:
        logger.error("DATABASE_URL not set. Pass --db or set DATABASE_URL environment variable.")
        sys.exit(1)

    loader = CensusDataLoader(args.db)
    try:
        loader.connect()

        if args.country == 'Canada':
            if args.level == 'Municipal':
                loader.load_canada_municipalities(args.input)
            elif args.level == 'Province':
                loader.load_canada_provinces(args.input)
            else:
                logger.error(f"Level '{args.level}' not supported for Canada")
                sys.exit(1)

        elif args.country == 'USA':
            if args.level == 'Municipal':
                loader.load_usa_municipalities(args.input)
            elif args.level == 'State':
                loader.load_usa_states(args.input)
            else:
                logger.error(f"Level '{args.level}' not supported for USA")
                sys.exit(1)

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
    finally:
        loader.close()


if __name__ == '__main__':
    main()
