import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import * as turf from '@turf/turf';
import { MapPin, Search, Compass, Navigation, Map as MapIcon } from 'lucide-react';
import MapComponent from '../components/map/MapComponent';

export default function UserPage() {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [boundaries, setBoundaries] = useState([]);
  const [selectedBoundaryIds, setSelectedBoundaryIds] = useState(new Set());
  const [expandedCountries, setExpandedCountries] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBoundaries = async () => {
      try {
        // Fetch updated attributes to support advanced categorizing
        const { data, error } = await supabase.from('map_shapes').select('id, name, country, boundary_type, code').order('name');
            
        if (error) throw error;
        
        if (data) {
          // Initialize with geojson as null, we will lazy-load it when clicked
          setBoundaries(data.map(b => ({ ...b, geojson: null })));
          // By default, maybe don't select any or select the first one. We'll leave it empty.
        }
      } catch (err) {
        console.error('Error fetching boundaries:', err);
        setError('Database Error: ' + (err.message || 'Could not load map shapes data.'));
      }
    };
    fetchBoundaries();
  }, []);

  const toggleBoundary = async (id) => {
    const newSet = new Set(selectedBoundaryIds);
    if (newSet.has(id)) {
      newSet.delete(id);
      setSelectedBoundaryIds(newSet);
    } else {
      newSet.add(id);
      setSelectedBoundaryIds(newSet);
      
      // Lazy-load the heavy GeoJSON only when the user wants to see it on the map!
      const boundaryIndex = boundaries.findIndex(b => b.id === id);
      if (boundaryIndex >= 0 && !boundaries[boundaryIndex].geojson) {
        try {
          // This forces Supabase to only st_asgeojson on ONE specific row, completely preventing the timeout
          const { data, error } = await supabase.rpc('get_geojson_shapes').eq('id', id).single();
          
          if (data && data.geojson) {
            setBoundaries(prev => {
              const updated = [...prev];
              const idx = updated.findIndex(b => b.id === id);
              if (idx >= 0) {
                updated[idx] = { ...updated[idx], geojson: data.geojson };
              }
              return updated;
            });
          }
        } catch (err) {
          console.error("Failed to load geometry for shape", id, err);
        }
      }
    }
  };

  const toggleSelectAllCategory = async (e, items) => {
    e.stopPropagation();
    const itemIds = items.map(item => item.id);
    const allSelected = itemIds.every(id => selectedBoundaryIds.has(id));
    
    const newSet = new Set(selectedBoundaryIds);
    if (allSelected) {
      // Deselect all
      itemIds.forEach(id => newSet.delete(id));
      setSelectedBoundaryIds(newSet);
    } else {
      // Select all
      itemIds.forEach(id => newSet.add(id));
      setSelectedBoundaryIds(newSet);
      
      // Batch fetch missing geometries
      const missingIds = items.filter(b => {
         const existing = boundaries.find(bd => bd.id === b.id);
         return !existing || !existing.geojson;
      }).map(b => b.id);
      
      if (missingIds.length > 0) {
        try {
          const { data, error } = await supabase.rpc('get_geojson_shapes').in('id', missingIds);
          if (data) {
            setBoundaries(prev => {
              const updated = [...prev];
              data.forEach(fetchedItem => {
                const idx = updated.findIndex(b => b.id === fetchedItem.id);
                if (idx >= 0) {
                  updated[idx] = { ...updated[idx], geojson: fetchedItem.geojson };
                }
              });
              return updated;
            });
          }
        } catch (err) {
          console.error("Failed to batch load geometries", err);
        }
      }
    }
  };

  const toggleCountry = (country) => {
    const newSet = new Set(expandedCountries);
    if (newSet.has(country)) newSet.delete(country);
    else newSet.add(country);
    setExpandedCountries(newSet);
  };

  const filteredBoundaries = boundaries.filter(b => b.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  const groupedBoundaries = filteredBoundaries.reduce((acc, curr) => {
    const hasNewFormat = !!curr.country;
    let country = curr.country;
    let bType = curr.boundary_type || 'General';
    let display = curr.name;

    if (!hasNewFormat) {
      const parts = (curr.name || '').split(' - ');
      country = parts.length > 1 ? parts[0] : 'Uncategorized';
      display = parts.length > 1 ? parts.slice(1).join(' - ') : curr.name;
    }

    const key = `${country} - ${bType}`;
    
    if (!acc[key]) acc[key] = { country, bType, items: [] };
    acc[key].items.push({ ...curr, display_name: display });
    return acc;
  }, {});

  const handleSearch = () => {
    setError('');
    setResult(null);
    
    if (!latitude || !longitude) {
      setError('Please enter both latitude and longitude.');
      return;
    }
    
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lng)) {
      setError('Invalid coordinates. Please enter valid numbers.');
      return;
    }
    
    setLoading(true);
    
    setTimeout(async () => {
      try {
        // Instead of downloading 50MB of data to the browser and using turf.js, 
        // we ask the PostGIS database to do the calculation instantly!
        const { data, error } = await supabase.rpc('find_boundaries_by_point', {
          lng: lng,
          lat: lat
        });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          // Found boundaries! Since they overlap, we get all levels (Federal, Provincial, etc)
          setResult({
            boundaries: data
          });
        } else {
          setResult({
            notFound: true
          });
        }
      } catch (err) {
        console.error(err);
        setError('Error calculating boundary. Check if coordinates are valid. (Did you run the SQL snippet for find_boundary_by_point?)');
      } finally {
        setLoading(false);
      }
    }, 100); 
  };

  const fillExample = () => {
    setLatitude('49.153804');
    setLongitude('-122.648797');
  };

  return (
    <div className="w-full max-w-none animate-fade-in px-4 lg:px-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-2xl border border-primary/20 shadow-[0_0_15px_rgba(233,235,158,0.1)]">
          <Compass className="text-primary w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-text-main">Boundary Finder</h1>
          <p className="text-text-muted text-sm mt-0.5">Discover your electoral district with geographical coordinates.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT COLUMN: Input Form & Results */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 border border-border-light bg-surface-elevated/40 backdrop-blur-md">
            <h2 className="text-lg font-bold text-text-secondary mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-accent" /> Coordinates Search
            </h2>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Latitude</label>
                <div className="relative flex items-center">
                  <MapPin className="absolute left-4 text-text-muted" size={16} />
                  <input 
                    type="text" 
                    className="w-full pl-11 pr-4 py-3 bg-surface/40 border border-border-light rounded-xl text-text-main text-sm transition-all duration-300 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                    placeholder="e.g. 49.153804" 
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Longitude</label>
                <div className="relative flex items-center">
                  <Navigation className="absolute left-4 text-text-muted" size={16} />
                  <input 
                    type="text" 
                    className="w-full pl-11 pr-4 py-3 bg-surface/40 border border-border-light rounded-xl text-text-main text-sm transition-all duration-300 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                    placeholder="e.g. -122.648797" 
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <button 
                className="col-span-1 flex items-center justify-center py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 border border-border-light bg-surface/20 hover:bg-surface-hover text-text-secondary"
                onClick={fillExample}
              >
                Example
              </button>
              <button 
                className="col-span-2 flex items-center justify-center py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 bg-primary hover:bg-primary-hover text-slate-950 shadow-[0_4px_14px_rgba(233,235,158,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                onClick={handleSearch} 
                disabled={loading || boundaries.length === 0}
              >
                {loading ? 'Searching...' : boundaries.length === 0 ? 'Loading...' : 'Find Boundary'}
                {!loading && <Search size={16} className="ml-1.5" />}
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm text-center animate-fade-in">
                {error}
              </div>
            )}
          </div>

          {result && (
            <div className={`p-6 rounded-2xl border animate-fade-in shadow-xl ${result.notFound ? 'bg-danger/5 border-danger/25' : 'bg-accent/5 border-accent/25'}`}>
              {result.notFound ? (
                <div>
                  <h3 className="text-xs text-danger font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    No Boundary Found
                  </h3>
                  <p className="text-text-secondary text-sm">The coordinates you entered do not fall within any known electoral boundaries in our database.</p>
                </div>
              ) : (
                <div>
                  <h3 className="text-xs text-accent font-bold uppercase tracking-wider mb-3">You are located in:</h3>
                  <div className="space-y-4">
                    {result.boundaries.map((b, i) => (
                      <div key={i} className="pb-3 border-b border-border-light last:border-0 last:pb-0">
                        <div className="flex gap-1.5 items-center mb-1.5">
                          <span className="text-[10px] bg-accent/20 text-accent-hover px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                            {b.country || 'Country'}
                          </span>
                          <span className="text-[10px] bg-primary/20 text-primary-light px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                            {b.boundary_type || 'Type'}
                          </span>
                        </div>
                        <h2 className="text-xl text-text-main font-bold">{b.name}</h2>
                        {b.code && (
                          <p className="text-xs text-text-muted mt-1">
                            Boundary Code: <span className="font-mono text-text-secondary">{b.code}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Boundary Selector List & Map Component */}
        <div className="lg:col-span-2 glass-card p-6 border border-border-light flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MapIcon className="text-primary" size={20} />
              <h3 className="text-lg font-bold text-text-main">Interactive Map Viewer</h3>
            </div>
            <p className="text-xs text-text-muted max-w-md sm:text-right">
              Toggle specific boundary shapes in the selector below to visualize them directly on the map.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* List Selector Column */}
            <div className="md:col-span-1 flex flex-col h-[450px] bg-surface/30 rounded-xl border border-border-light overflow-hidden">
              <div className="p-3.5 bg-surface/50 border-b border-border-light flex flex-col gap-2.5">
                <div className="flex justify-between items-center text-xs">
                  <h4 className="font-bold text-text-secondary">Boundaries List</h4>
                  <span className="bg-primary/20 text-primary-light px-2 py-0.5 rounded-full font-semibold">{boundaries.length} total</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted w-3.5 h-3.5" />
                  <input 
                    type="text" 
                    placeholder="Search shapes..." 
                    className="w-full bg-surface-hover/80 text-xs text-text-secondary border border-border-light rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-primary transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-3 overflow-y-auto flex-1 custom-scrollbar space-y-2.5">
                {Object.keys(groupedBoundaries).length === 0 ? (
                  <p className="text-xs text-text-muted italic text-center mt-4">No boundaries match.</p>
                ) : (
                  Object.entries(groupedBoundaries).sort(([a], [b]) => a.localeCompare(b)).map(([groupKey, group]) => {
                    const isExpanded = expandedCountries.has(groupKey) || searchTerm !== '';
                    const { items } = group;
                    const allCategorySelected = items.every(item => selectedBoundaryIds.has(item.id));
                    
                    return (
                      <div key={groupKey} className="flex flex-col border border-border-light/40 rounded-lg bg-surface-hover/20 overflow-hidden">
                        <div 
                          className="flex justify-between items-center p-2.5 w-full hover:bg-surface-active/30 transition-colors text-left cursor-pointer select-none"
                          onClick={() => toggleCountry(groupKey)}
                        >
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="font-bold text-text-tertiary text-xs truncate max-w-[120px]">{groupKey}</span>
                            <span className="text-[10px] text-text-muted">({items.length})</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button 
                              className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border transition-colors ${allCategorySelected ? 'bg-primary/20 text-primary-light border-primary/40 hover:bg-primary/30' : 'bg-surface border-border-light text-text-muted hover:bg-surface-active'}`}
                              onClick={(e) => toggleSelectAllCategory(e, items)}
                            >
                              {allCategorySelected ? 'None' : 'All'}
                            </button>
                            <span className={`text-text-muted text-[10px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="flex flex-col gap-1 px-1.5 pb-2 bg-surface/30 pt-1 border-t border-border-light/10">
                            {items.map(boundary => {
                              const id = boundary.id;
                              const isSelected = selectedBoundaryIds.has(id);
                              return (
                                <button
                                  key={id}
                                  onClick={() => toggleBoundary(id)}
                                  className={`flex items-center text-left p-1.5 rounded transition-all duration-200 group ${isSelected ? 'bg-primary/10' : 'hover:bg-surface-hover/60'}`}
                                >
                                  <div className={`shrink-0 w-3.5 h-3.5 rounded border mr-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary shadow-[0_0_8px_rgba(233,235,158,0.3)]' : 'border-border-light bg-surface group-hover:border-text-muted'}`}>
                                    {isSelected && <svg className="w-2.5 h-2.5 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                  </div>
                                  <span className={`text-xs truncate ${isSelected ? 'text-primary-light font-bold' : 'text-text-muted group-hover:text-text-secondary'}`}>{boundary.display_name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Map Column */}
            <div className="md:col-span-2 relative h-[450px] rounded-xl overflow-hidden border border-border-light shadow-lg">
              <MapComponent boundaries={boundaries.filter((b, i) => selectedBoundaryIds.has(b.id || i))} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
