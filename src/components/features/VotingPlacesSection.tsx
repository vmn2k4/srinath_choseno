"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Navigation, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getVotingPlacesForShape, type VotingPlace, type VotingPlaceSchedule } from "@/lib/services/votingPlaces";
import AddToCalendarMenu from "./AddToCalendarMenu";
import { getGuestLocation } from "@/lib/utils/guestLocation";

const INITIAL_COUNT = 5;

// Loader notes that just restate what the schedule rows already show.
const GENERIC_NOTE = /^(advance and election day|election day only|advance voting only)$/i;

// Today in BC (YYYY-MM-DD), so a visitor elsewhere still sees days that are
// upcoming locally; en-CA formats as ISO.
const todayInBC = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Vancouver" });

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function fmtTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hr}:${String(m).padStart(2, "0")}${suffix}` : `${hr}${suffix}`;
}

function fmtDate(d: string) {
  // Parse the parts directly; new Date("YYYY-MM-DD") is UTC and can shift a day.
  const [y, mo, da] = d.split("-").map(Number);
  return new Date(y, mo - 1, da).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function scheduleLine(s: VotingPlaceSchedule) {
  const hours = s.opens_at && s.closes_at ? `${fmtTime(s.opens_at)}–${fmtTime(s.closes_at)}` : "hours TBA";
  return `${fmtDate(s.vote_date)} · ${hours}`;
}

interface Props {
  mapShapeId: number | null | undefined;
  electionDate: string | null | undefined;
  jurisdictionName: string;
  // A location the parent already has (e.g. the pin on Find My District);
  // falls back to the visitor's remembered location.
  initialOrigin?: { lat: number; lng: number } | null;
}

export default function VotingPlacesSection({ mapShapeId, electionDate, jurisdictionName, initialOrigin }: Props) {
  const [places, setPlaces] = useState<VotingPlace[]>([]);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [day, setDay] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"distance" | "name">("distance");

  useEffect(() => {
    if (!mapShapeId || !electionDate) return;
    let cancelled = false;
    getVotingPlacesForShape(createClient(), mapShapeId, electionDate).then(({ data }) => {
      if (cancelled) return;
      // Drop days that have already passed, then places with nothing left to show.
      const today = todayInBC();
      const upcoming = (data || [])
        .map((p) => ({ ...p, voting_place_schedules: p.voting_place_schedules.filter((s) => s.vote_date >= today) }))
        .filter((p) => p.voting_place_schedules.length > 0);
      setPlaces(upcoming);
    });
    // Reuse a location the visitor already shared elsewhere on the site;
    // never prompt for GPS on page load.
    const guest = getGuestLocation();
    if (initialOrigin) setOrigin(initialOrigin);
    else if (guest?.lat != null && guest?.lng != null) setOrigin({ lat: guest.lat, lng: guest.lng });
    return () => {
      cancelled = true;
    };
  }, [mapShapeId, electionDate, initialOrigin?.lat, initialOrigin?.lng]);

  const locate = () => {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Your browser doesn't support location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setGeoError("Couldn't get your location. Showing all voting places instead.");
      },
      { timeout: 10000 }
    );
  };

  // Every upcoming day any place is open, for the day filter chips.
  const days = useMemo(
    () => [...new Set(places.flatMap((p) => p.voting_place_schedules.map((s) => s.vote_date)))].sort(),
    [places]
  );

  const sorted = useMemo(() => {
    const withDist = places
      .map((p) => ({
        // With a day picked, show only that day's hours on each card.
        place: day === "all" ? p : { ...p, voting_place_schedules: p.voting_place_schedules.filter((s) => s.vote_date === day) },
        km: origin && p.lat != null && p.lng != null ? distanceKm(origin.lat, origin.lng, p.lat, p.lng) : null,
      }))
      .filter((x) => x.place.voting_place_schedules.length > 0);
    if (origin && sortBy === "distance") {
      withDist.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    } else {
      withDist.sort((a, b) => a.place.name.localeCompare(b.place.name));
    }
    return withDist;
  }, [places, origin, day, sortBy]);

  if (places.length === 0) return null;

  const visible = showAll ? sorted : sorted.slice(0, INITIAL_COUNT);
  const checked = places.reduce((m, p) => (p.last_checked_at > m ? p.last_checked_at : m), "");

  return (
    <section aria-labelledby="voting-places-heading" className="px-4 lg:px-0 pb-10">
      <h2 id="voting-places-heading" className="font-display text-xl font-bold text-text-main flex items-center gap-2">
        <MapPin size={22} className="text-accent" /> Where to vote in {jurisdictionName}
      </h2>
      <p className="text-sm text-text-secondary mt-1">
        {origin && sortBy === "distance" ? "Closest voting places first." : origin ? "Sorted by name." : "Share your location to see the closest voting place."}
      </p>
      {!origin && (
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Navigation size={16} /> {locating ? "Locating…" : "Find closest to me"}
        </button>
      )}
      {geoError && <p className="mt-2 text-sm text-text-muted">{geoError}</p>}

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by day">
        {["all", ...days].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setDay(d);
              setShowAll(false);
            }}
            aria-pressed={day === d}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              day === d ? "border-accent bg-accent text-white" : "border-border text-text-secondary hover:text-text-main"
            }`}
          >
            {d === "all" ? "All days" : fmtDate(d)}
          </button>
        ))}
      </div>
      {origin && (
        <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
          <span>Sort by</span>
          {(["distance", "name"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSortBy(k)}
              aria-pressed={sortBy === k}
              className={`rounded-full border px-3 py-1 font-semibold ${
                sortBy === k ? "border-accent bg-accent text-white" : "border-border hover:text-text-main"
              }`}
            >
              {k === "distance" ? "Closest" : "Name"}
            </button>
          ))}
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {visible.map(({ place, km }) => {
          const schedules = [...place.voting_place_schedules].sort((a, b) =>
            a.vote_date.localeCompare(b.vote_date)
          );
          const advance = schedules.filter((s) => s.voting_type !== "general");
          const general = schedules.filter((s) => s.voting_type === "general");
          const mapsQuery = place.lat != null && place.lng != null
            ? `${place.lat},${place.lng}`
            : encodeURIComponent(`${place.name} ${place.address ?? ""}`);
          return (
            <li key={place.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-text-main hover:text-accent hover:underline"
                  >
                    {place.name}
                  </a>
                  {place.address && <p className="text-sm text-text-secondary">{place.address}</p>}
                </div>
                {km != null && (
                  <span className="shrink-0 text-sm font-semibold text-accent">
                    {km < 10 ? km.toFixed(1) : Math.round(km)} km
                  </span>
                )}
              </div>
              {[
                { label: "Advance voting", rows: advance },
                { label: "Election day", rows: general },
              ].map(
                ({ label, rows }) =>
                  rows.length > 0 && (
                    <div key={label} className="mt-2 text-sm">
                      <p className="flex items-center gap-1 font-medium text-text-main">
                        <Clock size={13} className="text-accent" /> {label}
                      </p>
                      <ul className="text-text-secondary">
                        {rows.map((s) => (
                          <li key={`${s.voting_type}-${s.vote_date}`}>
                            {scheduleLine(s)}
                            {s.notes ? ` (${s.notes})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
              )}
              {place.notes && !GENERIC_NOTE.test(place.notes) && <p className="mt-2 text-xs text-text-muted">{place.notes}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Get directions
                </a>
                <AddToCalendarMenu
                  options={schedules.map((sc) => ({
                    label: `${scheduleLine(sc)} · ${sc.voting_type === "general" ? "Election day" : "Advance"}`,
                    event: {
                      title: `Vote: ${place.name}`,
                      date: sc.vote_date,
                      opensAt: sc.opens_at,
                      closesAt: sc.closes_at,
                      location: [place.name, place.address].filter(Boolean).join(", "),
                      description: `${sc.voting_type === "general" ? "Election day" : "Advance voting"} at ${place.name} (${jurisdictionName}). Bring ID. Confirm hours with your local government. Find more at https://www.choseno.com/find-my-district`,
                    },
                  }))}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {sorted.length > INITIAL_COUNT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-sm font-medium text-accent hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${sorted.length} voting places`}
        </button>
      )}
      <p className="mt-4 text-xs text-text-muted">
        Collected from {jurisdictionName}&apos;s official election information
        {checked ? `, last checked ${checked.slice(0, 10)}` : ""}. Locations and hours can change — confirm with your
        local government before you go.
      </p>
    </section>
  );
}
