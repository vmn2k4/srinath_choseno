-- Add census_data JSONB column to map_shapes for lightweight census enrichment
-- Supports Canada municipalities, provinces, federal + USA municipalities, states, federal
-- Schema: { population_2021, population_2020, population_density, households, median_income, ... }

ALTER TABLE public.map_shapes
ADD COLUMN IF NOT EXISTS census_data JSONB DEFAULT NULL;

-- Index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_map_shapes_census_data
  ON public.map_shapes USING GIN (census_data);

-- Comment documenting the census_data JSONB structure
COMMENT ON COLUMN public.map_shapes.census_data IS
'Census/demographic data as JSONB. Structure varies by country/boundary_type:
CANADA MUNICIPALITIES: { population_2021, population_2016, population_growth_pct, population_density, households, household_avg_size, median_age, median_household_income, low_income_pct, land_area_km2, owner_occupied_pct, median_rent_monthly, unemployment_rate, labour_participation_pct, official_language_en_pct, official_language_fr_pct }
CANADA PROVINCES: { population_2021, population_2016, population_density, households, median_income, ... same as above }
CANADA FEDERAL: { population_2021, ... aggregated national data }
USA MUNICIPALITIES: { population_2020, population_2010, population_growth_pct, population_density, households, median_income, median_rent, unemployment_rate, poverty_rate, owner_occupied_pct, median_age }
USA STATES: { population_2020, population_density, households, median_income, unemployment_rate, poverty_rate, median_age, land_area_sq_mi }
USA FEDERAL: { population_2020, ... aggregated national data }
All timestamps in ISO 8601. Data sourced from: StatCan Census Profiles (Canada), US Census Bureau ACS 5-Year (USA)';
