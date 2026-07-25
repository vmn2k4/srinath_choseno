import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { getBoundaryCandidates, getGeojsonShapes } from '../../services/boundaries';
import MapComponent from './MapComponent';

// Above this many candidate shapes we don't eagerly load every geometry
// (avoids hammering ST_AsGeoJSON over huge result sets) — click-to-select on
// the map only works within a set small enough to render in full.
const EAGER_LOAD_LIMIT = 400;

// Above this many selected shapes, skip bulk-fetching geometry for the
// selection too — matches BoundaryVisualizer's RENDER_CAP.
const SELECTED_GEO_FETCH_CAP = 500;

export default function BoundaryPicker({
  mode = 'multi', // 'multi' | 'single'
  selectedIds,
  onChange,
  boundaryTypeFilter, // string[] optional
  countryFilter, // string optional
  height = '450px',
  showMap = true // false renders a plain list, no map column or geometry fetches
}) {
  const [boundaries, setBoundaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [forceLoadSelected, setForceLoadSelected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchBoundaries = async () => {
      setLoading(true);
      const { data, error } = await getBoundaryCandidates({ boundaryTypeFilter, countryFilter });
      if (error || cancelled) {
        setLoading(false);
        return;
      }

      let withGeo = (data || []).map(b => ({ ...b, geojson: null }));

      if (showMap && withGeo.length > 0 && withGeo.length <= EAGER_LOAD_LIMIT) {
        const ids = withGeo.map(b => b.id);
        const { data: geoData } = await getGeojsonShapes(ids);
        if (geoData) {
          const geoMap = new Map(geoData.map(g => [g.id, g.geojson]));
          withGeo = withGeo.map(b => ({ ...b, geojson: geoMap.get(b.id) || null }));
        }
      }

      if (!cancelled) {
        setBoundaries(withGeo);
        setLoading(false);
      }
    };

    fetchBoundaries();
    return () => { cancelled = true; };
  }, [JSON.stringify(boundaryTypeFilter), countryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const eagerLoaded = boundaries.length > 0 && boundaries.length <= EAGER_LOAD_LIMIT;

  // Bulk selection changes (e.g. a parent setting selectedIds directly from a
  // "find matching boundaries" result, rather than via toggle() below) never
  // ran through toggle()'s per-shape lazy fetch, so above EAGER_LOAD_LIMIT the
  // selected shapes never got geometry and the map showed nothing. Fetch
  // geometry for whatever's selected but missing it, in one batched call.
  // Above SELECTED_GEO_FETCH_CAP this is opt-in (forceLoadSelected) rather
  // than automatic — real election-sized selections routinely exceed it, and
  // silently rendering no map at all read as broken rather than capped.
  useEffect(() => {
    if (!showMap || eagerLoaded) return;
    if (!selectedIds || selectedIds.size === 0) return;
    if (selectedIds.size > SELECTED_GEO_FETCH_CAP && !forceLoadSelected) return;

    let cancelled = false;

    const fetchMissing = async () => {
      const missingIds = boundaries
        .filter(b => selectedIds.has(b.id) && !b.geojson)
        .map(b => b.id);
      if (missingIds.length === 0) return;

      const { data } = await getGeojsonShapes(missingIds);
      if (cancelled || !data) return;
      const geoMap = new Map(data.map(g => [g.id, g.geojson]));
      setBoundaries(prev => prev.map(b => (geoMap.has(b.id) ? { ...b, geojson: geoMap.get(b.id) } : b)));
    };

    fetchMissing();
    return () => { cancelled = true; };
  }, [selectedIds, eagerLoaded, boundaries, showMap, forceLoadSelected]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (id) => {
    if (mode === 'single') {
      onChange(new Set([id]));
    } else {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange(next);
    }

    // Large result sets skip eager loading — fetch this one shape's geometry now.
    if (!eagerLoaded) {
      const b = boundaries.find(x => x.id === id);
      if (b && !b.geojson) {
        const { data } = await getGeojsonShapes([id], { single: true });
        if (data?.geojson) {
          setBoundaries(prev => prev.map(x => (x.id === id ? { ...x, geojson: data.geojson } : x)));
        }
      }
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return boundaries;
    const term = searchTerm.toLowerCase();
    return boundaries.filter(b => {
      const haystack = `${b.name || ''} ${JSON.stringify(b.properties || {})}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [boundaries, searchTerm]);

  const grouped = useMemo(() => {
    const acc = {};
    filtered.forEach(b => {
      const key = `${b.country || 'Unknown'} — ${b.boundary_type || 'General'}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(b);
    });
    return acc;
  }, [filtered]);

  // Map always shows selected shapes; when the candidate set is small enough
  // to have been eager-loaded, it also shows unselected candidates (dimmed)
  // so they can be clicked directly.
  const mapBoundaries = eagerLoaded
    ? filtered.filter(b => b.geojson)
    : boundaries.filter(b => selectedIds.has(b.id) && b.geojson);

  const overCap = !eagerLoaded && selectedIds && selectedIds.size > SELECTED_GEO_FETCH_CAP && !forceLoadSelected;

  return (
    <div className={showMap ? 'grid grid-cols-1 md:grid-cols-3 gap-4' : 'grid grid-cols-1'}>
      {/* List Column */}
      <div className={`${showMap ? 'md:col-span-1' : ''} flex flex-col rounded-xl border border-border-light overflow-hidden bg-surface/30`} style={{ height }}>
        <div className="p-3 border-b border-border-light bg-surface/50 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Search name or metadata..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-surface-hover/80 text-xs text-text-secondary border border-border-light rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          {!loading && !eagerLoaded && boundaries.length > 0 && (
            <p className="text-[10px] text-amber-400 mt-1.5">
              {boundaries.length} candidates — too many to click-select on the map here, use the list.
            </p>
          )}
        </div>

        <div className="p-2.5 overflow-y-auto flex-1 custom-scrollbar space-y-2">
          {loading ? (
            <p className="text-xs text-text-muted text-center mt-4">Loading...</p>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-xs text-text-muted text-center mt-4">No boundaries match.</p>
          ) : (
            Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([groupKey, items]) => (
              <div key={groupKey} className="border border-border-light/40 rounded-lg overflow-hidden">
                <div className="p-2 bg-surface-hover/40 text-[11px] font-bold text-text-tertiary flex justify-between items-center gap-2">
                  <span className="truncate">{groupKey}</span>
                  <span className="text-text-muted font-normal shrink-0">({items.length})</span>
                </div>
                <div className="p-1.5 space-y-0.5">
                  {items.map(b => {
                    const isSelected = selectedIds.has(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggle(b.id)}
                        className={`w-full flex items-center gap-2 text-left p-1.5 rounded text-xs transition-colors ${
                          isSelected ? 'bg-primary/15 text-primary-light font-semibold' : 'hover:bg-surface-hover/60 text-text-muted'
                        }`}
                      >
                        <span className={`shrink-0 w-3 h-3 rounded-sm border ${isSelected ? 'bg-primary border-primary' : 'border-border-light'}`} />
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
        <div className="md:col-span-2 rounded-xl overflow-hidden border border-border-light flex items-center justify-center bg-surface/20" style={{ height }}>
          {overCap ? (
            <div className="text-center p-6">
              <p className="text-xs text-text-muted mb-3">
                {selectedIds.size} shapes selected — too many to auto-render (cap: {SELECTED_GEO_FETCH_CAP}).
              </p>
              <button
                type="button"
                onClick={() => setForceLoadSelected(true)}
                className="px-4 py-2 bg-surface-active hover:bg-border text-text-main rounded-lg text-xs font-semibold transition-colors"
              >
                Load Map Anyway
              </button>
            </div>
          ) : (
            <MapComponent
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
