# Census Data Integration Guide

This guide covers adding demographic and socioeconomic data to **all geographic levels** in both **Canada** and **USA**, stored as JSONB in `map_shapes.census_data`.

---

## 1. Migration

Applied automatically via:
```bash
npx supabase migration up
```

This adds:
- `census_data JSONB` column to `map_shapes`
- GIN index on `census_data` for efficient JSONB queries

---

## 2. Data Sources & Download Instructions

### 🇨🇦 CANADA

#### 2.1 Municipalities (5,161 CSDs)
**Source**: Statistics Canada 2021 Census Profile  
**Geographic Level**: Census Subdivisions (CSD)  
**Key Fields**: Population, age, income, housing, employment

**Download Steps**:
1. Visit: https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/index.cfm
2. Language: Select English
3. **Geography Selection**:
   - Click "Select geographies" → "Census subdivisions"
   - Click "Select all" to get all 5,161 municipalities
4. **Download as CSV**:
   - Click "Download data" → "CSV format"
   - File: `98-401-X2021001_English_CSV_data.zip` (~3 MB)
5. Extract: `98-401-X2021001_English_CSV_data.csv`

**Expected columns** in CSV:
```
GEO_CODE (7-digit CSDUID)
GEO_NAME
T1_COUNT_TOTAL (Population 2021)
Census_Median_Age
Census_Household_Count
Census_Median_HH_Income
Census_Owner_Occupied_Pct
Census_Unemployment_Rate
Census_Labour_Participation
... (400+ more fields)
```

**Load**:
```bash
export DATABASE_URL="postgresql://postgres.xxx:yyy@host:5432/postgres"
python3 scripts/load_census_data.py \
  --country Canada \
  --level Municipal \
  --input 98-401-X2021001_English_CSV_data.csv
```

---

#### 2.2 Provinces & Territories (13)
**Source**: Statistics Canada 2021 Census Profile  
**Geographic Level**: Provinces/Territories  

**Download Steps**:
1. Same URL as municipalities above
2. **Geography Selection**:
   - Click "Select geographies" → "Provinces and territories"
   - Click "Select all" (13 provinces/territories)
3. Download as CSV

**Load**:
```bash
python3 scripts/load_census_data.py \
  --country Canada \
  --level Province \
  --input 98-401-X2021001_provinces_CSV_data.csv
```

---

#### 2.3 Federal (Canada-wide)
**Source**: Statistics Canada 2021 Census, Canada-level aggregate  
**Geographic Level**: National  

**Option A: Manual aggregation** (easiest):
```sql
-- Aggregate municipalities → federal
UPDATE public.map_shapes ms
SET census_data = (
  SELECT jsonb_build_object(
    'source', 'StatCan 2021 Census (aggregated)',
    'population_2021', SUM((ms2.census_data->>'population_2021')::bigint),
    'households', SUM((ms2.census_data->>'households')::int),
    'median_age', AVG((ms2.census_data->>'median_age')::numeric),
    'updated_at', '2026-08-23'
  )
  FROM public.map_shapes ms2
  WHERE ms2.country = 'Canada'
    AND ms2.boundary_type = 'Municipal'
    AND ms2.census_data IS NOT NULL
)
WHERE ms.country = 'Canada'
  AND ms.boundary_type = 'Federal';
```

**Option B: Download from StatCan directly**:
1. Visit the Census Profile page, select no geography (= Canada total)
2. Download CSV, load with `--level Federal`

---

### 🇺🇸 USA

#### 2.4 Municipalities (Incorporated Places) (~20,000)
**Source**: US Census Bureau, American Community Survey (ACS) 5-Year 2022  
**Geographic Level**: Incorporated Places  

**Download Steps**:
1. Visit: https://data.census.gov/
2. Click "Table" → Search for:
   - `DP05` (ACS Demographic and Housing Estimates)
   - Or `S1903` (Median Income)
3. **Geography**: Select "Incorporated place within State"
   - Select all states, all places
4. **Download**:
   - Click "Download" → CSV format
   - Files: Multiple CSVs per state (combine with script below)

**Expected columns**:
```
GEO_ID (format: "1600000US" + 5-digit GEOID)
NAME (city name)
POPULATION_2020 (or ACS_EST)
HOUSEHOLDS
MEDIAN_HOUSEHOLD_INCOME
MEDIAN_AGE
UNEMPLOYMENT_RATE
POVERTY_RATE
OWNER_OCCUPIED_PCT
```

**Combine multiple CSVs** (if Census.gov split by state):
```bash
# Combine all state files into one
head -1 DP05_data_AK.csv > all_places.csv
tail -n +2 DP05_data_*.csv >> all_places.csv
```

**Load**:
```bash
python3 scripts/load_census_data.py \
  --country USA \
  --level Municipal \
  --input all_places.csv
```

---

#### 2.5 States (50)
**Source**: US Census Bureau, ACS 5-Year 2022  
**Geographic Level**: States  

**Download Steps**:
1. Visit: https://data.census.gov/
2. Search for: `DP05` (Demographic and Housing)
3. **Geography**: Select "State"
4. Select all 50 states
5. Download as CSV

**Expected columns**:
```
STATE_CODE (2-letter abbreviation or 2-digit FIPS code)
NAME (state name)
POPULATION_2020
MEDIAN_HOUSEHOLD_INCOME
MEDIAN_AGE
UNEMPLOYMENT_RATE
POVERTY_RATE
HOUSEHOLDS
```

**Load**:
```bash
python3 scripts/load_census_data.py \
  --country USA \
  --level State \
  --input acs_state_2022.csv
```

---

#### 2.6 Federal (USA-wide)
**Source**: US Census Bureau, National totals  

**Option A: Aggregate from states**:
```sql
UPDATE public.map_shapes ms
SET census_data = (
  SELECT jsonb_build_object(
    'source', 'US Census Bureau ACS (aggregated)',
    'population_2020', SUM((ms2.census_data->>'population_2020')::bigint),
    'households', SUM((ms2.census_data->>'households')::int),
    'updated_at', '2026-08-23'
  )
  FROM public.map_shapes ms2
  WHERE ms2.country = 'USA'
    AND ms2.boundary_type = 'State'
    AND ms2.census_data IS NOT NULL
)
WHERE ms.country = 'USA'
  AND ms.boundary_type = 'Federal';
```

**Option B: Download national data** from Census.gov

---

## 3. Verifying Loaded Data

After running load scripts, check coverage:

```sql
-- Count how many shapes have census data by country/boundary_type
SELECT country, boundary_type, COUNT(*) total_shapes,
       COUNT(census_data) with_census_data,
       ROUND(100.0 * COUNT(census_data) / COUNT(*), 1) pct_loaded
FROM public.map_shapes
GROUP BY country, boundary_type
ORDER BY country, boundary_type;

-- Sample a municipality
SELECT name, code, census_data
FROM public.map_shapes
WHERE country = 'Canada' 
  AND boundary_type = 'Municipal'
  AND census_data IS NOT NULL
LIMIT 1;
-- Output example:
-- census_data: {"median_household_income": 85000, "population_2021": 2930000, "median_age": 38.5, ...}
```

---

## 4. Querying Census Data (Frontend & Services)

### Service Layer Function

**File**: `src/lib/services/census.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

export async function getMapShapeWithCensusData(
  supabase: SupabaseClient<Database>,
  shapeId: bigint
) {
  const { data, error } = await supabase
    .from('map_shapes')
    .select(`
      id, name, code, boundary_type, country,
      census_data
    `)
    .eq('id', shapeId)
    .single();

  return { data, error };
}

export async function getTopMunicipalitiesByPopulation(
  supabase: SupabaseClient<Database>,
  country: string,
  limit: number = 20
) {
  // Query using JSONB extraction
  const { data, error } = await supabase
    .rpc('get_top_municipalities_by_population', {
      p_country: country,
      p_limit: limit,
    });

  return { data, error };
}

// Helper to extract census fields
export function parseCensusData(censusJson: any) {
  return {
    population: censusJson?.population_2021 || censusJson?.population_2020,
    median_income: censusJson?.median_household_income,
    median_age: censusJson?.median_age,
    unemployment_rate: censusJson?.unemployment_rate,
    households: censusJson?.households,
    source: censusJson?.source || 'Unknown',
  };
}
```

### SQL-level Queries (Performance)

**Get top 20 largest municipalities**:
```sql
SELECT name, code, boundary_type,
       (census_data->>'population_2021')::bigint AS population,
       (census_data->>'median_household_income')::int AS income,
       (census_data->>'median_age')::numeric AS median_age
FROM public.map_shapes
WHERE country = 'Canada'
  AND boundary_type = 'Municipal'
  AND census_data->'population_2021' IS NOT NULL
ORDER BY (census_data->>'population_2021')::bigint DESC
LIMIT 20;
```

**Get average income by province**:
```sql
SELECT ms_prov.name, 
       AVG((ms_mun.census_data->>'median_household_income')::int) AS avg_income
FROM public.map_shapes ms_mun
JOIN public.shape_containers sc ON sc.map_shape_id = ms_mun.id
JOIN public.map_shapes ms_prov ON ms_prov.id = sc.container_shape_id
WHERE ms_mun.country = 'Canada'
  AND ms_mun.boundary_type = 'Municipal'
  AND ms_mun.census_data IS NOT NULL
GROUP BY ms_prov.id, ms_prov.name
ORDER BY avg_income DESC;
```

### Frontend Components

**Display population on municipality card**:
```typescript
// src/components/MunicipalityCard.tsx
export function MunicipalityCard({ mapShape }) {
  const census = mapShape.census_data;
  const population = census?.population_2021 || census?.population_2020;
  
  return (
    <div className="card p-4 border rounded-lg">
      <h3 className="text-lg font-bold">{mapShape.name}</h3>
      {population && (
        <p className="text-sm text-gray-700">
          <strong>Population:</strong> {population.toLocaleString()}
        </p>
      )}
      {census?.median_household_income && (
        <p className="text-sm text-gray-700">
          <strong>Median Income:</strong> ${census.median_household_income.toLocaleString()}
        </p>
      )}
      {census?.unemployment_rate && (
        <p className="text-sm text-gray-700">
          <strong>Unemployment:</strong> {census.unemployment_rate}%
        </p>
      )}
    </div>
  );
}
```

---

## 5. Common JSONB Field Names by Level

### Canada - Municipalities & Provinces
```json
{
  "source": "StatCan 2021 Census Profile",
  "updated_at": "2026-08-23",
  "population_2021": 2930000,
  "population_2016": 2900000,
  "population_growth_pct": 1.03,
  "population_density": 4650.5,
  "households": 1200000,
  "household_avg_size": 2.44,
  "median_age": 38.5,
  "median_household_income": 85000,
  "low_income_pct": 9.2,
  "owner_occupied_pct": 65.5,
  "unemployment_rate": 4.1,
  "labour_participation_pct": 62.3,
  "median_rent_monthly": 1450,
  "official_language_en_pct": 92.5,
  "official_language_fr_pct": 3.2
}
```

### USA - Municipalities & States
```json
{
  "source": "US Census Bureau ACS 5-Year 2022",
  "updated_at": "2026-08-23",
  "population_2020": 128500,
  "population_density": 1250.0,
  "households": 45000,
  "median_household_income": 72000,
  "median_age": 37.2,
  "unemployment_rate": 3.5,
  "poverty_rate": 12.1,
  "owner_occupied_pct": 68.5,
  "median_rent_monthly": 1200,
  "median_home_value": 350000
}
```

---

## 6. Updating Data (Quarterly/Annually)

StatCan and Census Bureau release updates annually. To refresh:

```bash
# 2025 Census data (when available)
python3 scripts/load_census_data.py \
  --country Canada \
  --level Municipal \
  --input 98-401-X2025001_English_CSV_data.csv

# Re-run Federal aggregation
psql "$DATABASE_URL" < scripts/aggregate_federal_census.sql
```

---

## 7. Notes & Caveats

1. **JSONB Flexibility**: Fields may differ by country/level. Always check with `->` (text) or `->>` (text-to-string) operators.

2. **Population vs. Households**: Census can distinguish:
   - `population_2021` = individuals
   - `households` = housing units (smaller number)

3. **Missing Data**: Some smaller municipalities may lack certain fields (e.g., median income for very small towns). Always `NULL`-check in queries.

4. **Confidentiality**: Census Bureau suppresses data for very small geographies (< 100 people) for privacy.

5. **Census Timing**:
   - Canada: Decennial (2021, next 2031)
   - USA: ACS updated annually (5-year estimates are most stable)

---

## 8. Troubleshooting

### Error: "No rows updated"
- Check that `code` values in CSV match `map_shapes.code` (7 digits for Canada CSDs, FIPS for USA places)
- Verify `country` and `boundary_type` match exactly

### Slow JSONB queries?
- The GIN index on `census_data` helps with containment (`@>`) queries
- For frequent filtering by population, consider a materialized view:
  ```sql
  CREATE MATERIALIZED VIEW map_shapes_with_population AS
  SELECT id, name, boundary_type, country,
         (census_data->>'population_2021')::bigint AS population_2021
  FROM public.map_shapes
  WHERE census_data IS NOT NULL;
  
  CREATE INDEX idx_pop_view ON map_shapes_with_population(population_2021 DESC);
  ```

### Data quality check
```sql
-- Find municipalities with very high population density (data errors?)
SELECT name, country, boundary_type,
       (census_data->>'population_2021')::bigint AS pop,
       (census_data->>'land_area_km2')::numeric AS area,
       (census_data->>'population_2021')::bigint / 
         NULLIF((census_data->>'land_area_km2')::numeric, 0) AS calc_density
FROM public.map_shapes
WHERE country = 'Canada'
  AND boundary_type = 'Municipal'
  AND census_data->>'population_2021' IS NOT NULL
HAVING (census_data->>'population_2021')::bigint / 
       NULLIF((census_data->>'land_area_km2')::numeric, 0) > 50000
ORDER BY calc_density DESC;
```

---

## Quick Start Checklist

- [ ] Apply migration: `npx supabase migration up`
- [ ] Download Canada municipality CSV from StatCan
- [ ] Download USA municipality/state CSVs from Census.gov
- [ ] Load Canada municipalities: `python3 scripts/load_census_data.py --country Canada --level Municipal --input ...csv`
- [ ] Load Canada provinces: `python3 scripts/load_census_data.py --country Canada --level Province --input ...csv`
- [ ] Load USA municipalities: `python3 scripts/load_census_data.py --country USA --level Municipal --input ...csv`
- [ ] Load USA states: `python3 scripts/load_census_data.py --country USA --level State --input ...csv`
- [ ] Run verification query to check coverage
- [ ] Create service layer functions in `src/lib/services/census.ts`
- [ ] Update frontend components to display census data
