import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { fetchAllPages } from '../../utils/fetchAllPages';
import MapComponent from './MapComponent';

// Above this many candidate shapes we don't eagerly load every geometry
// (avoids hammering ST_AsGeoJSON over huge result sets) — click-to-select on
// the map only works within a set small enough to render in full.
const EAGER_LOAD_LIMIT = 400;

export default function BoundaryPicker({
  mode = 'multi', // 'multi' | 'single'
  selectedIds,
  onChange,
  boundaryTypeFilter, // string[] optional
  countryFilter, // string optional
  height = '450px'
}) {
  const [boundaries, setBoundaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchBoundaries = async () => {
      setLoading(true);
      const { data, error } = await fetchAllPages((from, to) => {
        let query = supabase
          .from('map_shapes')
          .select('id, name, country, boundary_type, code, properties')
          .is('retired_at', null)
          .order('name')
          .order('id')
          .range(from, to);

        if (boundaryTypeFilter?.length) query = query.in('boundary_type', boundaryTypeFilter);
        if (countryFilter) query = query.eq('country', countryFilter);

        return query;
      });
      if (error || cancelled) {
        setLoading(false);
        return;
      }

      let withGeo = (data || []).map(b => ({ ...b, geojson: null }));

      if (withGeo.length > 0 && withGeo.length <= EAGER_LOAD_LIMIT) {
        const ids = withGeo.map(b => b.id);
        const { data: geoData } = await supabase.rpc('get_geojson_shapes', { ids });
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
        const { data } = await supabase.rpc('get_geojson_shapes', { ids: [id] }).single();
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* List Column */}
      <div className="md:col-span-1 flex flex-col rounded-xl border border-border-light overflow-hidden bg-surface/30" style={{ height }}>
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
      <div className="md:col-span-2 rounded-xl overflow-hidden border border-border-light" style={{ height }}>
        <MapComponent
          boundaries={mapBoundaries}
          selectedIds={selectedIds}
          onShapeClick={eagerLoaded ? toggle : undefined}
        />
      </div>
    </div>
  );
}
