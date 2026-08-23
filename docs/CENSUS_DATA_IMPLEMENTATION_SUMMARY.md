# Census Data Integration — Complete Implementation Summary

**Status**: Ready to implement (all code scaffolding complete)  
**Date**: 2026-08-23  
**Approach**: JSONB lightweight (Approach 1)  
**Coverage**: Canada (Municipalities, Provinces, Federal) + USA (Municipalities, States, Federal)

---

## What Was Created

### 1. **Database Migration** ✅
**File**: `supabase/migrations/20260823000000_add_census_data_jsonb.sql`

- Adds `census_data JSONB` column to `map_shapes`
- GIN index for efficient JSONB queries
- Full documentation in column comment describing schema structure

**Apply with**:
```bash
npx supabase migration up
```

---

### 2. **Data Load Script** ✅
**File**: `scripts/load_census_data.py`

Universal Python script that loads census data from CSV files into `map_shapes.census_data` JSONB column.

**Supports**:
- Canada municipalities (5,161 CSDs)
- Canada provinces/territories (13)
- USA municipalities/places (~20,000)
- USA states (50)

**Usage**:
```bash
# Canada municipalities
python3 scripts/load_census_data.py \
  --country Canada \
  --level Municipal \
  --input census_profile_2021.csv

# USA states
python3 scripts/load_census_data.py \
  --country USA \
  --level State \
  --input acs_state_2022.csv
```

---

### 3. **Comprehensive Data Guide** ✅
**File**: `docs/CENSUS_DATA_GUIDE.md`

Complete reference covering:
- Where to download census data for each country/level
- Step-by-step download instructions (with URLs)
- Data source descriptions
- Verification queries
- Troubleshooting
- Quick start checklist

---

### 4. **Service Layer Functions** ✅
**File**: `src/lib/services/census.ts`

TypeScript service layer with 10+ functions:

| Function | Purpose |
|----------|---------|
| `getMapShapeWithCensus()` | Fetch single shape with census data |
| `getMapShapesWithCensus()` | Fetch multiple shapes |
| `getShapesByTypeWithCensus()` | Get all shapes of a type (e.g., all CA municipalities) |
| `getTopShapesByPopulation()` | Top N largest municipalities/states |
| `getShapesInContainerWithCensus()` | Municipalities within a province (with census data) |
| `searchShapesWithCensus()` | Full-text search shapes by name |
| `formatCensusData()` | Parse JSONB → human-readable object |
| `calculateDensity()` | Extract/calculate population density |
| `getMedianIncome()` | Calculate national median income statistic |

**Import & use**:
```typescript
import { getTopShapesByPopulation, formatCensusData } from '@/lib/services/census';

const { data: topCities } = await getTopShapesByPopulation(supabase, 'Canada', 'Municipal', 20);
const formatted = formatCensusData(topCities[0].census_data);
console.log(formatted.population); // "2,930,000"
```

---

### 5. **UI Components** ✅
**File**: `src/components/features/CensusDataDisplay.tsx`

Pre-built React components for displaying census data:

| Component | Layout | Use Case |
|-----------|--------|----------|
| `<CensusDataDisplay>` | cards, inline, detailed | Main census display (flexible layouts) |
| `<CensusDataMini>` | minimal | Compact list/table display |
| `<CensusRankBadge>` | badge | Show ranking (e.g., "Rank #1 by population") |

**Example usage**:
```tsx
import { CensusDataDisplay } from '@/components/features/CensusDataDisplay';

export function MunicipalityCard({ mapShape }) {
  return (
    <div>
      <h3>{mapShape.name}</h3>
      <CensusDataDisplay 
        census={mapShape.census_data} 
        layout="cards"
        showSource={true}
      />
    </div>
  );
}
```

---

## Step-by-Step Implementation Plan

### **Phase 1: Database Setup** (5 min)

```bash
# 1. Apply migration
npx supabase migration up

# 2. Verify column exists
psql "$DATABASE_URL" -c "SELECT * FROM information_schema.columns WHERE table_name='map_shapes' AND column_name='census_data';"
```

---

### **Phase 2: Download Census Data** (30 min)

#### **Canada Municipalities**
1. Visit: https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/index.cfm
2. Select: All Census Subdivisions
3. Download CSV (file: `98-401-X2021001_English_CSV_data.csv` or similar)
4. Keep in project root or `scripts/data/` directory

#### **Canada Provinces**
1. Same URL, select Provinces/Territories
2. Download as CSV

#### **USA Municipalities**
1. Visit: https://data.census.gov/
2. Search for: `DP05` (Demographic and Housing)
3. Geography: Incorporated Places (all states)
4. Download CSV (may come as multiple state files — combine them)

#### **USA States**
1. Same URL, Geography: States
2. Download CSV

---

### **Phase 3: Load Census Data** (5-10 min per load)

```bash
# Set database URL
export DATABASE_URL="postgresql://postgres.xxx:yyy@aws-1-us-east-2.pooler.supabase.com:5432/postgres"

# 1. Load Canada municipalities
python3 scripts/load_census_data.py \
  --country Canada \
  --level Municipal \
  --input path/to/98-401-X2021001_English_CSV_data.csv

# 2. Load Canada provinces
python3 scripts/load_census_data.py \
  --country Canada \
  --level Province \
  --input path/to/provinces_census_data.csv

# 3. Load USA municipalities
python3 scripts/load_census_data.py \
  --country USA \
  --level Municipal \
  --input path/to/combined_places.csv

# 4. Load USA states
python3 scripts/load_census_data.py \
  --country USA \
  --level State \
  --input path/to/states_census_data.csv
```

---

### **Phase 4: Verify Data Loaded** (2 min)

```bash
# Check coverage by country/boundary_type
psql "$DATABASE_URL" -c "
SELECT country, boundary_type, COUNT(*) total_shapes,
       COUNT(census_data) with_census_data,
       ROUND(100.0 * COUNT(census_data) / COUNT(*), 1) pct_loaded
FROM public.map_shapes
GROUP BY country, boundary_type
ORDER BY country, boundary_type;
"

# Example output:
--  country | boundary_type | total_shapes | with_census_data | pct_loaded
-- ---------+---------------+--------------+------------------+-----------
--  Canada  | Federal       |            1 |                0 |       0.0
--  Canada  | Municipal     |         5161 |             5161 |     100.0
--  Canada  | Province      |           13 |               13 |     100.0
--  USA     | Federal       |            1 |                0 |       0.0
--  USA     | Municipal     |        19505 |            19500 |      99.9
--  USA     | State         |           50 |               50 |     100.0

# Sample one municipality's data
psql "$DATABASE_URL" -c "
SELECT name, census_data
FROM public.map_shapes
WHERE country = 'Canada' 
  AND boundary_type = 'Municipal'
  AND census_data IS NOT NULL
LIMIT 1;
"
```

---

### **Phase 5: Frontend Integration** (15-30 min)

#### **Example 1: Show population on municipality detail page**

**File**: `src/app/municipality/[slug]/page.tsx`

```typescript
import { getMapShapeWithCensus } from '@/lib/services/census';
import { CensusDataDisplay } from '@/components/features/CensusDataDisplay';

export default async function MunicipalityPage({ params }: Props) {
  const supabase = createServerClient();
  
  // Get shape by code (CSDUID for Canada)
  const { data: shape } = await getMapShapeWithCensus(supabase, shapeId);
  
  return (
    <div>
      <h1>{shape?.name}</h1>
      <CensusDataDisplay 
        census={shape?.census_data} 
        layout="detailed"
      />
    </div>
  );
}
```

#### **Example 2: List top 20 largest municipalities in a province**

**File**: `src/app/district/[slug]/page.tsx`

```typescript
import { getShapesInContainerWithCensus, formatCensusData } from '@/lib/services/census';
import { CensusDataMini } from '@/components/features/CensusDataDisplay';

export default async function DistrictPage({ params }: Props) {
  const supabase = createServerClient();
  
  const { data: municipalities } = await getShapesInContainerWithCensus(
    supabase,
    containerShapeId, // Province shape ID
    'Municipal',
    100 // Fetch all, will be sorted by population
  );
  
  return (
    <div>
      <h2>Municipalities by Population</h2>
      <ul>
        {municipalities.map((muni, idx) => (
          <li key={muni.id}>
            <span className="font-bold">#{idx + 1}</span> {muni.name}
            <CensusDataMini census={muni.census_data} />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

#### **Example 3: National statistics dashboard**

```typescript
import { 
  getShapesByTypeWithCensus, 
  getMedianIncome 
} from '@/lib/services/census';

export default async function NationalStatsPage() {
  const supabase = createServerClient();
  
  // Get all Canadian municipalities with census data
  const { data: allMunicipalities } = await getShapesByTypeWithCensus(
    supabase, 
    'Canada', 
    'Municipal'
  );
  
  // Calculate national stats
  const totalPopulation = allMunicipalities
    .reduce((sum, m) => sum + (m.census_data?.population_2021 || 0), 0);
  
  const { median: medianIncome } = await getMedianIncome(
    supabase, 
    'Canada', 
    'Municipal'
  );
  
  return (
    <div className="grid gap-4">
      <StatCard 
        label="Total Population (Canada)" 
        value={totalPopulation.toLocaleString()} 
      />
      <StatCard 
        label="Median Municipal Income" 
        value={`$${medianIncome?.toLocaleString()}`} 
      />
    </div>
  );
}
```

---

## Database Query Examples

### Frequently Asked Questions (SQL)

**Get top 10 most populous Canadian municipalities**:
```sql
SELECT name, 
       (census_data->>'population_2021')::bigint AS population,
       (census_data->>'median_household_income')::int AS income
FROM public.map_shapes
WHERE country = 'Canada'
  AND boundary_type = 'Municipal'
  AND census_data->'population_2021' IS NOT NULL
ORDER BY (census_data->>'population_2021')::bigint DESC
LIMIT 10;
```

**Get municipalities with highest median income**:
```sql
SELECT name, 
       (census_data->>'median_household_income')::int AS income
FROM public.map_shapes
WHERE country = 'Canada'
  AND boundary_type = 'Municipal'
  AND census_data->'median_household_income' IS NOT NULL
ORDER BY (census_data->>'median_household_income')::int DESC
LIMIT 20;
```

**Population density (people per km²)**:
```sql
SELECT name, 
       (census_data->>'population_2021')::bigint AS population,
       (census_data->>'population_density')::numeric AS density_per_km2
FROM public.map_shapes
WHERE country = 'USA'
  AND boundary_type = 'Municipal'
  AND census_data->'population_density' IS NOT NULL
ORDER BY (census_data->>'population_density')::numeric DESC
LIMIT 10;
```

**Average income by state** (USA):
```sql
SELECT ms.name, 
       AVG((cd.census_data->>'median_household_income')::int) AS avg_income,
       COUNT(*) AS municipality_count
FROM public.map_shapes cd
JOIN public.shape_containers sc ON sc.map_shape_id = cd.id
JOIN public.map_shapes ms ON ms.id = sc.container_shape_id
WHERE cd.country = 'USA'
  AND cd.boundary_type = 'Municipal'
  AND ms.boundary_type = 'State'
  AND cd.census_data IS NOT NULL
GROUP BY ms.id, ms.name
ORDER BY avg_income DESC;
```

---

## JSONB Field Reference

### Canada Municipalities & Provinces
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
  "median_rent_monthly": 1450
}
```

### USA Municipalities & States
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
  "median_rent_monthly": 1200
}
```

---

## Checklist: Before Going Live

- [ ] Migration applied (`npx supabase migration up`)
- [ ] Canada municipality CSV downloaded
- [ ] Canada province CSV downloaded
- [ ] USA municipality CSV(s) downloaded & combined
- [ ] USA state CSV downloaded
- [ ] All load scripts run successfully
- [ ] Verification queries show 100% (or near 100%) coverage
- [ ] Service layer imported in at least one component
- [ ] Census data displays correctly in UI
- [ ] Tested filtering/sorting by population
- [ ] Tested with small viewport (mobile responsive)

---

## Performance Considerations

### JSONB GIN Index
The migration creates a GIN index on `census_data`:
```sql
CREATE INDEX idx_map_shapes_census_data ON public.map_shapes USING GIN (census_data);
```

This enables fast containment queries like:
```sql
-- Find all shapes with population > 1M (slow without index)
SELECT * FROM map_shapes
WHERE (census_data->>'population_2021')::bigint > 1000000;
```

### Caching Strategy
For dashboards with national statistics, cache the aggregations:
```typescript
// Cache for 1 hour
const stats = await redis.setex(
  'canada:census:stats',
  3600,
  JSON.stringify({
    total_population,
    median_income,
    last_updated: new Date().toISOString()
  })
);
```

### Avoid JSONB Parsing in Loops
❌ **Don't**:
```typescript
const municipalities = [...]; // 5000 items
municipalities.forEach(m => {
  const pop = parseInt(m.census_data?.population_2021); // Parsing in loop
});
```

✅ **Do**:
```typescript
// Parse once with SQL
const { data } = await supabase
  .from('map_shapes')
  .select(`
    id, name,
    population: census_data->population_2021
  `)
  .cast('population', 'bigint');
```

---

## Future Enhancements

1. **Automated Annual Updates**: Cron job to download & load new Census data
2. **PostgreSQL Views**: Create materialized views for common aggregations
3. **Time-Series Census Data**: Track changes from 2016 → 2021 → 2026 (store multiple census years)
4. **RPC Functions**: Database-level functions for complex census queries (income rankings, percentile filters)
5. **Data Validation**: Background job to flag anomalies (e.g., population decrease > 20%)

---

## Troubleshooting

**Q: Migration fails with "column already exists"**  
A: The column may have been partially created. Check with:
```bash
psql "$DATABASE_URL" -c "\d map_shapes" | grep census_data
```
If it exists, skip the migration (it's idempotent with `IF NOT EXISTS`).

**Q: Load script reports "No rows updated"**  
A: Check that:
1. CSV file has `GEO_CODE` column (Canada) or `GEO_ID`/`STATE_CODE` (USA)
2. Codes in CSV match `map_shapes.code` format (7-digit CSDUID for CA municipalities)
3. Run a sample query to verify codes exist: `SELECT DISTINCT code FROM map_shapes WHERE country='Canada' AND boundary_type='Municipal' LIMIT 5;`

**Q: Slow JSONB queries?**  
A: Ensure GIN index exists:
```bash
psql "$DATABASE_URL" -c "\d map_shapes" | grep idx_map_shapes_census_data
```
If missing, the migration didn't apply. Re-run `npx supabase migration up`.

---

## Files Reference

| File | Purpose |
|------|---------|
| `supabase/migrations/20260823000000_add_census_data_jsonb.sql` | DB migration |
| `scripts/load_census_data.py` | Data loader (universal) |
| `src/lib/services/census.ts` | Service layer functions |
| `src/components/features/CensusDataDisplay.tsx` | React components |
| `docs/CENSUS_DATA_GUIDE.md` | Detailed data source guide |
| `docs/CENSUS_DATA_IMPLEMENTATION_SUMMARY.md` | This file |

---

## Questions or Issues?

Refer to [CENSUS_DATA_GUIDE.md](CENSUS_DATA_GUIDE.md) for troubleshooting, data source links, and comprehensive query examples.
