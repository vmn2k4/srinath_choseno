'use client';

import React from 'react';
import { formatCensusData, type CensusData } from '@/lib/services/census';

interface CensusDataDisplayProps {
  census: CensusData | null | undefined;
  layout?: 'cards' | 'inline' | 'detailed';
  showSource?: boolean;
}

/**
 * Display census data in various formats
 * Handles Canada and USA data with appropriate formatting
 */
export function CensusDataDisplay({
  census,
  layout = 'cards',
  showSource = true,
}: CensusDataDisplayProps) {
  if (!census) {
    return <div className="text-gray-500 text-sm">No census data available</div>;
  }

  const formatted = formatCensusData(census);

  if (layout === 'inline') {
    return (
      <div className="text-sm text-gray-700 space-y-1">
        {formatted.population && (
          <p>
            <strong>Population:</strong> {formatted.population}
          </p>
        )}
        {formatted.median_income && (
          <p>
            <strong>Median Income:</strong> {formatted.median_income}
          </p>
        )}
        {formatted.unemployment && (
          <p>
            <strong>Unemployment:</strong> {formatted.unemployment}
          </p>
        )}
        {showSource && <p className="text-xs text-gray-500">Source: {formatted.source}</p>}
      </div>
    );
  }

  if (layout === 'detailed') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {formatted.population && (
            <div className="p-3 bg-blue-50 rounded">
              <p className="text-xs text-gray-600">Population</p>
              <p className="text-lg font-bold text-blue-900">{formatted.population}</p>
            </div>
          )}
          {formatted.households && (
            <div className="p-3 bg-green-50 rounded">
              <p className="text-xs text-gray-600">Households</p>
              <p className="text-lg font-bold text-green-900">{formatted.households}</p>
            </div>
          )}
          {formatted.median_income && (
            <div className="p-3 bg-purple-50 rounded">
              <p className="text-xs text-gray-600">Median Income</p>
              <p className="text-lg font-bold text-purple-900">{formatted.median_income}</p>
            </div>
          )}
          {formatted.median_age && (
            <div className="p-3 bg-orange-50 rounded">
              <p className="text-xs text-gray-600">Median Age</p>
              <p className="text-lg font-bold text-orange-900">{formatted.median_age}</p>
            </div>
          )}
        </div>

        {/* Additional fields if available */}
        <div className="border-t pt-3">
          {census.population_density && (
            <p className="text-sm text-gray-700">
              <strong>Population Density:</strong>{' '}
              {(census.population_density as number).toFixed(1)} people/km²
            </p>
          )}
          {census.poverty_rate && (
            <p className="text-sm text-gray-700">
              <strong>Poverty Rate:</strong> {(census.poverty_rate as number).toFixed(1)}%
            </p>
          )}
          {census.owner_occupied_pct && (
            <p className="text-sm text-gray-700">
              <strong>Owner-Occupied Housing:</strong>{' '}
              {(census.owner_occupied_pct as number).toFixed(1)}%
            </p>
          )}
          {census.labour_participation_pct && (
            <p className="text-sm text-gray-700">
              <strong>Labour Participation:</strong>{' '}
              {(census.labour_participation_pct as number).toFixed(1)}%
            </p>
          )}
        </div>

        {showSource && (
          <p className="text-xs text-gray-500 border-t pt-2">
            <strong>Source:</strong> {formatted.source}
            {census.updated_at && <span> (Updated: {census.updated_at})</span>}
          </p>
        )}
      </div>
    );
  }

  // Default: cards layout
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {formatted.population && (
        <div className="p-3 border rounded-lg bg-slate-50">
          <p className="text-xs font-medium text-gray-600 uppercase">Population</p>
          <p className="text-lg font-bold text-gray-900">{formatted.population}</p>
        </div>
      )}
      {formatted.median_income && (
        <div className="p-3 border rounded-lg bg-slate-50">
          <p className="text-xs font-medium text-gray-600 uppercase">Median Income</p>
          <p className="text-lg font-bold text-gray-900">{formatted.median_income}</p>
        </div>
      )}
      {formatted.median_age && (
        <div className="p-3 border rounded-lg bg-slate-50">
          <p className="text-xs font-medium text-gray-600 uppercase">Median Age</p>
          <p className="text-lg font-bold text-gray-900">{formatted.median_age}</p>
        </div>
      )}
      {formatted.unemployment && (
        <div className="p-3 border rounded-lg bg-slate-50">
          <p className="text-xs font-medium text-gray-600 uppercase">Unemployment</p>
          <p className="text-lg font-bold text-gray-900">{formatted.unemployment}</p>
        </div>
      )}

      {showSource && (
        <p className="col-span-full text-xs text-gray-500">Source: {formatted.source}</p>
      )}
    </div>
  );
}

/**
 * Mini card for use in lists/tables
 */
export function CensusDataMini({ census }: { census: CensusData | null | undefined }) {
  if (!census) return null;

  const pop = census.population_2021 || census.population_2020;
  const income = census.median_household_income;

  return (
    <div className="text-xs text-gray-600 space-y-1">
      {pop && <p>Pop: {(pop as number).toLocaleString()}</p>}
      {income && <p>Income: ${(income as number).toLocaleString()}</p>}
    </div>
  );
}

/**
 * Ranking badge (e.g., "Rank #1 by population in province")
 */
export function CensusRankBadge({
  currentPopulation,
  totalInCategory,
  label = 'by population',
}: {
  currentPopulation: number | null | undefined;
  totalInCategory: number;
  label?: string;
}) {
  if (!currentPopulation || totalInCategory <= 0) return null;

  // Simple rank (would need sorted data from service layer for true ranking)
  const rank = 1; // Placeholder

  return (
    <span className="inline-block px-2 py-1 bg-amber-100 text-amber-900 text-xs rounded font-medium">
      #{rank} {label}
    </span>
  );
}
