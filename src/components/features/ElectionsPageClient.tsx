"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Vote,
  MapPin,
  Users,
  ChevronRight,
  ChevronLeft,
  Check,
  Layers,
  Sparkles,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  Card,
  Button,
  EmptyState,
  PageHeader,
  Badge,
  Spinner,
} from "@/components/primitives";
import InteractiveLocationPicker from "./InteractiveLocationPicker";
import { createClient } from "@/lib/supabase/client";
import { buildSeatSlug } from "@/lib/utils/slugs";
import { findBoundariesByPoint } from "@/lib/services/boundaries";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  getActiveSeatsByShapeIds,
  getActiveSeats,
  getCandidatesBySeatIds,
} from "@/lib/services/elections";
import { getProfileRole, getUserBoundaryMemberships } from "@/lib/services/profile";
import {
  useGuestLocation,
  setGuestLocation,
  clearGuestLocation,
} from "@/lib/utils/guestLocation";

export interface SeatWithCandidates {
  id: string;
  role_title: string;
  elections?: { id?: string; name: string; election_date: string } | null;
  map_shapes?: { name: string; boundary_type?: string } | null;
  candidates: unknown[];
}

export interface MatchedBoundary {
  id: number;
  name: string;
  boundary_type?: string;
  country?: string;
}

interface ElectionsPageClientProps {
  initialSeats: SeatWithCandidates[];
  initialRole?: string | null;
  initialBoundaries?: MatchedBoundary[];
}

export default function ElectionsPageClient({
  initialSeats = [],
  initialRole = null,
  initialBoundaries = [],
}: ElectionsPageClientProps) {
  const { t } = useTranslation();
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();
  const guestLocation = useGuestLocation();
  // page.tsx no longer resolves auth server-side (see its comment), so
  // initialBoundaries is always empty on first paint now regardless of who's
  // visiting -- this has to key off the real client-side session instead.
  // While auth itself is still resolving, isGuest stays false so the
  // localStorage guest-location sync below doesn't briefly run for someone
  // who turns out to be signed in.
  const isGuest = !authLoading && !user;

  const [role, setRole] = useState<string | null>(initialRole);
  // A signed-in visitor's real, verified boundary memberships (once the
  // personalization effect below resolves them) -- kept separate from
  // matchedBoundaries so "Reset to Default" can return to the account's own
  // districts instead of always resetting to empty/guest.
  const [accountBoundaries, setAccountBoundaries] = useState<MatchedBoundary[]>(initialBoundaries);
  const [seats, setSeats] = useState<SeatWithCandidates[]>(initialSeats);
  const [loading, setLoading] = useState(false);

  // Renders the seat list windowed instead of dumping every matched seat's
  // DOM (each carries an <h2>) into the page at once -- unscoped/anonymous
  // browsing can return hundreds of active seats platform-wide, which is
  // exactly the crawl-budget/DOM-bloat problem the SEO audit flagged.
  const SEATS_PER_PAGE = 24;
  const [seatsPage, setSeatsPage] = useState(1);

  const [currentLat, setCurrentLat] = useState<number | undefined>(undefined);
  const [currentLng, setCurrentLng] = useState<number | undefined>(undefined);
  const [matchedBoundaries, setMatchedBoundaries] =
    useState<MatchedBoundary[]>(initialBoundaries);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState("");
  const [hasCustomLocation, setHasCustomLocation] = useState(false);
  const [showPicker, setShowPicker] = useState(
    !initialRole || initialBoundaries.length === 0
  );
  // Below lg the finder widget starts collapsed to a small icon pill so the
  // (more important) active-seats list is visible without scrolling — unless
  // there's nothing verified yet, in which case a first-time visitor needs
  // it open to search.
  const [mobileFinderOpen, setMobileFinderOpen] = useState(
    !initialRole || initialBoundaries.length === 0
  );

  const fetchSeatsForBoundaries = useCallback(
    async (boundariesToFetch: MatchedBoundary[]) => {
      setLoading(true);
      setSeatsPage(1);
      try {
        const shapeIds = boundariesToFetch.map((b) => b.id);
        let resSeats: SeatWithCandidates[] = [];

        if (shapeIds.length > 0) {
          const { data: seatRows } = await getActiveSeatsByShapeIds(
            supabase,
            shapeIds
          );
          resSeats = (seatRows || []) as unknown as SeatWithCandidates[];
        } else {
          const { data: seatRows } = await getActiveSeats(supabase);
          resSeats = (seatRows || []) as unknown as SeatWithCandidates[];
        }

        const seatIds = resSeats.map((s) => s.id);
        const candidatesBySeat: Record<string, unknown[]> = {};
        if (seatIds.length > 0) {
          const { data: candidateRows } = await getCandidatesBySeatIds(
            supabase,
            seatIds
          );
          (candidateRows || []).forEach((c: { seat_id: string }) => {
            candidatesBySeat[c.seat_id] = candidatesBySeat[c.seat_id] || [];
            candidatesBySeat[c.seat_id].push(c);
          });
        }

        setSeats(
          resSeats.map((s) => ({
            ...s,
            candidates: candidatesBySeat[s.id] || [],
          }))
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  // Signed-in personalization -- the SSR shell (page.tsx) always renders the
  // anonymous, cacheable platform-wide view now (no more server-side
  // auth.getUser()); a verified account's real role and boundary-scoped
  // seats replace it here right after mount, using the browser's own
  // session. Mirrors the guest-location effect below, just for a real
  // account instead of a localStorage-remembered point.
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      const [{ data: myProfile }, { data: memberships }] = await Promise.all([
        getProfileRole(supabase, user.id),
        getUserBoundaryMemberships(supabase, user.id),
      ]);
      if (cancelled) return;
      setRole(myProfile?.role || null);

      const memRows = (memberships || []) as Array<{
        map_shape_id: number;
        map_shapes?: { id: number; name: string; country?: string; boundary_type?: string } | null;
      }>;
      const boundaries: MatchedBoundary[] = memRows
        .map((m) => m.map_shapes)
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => ({ id: s.id, name: s.name, country: s.country, boundary_type: s.boundary_type }));

      setAccountBoundaries(boundaries);
      setMatchedBoundaries(boundaries);
      setShowPicker(boundaries.length === 0);
      setMobileFinderOpen(boundaries.length === 0);

      if (boundaries.length > 0) {
        await fetchSeatsForBoundaries(boundaries);
      } else {
        // Matches the old server behavior exactly: a verified account with
        // no boundary memberships yet sees an empty list (prompting them to
        // find their district), not the generic platform-wide one.
        setSeats([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, supabase]);

  // Sync with guest location from localStorage / cross-tab storage events
  useEffect(() => {
    if (!isGuest) return;

    if (guestLocation && guestLocation.boundaries.length > 0) {
      setMatchedBoundaries(guestLocation.boundaries);
      setCurrentLat(guestLocation.lat);
      setCurrentLng(guestLocation.lng);
      setHasCustomLocation(true);
      setShowPicker(false);
      setMobileFinderOpen(false);
      fetchSeatsForBoundaries(guestLocation.boundaries);
    } else if (hasCustomLocation && (!guestLocation || guestLocation.boundaries.length === 0)) {
      setMatchedBoundaries([]);
      setCurrentLat(undefined);
      setCurrentLng(undefined);
      setHasCustomLocation(false);
      setShowPicker(true);
      setMobileFinderOpen(true);
      fetchSeatsForBoundaries([]);
    }
  }, [guestLocation, isGuest, fetchSeatsForBoundaries]);

  const handleLocationSelect = async (lat: number, lng: number) => {
    setCurrentLat(lat);
    setCurrentLng(lng);
    setLocLoading(true);
    setLocError("");

    try {
      const { data: boundaries, error: rpcError } = await findBoundariesByPoint(
        supabase,
        lat,
        lng
      );
      if (rpcError) throw rpcError;

      const matched = (boundaries as MatchedBoundary[]) || [];
      setMatchedBoundaries(matched);
      setHasCustomLocation(true);

      if (isGuest) {
        setGuestLocation({ lat, lng, boundaries: matched });
      }

      await fetchSeatsForBoundaries(matched);
    } catch (err: any) {
      console.error(err);
      setLocError("Could not resolve location boundaries.");
    } finally {
      setLocLoading(false);
    }
  };

  const handleResetLocation = async () => {
    // A signed-in visitor resets to their own verified account boundaries
    // (resolved client-side, see the personalization effect above); a guest
    // resets to the empty default, same as before.
    const resetTarget = isGuest ? initialBoundaries : accountBoundaries;

    setHasCustomLocation(false);
    setMatchedBoundaries(resetTarget);
    setCurrentLat(undefined);
    setCurrentLng(undefined);

    if (isGuest) {
      clearGuestLocation();
    }

    await fetchSeatsForBoundaries(resetTarget);
  };

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 flex flex-col gap-6 lg:gap-8">
      <PageHeader icon={Vote} title={t("elections.title")} />

      {role === "normal" && (
        <Card
          padding="sm"
          className="flex items-center justify-between gap-4 flex-wrap"
        >
          <p className="text-sm text-text-secondary">
            {t("elections.runCta")}
          </p>
          <Button as={Link} href="/profile" className="shrink-0">
            {t("elections.runBtn")}
          </Button>
        </Card>
      )}

      {/* Location / Constituency Finder Widget. Below lg it moves after the
          seats list (order-3, vs the seats list's order-2) and starts
          collapsed to a small icon pill — tap to expand into the same full
          widget lg+ always shows. */}
      <div className="order-3 lg:order-2 flex flex-col gap-2">
        {!mobileFinderOpen && (
          <button
            type="button"
            onClick={() => setMobileFinderOpen(true)}
            className="lg:hidden self-start flex items-center gap-1.5 px-3 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold"
          >
            <MapPin size={15} />
            {matchedBoundaries.length > 0
              ? `${matchedBoundaries.length} ${t("elections.verifiedDistricts")}`
              : t("elections.finderTitle")}
          </button>
        )}

        <Card
          padding="sm"
          className={`space-y-3 lg:p-6 lg:space-y-4 lg:block ${mobileFinderOpen ? "" : "hidden"}`}
        >
          <div className="flex items-center justify-between gap-2 lg:gap-4 lg:flex-wrap border-b border-border-light/20 pb-2 lg:pb-4">
            <div className="flex items-center gap-2 lg:gap-2.5 min-w-0">
              <div className="p-1.5 lg:p-2 rounded-lg lg:rounded-xl bg-accent/10 border border-accent/20 text-accent shrink-0">
                <MapPin size={16} className="lg:hidden" />
                <MapPin size={20} className="hidden lg:block" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm lg:text-base font-bold text-text-main truncate lg:whitespace-normal lg:flex lg:items-center lg:gap-2">
                  {t("elections.finderTitle")}
                </h2>
                <p className="hidden lg:block text-xs text-text-muted">
                  {t("elections.finderSubtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPicker(!showPicker)}
                className="gap-1.5 text-xs shrink-0 !px-2.5 !py-1.5 lg:!px-3"
              >
                <Search size={14} />
                <span className="hidden lg:inline">
                  {showPicker ? t("elections.hideSearch") : t("elections.showSearch")}
                </span>
                <span className="lg:hidden">{showPicker ? "Hide" : "Search"}</span>
              </Button>

              {matchedBoundaries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMobileFinderOpen(false)}
                  className="lg:hidden text-text-muted hover:text-text-main p-1.5 cursor-pointer"
                  title="Collapse"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {showPicker && (
          <InteractiveLocationPicker
            currentLat={currentLat}
            currentLng={currentLng}
            onLocationSelect={handleLocationSelect}
            loading={locLoading}
            error={locError}
          />
        )}

        {/* Matched Constituencies Badge Bar */}
        {matchedBoundaries.length > 0 && (
          <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-text-muted uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-accent" /> Verified in{" "}
                {matchedBoundaries.length} electoral district
                {matchedBoundaries.length > 1 ? "s" : ""}
              </p>

              {hasCustomLocation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetLocation}
                  className="text-xs gap-1 py-0.5 px-2"
                >
                  <RotateCcw size={12} /> Reset to Default
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {matchedBoundaries.map((b) => (
                <span
                  key={`mb-${b.id}`}
                  className="px-3 py-1 bg-surface-elevated border border-border-light/40 rounded-xl text-xs font-medium text-text-main flex items-center gap-1.5 shadow-sm"
                >
                  <Check size={12} className="text-accent" /> {b.name}
                  {b.boundary_type && (
                    <span className="text-[10px] text-text-muted font-normal">
                      ({b.boundary_type})
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
        </Card>
      </div>

      {/* Elections & Open Seats List — below lg this renders before the
          finder widget (order-2 vs its order-3) since it's the content
          people actually came for. */}
      {loading ? (
        <div className="order-2 lg:order-3 flex justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : seats.length === 0 ? (
        <div className="order-2 lg:order-3">
          <EmptyState
            icon={Vote}
            title="No Active Elections Found"
            description={
              matchedBoundaries.length > 0
                ? "There are no active elections or open seats currently running for your selected constituency boundaries."
                : "There are no active elections running right now."
            }
          />
        </div>
      ) : (
        <div className="order-2 lg:order-3 space-y-4">
          {(() => {
            const totalSeatsPages = Math.max(1, Math.ceil(seats.length / SEATS_PER_PAGE));
            const validSeatsPage = Math.min(seatsPage, totalSeatsPages);
            const seatsStart = (validSeatsPage - 1) * SEATS_PER_PAGE;
            const pagedSeats = seats.slice(seatsStart, seatsStart + SEATS_PER_PAGE);

            return (
              <>
                <div className="flex items-center justify-between text-xs text-text-muted px-1">
                  <span>
                    Showing {seatsStart + 1}–{Math.min(seatsStart + SEATS_PER_PAGE, seats.length)} of {seats.length} active seat
                    {seats.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {pagedSeats.map((seat) => (
                  <Card
                    key={seat.id}
                    as={Link}
                    href={`/elections/seat/${buildSeatSlug(seat)}`}
                    interactive
                    className="w-full text-left overflow-hidden flex items-center justify-between gap-4 group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-text-muted mb-1">
                        {seat.elections?.name} · {seat.elections?.election_date}
                      </p>
                      <h2 className="text-lg font-bold text-text-main flex items-center gap-2 flex-wrap">
                        {seat.role_title}
                        {seat.map_shapes?.name && (
                          <span className="text-sm font-normal text-text-muted flex items-center gap-1">
                            <MapPin size={13} className="text-accent" />{" "}
                            {seat.map_shapes.name}
                          </span>
                        )}
                      </h2>
                      <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5">
                        <Users size={12} />
                        {seat.candidates.length === 0
                          ? "No candidates yet"
                          : `${seat.candidates.length} candidate${
                              seat.candidates.length !== 1 ? "s" : ""
                            }`}
                      </p>
                    </div>
                    <ChevronRight
                      size={18}
                      className="text-text-darker group-hover:text-primary-light transition-colors shrink-0"
                    />
                  </Card>
                ))}

                {totalSeatsPages > 1 && (
                  <div className="pt-4 flex items-center justify-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSeatsPage((p) => Math.max(1, p - 1))}
                      disabled={validSeatsPage === 1}
                      className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1 disabled:opacity-40"
                    >
                      <ChevronLeft size={14} /> Previous
                    </Button>
                    <span className="px-3 text-xs text-text-muted font-medium">
                      Page {validSeatsPage} of {totalSeatsPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSeatsPage((p) => Math.min(totalSeatsPages, p + 1))}
                      disabled={validSeatsPage === totalSeatsPages}
                      className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1 disabled:opacity-40"
                    >
                      Next <ChevronRight size={14} />
                    </Button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
