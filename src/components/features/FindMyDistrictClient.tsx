"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MapPin, ArrowRight, Layers, Network, ChevronDown, Sparkles } from "lucide-react";
import InteractiveLocationPicker from "./InteractiveLocationPicker";
import BoundaryDirectoryClient from "./BoundaryDirectoryClient";
import MissionRegisterCTA from "./MissionRegisterCTA";
import { findBoundariesByPoint } from "@/lib/services/boundaries";
import { getActiveSeatsByShapeIds, getCandidatesBySeatIds, resolveRepresentationBranch } from "@/lib/services/elections";
import { buildBoundarySlug, buildSeatSlug } from "@/lib/utils/slugs";
import { Card, Spinner } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import { trackFindDistrictCompleted } from "@/lib/analytics/events";
import { useTranslation } from "@/contexts/LanguageContext";
import type { RepresentationBranch } from "./RepresentationBranchTree";
import { useGuestLocation, setGuestLocation, type MatchedBoundary } from "@/lib/utils/guestLocation";
import { REP_LIST_GATING_ENABLED } from "@/lib/constants/site";

type ShapeRow = { id: number; name: string; country: string; boundary_type: string; properties?: unknown };

type SeatWithElections = {
  id: string;
  role_title: string;
  candidateCount: number;
  map_shapes?: { name?: string; properties?: unknown } | null;
  elections?: { name?: string; election_date?: string } | null;
};

function formatElectionDate(dateString?: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

// Thin wrapper around the shared resolveRepresentationBranch (src/lib/
// services/elections.ts) -- this used to be a full copy-pasted
// reimplementation (toNode, HEAD_ROLE_TITLES, SUPERIOR_SOURCE, and the
// branch-resolution walk) that had drifted out of sync with the server-side
// version (it was missing wall_slug, which is what sent "View Wall" through
// two redirects). One bad boundary shouldn't fail the whole batch in
// resolveAllBranches below, so the try/catch that used to live inside the
// duplicate stays here instead.
async function resolveBranch(
  supabase: ReturnType<typeof createClient>,
  shape: ShapeRow
): Promise<RepresentationBranch | null> {
  try {
    return await resolveRepresentationBranch(supabase, shape);
  } catch (err) {
    console.error("Error resolving branch:", err);
    return null;
  }
}

interface FindMyDistrictClientProps {
  // Constituency already on file for this account (same source as Elections
  // & Races' initialBoundaries) — lets this screen skip straight to results
  // instead of re-asking for a location every visit.
  initialBoundaries?: MatchedBoundary[];
}

export default function FindMyDistrictClient({ initialBoundaries = [] }: FindMyDistrictClientProps) {
  const { t } = useTranslation();
  const supabase = createClient();
  const guestLocation = useGuestLocation();
  const hasInitialBoundaries = initialBoundaries.length > 0;
  const [boundaries, setBoundaries] = useState<MatchedBoundary[] | null>(
    hasInitialBoundaries ? initialBoundaries : null
  );
  const [branches, setBranches] = useState<RepresentationBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(hasInitialBoundaries);
  const [seatsLoading, setSeatsLoading] = useState(hasInitialBoundaries);
  const [error, setError] = useState("");
  const [selectedLat, setSelectedLat] = useState<number | undefined>(undefined);
  const [selectedLng, setSelectedLng] = useState<number | undefined>(undefined);
  const [seats, setSeats] = useState<SeatWithElections[]>([]);
  // Below md: if we already know the constituency, the map/search picker
  // starts collapsed to a "Change location" pill instead of covering the
  // screen with a GPS-permission overlay on every visit. md+ always shows
  // the full two-column layout — there's room for both there.
  const [pickerOpen, setPickerOpen] = useState(!hasInitialBoundaries);

  const resolveAllBranches = useCallback(
    async (matched: MatchedBoundary[]) => {
      if (matched.length === 0) {
        setBranches([]);
        return;
      }
      setBranchesLoading(true);
      // Filter out polling districts as they're not electoral boundaries
      const boundariesToResolve = matched.filter(
        (b) => !(b.boundary_type || "").toLowerCase().includes("polling")
      );
      const resolvedBranches = await Promise.all(
        boundariesToResolve.map((b) =>
          resolveBranch(supabase, {
            id: b.id,
            name: b.name,
            country: b.country || "",
            boundary_type: b.boundary_type || "",
          } as ShapeRow)
        )
      );
      setBranches(resolvedBranches.filter((b): b is RepresentationBranch => b !== null));
      setBranchesLoading(false);
    },
    [supabase]
  );

  const resolveAllSeats = useCallback(
    async (matched: MatchedBoundary[]) => {
      if (matched.length === 0) {
        setSeats([]);
        return;
      }
      setSeatsLoading(true);
      try {
        // Get shape IDs from matched boundaries, filtering out polling districts
        const shapeIds = matched
          .filter((b) => !(b.boundary_type || "").toLowerCase().includes("polling"))
          .map((b) => b.id);

        if (shapeIds.length === 0) {
          setSeats([]);
          setSeatsLoading(false);
          return;
        }

        // Fetch seats for all boundaries
        const { data: seatsData } = await getActiveSeatsByShapeIds(supabase, shapeIds);
        const seatRows = (seatsData || []) as Array<{
          id: string;
          role_title: string;
          map_shapes?: { name?: string; properties?: unknown } | null;
          elections?: { id: string; name: string; election_date: string; status: string } | null;
        }>;

        if (seatRows.length === 0) {
          setSeats([]);
          setSeatsLoading(false);
          return;
        }

        // Fetch candidate counts for each seat
        const seatIds = seatRows.map((s) => s.id);
        const { data: candidateRows } = await getCandidatesBySeatIds(supabase, seatIds);
        const candidateCountBySeat = new Map<string, number>();
        (candidateRows || []).forEach((c: any) => {
          candidateCountBySeat.set(c.seat_id, (candidateCountBySeat.get(c.seat_id) || 0) + 1);
        });

        // Format seats with candidate counts and preserve elections data
        const formattedSeats = seatRows.map((seat) => ({
          id: seat.id,
          role_title: seat.role_title,
          candidateCount: candidateCountBySeat.get(seat.id) || 0,
          map_shapes: seat.map_shapes || undefined,
          elections: seat.elections || undefined,
        }));

        setSeats(formattedSeats);
      } catch (err) {
        console.error("Error resolving seats:", err);
        setSeats([]);
      } finally {
        setSeatsLoading(false);
      }
    },
    [supabase]
  );

  // Sync initial profile boundaries or guest location from localStorage / cross-tab storage
  useEffect(() => {
    if (hasInitialBoundaries) {
      Promise.resolve().then(() => {
        resolveAllBranches(initialBoundaries);
        resolveAllSeats(initialBoundaries);
      });
    } else if (guestLocation && guestLocation.boundaries.length > 0) {
      setBoundaries(guestLocation.boundaries);
      setSelectedLat(guestLocation.lat);
      setSelectedLng(guestLocation.lng);
      setPickerOpen(false);
      Promise.resolve().then(() => {
        resolveAllBranches(guestLocation.boundaries);
        resolveAllSeats(guestLocation.boundaries);
      });
    } else if (!guestLocation || guestLocation.boundaries.length === 0) {
      setBoundaries(null);
      setBranches([]);
      setSeats([]);
      setPickerOpen(true);
    }
  }, [hasInitialBoundaries, guestLocation, initialBoundaries, resolveAllBranches, resolveAllSeats]);

  const handleLocationSelect = async (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    setLoading(true);
    setError("");
    setBranches([]);
    setSeats([]);
    const { data, error: rpcError } = await findBoundariesByPoint(supabase, lat, lng);
    setLoading(false);
    if (rpcError) {
      setError("Couldn't look up boundaries for that location. Please try again.");
      return;
    }
    const matched = (data as MatchedBoundary[] | null) || [];
    trackFindDistrictCompleted({ found: matched.length > 0, boundaryCount: matched.length });
    setBoundaries(matched);
    if (!hasInitialBoundaries) {
      setGuestLocation({ lat, lng, boundaries: matched });
    }
    await Promise.all([resolveAllBranches(matched), resolveAllSeats(matched)]);
  };

  return (
    <div className="w-full min-h-screen bg-page-bg">
      <MissionRegisterCTA variant="district" nextPath="/find-my-district" />
      {/* Header — compact on mobile (title only, description hidden) so the
          functional search widget is reachable without scrolling past a
          marketing block; full hero treatment returns at sm: and up. */}
      <header className="w-full max-w-7xl mx-auto px-4 pt-3 pb-1 sm:py-4">
        <div className="text-center space-y-1 sm:space-y-2 mb-3 sm:mb-6">
          <h1 className="font-display text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
            {t("findDistrict.title")}
          </h1>
          <p className="hidden sm:block text-text-muted text-sm max-w-2xl mx-auto">
            {t("findDistrict.subtitle")}
          </p>
        </div>
      </header>

      {/* Main Layout - Two Column (Map + Boundaries) — two-up from md: so
          iPad portrait already gets both panels side by side instead of a
          long single-column scroll. */}
      <section className="w-full max-w-7xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mb-8">
          {/* Left Column - Map. Below md, if we already resolved a
              constituency on mount, this starts collapsed behind a
              "Change location" pill instead of forcing the GPS-permission
              overlay in front of results the user already has. md+ always
              shows the map — there's room for it alongside the list. */}
          <div className="space-y-3">
            {!pickerOpen && (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="md:hidden w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-border-light/40 bg-surface-elevated/70 text-sm font-semibold text-text-main"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <MapPin size={15} className="text-primary shrink-0" />
                  <span className="truncate">{t("findDistrict.changeLocation")}</span>
                </span>
                <ChevronDown size={15} className="text-text-muted shrink-0" />
              </button>
            )}
            <div className={pickerOpen ? "space-y-4" : "hidden md:block space-y-4"}>
              <InteractiveLocationPicker
                currentLat={selectedLat}
                currentLng={selectedLng}
                onLocationSelect={handleLocationSelect}
                loading={loading}
                error={error}
                isVisible={pickerOpen}
              />
            </div>
          </div>

          {/* Right Column - Electoral Boundaries */}
          <div className="space-y-4">
            {/* Loading State */}
            {loading && (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            )}

            {/* Boundaries List */}
            {!loading && boundaries && (
              <section className="space-y-3" aria-label="Electoral boundaries at your location">
                {boundaries.length === 0 ? (
                  <Card padding="md" className="text-center text-sm text-text-muted">
                    {t("findDistrict.noBoundaries")}
                  </Card>
                ) : (
                  <>
                    <h2 className="text-base font-bold text-text-main">{t("findDistrict.yourBoundaries")}</h2>
                    <div className="space-y-3">
                      {boundaries.map((b) => (
                        <Link
                          key={b.id}
                          href={`/elections/${buildBoundarySlug(b)}`}
                          className="group flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border-light/40 bg-surface-elevated/70 hover:border-primary/40 hover:bg-surface-hover/40 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-surface/80 border border-border-light/40 flex items-center justify-center shrink-0">
                              <Layers size={16} className="text-primary" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-text-main truncate">{b.name}</p>
                              <p className="text-xs text-text-muted flex items-center gap-1">
                                <MapPin size={10} /> {b.boundary_type} · {b.country}
                              </p>
                            </div>
                          </div>
                          <ArrowRight
                            size={16}
                            className="text-text-muted shrink-0 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary"
                            aria-hidden="true"
                          />
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
          </div>
        </div>

        {/* Full Width - Active Election Nominations CTA (Below Map & Boundaries) */}
        {!loading && boundaries && boundaries.length > 0 && (
          <section className="my-8">
            {seatsLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : seats.length > 0 ? (
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-2 border-primary/30 rounded-2xl p-6 sm:p-8 space-y-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-text-main flex items-center gap-2 mb-2">
                    <Sparkles size={24} className="text-primary" aria-hidden="true" />
                    2026 Candidates in Your Area
                  </h2>
                  <p className="text-sm text-text-muted">Explore the races happening in your electoral boundaries</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {seats.map((seat) => (
                    <Link
                      key={seat.id}
                      href={`/elections/seat/${buildSeatSlug({
                        id: seat.id,
                        role_title: seat.role_title,
                        map_shapes: seat.map_shapes || { name: "", properties: {} },
                      })}`}
                      className="group flex items-start justify-between gap-3 p-4 rounded-lg bg-white/80 hover:bg-primary hover:text-white border border-primary/20 hover:border-primary transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-text-main group-hover:text-white">{seat.role_title}</div>
                        <div className="text-xs text-text-muted group-hover:text-white/70 mt-1 space-y-0.5">
                          {seat.map_shapes?.name && (
                            <div>{seat.map_shapes.name}</div>
                          )}
                          {seat.elections?.election_date && (
                            <div>{formatElectionDate(seat.elections.election_date)}</div>
                          )}
                        </div>
                      </div>
                      <span className="font-bold text-primary group-hover:text-white flex items-center gap-2 text-sm whitespace-nowrap shrink-0">
                        {seat.candidateCount}
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        )}

        {/* Full Width - Chain of Representation (Below CTA) */}
        {!loading && boundaries && boundaries.length > 0 && (
          <section className="space-y-4 border-t border-border-light/40 pt-8" aria-label="Representatives by government level">
            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Network size={20} className="text-primary" aria-hidden="true" />
              Chain of Representation
            </h2>

            {branchesLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : branches.length > 0 ? (
              <BoundaryDirectoryClient
                branches={branches}
                country={boundaries[0]?.country || ""}
                defaultBranchKey="all"
                gated={REP_LIST_GATING_ENABLED}
              />
            ) : (
              <Card padding="md" className="text-center text-sm text-text-muted">
                No office holders data available for the selected boundaries yet.
              </Card>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
