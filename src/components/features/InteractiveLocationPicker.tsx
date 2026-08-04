"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Search,
  Loader2,
  Navigation,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { Card, Button, Input } from "@/components/primitives";

async function geocodeAddressFree(query: string) {
  if (!query || query.trim().length < 3) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query.trim()
      )}&limit=5`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "Choseno-Civic-App/1.0",
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((item: any) => ({
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch (err) {
    console.error("Free Geocoding error:", err);
    return [];
  }
}

interface InteractiveLocationPickerProps {
  currentLat?: string | number;
  currentLng?: string | number;
  onLocationSelect: (lat: number, lng: number) => void;
  loading?: boolean;
  error?: string;
}

export default function InteractiveLocationPicker({
  currentLat,
  currentLng,
  onLocationSelect,
  loading = false,
  error = "",
}: InteractiveLocationPickerProps) {
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [geoError, setGeoError] = useState("");

  const [manualLat, setManualLat] = useState(currentLat?.toString() || "");
  const [manualLng, setManualLng] = useState(currentLng?.toString() || "");
  const [showManualCoords, setShowManualCoords] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (currentLat) setManualLat(currentLat.toString());
      if (currentLng) setManualLng(currentLng.toString());
    });
  }, [currentLat, currentLng]);

  useEffect(() => {
    if (!addressQuery.trim() || addressQuery.trim().length < 3) {
      Promise.resolve().then(() => setAddressSuggestions([]));
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

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isSubscribed = true;

    async function initMap() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (!isSubscribed || !mapContainerRef.current) return;

      const defaultIcon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const initialLat = currentLat ? parseFloat(currentLat.toString()) : 49.2827;
      const initialLng = currentLng ? parseFloat(currentLng.toString()) : -123.1207;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current).setView(
          [initialLat, initialLng],
          currentLat && currentLng ? 13 : 10
        );

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 19,
          }
        ).addTo(map);

        const marker = L.marker([initialLat, initialLng], {
          draggable: true,
          icon: defaultIcon,
        }).addTo(map);

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onLocationSelect(pos.lat, pos.lng);
        });

        map.on("click", (e: any) => {
          marker.setLatLng(e.latlng);
          onLocationSelect(e.latlng.lat, e.latlng.lng);
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
      } else {
        if (currentLat && currentLng) {
          const latNum = parseFloat(currentLat.toString());
          const lngNum = parseFloat(currentLng.toString());
          mapInstanceRef.current.setView([latNum, lngNum], 13);
          markerRef.current.setLatLng([latNum, lngNum]);
        }
      }
    }

    initMap();

    return () => {
      isSubscribed = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [currentLat, currentLng]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoDetectGPS = () => {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationSelect(
          position.coords.latitude,
          position.coords.longitude
        );
      },
      (err) => {
        setGeoError(`GPS error: ${err.message}`);
      },
      { timeout: 10000 }
    );
  };

  const selectAddress = (suggestion: any) => {
    onLocationSelect(suggestion.lat, suggestion.lng);
    setAddressQuery("");
    setAddressSuggestions([]);
  };

  const verifyManualCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = parseFloat(manualLat);
    const parsedLng = parseFloat(manualLng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setGeoError("Please enter valid decimal latitude and longitude numbers.");
      return;
    }
    onLocationSelect(parsedLat, parsedLng);
  };

  return (
    <Card padding="md" className="space-y-4">
      <div className="relative">
        <div className="relative flex items-center">
          <Search
            size={16}
            className="absolute left-3 text-text-muted pointer-events-none"
          />
          <Input
            type="text"
            placeholder="Search address or city (e.g. 1055 W Georgia St, Vancouver)..."
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            className="pl-9 text-xs"
          />
          {searchingAddress && (
            <Loader2
              size={16}
              className="animate-spin text-primary absolute right-3"
            />
          )}
        </div>

        {addressSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface-elevated border border-border-light/40 rounded-xl shadow-xl z-30 overflow-hidden">
            {addressSuggestions.map((item, idx) => (
              <button
                key={idx}
                onClick={() => selectAddress(item)}
                className="w-full text-left px-4 py-2.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-main flex items-center gap-2 border-b border-border-light/20 last:border-b-0 transition-colors"
              >
                <MapPin size={14} className="text-accent shrink-0" />
                <span className="truncate">{item.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative h-64 sm:h-80 rounded-2xl overflow-hidden border border-border-light/30 bg-black/10">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        <div className="absolute bottom-3 right-3 z-20">
          {/* Fixed (not theme-token) colors deliberately — this button floats on top of the
              Leaflet/CARTO map tiles, which are always pale regardless of which of the site's
              12 themes is active. A translucent theme-colored background (the previous
              bg-surface-elevated/90) barely tints a light map, so light-on-dark themes ended
              up with near-white text on an almost-white backdrop. A solid white pill with dark
              text/icon is the standard on-map-control convention (Google/Apple Maps) for
              exactly this reason — it stays legible over any map imagery, independent of
              in-app theming. */}
          <Button
            size="sm"
            onClick={autoDetectGPS}
            disabled={loading}
            // `!` (important) modifiers are required here: Button's default variant="primary"
            // already sets a text/background color (text-text-on-primary, bg-primary), and
            // those utility classes win the cascade over a plain same-specificity override
            // regardless of className string order, since Tailwind's generated CSS order (not
            // JSX prop order) decides ties. Confirmed live — without `!`, computed color was
            // still primary's white despite this className listing slate-800.
            className="shadow-lg text-xs gap-1.5 !bg-white !border !border-black/10 !text-slate-800 hover:!bg-slate-50"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin !text-blue-600" />
            ) : (
              <Navigation size={14} className="!text-blue-600" />
            )}
            Auto-Detect GPS
          </Button>
        </div>
      </div>

      {(error || geoError) && (
        <p className="text-xs text-danger font-medium">{error || geoError}</p>
      )}

      {currentLat && currentLng && (
        <div className="flex items-center justify-between p-3 bg-surface/30 border border-border-light/20 rounded-xl text-xs">
          <span className="text-text-muted flex items-center gap-1.5">
            <Check size={14} className="text-accent" /> Location Set:{" "}
            <strong className="text-text-main font-mono">
              {parseFloat(currentLat.toString()).toFixed(4)},{" "}
              {parseFloat(currentLng.toString()).toFixed(4)}
            </strong>
          </span>

          <button
            onClick={() => setShowManualCoords(!showManualCoords)}
            className="text-[11px] font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
          >
            <SlidersHorizontal size={12} /> Edit Coords
          </button>
        </div>
      )}

      {showManualCoords && (
        <form
          onSubmit={verifyManualCoords}
          className="p-3 bg-surface/20 border border-border-light/20 rounded-xl flex items-center gap-2"
        >
          <Input
            placeholder="Latitude"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            className="text-xs"
          />
          <Input
            placeholder="Longitude"
            value={manualLng}
            onChange={(e) => setManualLng(e.target.value)}
            className="text-xs"
          />
          <Button type="submit" size="sm" className="shrink-0">
            Set
          </Button>
        </form>
      )}
    </Card>
  );
}
