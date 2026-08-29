"use client";

// Compact "find your district" card for the homepage hero — sits side by
// side with the headline instead of requiring a trip to /find-my-district.
// Reuses the same services/utils as the full picker (InteractiveLocationPicker,
// FindMyDistrictClient) rather than re-deriving boundary/rep lookups here.

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, Navigation, Loader2, MapPin, ExternalLink, Flag, LogIn } from "lucide-react";
import { Card, Button, Input, Avatar } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { findBoundariesByPoint } from "@/lib/services/boundaries";
import { getOfficeHoldersForShapes } from "@/lib/services/elections";
import { getPoliticianEngagementSummaries } from "@/lib/services/ratings";
import { reportContent, type ReportTargetType } from "@/lib/services/moderation";
import ReportDialog from "../ReportDialog";
import PoliticianEngagementStats from "../PoliticianEngagementStats";
import { buildBoundarySlug } from "@/lib/utils/slugs";
import { geocodeAddressFree, type GeocodeSuggestion } from "@/lib/utils/geocode";
import { trackSearch, trackRepListGateShown, trackRepListGateClicked } from "@/lib/analytics/events";
import { useGuestLocation, getGuestLocation, setGuestLocation, clearGuestLocation, type MatchedBoundary } from "@/lib/utils/guestLocation";
import { ANON_REP_PREVIEW_LIMIT, REP_LIST_GATING_ENABLED } from "@/lib/constants/site";

interface RepRow {
  id: string;
  map_shape_id: number;
  full_name: string;
  photo_url?: string | null;
  election_role_types?: { role_title?: string | null } | null;
  profiles?: {
    id?: string;
    current_ghost_id?: string | null;
    politician_profiles?: { photo_url?: string | null; avatar_url?: string | null; wall_slug?: string | null } | null;
  } | null;
}

type EngagementSummary = { avgRating: number; ratingCount: number; commentCount: number; supporterCount: number };

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

export default function HomeLocateWidget({ className = "" }: { className?: string }) {
  const supabase = createClient();
  const guestLocation = useGuestLocation();
  const { user } = useAuth();
  // Fires the gate impression once per mount -- see BoundaryDirectoryClient's
  // matching gateShownRef for why a dependency array alone isn't enough.
  const gateShownRef = useRef(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState("");
  const [boundaries, setBoundaries] = useState<MatchedBoundary[] | null>(null);
  const [reps, setReps] = useState<RepRow[]>([]);
  const [reportRepId, setReportRepId] = useState<string | null>(null);
  const [engagementSummaries, setEngagementSummaries] = useState<Map<string, EngagementSummary>>(new Map());

  // Batch-fetch supporter/rating/comment summaries for every rep on screen,
  // once per reps list -- same PoliticianEngagementStats widget and
  // getPoliticianEngagementSummaries batch call PoliticianSidebar uses, so
  // the star rating shown here and clicking it to rate is the exact same
  // system as everywhere else, not a new one.
  useEffect(() => {
    const profileIds = reps.map((r) => r.profiles?.id).filter((id): id is string => Boolean(id));
    if (profileIds.length === 0) {
      setEngagementSummaries(new Map());
      return;
    }
    let isMounted = true;
    getPoliticianEngagementSummaries(supabase, profileIds).then(({ data }) => {
      if (!isMounted || !data) return;
      const map = new Map<string, EngagementSummary>();
      (data as any[]).forEach((row) => {
        map.set(row.politician_id, {
          avgRating: row.avg_rating || 0,
          ratingCount: row.rating_count || 0,
          commentCount: row.comment_count || 0,
          supporterCount: row.supporter_count || 0,
        });
      });
      setEngagementSummaries(map);
    });
    return () => {
      isMounted = false;
    };
  }, [reps, supabase]);

  // Component-owned service call (nothing else here plays the "page-level
  // client" role this widget could hand it off to) -- flags a rep row's
  // office_holders record as wrong right from the homepage preview, same
  // report_content() RPC and admin queue as the full directory pages.
  const handleReport = (targetType: ReportTargetType, targetId: string, abuseType: string) =>
    reportContent(supabase, targetType, targetId, abuseType);

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

  // Sync guest location from localStorage / cross-tab storage events
  useEffect(() => {
    const loc = guestLocation || getGuestLocation();
    if (loc && loc.boundaries && loc.boundaries.length > 0) {
      const matched = loc.boundaries.filter(
        (b) => !(b.boundary_type || "").toLowerCase().includes("polling")
      );
      setBoundaries(matched);

      if (matched.length > 0) {
        setLoadingResults(true);
        getOfficeHoldersForShapes(
          supabase,
          matched.map((b) => b.id)
        ).then(({ data: holderRows }) => {
          setReps((holderRows || []) as unknown as RepRow[]);
          setLoadingResults(false);
        }).catch((err) => {
          console.error(err);
          setLoadingResults(false);
        });
      }
    } else if (boundaries !== null && (!loc || loc.boundaries.length === 0)) {
      setBoundaries(null);
      setReps([]);
    }
  }, [guestLocation, supabase]);

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
      (b) => !(b.boundary_type || "").toLowerCase().includes("polling")
    );
    setBoundaries(matched);
    setGuestLocation({ lat, lng, boundaries: matched });

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
    clearGuestLocation();
  };

  const repsFor = (boundaryId: number) => reps.filter((r) => r.map_shape_id === boundaryId);
  const busy = locating || loadingResults;

  // Flipping REP_LIST_GATING_ENABLED to false makes this true for everyone,
  // which short-circuits every gating check below back to the original
  // fully-open behavior -- the old code path never got deleted, just
  // branched around, so no diff needs reverting to turn this off.
  const showFullList = !REP_LIST_GATING_ENABLED || !!user;

  // Signed-out visitors (when gating is enabled) get at most
  // ANON_REP_PREVIEW_LIMIT people total across every boundary combined, not
  // per boundary -- repBudget is a plain closure variable the boundary
  // .map() below reads and mutates as it renders (recomputed fresh every
  // render, not React state). totalRepsAvailable is the real total (not
  // just the first 3 boundaries shown) so the sign-in CTA's count is
  // accurate.
  let repBudget = showFullList ? Infinity : ANON_REP_PREVIEW_LIMIT;
  const totalRepsAvailable = reps.length;
  const gateVisible = !showFullList && totalRepsAvailable > ANON_REP_PREVIEW_LIMIT;

  // Impression side of trackRepListGateClicked below -- fires once per
  // mount (guarded by gateShownRef, not just a dependency array) the first
  // time the gate becomes visible (naturally false until reps loads past
  // the cap, so this never fires before a real location result exists).
  useEffect(() => {
    if (gateVisible && !gateShownRef.current) {
      gateShownRef.current = true;
      trackRepListGateShown({ surface: "home_widget", hiddenCount: totalRepsAvailable - ANON_REP_PREVIEW_LIMIT });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateVisible]);

  return (
    // padding="sm" + a larger override at sm+ (Card's `padding` prop itself
    // isn't responsive) -- p-8 on a ~375px phone was over a fifth of the
    // card's width gone to padding alone before content even started,
    // compounding with the boundary-group box's own padding below it.
    <Card
      variant="hero"
      padding="sm"
      className={`w-full max-w-md text-left sm:!p-6 ${className}`.trim()}
    >
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
                .sort((a, b) => getBoundaryTypeOrder(a.boundary_type || "") - getBoundaryTypeOrder(b.boundary_type || ""))
                .map((b) => {
                  const boundaryReps = repsFor(b.id);
                  const isMunicipal = (b.boundary_type || "").toLowerCase() === "municipal";

                  // For municipal: separate mayor and councillors
                  let displayReps = boundaryReps;
                  let mayor: RepRow | undefined;
                  let councillors: RepRow[] = [];

                  if (isMunicipal) {
                    mayor = boundaryReps.find((r) => (r.election_role_types?.role_title || "").toLowerCase() === "mayor");
                    councillors = boundaryReps.filter((r) => (r.election_role_types?.role_title || "").toLowerCase() !== "mayor");
                    displayReps = mayor ? [mayor, ...councillors.slice(0, 5)] : councillors.slice(0, 6);
                  } else {
                    displayReps = boundaryReps.slice(0, 6);
                  }

                  const cappedReps = displayReps.slice(0, Math.max(0, repBudget));
                  repBudget -= cappedReps.length;

                  // Budget ran out before this boundary got anything to
                  // show -- skip the whole card rather than rendering a
                  // header over an empty list (the combined sign-in CTA
                  // below covers it).
                  if (!showFullList && boundaryReps.length > 0 && cappedReps.length === 0) return null;

                  return (
                    <div
                      key={b.id}
                      className="px-2.5 py-2.5 sm:px-3.5 sm:py-3 rounded-xl border border-border-light/40 bg-surface-elevated/70"
                    >
                      <div className="mb-2">
                        <p className="text-[11px] font-semibold text-text-muted">{b.boundary_type}</p>
                        <p className="text-sm font-bold text-text-main">{b.name}</p>
                      </div>

                      {boundaryReps.length === 0 ? (
                        <p className="text-xs text-text-muted">No office holder data yet.</p>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            {cappedReps.map((rep) => {
                              const wallHref = wallHrefFor(rep);
                              const photo =
                                rep.photo_url ||
                                rep.profiles?.politician_profiles?.photo_url ||
                                rep.profiles?.politician_profiles?.avatar_url ||
                                null;
                              const engagement = rep.profiles?.id ? engagementSummaries.get(rep.profiles.id) : undefined;
                              return (
                                // One compact row: avatar + name/role (truncates, never
                                // wraps) on line one, rating on line two -- View Wall and
                                // report collapse to small fixed-width icon buttons on the
                                // right of line one instead of a dedicated full-width row,
                                // so a person takes ~2 lines instead of ~4 and the name
                                // column gets the width back rather than losing it to a
                                // button that used to span the whole row underneath.
                                <div
                                  key={rep.id}
                                  className="group/rep flex items-center gap-2 rounded-lg py-1 px-1.5 -mx-1.5 hover:bg-surface-hover/40 transition-colors"
                                >
                                  <Avatar src={photo} name={rep.full_name} size="sm" className="shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-1.5">
                                      <p className="text-xs font-bold text-text-main truncate">{rep.full_name}</p>
                                      {rep.election_role_types?.role_title && (
                                        <span className="text-[10px] text-primary font-semibold truncate shrink-0">
                                          {rep.election_role_types.role_title}
                                        </span>
                                      )}
                                    </div>
                                    {rep.profiles?.id && (
                                      <PoliticianEngagementStats
                                        politicianId={rep.profiles.id}
                                        politicianName={rep.full_name}
                                        supporterCount={engagement?.supporterCount ?? 0}
                                        avgRating={engagement?.avgRating ?? 0}
                                        ratingCount={engagement?.ratingCount ?? 0}
                                        commentCount={engagement?.commentCount ?? 0}
                                        size="xs"
                                        className="mt-0.5"
                                      />
                                    )}
                                  </div>
                                  <div className="shrink-0 flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setReportRepId(rep.id)}
                                      className="text-text-muted/40 hover:text-danger opacity-0 group-hover/rep:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
                                      title="Report incorrect information"
                                    >
                                      <Flag size={12} aria-hidden="true" />
                                    </button>
                                    {wallHref && (
                                      <Link
                                        href={wallHref}
                                        className="inline-flex items-center gap-1 h-7 px-2 rounded-full text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/15 transition-colors"
                                        title="View their wall"
                                      >
                                        <ExternalLink size={12} aria-hidden="true" />
                                        <span className="hidden sm:inline">View Wall</span>
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {showFullList && boundaryReps.length > displayReps.length && (
                            <Link
                              href="/find-my-district"
                              className="inline-block mt-2 text-[11px] font-semibold text-primary hover:text-primary-hover transition-colors"
                            >
                              View more →
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              {showFullList && boundaries.length > 3 && (
                <Link
                  href="/find-my-district"
                  className="block text-center text-xs font-semibold text-primary hover:text-primary-hover pt-1"
                >
                  See all {boundaries.length} boundaries &amp; representatives →
                </Link>
              )}
              {gateVisible && (
                <Card padding="sm" className="text-center space-y-1.5 border-primary/20 bg-primary/5">
                  <p className="text-xs font-bold text-text-main">
                    {totalRepsAvailable - ANON_REP_PREVIEW_LIMIT} more representative
                    {totalRepsAvailable - ANON_REP_PREVIEW_LIMIT === 1 ? "" : "s"} in your area
                  </p>
                  <Button
                    as={Link}
                    href="/auth?role=citizen&next=%2Ffind-my-district"
                    onClick={() =>
                      trackRepListGateClicked({ surface: "home_widget", hiddenCount: totalRepsAvailable - ANON_REP_PREVIEW_LIMIT })
                    }
                    variant="primary"
                    size="sm"
                    className="mx-auto"
                  >
                    <LogIn size={13} />
                    Sign In to See the Rest
                  </Button>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {reportRepId && (
        <ReportDialog
          targetType="office_holder"
          targetId={reportRepId}
          onReport={handleReport}
          onClose={() => setReportRepId(null)}
        />
      )}
    </Card>
  );
}
