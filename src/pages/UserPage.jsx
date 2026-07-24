import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { MapPin, Search, Compass, Navigation, Map as MapIcon } from 'lucide-react';
import BoundaryPicker from '../components/map/BoundaryPicker';

const COUNTRY_FILTER_STORAGE_KEY = 'explore_country_filter';

export default function UserPage() {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedBoundaryIds, setSelectedBoundaryIds] = useState(new Set());
  const [error, setError] = useState('');

  // Scopes the map viewer/picker to one country at a time — the picker's
  // candidate list is unmanageable once several countries' boundaries are
  // all loaded at once (grew to ~54,700 total map_shapes rows once a second
  // country was loaded — "All countries" on first visit visibly hung the
  // tab). Remembered per-tab so it doesn't reset on navigation. `null` means
  // "no explicit choice yet" (distinct from '' = deliberately "All
  // countries"), so the first-visit default below only applies once.
  const [countries, setCountries] = useState([]);
  const [countryFilter, setCountryFilter] = useState(
    () => sessionStorage.getItem(COUNTRY_FILTER_STORAGE_KEY) ?? null
  );

  useEffect(() => {
    supabase.from('countries').select('name').order('name')
      .then(({ data }) => {
        const names = (data || []).map(c => c.name);
        setCountries(names);
        setCountryFilter(prev => (prev === null && names.length > 0) ? names[0] : (prev ?? ''));
      });
  }, []);

  useEffect(() => {
    if (countryFilter !== null) sessionStorage.setItem(COUNTRY_FILTER_STORAGE_KEY, countryFilter);
  }, [countryFilter]);

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
                disabled={loading}
              >
                {loading ? 'Searching...' : 'Find Boundary'}
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

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Country</label>
            <select
              value={countryFilter ?? ''}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="p-2 bg-surface/40 border border-border-light text-xs text-text-main rounded-lg focus:outline-none focus:border-primary"
            >
              <option value="">All countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <BoundaryPicker
            mode="multi"
            selectedIds={selectedBoundaryIds}
            onChange={setSelectedBoundaryIds}
            countryFilter={countryFilter || undefined}
            height="450px"
          />
        </div>

      </div>
    </div>
  );
}
