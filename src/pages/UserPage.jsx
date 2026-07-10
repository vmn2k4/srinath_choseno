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
    <div className="w-full max-w-6xl animate-fade-in">
      <div className="glass-card p-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-sky-400/20 to-indigo-400/20 rounded-full mb-4 border border-indigo-400/30">
            <Compass className="text-indigo-400 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Boundary Finder</h1>
          <p className="text-slate-400 text-base">Discover your electoral district with precision.</p>
        </div>

        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-400">Latitude</label>
            <div className="relative flex items-center">
              <MapPin className="absolute left-4 text-slate-400" size={18} />
              <input 
                type="text" 
                className="w-full pl-12 pr-4 py-4 bg-slate-900/60 border border-white/10 rounded-xl text-slate-50 text-base transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                placeholder="e.g. 49.153804" 
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-400">Longitude</label>
            <div className="relative flex items-center">
              <Navigation className="absolute left-4 text-slate-400" size={18} />
              <input 
                type="text" 
                className="w-full pl-12 pr-4 py-4 bg-slate-900/60 border border-white/10 rounded-xl text-slate-50 text-base transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                placeholder="e.g. -122.648797" 
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <button 
            className="flex-1 flex items-center justify-center py-4 px-6 rounded-xl text-base font-semibold transition-all duration-300 border border-white/10 bg-white/5 hover:bg-white/10 text-slate-50"
            onClick={fillExample}
          >
            Use Example
          </button>
          <button 
            className="flex-[2] flex items-center justify-center py-4 px-6 rounded-xl text-base font-semibold transition-all duration-300 bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-[0_4px_14px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(59,130,246,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            onClick={handleSearch} 
            disabled={loading || boundaries.length === 0}
          >
            {loading ? 'Searching...' : boundaries.length === 0 ? 'No Data Available' : 'Find Boundary'}
            {!loading && <Search size={18} className="ml-2" />}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-center animate-fade-in">
            {error}
          </div>
        )}

        {result && (
          <div className={`mt-8 p-6 rounded-2xl animate-fade-in ${result.notFound ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'}`}>
            {result.notFound ? (
              <div>
                <h3 className="text-sm text-slate-400 uppercase tracking-wider mb-2">No Boundary Found</h3>
                <p className="text-slate-50">The coordinates you entered do not fall within any known electoral boundaries in our database.</p>
              </div>
            ) : (
              <div>
                <h3 className="text-sm text-slate-400 uppercase tracking-wider mb-4">You are in:</h3>
                {result.boundaries.map((b, i) => (
                  <div key={i} className="mb-4 pb-4 border-b border-white/10 last:border-0 last:pb-0 last:mb-0">
                    <div className="flex gap-2 items-center mb-1">
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full font-medium">
                        {b.country || 'Unknown Country'}
                      </span>
                      <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full font-medium">
                        {b.boundary_type || 'Unknown Type'}
                      </span>
                    </div>
                    <h2 className="text-2xl text-emerald-400 font-bold">{b.name}</h2>
                    {b.code && <p className="text-sm text-slate-400 mt-1">Boundary Code: <span className="font-mono text-slate-300">{b.code}</span></p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <MapIcon className="text-blue-400" size={24} />
            <h3 className="text-xl font-bold text-slate-50">Interactive Map Viewer</h3>
          </div>
          <p className="text-sm text-slate-400 mb-6">
            Select one or more shape files from the left to overlay them onto the map.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 flex flex-col h-[500px] bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden shadow-inner">
              <div className="p-4 bg-slate-900 border-b border-white/10 z-10 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-slate-300">Available Boundaries</h4>
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">{boundaries.length} Total</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Search regions or countries..." 
                    className="w-full bg-slate-800 text-sm text-slate-200 border border-slate-700 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                {Object.keys(groupedBoundaries).length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center mt-4">No boundaries match your search.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {Object.entries(groupedBoundaries).sort(([a], [b]) => a.localeCompare(b)).map(([groupKey, group]) => {
                      const isExpanded = expandedCountries.has(groupKey) || searchTerm !== ''; // Auto-expand when searching
                      const { items } = group;
                      const allCategorySelected = items.every(item => selectedBoundaryIds.has(item.id));
                      
                      return (
                        <div key={groupKey} className="flex flex-col border border-white/5 rounded-lg bg-slate-800/40 overflow-hidden">
                          <div 
                            className="flex justify-between items-center p-3 w-full hover:bg-slate-700/60 transition-colors text-left cursor-pointer select-none"
                            onClick={() => toggleCountry(groupKey)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-slate-300 text-sm">{groupKey} <span className="text-slate-500 font-normal ml-1">({items.length})</span></span>
                              <button 
                                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border transition-colors ${allCategorySelected ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 hover:bg-blue-500/30' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-600 hover:text-white'}`}
                                onClick={(e) => toggleSelectAllCategory(e, items)}
                              >
                                {allCategorySelected ? 'Deselect All' : 'Select All'}
                              </button>
                            </div>
                            <span className={`text-slate-500 text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                          </div>
                          
                          {isExpanded && (
                            <div className="flex flex-col gap-1 px-2 pb-2 bg-slate-900/40 pt-1">
                              {items.map(boundary => {
                                const id = boundary.id;
                                const isSelected = selectedBoundaryIds.has(id);
                                return (
                                  <button
                                    key={id}
                                    onClick={() => toggleBoundary(id)}
                                    className={`flex items-center text-left p-2 rounded-md transition-all duration-200 group ${isSelected ? 'bg-blue-500/20' : 'hover:bg-slate-800'}`}
                                  >
                                    <div className={`shrink-0 w-4 h-4 rounded-sm border mr-3 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.4)]' : 'border-slate-500 bg-slate-800 group-hover:border-slate-400'}`}>
                                      {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    <span className={`text-sm truncate ${isSelected ? 'text-blue-200 font-medium' : 'text-slate-400 group-hover:text-slate-200'}`}>{boundary.display_name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-2 relative h-[500px]">
              <MapComponent boundaries={boundaries.filter((b, i) => selectedBoundaryIds.has(b.id || i))} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
