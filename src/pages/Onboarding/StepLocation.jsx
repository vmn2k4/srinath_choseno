import React, { useState, useEffect } from 'react';
import { MapPin, Loader2, ArrowLeft, ArrowRight, Search, Check, Layers } from 'lucide-react';
import { searchMapShapesByName, findBoundariesByPoint, syncUserBoundaryMemberships, addUserBoundaryMembership } from '../../services/boundaries';
import { Card, Button, Input } from '../../components/ui';
import InteractiveLocationPicker from '../../components/InteractiveLocationPicker';

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
      const { data: boundaries } = await searchMapShapesByName(searchQuery.trim());

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
      const { data: boundaries, error: rpcError } = await findBoundariesByPoint(parseFloat(latitude), parseFloat(longitude));

      if (rpcError) throw rpcError;

      const { error: syncError } = await syncUserBoundaryMemberships(parseFloat(latitude), parseFloat(longitude));

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
      const { error: addError } = await addUserBoundaryMembership(boundary.id);
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
          <Button variant="icon" onClick={prevStep} className="rounded-full">
            <ArrowLeft size={20} />
          </Button>
        )}
        <div>
          <h2 className="text-2xl font-bold text-text-main">Verify Your Electoral District</h2>
          <p className="text-sm text-text-muted">We will resolve every verified constituency your location falls inside — municipal, state/provincial, and federal.</p>
        </div>
      </div>

      {/* Interactive Location Verification: Address Search, Leaflet Map Pin Picker, or Auto-Detect */}
      <InteractiveLocationPicker
        currentLat={data.lat}
        currentLng={data.lng}
        onLocationSelect={(latitude, longitude) => {
          setLat(latitude.toString());
          setLng(longitude.toString());
          lookupBoundaries(latitude, longitude);
        }}
        loading={loading}
        error={error}
      />

      {/* Matched Groups Display */}
      {matchedBoundaries.length > 0 && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-2xl">
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
            <Layers size={14} /> Verified in {matchedBoundaries.length} constituenc{matchedBoundaries.length > 1 ? 'ies' : 'y'}
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

      {/* Navigation Buttons */}
      <div className="flex justify-end pt-4">
        <Button size="lg" onClick={nextStep} disabled={!hasLocation}>
          Continue <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
