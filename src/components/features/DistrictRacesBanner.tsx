"use client";

// Auto-locate banner: asks the browser for the visitor's location on load
// (Chrome shows its native permission prompt) and, once granted, replaces the
// generic "Find Your District" promo with the districts they belong to and
// the elections happening in them. Until then -- or if permission is denied,
// unsupported, or the lookup fails -- it renders the original promo in the
// same slot, so the page never has a hole in it.
//
// Only ever displays districts from a fresh GPS fix on this page load -- never
// a previously saved location. Reuses: findBoundariesByPoint (lookup),
// getActiveSeatsWithCandidateCounts
// and DistrictSeatCards (same race cards as /find-my-district).

import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers, MapPin, Sparkles } from "lucide-react";
import FindDistrictPromo from "./FindDistrictPromo";
import DistrictSeatCards, { type DistrictSeat } from "./DistrictSeatCards";
import { createClient } from "@/lib/supabase/client";
import { findBoundariesByPoint } from "@/lib/services/boundaries";
import { getActiveSeatsWithCandidateCounts } from "@/lib/services/elections";
import { recordDistrictLookup, recordDistrictBannerClick } from "@/lib/services/districtLookups";
import { buildBoundarySlug } from "@/lib/utils/slugs";
import { getGuestLocation, setGuestLocation, type MatchedBoundary } from "@/lib/utils/guestLocation";

// Set once the visitor has been asked (and said no / dismissed) this session,
// so navigating between pages doesn't re-prompt on every load.
const ASKED_SESSION_KEY = "choseno_geo_asked";

// Local races first (municipal / school board are the ones people know least
// and are decided closest to home), then soonest election, then provincial,
// federal and state/national.
const LOCAL_RANK = (type?: string | null) => {
  const t = (type || "").toLowerCase();
  if (t.includes("municipal") || t.includes("school") || t.includes("ward") || t.includes("city")) return 0;
  if (t.includes("provincial") || t.includes("state house") || t.includes("state senate")) return 1;
  if (t.includes("federal")) return 2;
  return 3;
};
const sortByRelevance = (rows: DistrictSeat[]) =>
  [...rows].sort(
    (a, b) =>
      LOCAL_RANK((a.map_shapes as { boundary_type?: string } | null | undefined)?.boundary_type) -
        LOCAL_RANK((b.map_shapes as { boundary_type?: string } | null | undefined)?.boundary_type) ||
      (a.elections?.election_date || "").localeCompare(b.elections?.election_date || "") ||
      b.candidateCount - a.candidateCount
  );

const isElectoral = (b: MatchedBoundary) => !(b.boundary_type || "").toLowerCase().includes("polling");

export default function DistrictRacesBanner({
  title,
  description,
  orientation = "horizontal",
  className = "",
}: {
  title?: string;
  description?: string;
  // "vertical" is the narrow side-column layout (e.g. the wall page's right rail).
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  const vertical = orientation === "vertical";
  const supabase = createClient();
  const [loaded, setLoaded] = useState<{ key: string; rows: DistrictSeat[] } | null>(null);
  // Districts from THIS page load's GPS fix only. A location saved earlier
  // (search box, map pin, another page) is deliberately ignored here: a wrong
  // district is worse than showing the Find Your District promo.
  const [boundaries, setBoundaries] = useState<MatchedBoundary[]>([]);
  const boundaryKey = boundaries.map((b) => b.id).join(",");

  // Ask the browser for the real location once per mount. If it's denied,
  // unsupported, times out, or the lookup fails, nothing is set and the
  // promo stays.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    try {
      if (sessionStorage.getItem(ASKED_SESSION_KEY)) return;
    } catch {
      /* storage blocked -- fall through and ask */
    }

    let cancelled = false;
    const locate = () =>
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          const { data, error } = await findBoundariesByPoint(supabase, lat, lng);
          if (cancelled || error) return;
          const matched = ((data as MatchedBoundary[] | null) || []).filter(isElectoral);
          setBoundaries(matched);
          // Only count a lookup (and share the location with the rest of the
          // site) when it's new, so a granted-permission visitor reloading
          // pages isn't logged as a fresh lookup every time.
          const prev = (getGuestLocation()?.boundaries || []).filter(isElectoral).map((b) => b.id).join(",");
          if (prev !== matched.map((b) => b.id).join(",")) {
            setGuestLocation({ lat, lng, boundaries: matched });
            recordDistrictLookup(supabase, { source: "district_banner", method: "gps", boundaryCount: matched.length });
          }
        },
        () => {
          try {
            sessionStorage.setItem(ASKED_SESSION_KEY, "1");
          } catch {
            /* ignore */
          }
        },
        { timeout: 10000, maximumAge: 60 * 1000 }
      );

    // A previously denied permission can't prompt again -- skip straight to the fallback promo.
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          if (status.state !== "denied") locate();
        })
        .catch(locate);
    } else {
      locate();
    }

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Elections happening in the visitor's districts. Results are stored with
  // the boundary key they were fetched for, so "loading" is derived rather
  // than set synchronously inside the effect.
  useEffect(() => {
    if (!boundaryKey) return;
    let cancelled = false;
    getActiveSeatsWithCandidateCounts(supabase, boundaryKey.split(",").map(Number))
      .catch((err) => {
        console.error("Error loading seats for district banner:", err);
        return [] as DistrictSeat[];
      })
      .then((rows) => {
        if (!cancelled) setLoaded({ key: boundaryKey, rows });
      });
    return () => {
      cancelled = true;
    };
  }, [boundaryKey, supabase]);

  const seatsLoading = loaded?.key !== boundaryKey;
  const seats = loaded?.key === boundaryKey ? sortByRelevance(loaded.rows) : [];
  const visibleLimit = vertical ? 4 : 6;
  const visibleSeats = seats.slice(0, visibleLimit);
  const hiddenCount = seats.length - visibleSeats.length;

  if (boundaries.length === 0) {
    return (
      <div className={className}>
        <FindDistrictPromo title={title} description={description} orientation={orientation} />
      </div>
    );
  }

  return (
    <section
      aria-label="Districts and elections in your area"
      className={`rounded-2xl border-2 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent ${vertical ? "p-3.5" : "p-4 sm:p-5"} space-y-3 ${className}`.trim()}
    >
      <h2 className={`${vertical ? "text-base" : "text-lg"} font-black text-text-main flex items-center gap-2`}>
        <Sparkles size={18} className="text-primary" aria-hidden="true" />
        {seatsLoading || seats.length > 0 ? "Races on your ballot" : "Your districts"}
      </h2>

      {seatsLoading ? (
        <p className="text-sm text-text-muted">Loading elections in your area…</p>
      ) : seats.length > 0 ? (
        <>
          <DistrictSeatCards
            variant="banner"
            seats={visibleSeats}
            singleColumn={vertical}
            onSeatClick={(seat) => recordDistrictBannerClick(supabase, { targetType: "seat", targetId: seat.id })}
          />
          {hiddenCount > 0 && (
            <Link href="/find-my-district" className="block text-xs font-semibold text-primary hover:underline">
              + {hiddenCount} more {hiddenCount === 1 ? "race" : "races"} in your area →
            </Link>
          )}
        </>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-text-muted">
          <MapPin size={14} aria-hidden="true" /> No elections are currently open in your districts.
        </p>
      )}

      {/* Districts: supporting info, kept small and last. One line in the wide
          layout (label, chips, change link); stacked in the narrow rail. */}
      <div className={`border-t border-primary/15 pt-2.5 ${vertical ? "" : "flex flex-wrap items-center gap-x-3 gap-y-1.5"}`}>
        {vertical ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Your districts</span>
            <Link href="/find-my-district" className="text-[11px] font-semibold text-primary hover:underline">
              Not right? Change
            </Link>
          </div>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Your districts</span>
        )}
        <ul className={`flex flex-wrap gap-1 ${vertical ? "mt-1.5" : "flex-1"}`}>
          {boundaries.map((b) => (
            <li key={b.id}>
              <Link
                href={`/elections/${buildBoundarySlug(b)}`}
                onClick={() => recordDistrictBannerClick(supabase, { targetType: "boundary", targetId: b.id })}
                title={b.boundary_type}
                className="inline-flex items-center gap-1 rounded-full border border-border-light/40 bg-surface-elevated/70 px-2 py-0.5 text-[11px] font-medium text-text-main hover:border-primary/40 hover:text-primary transition-colors"
              >
                <Layers size={10} className="text-primary" aria-hidden="true" />
                {b.name}
                {!vertical && b.boundary_type && <span className="text-text-muted">· {b.boundary_type}</span>}
              </Link>
            </li>
          ))}
        </ul>
        {!vertical && (
          <Link href="/find-my-district" className="shrink-0 text-[11px] font-semibold text-primary hover:underline">
            Not right? Change
          </Link>
        )}
      </div>
    </section>
  );
}
