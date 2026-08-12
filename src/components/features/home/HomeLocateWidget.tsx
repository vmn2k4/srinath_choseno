"use client";

// Compact "find your district" card for the homepage hero — sits side by
// side with the headline instead of requiring a trip to /find-my-district.
// Reuses the same services/utils as the full picker (InteractiveLocationPicker,
// FindMyDistrictClient) rather than re-deriving boundary/rep lookups here.

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Navigation, Loader2, MapPin, Star, Users } from "lucide-react";
import { Card, Button, Input } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import { findBoundariesByPoint } from "@/lib/services/boundaries";
import { getOfficeHoldersForShapes } from "@/lib/services/elections";
import { buildBoundarySlug } from "@/lib/utils/slugs";
import { geocodeAddressFree, type GeocodeSuggestion } from "@/lib/utils/geocode";
import { trackSearch } from "@/lib/analytics/events";

interface MatchedBoundary {
  id: number;
  name: string;
  country: string;
  boundary_type: string;
}

interface RepRow {
  id: string;
  map_shape_id: number;
  full_name: string;
  election_role_types?: { role_title?: string | null } | null;
  profiles?: {
    current_ghost_id?: string | null;
    politician_profiles?: { wall_slug?: string | null } | null;
  } | null;
}

// Boundary type sort order: Federal → Provincial → Municipal
const BOUNDARY_TYPE_ORDER: Record<string, number> = {
  "federal area": 0,
  federal: 0,
  provincial: 1,
  municipal: 2,
};

function getBoundaryTypeOrder(type: string): number {
  const normalized = type.toLowerCase().trim();
  return BOUNDARY_TYPE_ORDER[normalized] ?? 999;
}

// Prefer the human-readable wall_slug (matches how PoliticianWallClient/
// RepresentationBranchTree link out); fall back to the raw ghost_id, which
// /wall/[ghostId] also resolves directly. Null when the seat has no linked,
// claimed profile yet -- nothing to link to.
function wallHrefFor(rep: RepRow): string | null {
  const wallSlug = rep.profiles?.politician_profiles?.wall_slug;
  if (wallSlug) return `/wall/${wallSlug}`;
  const ghostId = rep.profiles?.current_ghost_id;
  if (ghostId) return `/wall/${ghostId}`;
  return null;
}

export default function HomeLocateWidget() {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState("");
  const [boundaries, setBoundaries] = useState<MatchedBoundary[] | null>(null);
  const [reps, setReps] = useState<RepRow[]>([]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await geocodeAddressFree(query);
      setSuggestions(results);
      setSearching(false);
      trackSearch(query.trim());
    }, 450);
    return () => clearTimeout(timer);
  }, [query]);

  const resolveLocation = async (lat: number, lng: number) => {
    setError("");
    setLoadingResults(true);
    setBoundaries(null);
    setReps([]);
    const { data, error: rpcError } = await findBoundariesByPoint(supabase, lat, lng);
    if (rpcError) {
      setError("Couldn't look up your district. Please try again.");
      setLoadingResults(false);
      return;
    }
    const matched = ((data as MatchedBoundary[] | null) || []).filter(
      (b) => !b.boundary_type.toLowerCase().includes("polling")
    );
    setBoundaries(matched);

    if (matched.length > 0) {
      const { data: holderRows } = await getOfficeHoldersForShapes(
        supabase,
        matched.map((b) => b.id)
      );
      setReps((holderRows || []) as unknown as RepRow[]);
    }
    setLoadingResults(false);
  };

  const handleLocateMe = () => {
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocation isn't supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        resolveLocation(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        setLocating(false);
        setError(`Couldn't get your GPS location: ${err.message}`);
      },
      { timeout: 10000 }
    );
  };

  const selectSuggestion = (s: GeocodeSuggestion) => {
    setQuery("");
    setSuggestions([]);
    resolveLocation(s.lat, s.lng);
  };

  const reset = () => {
    setBoundaries(null);
    setReps([]);
    setError("");
    setQuery("");
  };

  const repsFor = (boundaryId: number) => reps.filter((r) => r.map_shape_id === boundaryId);
  const busy = locating || loadingResults;

  return (
    <Card variant="hero" padding="lg" className="w-full max-w-md text-left">
      {!boundaries ? (
        <>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <MapPin size={18} className="text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-text-main">Find your district</h2>
          </div>
          <p className="text-sm text-text-muted mb-4">
            See your electoral boundaries and who represents you — instantly.
          </p>

          <div className="relative">
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-3 text-text-muted pointer-events-none" />
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your address or city..."
                className="pl-9 pr-8 text-sm"
              />
              {searching && (
                <Loader2 size={16} className="animate-spin text-primary absolute right-3" aria-hidden="true" />
              )}
            </div>

            {suggestions.length > 0 && (
              // Fixed (not theme-token) colors deliberately — this dropdown can sit
              // over the hero's decorative gradient/orbs, so it needs guaranteed
              // contrast rather than a translucent theme surface. Same reasoning as
              // the equivalent dropdown in InteractiveLocationPicker.
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-xl shadow-xl z-30 overflow-hidden">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 border-b border-black/5 last:border-b-0 transition-colors"
                  >
                    <MapPin size={13} className="text-blue-600 shrink-0" aria-hidden="true" />
                    <span className="truncate">{s.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleLocateMe}
            disabled={busy}
            className="mt-3 w-full"
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Navigation size={15} aria-hidden="true" />
            )}
            {loadingResults ? "Looking up your district..." : locating ? "Getting your location..." : "Use my location"}
          </Button>

          {error && <p className="mt-3 text-xs text-danger font-medium">{error}</p>}
        </>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <MapPin size={18} className="text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold text-text-main">Your district</h2>
            </div>
            <button
              onClick={reset}
              className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
            >
              Search again
            </button>
          </div>

          {boundaries.length === 0 ? (
            <p className="text-sm text-text-muted">
              No mapped boundaries here yet. Coverage is expanding — check back soon, or{" "}
              <Link href="/find-my-district" className="text-primary underline underline-offset-2">
                explore the full map
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-3">
              {boundaries
                .slice(0, 3)
                .sort((a, b) => getBoundaryTypeOrder(a.boundary_type) - getBoundaryTypeOrder(b.boundary_type))
                .map((b) => {
                  const boundaryReps = repsFor(b.id);

                  return (
                    <div
                      key={b.id}
                      className="px-3.5 py-3 rounded-xl border border-border-light/40 bg-surface-elevated/70"
                    >
                      <div className="mb-2">
                        <p className="text-[11px] font-semibold text-text-muted">{b.boundary_type}</p>
                        <p className="text-sm font-bold text-text-main">{b.name}</p>
                      </div>

                      {boundaryReps.length === 0 ? (
                        <p className="text-xs text-text-muted">No office holder data yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {boundaryReps.map((rep) => {
                            const wallHref = wallHrefFor(rep);
                            return (
                              <div key={rep.id} className="flex items-center justify-between gap-2">
                                <p className="min-w-0 text-xs text-text-muted flex items-center gap-1.5">
                                  <Users size={11} className="shrink-0" aria-hidden="true" />
                                  <span className="truncate">
                                    {rep.full_name}
                                    {rep.election_role_types?.role_title
                                      ? ` · ${rep.election_role_types.role_title}`
                                      : ""}
                                  </span>
                                </p>
                                {wallHref && (
                                  <Link
                                    href={wallHref}
                                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/15 transition-colors whitespace-nowrap"
                                    title="Rate this representative"
                                  >
                                    <Star size={12} className="fill-primary" aria-hidden="true" />
                                    Rate
                                  </Link>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              {boundaries.length > 3 && (
                <Link
                  href="/find-my-district"
                  className="block text-center text-xs font-semibold text-primary hover:text-primary-hover pt-1"
                >
                  See all {boundaries.length} boundaries &amp; representatives →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
