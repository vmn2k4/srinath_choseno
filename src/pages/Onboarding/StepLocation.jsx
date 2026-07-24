import React, { useState, useEffect } from 'react';
import { MapPin, Loader2, ArrowLeft, ArrowRight, Search, Check, Layers } from 'lucide-react';
import { supabase } from '../../services/supabase';

export default function StepLocation({ data, updateData, nextStep, prevStep }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [lat, setLat] = useState(data.lat || '');
  const [lng, setLng] = useState(data.lng || '');

  // Manual boundary search state (for adding a specific boundary the point lookup missed)
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingBoundaries, setSearchingBoundaries] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingBoundaries(true);
      const { data: boundaries } = await supabase
        .from('map_shapes')
        .select('id, name, country, boundary_type')
        .ilike('name', `%${searchQuery.trim()}%`)
        .limit(15);

      setSearchResults(boundaries || []);
      setSearchingBoundaries(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getLocationFromBrowser = () => {
    setLoading(true);
    setError('');
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setLat(latitude.toString());
        setLng(longitude.toString());
        lookupBoundaries(latitude, longitude);
      },
      (err) => {
        setError(`Unable to retrieve your location: ${err.message}. Please enter coordinates manually or search your jurisdiction.`);
        setLoading(false);
      },
      { timeout: 10000 }
    );
  };

  // Resolves every boundary the point falls inside (not just one per level) and
  // persists the full membership set via sync_user_boundary_memberships.
  const lookupBoundaries = async (latitude, longitude) => {
    setLoading(true);
    setError('');
    try {
      const { data: boundaries, error: rpcError } = await supabase.rpc('find_boundaries_by_point', {
        lng: parseFloat(longitude),
        lat: parseFloat(latitude)
      });

      if (rpcError) throw rpcError;

      const { error: syncError } = await supabase.rpc('sync_user_boundary_memberships', {
        p_lat: parseFloat(latitude),
        p_lng: parseFloat(longitude)
      });

      if (syncError) throw syncError;

      updateData({
        lat: latitude.toString(),
        lng: longitude.toString(),
        matchedBoundaries: boundaries || []
      });

      if (!boundaries || boundaries.length === 0) {
        setError("No configured boundaries cover this location yet. You can still continue — you'll just see Country and International feeds until an admin uploads boundary data for your area, or search below to add a specific one manually.");
      }
    } catch (err) {
      console.error(err);
      setError("Could not resolve location boundaries. You can search and add your jurisdiction manually below.");
    } finally {
      setLoading(false);
    }
  };

  // Manually adds one specific boundary as an extra membership (e.g. the point
  // lookup missed it, or the user wants to add a boundary by name directly).
  const addBoundary = async (boundary) => {
    try {
      const { error: addError } = await supabase.rpc('add_user_boundary_membership', {
        p_map_shape_id: boundary.id
      });
      if (addError) throw addError;

      const already = (data.matchedBoundaries || []).some(b => String(b.id) === String(boundary.id));
      updateData({
        matchedBoundaries: already ? data.matchedBoundaries : [...(data.matchedBoundaries || []), boundary]
      });
      setIsSearching(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error(err);
      setError('Could not add that boundary. Please try again.');
    }
  };

  const matchedBoundaries = data.matchedBoundaries || [];
  const hasLocation = Boolean(data.lat && data.lng);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {prevStep && (
          <button onClick={prevStep} className="p-2 bg-surface-hover rounded-full text-text-muted hover:text-text-main transition-colors">
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h2 className="text-2xl font-bold text-text-main">Set Your Jurisdiction</h2>
          <p className="text-sm text-text-muted">We'll match you to every group your location falls inside — municipal, federal, and beyond.</p>
        </div>
      </div>

      {/* Main Location Action Box */}
      <div className="bg-surface-hover p-6 rounded-2xl border border-border text-center">
        <div className="w-16 h-16 bg-primary/20 text-primary-light rounded-full flex items-center justify-center mx-auto mb-4">
          <MapPin size={32} />
        </div>

        <h3 className="text-lg font-medium text-text-main mb-1">Detect Location Automatically</h3>
        <p className="text-text-muted text-xs mb-5 max-w-md mx-auto">
          We use your coordinates to match you with every boundary you belong to.
          Your exact coordinates are never shared publicly.
        </p>

        <button
          onClick={getLocationFromBrowser}
          disabled={loading}
          className="px-6 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary-hover transition-colors flex items-center gap-2 mx-auto disabled:opacity-50 text-sm shadow-md"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
          {loading ? 'Locating...' : 'Detect My Location'}
        </button>

        {error && <p className="text-amber-400 mt-3 text-xs font-medium max-w-md mx-auto">{error}</p>}
      </div>

      {/* Matched Groups Display */}
      {matchedBoundaries.length > 0 && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-2xl">
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
            <Layers size={14} /> You belong to {matchedBoundaries.length} group{matchedBoundaries.length > 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {matchedBoundaries.map(b => (
              <span key={b.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface rounded-xl border border-border-light text-xs font-semibold text-text-main">
                <Check size={13} className="text-primary-light" />
                {b.name} <span className="text-text-muted font-normal">({b.boundary_type})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Option to Search / Add a Jurisdiction Manually */}
      <div className="bg-surface p-5 rounded-2xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-text-main flex items-center gap-2">
            <Search size={16} className="text-primary-light" /> Search &amp; Add a Jurisdiction
          </h4>
          <button
            onClick={() => setIsSearching(!isSearching)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover text-text-main hover:bg-surface-active border border-border rounded-xl text-xs font-semibold transition-all"
          >
            {isSearching ? 'Close' : 'Open Search'}
          </button>
        </div>

        {isSearching && (
          <>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by constituency name (e.g. Lac-Saint-Jean)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface-hover border border-border-light rounded-xl p-3 text-sm text-text-main outline-none focus:border-primary transition-colors pr-10"
              />
              {searchingBoundaries && (
                <Loader2 size={18} className="animate-spin absolute right-3 top-3.5 text-text-muted" />
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border/50 bg-surface-hover">
                {searchResults.map(b => (
                  <button
                    key={b.id}
                    onClick={() => addBoundary(b)}
                    className="w-full p-3 text-left hover:bg-surface-active transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <p className="font-semibold text-sm text-text-main group-hover:text-primary-light">{b.name}</p>
                      <p className="text-xs text-text-muted">{b.country} • {b.boundary_type}</p>
                    </div>
                    <Check size={16} className="text-primary-light opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && !searchingBoundaries && (
              <p className="text-xs text-text-muted text-center p-3 bg-surface-hover rounded-xl">
                No matching boundaries found for "{searchQuery}".
              </p>
            )}
          </>
        )}

        {/* Manual Coordinate Entry Sub-section */}
        <div className="pt-3 border-t border-border/60">
          <p className="text-xs text-text-muted mb-2 font-medium uppercase tracking-wider">Or Enter Coordinates</p>
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Lat (e.g. 49.11)"
              value={lat}
              onChange={e => setLat(e.target.value)}
              className="flex-1 bg-surface-hover border border-border-light rounded-xl p-2.5 text-xs text-text-main outline-none focus:border-primary"
            />
            <input
              type="number"
              placeholder="Lng (e.g. -122.65)"
              value={lng}
              onChange={e => setLng(e.target.value)}
              className="flex-1 bg-surface-hover border border-border-light rounded-xl p-2.5 text-xs text-text-main outline-none focus:border-primary"
            />
            <button
              onClick={() => {
                if (lat && lng) lookupBoundaries(lat, lng);
                else setError('Enter both latitude and longitude');
              }}
              disabled={loading || !lat || !lng}
              className="px-4 py-2.5 bg-surface-active text-text-main rounded-xl hover:bg-border transition-colors text-xs font-bold disabled:opacity-50"
            >
              Verify
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-end pt-4">
        <button
          onClick={nextStep}
          disabled={!hasLocation}
          className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-colors flex items-center gap-2 disabled:opacity-50 shadow-md"
        >
          Continue <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
