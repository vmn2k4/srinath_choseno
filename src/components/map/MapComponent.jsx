import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../services/supabase';
import * as turf from '@turf/turf';

function AutoFitBounds({ boundaries }) {
  const map = useMap();

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
  }, [boundaries, map]);

  return null;
}

export default function MapComponent({ boundaries }) {
  if (!boundaries || boundaries.length === 0) {
    return (
      <div className="w-full h-96 bg-slate-800 rounded-xl flex items-center justify-center border border-white/10 mt-6">
        <p className="text-slate-400">No map data available. Please upload shapefiles.</p>
      </div>
    );
  }

  // Create a default center (can be calculated based on boundaries if needed)
  const defaultCenter = [0, 0];
  const defaultZoom = 2;

  // Function to determine random colors for different countries/shapes
  const getColor = (id) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return colors[id % colors.length];
  };

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-white/10 shadow-xl z-0 relative">
      <MapContainer center={defaultCenter} zoom={defaultZoom} className="w-full h-full" style={{ background: '#1e293b' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />
        
        {boundaries.map((boundary, index) => {
          if (!boundary.geojson) return null;
          
          return (
            <GeoJSON 
              key={boundary.id || index} 
              data={boundary.geojson}
              style={{
                fillColor: getColor(boundary.id || index),
                weight: 2,
                opacity: 1,
                color: 'white',
                dashArray: '3',
                fillOpacity: 0.4
              }}
            >
              <Tooltip sticky>
                <div className="text-slate-800 font-medium">
                  {boundary.name || 'Unnamed Boundary'}
                </div>
              </Tooltip>
            </GeoJSON>
          );
        })}
        
        <AutoFitBounds boundaries={boundaries} />
      </MapContainer>
    </div>
  );
}
