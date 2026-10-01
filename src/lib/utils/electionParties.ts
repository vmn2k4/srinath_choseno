// Pure helpers behind the per-party election pages: shape the flat
// candidate list into party summaries and per-party head-to-head views.
// No I/O -- the services fetch, the pages call these.
import { parseBioLinks } from "@/lib/utils/bioLinks";
import { buildCandidateSlug, buildPartySlug, buildSeatSlug, UNAFFILIATED_PARTY_SLUG } from "@/lib/utils/slugs";

export const UNAFFILIATED_LABEL = "Independent / No party";

export interface RosterCandidate {
  id: string;
  /** profiles.id -- the politician the Support button writes to */
  profileId: string | null;
  name: string;
  /** Bio prose (the trailing "Links:" line stripped), clipped for hover cards */
  bio: string | null;
  avatarUrl: string | null;
  partyId: number | null;
  partyName: string | null;
  partySlug: string;
  seatId: string;
  roleTitle: string;
  areaName: string;
  href: string;
}

export interface RosterSeat {
  id: string;
  role_title: string;
  map_shapes?: { name?: string; properties?: unknown } | null;
}

type Embedded<T> = T | T[] | null | undefined;
const one = <T,>(v: Embedded<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

// Row shape returned by getElectionCandidatesWithParty (PostgREST embeds).
function clipWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "")}…`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toRosterCandidates(rows: any[]): RosterCandidate[] {
  return rows.map((r) => {
    const seat = one(r.election_seats);
    const shape = one(seat?.map_shapes);
    const profile = one(r.profiles);
    const pp = one(profile?.politician_profiles);
    const rawParty = one(pp?.political_parties);
    // A literal "Independent" party row and a missing party are the same
    // thing to a voter -- one group, not two near-identical cards.
    const party = rawParty && !/^independent$/i.test(rawParty.name || "") ? rawParty : null;
    const name = profile?.full_name || "Candidate";
    const bioText = parseBioLinks(pp?.bio?.trim() || null).text.replace(/\s+/g, " ").trim();
    const seatForSlug = { id: seat?.id, role_title: seat?.role_title, map_shapes: shape };
    return {
      id: r.id,
      profileId: profile?.id ?? null,
      name,
      bio: bioText ? clipWords(bioText, 320) : null,
      avatarUrl: pp?.avatar_url ?? null,
      partyId: party?.id ?? null,
      partyName: party?.name ?? null,
      partySlug: buildPartySlug(party ?? {}),
      seatId: r.seat_id,
      roleTitle: seat?.role_title || "Seat",
      areaName: shape?.name || "",
      href: `/elections/seat/${buildSeatSlug(seatForSlug)}/candidate/${buildCandidateSlug({ id: r.id, profiles: { full_name: name } })}`,
    };
  });
}

// ── Party colors ────────────────────────────────────────────────────────
// Class names are spelled out in full (not built from the hue) so Tailwind
// can see them; the hues themselves are the --color-party-* tokens in
// globals.css.
export const PARTY_TONES = {
  red: { bar: "bg-party-red", text: "text-party-red", soft: "bg-party-red/15", border: "border-party-red/40" },
  blue: { bar: "bg-party-blue", text: "text-party-blue", soft: "bg-party-blue/15", border: "border-party-blue/40" },
  orange: { bar: "bg-party-orange", text: "text-party-orange", soft: "bg-party-orange/15", border: "border-party-orange/40" },
  green: { bar: "bg-party-green", text: "text-party-green", soft: "bg-party-green/15", border: "border-party-green/40" },
  yellow: { bar: "bg-party-yellow", text: "text-party-yellow", soft: "bg-party-yellow/15", border: "border-party-yellow/40" },
  teal: { bar: "bg-party-teal", text: "text-party-teal", soft: "bg-party-teal/15", border: "border-party-teal/40" },
  purple: { bar: "bg-party-purple", text: "text-party-purple", soft: "bg-party-purple/15", border: "border-party-purple/40" },
  pink: { bar: "bg-party-pink", text: "text-party-pink", soft: "bg-party-pink/15", border: "border-party-pink/40" },
  slate: { bar: "bg-party-slate", text: "text-party-slate", soft: "bg-party-slate/15", border: "border-party-slate/40" },
} as const;

export type PartyTone = (typeof PARTY_TONES)[keyof typeof PARTY_TONES];

// Recognizable parties keep their familiar color; everything else gets a
// stable pick from the remaining hues by id so a party never changes color.
const NAME_RULES: Array<[RegExp, keyof typeof PARTY_TONES]> = [
  [/republican/, "red"],
  [/new democratic|\bndp\b/, "orange"],
  [/democrat/, "blue"],
  [/conservative/, "blue"],
  [/green/, "green"],
  [/liberal/, "red"],
  [/libertarian/, "yellow"],
  [/centre\s?bc|centrist/, "teal"],
  [/one\s?bc/, "purple"],
  [/independent|unaffiliated|no affiliation/, "slate"],
];
const FALLBACK_HUES: Array<keyof typeof PARTY_TONES> = ["teal", "purple", "pink", "yellow", "blue", "green", "orange", "red"];

export function partyTone(name: string | null | undefined, id?: number | null): PartyTone {
  if (!name) return PARTY_TONES.slate;
  const lower = name.toLowerCase();
  const hit = NAME_RULES.find(([re]) => re.test(lower));
  if (hit) return PARTY_TONES[hit[1]];
  const seed = id ?? [...lower].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  return PARTY_TONES[FALLBACK_HUES[Math.abs(seed) % FALLBACK_HUES.length]];
}

// ── Summaries ───────────────────────────────────────────────────────────
export interface PartySummary {
  slug: string;
  id: number | null;
  name: string;
  candidates: RosterCandidate[];
  raceCount: number;
}

export function summarizeParties(roster: RosterCandidate[]): PartySummary[] {
  const byParty = new Map<string, PartySummary>();
  for (const c of roster) {
    let p = byParty.get(c.partySlug);
    if (!p) {
      p = { slug: c.partySlug, id: c.partyId, name: c.partyName || UNAFFILIATED_LABEL, candidates: [], raceCount: 0 };
      byParty.set(c.partySlug, p);
    }
    p.candidates.push(c);
  }
  for (const p of byParty.values()) p.raceCount = new Set(p.candidates.map((c) => c.seatId)).size;
  // Biggest party first; the unaffiliated group always sits last.
  return [...byParty.values()].sort((a, b) => {
    if (a.slug === UNAFFILIATED_PARTY_SLUG) return 1;
    if (b.slug === UNAFFILIATED_PARTY_SLUG) return -1;
    return b.candidates.length - a.candidates.length || a.name.localeCompare(b.name);
  });
}

// Only what a chip renders -- the party page serializes every race to the
// client, so keep this lean (a big party is hundreds of races).
export type ChipCandidate = Pick<RosterCandidate, "id" | "profileId" | "name" | "bio" | "avatarUrl" | "partyId" | "partyName" | "href">;

const toChip = (c: RosterCandidate): ChipCandidate => ({
  id: c.id,
  profileId: c.profileId,
  name: c.name,
  bio: c.bio,
  avatarUrl: c.avatarUrl,
  partyId: c.partyId,
  partyName: c.partyName,
  href: c.href,
});

export interface PartyRace {
  seatId: string;
  roleTitle: string;
  areaName: string;
  seatHref: string;
  mine: ChipCandidate[];
  rivals: ChipCandidate[];
}

export interface PartyRival {
  slug: string;
  id: number | null;
  name: string;
  races: number;
}

export interface PartyView {
  races: PartyRace[];
  uncontested: Array<{ seatId: string; roleTitle: string; areaName: string; seatHref: string }>;
  rivals: PartyRival[];
}

export function buildPartyView(roster: RosterCandidate[], seats: RosterSeat[], partySlug: string): PartyView {
  const seatById = new Map(seats.map((s) => [s.id, s]));
  const bySeat = new Map<string, RosterCandidate[]>();
  for (const c of roster) bySeat.set(c.seatId, [...(bySeat.get(c.seatId) || []), c]);

  const seatHref = (id: string) => {
    const s = seatById.get(id);
    return s ? `/elections/seat/${buildSeatSlug(s as Parameters<typeof buildSeatSlug>[0])}` : `/elections/seat/${id}`;
  };
  const byArea = (a: { areaName: string; roleTitle: string }, b: { areaName: string; roleTitle: string }) =>
    a.areaName.localeCompare(b.areaName) || a.roleTitle.localeCompare(b.roleTitle);

  const races: PartyRace[] = [];
  const rivalCounts = new Map<string, PartyRival>();
  for (const [seatId, cands] of bySeat) {
    const mine = cands.filter((c) => c.partySlug === partySlug);
    if (mine.length === 0) continue;
    const rivals = cands
      .filter((c) => c.partySlug !== partySlug)
      .sort((a, b) => a.partySlug.localeCompare(b.partySlug) || a.name.localeCompare(b.name));
    const s = seatById.get(seatId);
    races.push({
      seatId,
      roleTitle: mine[0].roleTitle,
      areaName: s?.map_shapes?.name || mine[0].areaName,
      seatHref: seatHref(seatId),
      mine: mine.map(toChip),
      rivals: rivals.map(toChip),
    });
    for (const slug of new Set(rivals.map((r) => r.partySlug))) {
      const r = rivals.find((x) => x.partySlug === slug)!;
      const cur = rivalCounts.get(slug) || { slug, id: r.partyId, name: r.partyName || UNAFFILIATED_LABEL, races: 0 };
      cur.races += 1;
      rivalCounts.set(slug, cur);
    }
  }
  races.sort(byArea);

  const contested = new Set(races.map((r) => r.seatId));
  const uncontested = seats
    .filter((s) => !contested.has(s.id))
    .map((s) => ({ seatId: s.id, roleTitle: s.role_title, areaName: s.map_shapes?.name || "", seatHref: seatHref(s.id) }))
    .sort(byArea);

  const rivals = [...rivalCounts.values()].sort((a, b) => b.races - a.races || a.name.localeCompare(b.name));
  return { races, uncontested, rivals };
}
