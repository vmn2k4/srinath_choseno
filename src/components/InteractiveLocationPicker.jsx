import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Loader2, Navigation, Globe, X, Check, SlidersHorizontal } from 'lucide-react';
import { Card, Button, Input } from './ui';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons for Vite/Bundlers
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

/**
 * Free OpenStreetMap Nominatim Geocoding API (0 Cost, 0 API Key)
 */
async function geocodeAddressFree(query) {
  if (!query || query.trim().length < 3) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=5`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'Choseno-Civic-App/1.0'
        }
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(item => ({
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    }));
  } catch (err) {
    console.error('Free Geocoding error:', err);
    return [];
  }
}

/**
 * Combined Unified Location Verification Component
 * Integrates:
 * - Free Street Address Autocomplete Search (OpenStreetMap)
 * - Always-visible Interactive Leaflet Map (click/drag pin marker)
 * - Auto-Detect GPS Button overlaid on map
 * - Current Selected Location Coordinates display
 * - Manual Coordinate Inputs (Latitude / Longitude + Verify)
 */
export default function InteractiveLocationPicker({
  currentLat,
  currentLng,
  onLocationSelect,
  loading = false,
  error = ''
}) {
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [geoError, setGeoError] = useState('');

  // Manual Coordinates State
  const [manualLat, setManualLat] = useState(currentLat || '');
  const [manualLng, setManualLng] = useState(currentLng || '');
  const [showManualCoords, setShowManualCoords] = useState(false);

  // Sync manual inputs when current selection changes
  useEffect(() => {
    if (currentLat) setManualLat(currentLat.toString());
    if (currentLng) setManualLng(currentLng.toString());
  }, [currentLat, currentLng]);

  // Leaflet Map Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Address search debounced
  useEffect(() => {
    if (!addressQuery.trim() || addressQuery.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingAddress(true);
      const results = await geocodeAddressFree(addressQuery);
      setAddressSuggestions(results);
      setSearchingAddress(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [addressQuery]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLat = currentLat ? parseFloat(currentLat) : 49.2152; // Default Maple Ridge / Surrey BC
    const initialLng = currentLng ? parseFloat(currentLng) : -122.6333;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true
      }).setView([initialLat, initialLng], currentLat ? 13 : 11);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
      }).addTo(map);

      // Marker
      const marker = L.marker([initialLat, initialLng], { icon: defaultIcon, draggable: true }).addTo(map);
      markerRef.current = marker;

      // Handle marker drag
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onLocationSelect(pos.lat, pos.lng);
      });

      // Handle map click
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        onLocationSelect(lat, lng);
      });

      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.invalidateSize();
      if (currentLat && currentLng) {
        const newPos = [parseFloat(currentLat), parseFloat(currentLng)];
        mapInstanceRef.current.setView(newPos, 13);
        if (markerRef.current) markerRef.current.setLatLng(newPos);
      }
    }
  }, [mapContainerRef, currentLat, currentLng]);

  const handleSelectSuggestion = (item) => {
    setAddressQuery(item.display_name);
    setAddressSuggestions([]);
    onLocationSelect(item.lat, item.lng);
  };

  const handleAutoDetectGPS = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 14);
          if (markerRef.current) markerRef.current.setLatLng([latitude, longitude]);
        }
        onLocationSelect(latitude, longitude);
      },
      (err) => {
        setGeoError(`Unable to detect browser location: ${err.message}. Click the map pin or search an address below.`);
      },
      { timeout: 10000 }
    );
  };

  const handleApplyManualCoords = () => {
    if (manualLat && manualLng) {
      const parsedLat = parseFloat(manualLat);
      const parsedLng = parseFloat(manualLng);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([parsedLat, parsedLng], 13);
          if (markerRef.current) markerRef.current.setLatLng([parsedLat, parsedLng]);
        }
        onLocationSelect(parsedLat, parsedLng);
      }
    }
  };

  return (
    <Card variant="composer" padding="md" className="space-y-4">
      {/* 1. TOP ADDRESS AUTOCOMPLETE SEARCH BAR */}
      <div className="space-y-2 relative">
        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
          Search Address or Click Map Pin
        </label>
        <div className="relative">
          <Input
            type="text"
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            placeholder="Search street address, city, or postal code..."
            className="pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            {searchingAddress ? <Loader2 size={16} className="animate-spin text-primary" /> : <Search size={16} />}
          </div>
        </div>

        {/* 100% Solid Opaque Address Suggestions Dropdown */}
        {addressSuggestions.length > 0 && (
          <div className="absolute z-[100] left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border-2 border-sky-500/60 dark:border-primary/60 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden max-h-64 overflow-y-auto p-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3 py-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between mb-1">
              <span>Matching Addresses (OpenStreetMap)</span>
              <button type="button" onClick={() => setAddressSuggestions([])} className="hover:text-slate-800 dark:hover:text-slate-200 p-0.5">
                <X size={13} />
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {addressSuggestions.map((item, idx) => {
                const parts = item.display_name.split(',');
                const mainName = parts.slice(0, 2).join(',').trim();
                const subDetail = parts.slice(2).join(',').trim();

                return (
                  <button
                    key={`${item.lat}-${item.lng}-${idx}`}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className="w-full text-left p-3 hover:bg-sky-50 dark:hover:bg-slate-800/80 border border-transparent rounded-xl transition-all flex items-start gap-2.5 group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-primary/20 border border-sky-300 dark:border-primary/40 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-sky-500 dark:group-hover:bg-primary group-hover:text-white transition-colors">
                      <MapPin size={15} className="text-sky-600 dark:text-primary group-hover:text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-primary-light transition-colors leading-snug truncate">
                        {mainName || item.display_name}
                      </p>
                      {subDetail && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mt-0.5">
                          {subDetail}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. INTERACTIVE MAP DISPLAY WITH FLOATING GPS AUTO-DETECT BUTTON */}
      <div className="relative rounded-2xl overflow-hidden border border-border-light shadow-inner">
        <div ref={mapContainerRef} className="w-full h-64 sm:h-72 z-10" />

        {/* Floating Auto-Detect GPS Button */}
        <div className="absolute top-3 right-3 z-[400]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAutoDetectGPS}
            className="shadow-xl bg-surface-elevated/95 backdrop-blur-md border border-border-light text-xs font-semibold hover:bg-primary/20 hover:text-primary-light flex items-center gap-1.5"
            title="Auto-detect location using browser GPS"
          >
            <Navigation size={14} className="text-primary" /> Auto-Detect Location
          </Button>
        </div>
      </div>

      {/* 3. CURRENT SELECTED LOCATION DISPLAY BAR */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border-light/40 text-xs">
        <div className="flex items-center gap-2 text-text-muted">
          <Globe size={15} className="text-primary shrink-0" />
          <span>
            Coordinates selected:{' '}
            <strong className="text-text-main font-mono">
              {currentLat ? parseFloat(currentLat).toFixed(4) : '—'}, {currentLng ? parseFloat(currentLng).toFixed(4) : '—'}
            </strong>
          </span>
        </div>

        {/* Toggle Manual Coordinates Entry */}
        <button
          type="button"
          onClick={() => setShowManualCoords(!showManualCoords)}
          className="text-text-muted hover:text-primary-light flex items-center gap-1 text-[11px] font-semibold transition-colors"
        >
          <SlidersHorizontal size={13} />
          {showManualCoords ? 'Hide Coordinate Entry' : 'Manual Coordinates'}
        </button>
      </div>

      {/* 4. INTEGRATED MANUAL COORDINATES ENTRY */}
      {showManualCoords && (
        <div className="p-3 bg-surface-hover/60 border border-border-light/50 rounded-xl space-y-2 animate-fade-in">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Direct Latitude / Longitude Entry
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              size="sm"
              placeholder="Latitude (e.g. 49.215)"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              size="sm"
              placeholder="Longitude (e.g. -122.633)"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              className="flex-1"
            />
            <Button variant="secondary" size="sm" onClick={handleApplyManualCoords} disabled={!manualLat || !manualLng || loading}>
              Verify
            </Button>
          </div>
        </div>
      )}

      {/* Loading & Error Indicators */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-primary-light">
          <Loader2 size={16} className="animate-spin" /> Resolving electoral constituencies...
        </div>
      )}

      {(error || geoError) && (
        <p className="text-xs font-medium text-warning bg-warning/10 p-3 rounded-xl border border-warning/25">
          {error || geoError}
        </p>
      )}
    </Card>
  );
}
