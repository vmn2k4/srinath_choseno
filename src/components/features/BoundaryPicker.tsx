"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { getBoundaryCandidates, getGeojsonShapes } from "@/lib/services/boundaries";
import BoundaryMapComponent, { type MapBoundary } from "./BoundaryMapComponent";
import { Button, Input } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

interface BoundaryCandidate extends MapBoundary {
  country?: string | null;
  boundary_type?: string | null;
  code?: string | null;
  properties?: unknown;
}

// On a mobile single-column stack, the list and map columns render one above
// the other — forcing each to the full desktop `height` doubles the total
// scroll height on a phone. Cap the stacked-mobile height and only grow to
// the caller's requested height once the grid actually splits into columns.
const MOBILE_HEIGHT = "260px";

// Above this many candidate shapes we don't eagerly load every geometry
// (avoids hammering ST_AsGeoJSON over huge result sets) — click-to-select on
// the map only works within a set small enough to render in full.
const EAGER_LOAD_LIMIT = 400;

// Above this many selected shapes, skip bulk-fetching geometry for the
// selection too — matches BoundaryVisualizer's RENDER_CAP.
const SELECTED_GEO_FETCH_CAP = 500;

export default function BoundaryPicker({
  mode = "multi",
  selectedIds,
  onChange,
  boundaryTypeFilter,
  countryFilter,
  restrictToIds,
  height = "450px",
  showMap = true,
}: {
  mode?: "multi" | "single";
  selectedIds: Set<number>;
  onChange: (ids: Set<number>) => void;
  boundaryTypeFilter?: string[];
  countryFilter?: string;
  restrictToIds?: Set<number>;
  height?: string;
  showMap?: boolean;
}) {
  const supabase = createClient();
  const [boundaries, setBoundaries] = useState<BoundaryCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [forceLoadSelected, setForceLoadSelected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchBoundaries = async () => {
      setLoading(true);
      const { data, error } = await getBoundaryCandidates(supabase, { boundaryTypeFilter, countryFilter });
      if (error || cancelled) {
        setLoading(false);
        return;
      }

      let withGeo: BoundaryCandidate[] = ((data as unknown as BoundaryCandidate[]) || []).map((b) => ({
        ...b,
        geojson: null,
      }));

      if (showMap && withGeo.length > 0 && withGeo.length <= EAGER_LOAD_LIMIT) {
        const ids = withGeo.map((b) => b.id);
        const { data: geoData } = await getGeojsonShapes(supabase, ids);
        if (geoData) {
          const geoMap = new Map((geoData as { id: number; geojson: unknown }[]).map((g) => [g.id, g.geojson]));
          withGeo = withGeo.map((b) => ({ ...b, geojson: geoMap.get(b.id) || null }));
        }
      }

      if (!cancelled) {
        setBoundaries(withGeo);
        setLoading(false);
      }
    };

    fetchBoundaries();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(boundaryTypeFilter), countryFilter]);

  const eagerLoaded = boundaries.length > 0 && boundaries.length <= EAGER_LOAD_LIMIT;

  // Bulk selection changes (e.g. a parent setting selectedIds directly from a
  // "find matching boundaries" result, rather than via toggle() below) never
  // ran through toggle()'s per-shape lazy fetch, so above EAGER_LOAD_LIMIT the
  // selected shapes never got geometry and the map showed nothing. Fetch
  // geometry for whatever's selected but missing it, in one batched call.
  useEffect(() => {
    if (!showMap || eagerLoaded) return;
    if (!selectedIds || selectedIds.size === 0) return;
    if (selectedIds.size > SELECTED_GEO_FETCH_CAP && !forceLoadSelected) return;

    let cancelled = false;

    const fetchMissing = async () => {
      const missingIds = boundaries.filter((b) => selectedIds.has(b.id) && !b.geojson).map((b) => b.id);
      if (missingIds.length === 0) return;

      const { data } = await getGeojsonShapes(supabase, missingIds);
      if (cancelled || !data) return;
      const geoMap = new Map((data as { id: number; geojson: unknown }[]).map((g) => [g.id, g.geojson]));
      setBoundaries((prev) => prev.map((b) => (geoMap.has(b.id) ? { ...b, geojson: geoMap.get(b.id) } : b)));
    };

    fetchMissing();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, eagerLoaded, boundaries, showMap, forceLoadSelected]);

  const toggle = async (id: number) => {
    if (mode === "single") {
      onChange(new Set([id]));
    } else {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange(next);
    }

    if (!eagerLoaded) {
      const b = boundaries.find((x) => x.id === id);
      if (b && !b.geojson) {
        const { data } = await getGeojsonShapes(supabase, [id], { single: true });
        if ((data as { geojson?: unknown } | null)?.geojson) {
          setBoundaries((prev) =>
            prev.map((x) => (x.id === id ? { ...x, geojson: (data as { geojson: unknown }).geojson } : x))
          );
        }
      }
    }
  };

  const restricted = useMemo(() => {
    if (!restrictToIds) return boundaries;
    return boundaries.filter((b) => restrictToIds.has(b.id));
  }, [boundaries, restrictToIds]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return restricted;
    const term = searchTerm.toLowerCase();
    return restricted.filter((b) => {
      const haystack = `${b.name || ""} ${JSON.stringify(b.properties || {})}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [restricted, searchTerm]);

  const selectAllVisible = () => {
    const next = new Set(selectedIds);
    filtered.forEach((b) => next.add(b.id));
    onChange(next);
  };
  const clearVisible = () => {
    const visibleIds = new Set(filtered.map((b) => b.id));
    onChange(new Set([...selectedIds].filter((id) => !visibleIds.has(id))));
  };

  const grouped = useMemo(() => {
    const acc: Record<string, BoundaryCandidate[]> = {};
    filtered.forEach((b) => {
      const key = `${b.country || "Unknown"} — ${b.boundary_type || "General"}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(b);
    });
    return acc;
  }, [filtered]);

  // Map always shows selected shapes; when the candidate set is small enough
  // to have been eager-loaded, it also shows unselected candidates (dimmed)
  // so they can be clicked directly.
  const mapBoundaries = eagerLoaded
    ? filtered.filter((b) => b.geojson)
    : boundaries.filter((b) => selectedIds.has(b.id) && b.geojson);

  const overCap = !eagerLoaded && selectedIds && selectedIds.size > SELECTED_GEO_FETCH_CAP && !forceLoadSelected;

  return (
    <div className={showMap ? "grid grid-cols-1 md:grid-cols-3 gap-4" : "grid grid-cols-1"}>
      {/* List Column */}
      <div
        className={`${showMap ? "md:col-span-1" : ""} h-[var(--picker-mobile-h)] md:h-[var(--picker-h)] flex flex-col rounded-xl border border-border-light overflow-hidden bg-surface/30`}
        style={{ "--picker-h": height, "--picker-mobile-h": MOBILE_HEIGHT } as React.CSSProperties}
      >
        <div className="p-3 border-b border-border-light bg-surface/50 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted w-3.5 h-3.5" />
            <Input
              type="text"
              size="sm"
              placeholder="Search name or metadata..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          {!loading && !eagerLoaded && restricted.length > 0 && (
            <p className="text-[10px] text-warning mt-1.5">
              {restricted.length} candidates — too many to click-select on the map here, use the list.
            </p>
          )}
          {mode === "multi" && !loading && filtered.length > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <button
                type="button"
                onClick={selectAllVisible}
                className="text-[10px] font-semibold text-primary-light hover:text-primary transition-colors"
              >
                Select all ({filtered.length})
              </button>
              <span className="text-text-muted/40">·</span>
              <button
                type="button"
                onClick={clearVisible}
                className="text-[10px] font-semibold text-text-muted hover:text-danger transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="p-2.5 overflow-y-auto flex-1 space-y-2">
          {loading ? (
            <p className="text-xs text-text-muted text-center mt-4">Loading...</p>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-xs text-text-muted text-center mt-4">No boundaries match.</p>
          ) : (
            Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([groupKey, items]) => (
                <div key={groupKey} className="border border-border-light/40 rounded-lg overflow-hidden">
                  <div className="p-2 bg-surface-hover/40 text-[11px] font-bold text-text-tertiary flex justify-between items-center gap-2">
                    <span className="truncate">{groupKey}</span>
                    <span className="text-text-muted font-normal shrink-0">({items.length})</span>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    {items.map((b) => {
                      const isSelected = selectedIds.has(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggle(b.id)}
                          className={`w-full flex items-center gap-2 text-left p-1.5 rounded text-xs transition-colors ${
                            isSelected
                              ? "bg-primary/15 text-primary-light font-semibold"
                              : "hover:bg-surface-hover/60 text-text-muted"
                          }`}
                        >
                          <span
                            className={`shrink-0 w-3 h-3 rounded-sm border ${
                              isSelected ? "bg-primary border-primary" : "border-border-light"
                            }`}
                          />
                          <span className="truncate">{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Map Column */}
      {showMap && (
        <div
          className="md:col-span-2 h-[var(--picker-mobile-h)] md:h-[var(--picker-h)] rounded-xl overflow-hidden border border-border-light flex items-center justify-center bg-surface/20"
          style={{ "--picker-h": height, "--picker-mobile-h": MOBILE_HEIGHT } as React.CSSProperties}
        >
          {overCap ? (
            <div className="text-center p-6">
              <p className="text-xs text-text-muted mb-3">
                {selectedIds.size} shapes selected — too many to auto-render (cap: {SELECTED_GEO_FETCH_CAP}).
              </p>
              <Button variant="secondary" size="sm" onClick={() => setForceLoadSelected(true)}>
                Load Map Anyway
              </Button>
            </div>
          ) : (
            <BoundaryMapComponent
              boundaries={mapBoundaries}
              selectedIds={selectedIds}
              onShapeClick={eagerLoaded ? toggle : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}
