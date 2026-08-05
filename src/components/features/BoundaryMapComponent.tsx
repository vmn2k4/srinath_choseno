"use client";

import React, { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { GeoJsonObject } from "geojson";

export interface MapBoundary {
  id: number;
  name?: string | null;
  geojson: unknown;
}

// Port of the pre-Next.js Vite app's src/components/map/MapComponent.jsx —
// that version used react-leaflet + @turf/turf, neither of which exists in
// this app anymore. This uses the same raw-Leaflet, SSR-safe pattern
// InteractiveLocationPicker.tsx already established (dynamic `import("leaflet")`
// inside a useEffect guarded by `typeof window === "undefined"`), so the app
// has one Leaflet integration style, not two. Turf's only job there (bbox-fit)
// is replaced by Leaflet's own `L.geoJSON(...).getBounds()` + `LatLngBounds.extend()`.
const BOUNDARY_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function BoundaryMapComponent({
  boundaries,
  selectedIds,
  onShapeClick,
}: {
  boundaries: MapBoundary[];
  selectedIds?: Set<number>;
  onShapeClick?: (id: number) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const layerGroupRef = useRef<Leaflet.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Mount once: create the base map + tile layer + an empty layer group that
  // the render effect below repopulates on every data change.
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;
    let isSubscribed = true;

    async function initMap() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (!isSubscribed || !mapContainerRef.current || mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current, { preferCanvas: true }).setView([0, 0], 2);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);

      leafletRef.current = L;
      mapInstanceRef.current = map;
      layerGroupRef.current = layerGroup;
      setMapReady(true);
    }

    initMap();

    return () => {
      isSubscribed = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  // Re-render boundary layers whenever the data or selection changes.
  const boundsKey = boundaries.map((b) => b.id).join(",");
  useEffect(() => {
    if (!mapReady || !leafletRef.current || !layerGroupRef.current) return;
    const L = leafletRef.current;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    const hasSelection = Boolean(selectedIds && selectedIds.size > 0);
    let bounds: Leaflet.LatLngBounds | null = null;

    boundaries.forEach((boundary) => {
      if (!boundary.geojson) return;
      const isSelected = hasSelection && selectedIds!.has(boundary.id);
      const style = hasSelection
        ? {
            fillColor: isSelected ? "var(--color-primary)" : "#64748b",
            weight: isSelected ? 3 : 1,
            opacity: 1,
            color: isSelected ? "var(--color-primary)" : "#94a3b8",
            fillOpacity: isSelected ? 0.45 : 0.15,
          }
        : {
            fillColor: BOUNDARY_COLORS[boundary.id % BOUNDARY_COLORS.length],
            weight: 2,
            opacity: 1,
            color: "white",
            dashArray: "3",
            fillOpacity: 0.4,
          };

      const layer = L.geoJSON(boundary.geojson as GeoJsonObject, { style });
      layer.bindTooltip(boundary.name || "Unnamed Boundary", { sticky: true });
      if (onShapeClick) layer.on("click", () => onShapeClick(boundary.id));
      layer.addTo(layerGroup);

      const layerBounds = layer.getBounds();
      if (layerBounds.isValid()) {
        if (bounds) bounds.extend(layerBounds);
        else bounds = layerBounds;
      }
    });

    if (bounds && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 12 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, boundsKey, selectedIds, onShapeClick]);

  if (!boundaries || boundaries.length === 0) {
    return (
      <div className="w-full h-96 bg-surface-hover rounded-xl flex items-center justify-center border border-border-light mt-6">
        <p className="text-text-muted">No map data available. Please upload shapefiles.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-border-light shadow-xl relative">
      <div ref={mapContainerRef} className="w-full h-full" style={{ background: "#1e293b" }} />
    </div>
  );
}
