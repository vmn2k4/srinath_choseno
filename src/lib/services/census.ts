/**
 * Census & demographic data service.
 * All census data stored as JSONB in map_shapes.census_data
 * Supports Canada (municipalities, provinces, federal) and USA (municipalities, states, federal)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export interface CensusData {
  source?: string;
  updated_at?: string;
  population_2021?: number;
  population_2020?: number;
  population_2016?: number;
  population_growth_pct?: number;
  population_density?: number;
  households?: number;
  household_avg_size?: number;
  median_age?: number;
  median_household_income?: number;
  low_income_pct?: number;
  owner_occupied_pct?: number;
  unemployment_rate?: number;
  labour_participation_pct?: number;
  poverty_rate?: number;
  median_rent_monthly?: number;
  median_home_value?: number;
  official_language_en_pct?: number;
  official_language_fr_pct?: number;
  [key: string]: any;
}

export interface MapShapeWithCensus {
  id: number;
  name: string;
  code: string;
  boundary_type: string;
  country: string;
  census_data: CensusData | null;
}

/**
 * Get a single map shape with its census data
 */
export async function getMapShapeWithCensus(
  supabase: SupabaseClient<Database>,
  shapeId: number
): Promise<{ data: MapShapeWithCensus | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('map_shapes')
      .select('id, name, code, boundary_type, country, census_data')
      .eq('id', shapeId)
      .single();

    return { data: data as MapShapeWithCensus | null, error };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Get multiple shapes with census data by shape IDs
 */
export async function getMapShapesWithCensus(
  supabase: SupabaseClient<Database>,
  shapeIds: number[]
): Promise<{ data: MapShapeWithCensus[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('map_shapes')
      .select('id, name, code, boundary_type, country, census_data')
      .in('id', shapeIds);

    return { data: (data || []) as MapShapeWithCensus[], error };
  } catch (error) {
    return { data: [], error: error as Error };
  }
}

/**
 * Get all shapes in a boundary type (e.g., all Canadian municipalities)
 * Optionally filtered by country
 */
export async function getShapesByTypeWithCensus(
  supabase: SupabaseClient<Database>,
  country: string,
  boundaryType: string,
  limit: number = 1000
): Promise<{ data: MapShapeWithCensus[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('map_shapes')
      .select('id, name, code, boundary_type, country, census_data')
      .eq('country', country)
      .eq('boundary_type', boundaryType)
      .not('census_data', 'is', null)
      .limit(limit);

    return { data: (data || []) as MapShapeWithCensus[], error };
  } catch (error) {
    return { data: [], error: error as Error };
  }
}

/**
 * Get top N municipalities/shapes by population for a country
 * Sorted descending (largest first)
 */
export async function getTopShapesByPopulation(
  supabase: SupabaseClient<Database>,
  country: string,
  boundaryType: string = 'Municipal',
  limit: number = 20
): Promise<{ data: MapShapeWithCensus[]; error: Error | null }> {
  try {
    // Note: Direct sorting of JSONB in supabase.js requires a database function
    // As a workaround, fetch all and sort client-side, or use .rpc()
    const { data, error } = await supabase
      .from('map_shapes')
      .select('id, name, code, boundary_type, country, census_data')
      .eq('country', country)
      .eq('boundary_type', boundaryType)
      .not('census_data', 'is', null)
      .limit(limit * 2); // Fetch extra since we'll sort client-side

    if (error) return { data: [], error };

    // Sort by population (newest year first, fallback to older)
    const sorted = ((data || []) as MapShapeWithCensus[])
      .sort((a, b) => {
        const popA =
          (a.census_data?.population_2021 as number) ||
          (a.census_data?.population_2020 as number) ||
          0;
        const popB =
          (b.census_data?.population_2021 as number) ||
          (b.census_data?.population_2020 as number) ||
          0;
        return popB - popA;
      })
      .slice(0, limit);

    return { data: sorted, error: null };
  } catch (error) {
    return { data: [], error: error as Error };
  }
}

/**
 * Get shapes within a geographic area ordered by population
 * Used for district/region overviews
 */
export async function getShapesInContainerWithCensus(
  supabase: SupabaseClient<Database>,
  containerShapeId: number,
  childBoundaryType?: string,
  limit: number = 100
): Promise<{ data: MapShapeWithCensus[]; error: Error | null }> {
  try {
    let query = supabase
      .from('shape_containers')
      .select(
        `
        map_shapes!inner(id, name, code, boundary_type, country, census_data)
      `
      )
      .eq('container_shape_id', containerShapeId);

    if (childBoundaryType) {
      query = query.eq('map_shapes.boundary_type', childBoundaryType);
    }

    const { data, error } = await query.limit(limit);

    if (error) return { data: [], error };

    // Extract and flatten the shapes, sort by population
    const shapes = (data || [])
      .map((row: any) => row.map_shapes as MapShapeWithCensus)
      .filter(Boolean)
      .sort((a, b) => {
        const popA =
          (a.census_data?.population_2021 as number) ||
          (a.census_data?.population_2020 as number) ||
          0;
        const popB =
          (b.census_data?.population_2021 as number) ||
          (b.census_data?.population_2020 as number) ||
          0;
        return popB - popA;
      });

    return { data: shapes, error: null };
  } catch (error) {
    return { data: [], error: error as Error };
  }
}

/**
 * Search for shapes by name and return with census data
 */
export async function searchShapesWithCensus(
  supabase: SupabaseClient<Database>,
  query: string,
  country?: string,
  boundaryType?: string,
  limit: number = 20
): Promise<{ data: MapShapeWithCensus[]; error: Error | null }> {
  try {
    let qb = supabase
      .from('map_shapes')
      .select('id, name, code, boundary_type, country, census_data')
      .ilike('name', `%${query}%`);

    if (country) {
      qb = qb.eq('country', country);
    }
    if (boundaryType) {
      qb = qb.eq('boundary_type', boundaryType);
    }

    const { data, error } = await qb.limit(limit);

    return { data: (data || []) as MapShapeWithCensus[], error };
  } catch (error) {
    return { data: [], error: error as Error };
  }
}

/**
 * Parse census data and return human-readable summary
 */
export function formatCensusData(census: CensusData | null | undefined): {
  population: string | null;
  median_income: string | null;
  median_age: string | null;
  households: string | null;
  unemployment: string | null;
  source: string;
} {
  if (!census) {
    return {
      population: null,
      median_income: null,
      median_age: null,
      households: null,
      unemployment: null,
      source: 'No data',
    };
  }

  return {
    population: census.population_2021
      ? (census.population_2021 as number).toLocaleString()
      : census.population_2020
        ? (census.population_2020 as number).toLocaleString()
        : null,
    median_income: census.median_household_income
      ? `$${(census.median_household_income as number).toLocaleString()}`
      : null,
    median_age: census.median_age
      ? `${(census.median_age as number).toFixed(1)} years`
      : null,
    households: census.households
      ? (census.households as number).toLocaleString()
      : null,
    unemployment: census.unemployment_rate
      ? `${(census.unemployment_rate as number).toFixed(1)}%`
      : null,
    source: census.source || 'Census Data',
  };
}

/**
 * Calculate population density if available
 */
export function calculateDensity(census: CensusData | null | undefined): number | null {
  if (!census) return null;

  const pop = (census.population_2021 || census.population_2020) as number | undefined;
  const area = census.population_density; // Pre-calculated
  if (area) return area as number;

  // If no pre-calculated density, return null
  // (land area not always available in census_data)
  return null;
}

/**
 * Get comparative statistics (e.g., how a municipality ranks nationally)
 */
export async function getMedianIncome(
  supabase: SupabaseClient<Database>,
  country: string,
  boundaryType: string
): Promise<{ median: number | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('map_shapes')
      .select('census_data->median_household_income')
      .eq('country', country)
      .eq('boundary_type', boundaryType)
      .not('census_data->median_household_income', 'is', null);

    if (error) return { median: null, error };

    const incomes = (data || [])
      .map((row: any) => parseInt(row.census_data?.median_household_income || 0))
      .filter((v) => v > 0)
      .sort((a, b) => a - b);

    if (incomes.length === 0) return { median: null, error: null };

    const mid = Math.floor(incomes.length / 2);
    const median =
      incomes.length % 2 !== 0
        ? incomes[mid]
        : (incomes[mid - 1] + incomes[mid]) / 2;

    return { median, error: null };
  } catch (error) {
    return { median: null, error: error as Error };
  }
}
