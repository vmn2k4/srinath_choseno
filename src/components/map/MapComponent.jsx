import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../services/supabase';
import * as turf from '@turf/turf';

function AutoFitBounds({ boundaries }) {
  const map = useMap();
  // Callers (e.g. BoundaryPicker) can recreate the `boundaries` array on every
  // render via .filter() even when its contents haven't changed — keying the
  // effect off a stable primitive (the joined id list) instead of the array
  // reference avoids refitting bounds/recomputing turf.bbox over the whole
  // featureset on every unrelated re-render.
  const boundsKey = boundaries.map(b => b.id).join(',');

  useEffect(() => {
    if (boundaries && boundaries.length > 0) {
      try {
        const features = boundaries.map(b => b.geojson).filter(Boolean);
        if (features.length === 0) return;

        // Wrap everything in a FeatureCollection for turf to calculate bbox
        const fc = turf.featureCollection(
          features.map(f => f.type === 'Feature' ? f : turf.feature(f))
        );

        const [minLng, minLat, maxLng, maxLat] = turf.bbox(fc);
        map.fitBounds([
          [minLat, minLng],
          [maxLat, maxLng]
        ], { padding: [20, 20], maxZoom: 12 });
      } catch (err) {
        console.error("Error fitting bounds:", err);
      }
    }
  }, [boundsKey, map]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

const BOUNDARY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const BoundaryLayer = React.memo(function BoundaryLayer({ boundary, isSelected, hasSelection, onShapeClick }) {
  const style = useMemo(() => (
    hasSelection
      ? {
          fillColor: isSelected ? '#e9eb9e' : '#64748b',
          weight: isSelected ? 3 : 1,
          opacity: 1,
          color: isSelected ? '#e9eb9e' : '#94a3b8',
          fillOpacity: isSelected ? 0.45 : 0.15
        }
      : {
          fillColor: BOUNDARY_COLORS[boundary.id % BOUNDARY_COLORS.length],
          weight: 2,
          opacity: 1,
          color: 'white',
          dashArray: '3',
          fillOpacity: 0.4
        }
  ), [hasSelection, isSelected, boundary.id]);

  const eventHandlers = useMemo(() => (
    onShapeClick ? { click: () => onShapeClick(boundary.id) } : undefined
  ), [onShapeClick, boundary.id]);

  return (
    <GeoJSON data={boundary.geojson} style={style} eventHandlers={eventHandlers}>
      <Tooltip sticky>
        <div className="text-slate-800 font-medium">
          {boundary.name || 'Unnamed Boundary'}
        </div>
      </Tooltip>
    </GeoJSON>
  );
});

export default function MapComponent({ boundaries, selectedIds, onShapeClick }) {
  if (!boundaries || boundaries.length === 0) {
    return (
      <div className="w-full h-96 bg-surface-hover rounded-xl flex items-center justify-center border border-white/10 mt-6">
        <p className="text-text-muted">No map data available. Please upload shapefiles.</p>
      </div>
    );
  }

  // Create a default center (can be calculated based on boundaries if needed)
  const defaultCenter = [0, 0];
  const defaultZoom = 2;
  const hasSelection = Boolean(selectedIds);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-white/10 shadow-xl z-0 relative">
      <MapContainer center={defaultCenter} zoom={defaultZoom} className="w-full h-full" style={{ background: '#1e293b' }} preferCanvas>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />

        {boundaries.map((boundary, index) => {
          if (!boundary.geojson) return null;
          return (
            <BoundaryLayer
              key={boundary.id ?? index}
              boundary={boundary}
              isSelected={selectedIds?.has(boundary.id)}
              hasSelection={hasSelection}
              onShapeClick={onShapeClick}
            />
          );
        })}

        <AutoFitBounds boundaries={boundaries} />
      </MapContainer>
    </div>
  );
}
