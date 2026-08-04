import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { addUnregisteredCandidate } from "./elections";
import { getPoliticalParties } from "./politicalParties";

type Client = SupabaseClient<Database>;

type MapShapeLike = {
  country: string | null;
  boundary_type: string | null;
  code: string | number | null;
  properties: Json | null;
};

// Mirrors scripts/sync_federal_candidates.py's PROVINCE_BY_PREFIX -- the
// 2-digit province prefix on every Canadian federal ED code is fixed and
// well-documented, so PROV/PROVID never need to be stored per-district.
const CA_PROVINCE_BY_PREFIX: Record<number, string> = {
  10: "NL", 11: "PE", 12: "NS", 13: "NB", 24: "QC", 35: "ON",
  46: "MB", 47: "SK", 48: "AB", 59: "BC", 60: "YT", 61: "NT", 62: "NU",
};

// See docs/ELECTION_DATA_SOURCES.md -- each Canadian Provincial upload
// batch carries a property key unique to that province's source data,
// which is how rows under the shared boundary_type='Provincial' get told
// apart (there's no explicit "province" column on map_shapes). Must stay in
// sync with the Edge Function's copy of this same map.
const CA_PROVINCIAL_PROPERTY_SIGNATURE: Record<string, string> = {
  ed_abbreviation: "bc",
  ednameen: "mb",
  ed_id: "on",
  nm_cep: "qc",
  edname2017: "ab",
  con_num: "sk",
  dist_no: "pe",
};

const JURISDICTION_LABELS: Record<string, string> = {
  "ca-federal": "Canada — Federal",
  bc: "British Columbia — Provincial",
  mb: "Manitoba — Provincial",
  on: "Ontario — Provincial",
  qc: "Quebec — Provincial",
  ab: "Alberta — Provincial",
  sk: "Saskatchewan — Provincial",
  pe: "PEI — Provincial",
  "us-federal": "USA — Federal (House)",
  "us-senate": "USA — Federal (Senate)",
};

// USA — Governor + state legislature research findings (see
// docs/ELECTION_DATA_SOURCES.md, "USA — Governor + state legislature").
// Unlike the jurisdictions above, most of these have no live-fetch handler
// built yet -- `url` is always a real, human-viewable official source (so an
// admin can check manually), `hasFetch` is only true once a matching
// Edge Function handler actually exists (see JURISDICTIONS_WITH_FETCH and
// HANDLERS in supabase/functions/fetch-candidates/index.ts). Keyed by
// lowercase USPS state abbreviation (map_shapes.properties.stusps).
const US_STATE_SOURCES: Record<string, { label: string; url: string; hasFetch: boolean }> = {
  al: { label: "Alabama FCPA candidate search", url: "https://fcpa.alabamavotes.gov/PublicSite/Homepage.aspx", hasFetch: false },
  ak: { label: "Alaska Division of Elections candidate list", url: "https://www.elections.alaska.gov/candidates/", hasFetch: false },
  az: { label: "Arizona Secretary of State — Candidate Nominations and Petitions Filed", url: "https://azsos.gov/media/666", hasFetch: false },
  ar: { label: "Arkansas Secretary of State candidate search", url: "https://candidates.arkansas.gov/", hasFetch: false },
  ca: { label: "California Certified List of Candidates", url: "https://elections.cdn.sos.ca.gov/statewide-elections/2026-primary/cert-list-candidates.pdf", hasFetch: false },
  // hasFetch:false despite a working, verified fetchColorado handler existing
  // in the Edge Function -- coloradosos.gov returns 403 specifically to
  // Supabase's Edge Function egress (confirmed live), so the button would
  // just fail every time. Revisit if that WAF posture ever changes.
  co: { label: "Colorado Secretary of State candidate list", url: "https://www.coloradosos.gov/pubs/elections/vote/primaryCandidates.html", hasFetch: false },
  ct: { label: "Connecticut SEEC candidate list", url: "https://seec.ct.gov/ecrisreporting/CandidateListDownLoad.aspx?key=2026CANCSV", hasFetch: true },
  de: { label: "Delaware Dept. of Elections candidate list", url: "https://elections.delaware.gov/candidates/candidatelist/genl_fcddt_2026.html", hasFetch: false },
  fl: { label: "Florida Division of Elections Candidate Tracking System", url: "https://dos.elections.myflorida.com/candidates/", hasFetch: false },
  ga: { label: "Georgia Qualifying Candidate Information", url: "https://mvp.sos.ga.gov/s/qualifying-candidate-information", hasFetch: false },
  hi: { label: "Hawaii Campaign Spending Commission — candidates by ballot name", url: "https://ags.hawaii.gov/campaign/ballot-legal-name/", hasFetch: true },
  id: { label: "Idaho candidate filing search", url: "https://run.voteidaho.gov/search", hasFetch: true },
};

// Jurisdictions with a working live-fetch Edge Function handler (see
// HANDLERS in supabase/functions/fetch-candidates/index.ts). Everything else
// detectJurisdiction can return is "found & documented" but not yet
// automatable -- getCandidateSourceInfoForSeats still offers the manual
// "view official source" link for those, just not the "Fetch candidates"
// button (ElectionsAdmin.jsx only renders that button when status==='active').
const JURISDICTIONS_WITH_FETCH = new Set<string>([
  "ca-federal", "bc", "mb", "on", "qc", "us-federal", "us-senate",
  ...Object.entries(US_STATE_SOURCES)
    .filter(([, s]) => s.hasFetch)
    .flatMap(([abbr]) => [`us-gov-${abbr}`, `us-sen-${abbr}`, `us-hou-${abbr}`]),
]);

// 2-digit Census state FIPS -> USPS abbreviation, for building the "view
// official source" link client-side without an event row (US federal has
// none -- see below). Mirrors STATE_FIPS in
// scripts/sync_us_federal_candidates.py and US_STATE_FIPS in
// supabase/functions/fetch-candidates/index.ts -- keep in sync.
const US_STATE_FIPS: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY", "60": "AS", "66": "GU", "69": "MP",
  "72": "PR", "78": "VI",
};

// FEC cycles are even years -- the "current" one is the next even year at
// or after today. Mirrors currentFecCycle() in
// supabase/functions/fetch-candidates/index.ts -- keep in sync.
function currentFecCycle() {
  const year = new Date().getFullYear();
  return year % 2 === 0 ? year : year + 1;
}

// Which jurisdiction (if any) a seat's boundary belongs to, for official
// candidate-data purposes. Returns null for anything not built yet
// (other provinces, Municipal, US Governor, etc.) -- callers should treat
// that as "no official source available" rather than an error. roleTitle is
// needed for USA's 'State' boundary_type, which Senate and Governor seats
// both attach to -- the map_shape alone can't tell them apart. Must stay in
// sync with detectJurisdiction in
// supabase/functions/fetch-candidates/index.ts.
export function detectJurisdiction(mapShape: MapShapeLike | null, roleTitle?: string | null): string | null {
  if (!mapShape) return null;
  const { country, boundary_type, properties } = mapShape;
  const props = (properties as Record<string, unknown> | null) || null;

  if (country === "Canada" && boundary_type === "Federal") return "ca-federal";
  if (country === "Canada" && boundary_type === "Provincial") {
    for (const [key, jurisdiction] of Object.entries(CA_PROVINCIAL_PROPERTY_SIGNATURE)) {
      if (props && Object.prototype.hasOwnProperty.call(props, key)) return jurisdiction;
    }
    return null;
  }
  if (country === "USA" && boundary_type === "Federal") return "us-federal";
  if (country === "USA" && boundary_type === "State") {
    const stusps = typeof props?.stusps === "string" ? props.stusps.toLowerCase() : undefined;
    if (roleTitle === "U.S. Senator") return "us-senate";
    if (roleTitle === "Governor" && stusps) return `us-gov-${stusps}`;
    return null;
  }
  if (country === "USA" && boundary_type === "State Senate") {
    const stusps = typeof props?.stusps === "string" ? props.stusps.toLowerCase() : undefined;
    return stusps ? `us-sen-${stusps}` : null;
  }
  if (country === "USA" && boundary_type === "State House") {
    const stusps = typeof props?.stusps === "string" ? props.stusps.toLowerCase() : undefined;
    return stusps ? `us-hou-${stusps}` : null;
  }
  return null;
}

export function jurisdictionLabel(jurisdiction: string | null) {
  return (jurisdiction && JURISDICTION_LABELS[jurisdiction]) || jurisdiction;
}

// Shape is a union of two source tables (federal_election_events has
// ev_type but no source_url; provincial_election_events is the reverse) --
// both fields optional here since buildCandidateUrl only ever reads
// whichever one actually applies to the jurisdiction at hand.
type ElectionEvent = {
  id: string | number;
  ev_type?: string | number;
  province?: string;
  name: string;
  source_url?: string;
};

// One "current" event per jurisdiction, in a single pair of queries
// (federal_election_events has no per-province split; provincial_election_events
// covers all four built provinces at once) -- deliberately NOT one query per
// seat, since a single election here can have thousands of seats (e.g. a
// municipal election). Same event-picking order as
// scripts/sync_*_candidates.py's `discover`/pickEvent in the Edge Function --
// keep these in sync.
async function getCurrentEventsByJurisdiction(supabase: Client) {
  const [{ data: fed }, { data: prov }] = await Promise.all([
    // General elections cover every riding; by-elections only cover their own
    // few specific ridings, which isn't tracked structurally anywhere -- a
    // scheduled-but-not-yet-held by-election's event_date can sort above the
    // actual general election's, which would point most ridings at a VIS EV
    // that doesn't recognize them (confirmed live: redirects to a generic
    // "find your district" page instead of showing candidates). Prefer any
    // general election over any by-election first, then most recent.
    supabase
      .from("federal_election_events")
      .select("*")
      .order("is_general", { ascending: false })
      .order("event_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("provincial_election_events")
      .select("*")
      .order("event_date", { ascending: false, nullsFirst: false })
      // Tiebreaker for jurisdictions with no event_date (e.g. Manitoba's
      // history-plus-current dropdown, none dated): the source site lists
      // its current/top event first, and `discover` registers events in
      // that same order -- so the *earliest* discovered_at among undated
      // events is the one most likely to still be live. Verified against
      // real data: Manitoba's currently-open by-election was discovered
      // first, its oldest concluded general election discovered last.
      .order("discovered_at", { ascending: true }),
  ]);

  const byProvince: Record<string, ElectionEvent> = {};
  (prov || []).forEach((e) => {
    if (e.province && !byProvince[e.province]) byProvince[e.province] = e as ElectionEvent;
  });

  return {
    "ca-federal": (fed?.[0] as ElectionEvent) || null,
    bc: byProvince.BC || null,
    mb: byProvince.MB || null,
    on: byProvince.ON || null,
    qc: byProvince.QC || null,
    ab: byProvince.AB || null,
    sk: byProvince.SK || null,
    pe: byProvince.PE || null,
  } as Record<string, ElectionEvent | null>;
}

function buildCandidateUrl(mapShape: MapShapeLike, jurisdiction: string, event: ElectionEvent) {
  if (jurisdiction === "ca-federal") {
    const prefix = String(mapShape.code).slice(0, 2);
    const prov = CA_PROVINCE_BY_PREFIX[Number(prefix)];
    return `https://www.elections.ca/Scripts/vis/Candidates?L=e&ED=${mapShape.code}&EV=${event.id}&EV_TYPE=${event.ev_type}&PROV=${prov}&PROVID=${prefix}&QID=-1&PAGEID=17`;
  }
  // BC/Manitoba/Ontario/Quebec all just link to their event's source page
  // (BC/Manitoba are human-viewable candidate pages; Ontario/Quebec's are
  // the underlying API root, which requires an active election to resolve
  // -- still the accurate reference link either way).
  return event.source_url ?? null;
}

export type CandidateSourceInfo = {
  jurisdiction: string | null;
  status: "unsupported" | "active" | "manual_only" | "no_event" | "error";
  url: string | null;
  label: string;
  eventId?: string;
};

type SeatForSourceLookup = {
  id: string;
  role_title?: string | null;
  map_shapes: MapShapeLike | null;
};

// Batched version for rendering a seat list: one lookup covers every seat
// on the page, however many there are. Returns a Map keyed by seat.id.
export async function getCandidateSourceInfoForSeats(supabase: Client, seats: SeatForSourceLookup[]) {
  const events = await getCurrentEventsByJurisdiction(supabase);
  const result = new Map<string, CandidateSourceInfo>();
  for (const seat of seats) {
    const mapShape = seat.map_shapes;
    const jurisdiction = detectJurisdiction(mapShape, seat.role_title);
    if (!jurisdiction) {
      result.set(seat.id, {
        jurisdiction: null,
        status: "unsupported",
        url: null,
        label: "No official source built for this seat type yet",
      });
      continue;
    }
    const status = (url: string | null): CandidateSourceInfo["status"] =>
      JURISDICTIONS_WITH_FETCH.has(jurisdiction) ? "active" : url ? "manual_only" : "unsupported";

    if (jurisdiction === "us-federal" || jurisdiction === "us-senate") {
      // No event row to look up -- (cycle, office, state[, district]) is
      // already a full, self-describing key (see docs/ELECTION_DATA_SOURCES.md).
      const cycle = currentFecCycle();
      const office = jurisdiction === "us-federal" ? "H" : "S";
      const props = mapShape?.properties as Record<string, unknown> | null;
      const state =
        jurisdiction === "us-federal"
          ? US_STATE_FIPS[String(props?.statefp)]
          : String(mapShape?.code || "").toUpperCase();
      const district = jurisdiction === "us-federal" ? String(mapShape?.code).slice(2) : undefined;
      const label = office === "H" ? `${cycle} U.S. House — ${state}-${district}` : `${cycle} U.S. Senate — ${state}`;
      const url = `https://www.fec.gov/data/candidates/?${new URLSearchParams({
        cycle: String(cycle),
        office,
        state: state || "",
        ...(district ? { district } : {}),
      }).toString()}`;
      result.set(seat.id, { jurisdiction, status: status(url), url, label });
      continue;
    }
    // US Governor/State Senate/State House -- also self-describing (a fixed,
    // researched official-source URL per state, no per-event DB row), unlike
    // every jurisdiction below which needs a discovered/registered event.
    const usStateMatch = /^us-(gov|sen|hou)-(\w+)$/.exec(jurisdiction || "");
    if (usStateMatch) {
      const stusps = usStateMatch[2];
      const entry = US_STATE_SOURCES[stusps];
      if (!entry) {
        result.set(seat.id, {
          jurisdiction,
          status: "unsupported",
          url: null,
          label: "No official source built for this seat type yet",
        });
        continue;
      }
      result.set(seat.id, { jurisdiction, status: status(entry.url), url: entry.url, label: entry.label });
      continue;
    }
    const event = events[jurisdiction];
    if (!event) {
      result.set(seat.id, {
        jurisdiction,
        status: "no_event",
        url: null,
        label: `No known ${jurisdictionLabel(jurisdiction)} election event yet`,
      });
      continue;
    }
    const url = mapShape ? buildCandidateUrl(mapShape, jurisdiction, event) : null;
    result.set(seat.id, { jurisdiction, status: status(url), url, label: event.name, eventId: String(event.id) });
  }
  return result;
}

// Calls the fetch-candidates Edge Function -- the actual live scrape/fetch
// from the official source happens server-side (browsers can't make these
// cross-origin requests, and picking "the current event" needs a DB read
// that stays consistent with the link above regardless of who's asking).
// Returns { candidates: [{name, party}], sourceUrl, eventName, jurisdiction, status }.
export async function fetchOfficialCandidates(supabase: Client, seatId: string) {
  const { data, error } = await supabase.functions.invoke("fetch-candidates", { body: { seatId } });
  if (error) return { status: "error", error: error.message || "Failed to fetch candidates" };
  return data;
}

// Adds one candidate from a fetch-candidates result onto our platform, via
// the existing add_unregistered_candidate RPC (same path election admins
// already use for "running but not registered" candidates). The official
// source only gives us a free-text party name/abbreviation, not one of our
// political_parties rows -- best-effort match it by name for this seat's
// country so the stub profile's party comes through structured when
// possible; falls back to no party rather than guessing wrong.
export async function addFetchedCandidate(
  supabase: Client,
  seatId: string,
  country: string | null,
  candidate: { name: string; party?: string | null }
) {
  let partyId: number | null = null;
  if (candidate.party && country) {
    const { data: parties } = await getPoliticalParties(supabase, { country });
    const needle = candidate.party.trim().toLowerCase();
    const match = (parties || []).find(
      (p) => p.name.toLowerCase() === needle || p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase())
    );
    partyId = match?.id ?? null;
  }
  return addUnregisteredCandidate(supabase, seatId, {
    fullName: candidate.name,
    partyId,
    education: null,
    hometown: null,
    bio: partyId ? null : candidate.party ? `Party (from official source): ${candidate.party}` : null,
  });
}
