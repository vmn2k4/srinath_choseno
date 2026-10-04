// Pure SEO copy + structured data for the per-party election pages. Every
// sentence is derived from the real roster numbers (nothing generic), so the
// visible summary, the visible FAQ, and the JSON-LD all say the same true
// thing. No I/O.
import { SITE_URL } from "@/lib/constants/site";
import { buildElectionSlug, buildPartySlug } from "@/lib/utils/slugs";
import {
  UNAFFILIATED_LABEL,
  type PartySummary,
  type PartyView,
  type RosterCandidate,
} from "@/lib/utils/electionParties";

export interface ElectionLite {
  id: string;
  name: string;
  election_date?: string | null;
}

export interface Faq {
  q: string;
  a: string;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function formatElectionDate(d?: string | null): string | null {
  if (!d) return null;
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

/** Meta-description-safe clip: whole words, <= max chars, ends with an ellipsis if cut. */
export function clip(text: string, max = 158): string {
  if (text.length <= max) return text;
  // Prefer ending on a full sentence if one fits in the back half of the budget.
  const sentenceEnd = text.slice(0, max).lastIndexOf(". ");
  if (sentenceEnd > max * 0.5) return text.slice(0, sentenceEnd + 1);
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "")}…`;
}

function joinNames(names: string[], max: number): string {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} and ${rest.toLocaleString()} more` : shown.join(", ");
}

export const hubPath = (e: ElectionLite) => `/elections/e/${buildElectionSlug(e)}`;
export const partyPath = (e: ElectionLite, p: { id: number | null; name: string }) =>
  `${hubPath(e)}/party/${buildPartySlug({ id: p.id, name: p.name })}`;

// ── Hub ─────────────────────────────────────────────────────────────────
export function hubFacts(election: ElectionLite, parties: PartySummary[], total: number, races: number) {
  const named = parties.filter((p) => p.id != null);
  const indep = parties.find((p) => p.id == null);
  const top = named[0];
  const second = named[1];
  const date = formatElectionDate(election.election_date);

  const summary =
    `${plural(total, "candidate")} from ${plural(named.length, "registered party", "registered parties")} ` +
    `are running in the ${election.name}${races ? `, contesting ${plural(races, "race")}` : ""}` +
    `${date ? ` on ${date}` : ""}. ` +
    (top
      ? `${top.name} is running the most candidates (${top.candidates.length}, across ${plural(top.raceCount, "race")})` +
        `${second ? `, followed by ${second.name} (${second.candidates.length})` : ""}. `
      : "") +
    (indep ? `${plural(indep.candidates.length, "candidate")} ${indep.candidates.length === 1 ? "is" : "are"} independent or have no party listed.` : "");

  const faqs: Faq[] = [
    {
      q: `Which parties are running in the ${election.name}?`,
      a: named.length
        ? `${plural(named.length, "party", "parties")} have candidates in the ${election.name}: ${named
            .map((p) => `${p.name} (${p.candidates.length})`)
            .join(", ")}.${indep ? ` ${plural(indep.candidates.length, "candidate")} run as independents or with no party listed.` : ""}`
        : `No party affiliations are listed for candidates in the ${election.name} yet.`,
    },
    {
      q: `Which party is running the most candidates in the ${election.name}?`,
      a: top
        ? `${top.name} is running the most, with ${plural(top.candidates.length, "candidate")} in ${plural(top.raceCount, "race")}${races ? ` out of ${races}` : ""}.`
        : `Party totals will appear here as candidates are confirmed.`,
    },
    {
      q: `How many candidates are running in the ${election.name}?`,
      a: `${plural(total, "candidate")} are running${races ? ` across ${plural(races, "race")}` : ""}${date ? `, with voting on ${date}` : ""}.`,
    },
  ];
  return { summary: summary.trim(), faqs };
}

// ── Party page ──────────────────────────────────────────────────────────
export function partyFacts(election: ElectionLite, party: PartySummary, view: PartyView, races: number) {
  const n = party.candidates.length;
  const coverage = races > 0 ? Math.round((party.raceCount / races) * 100) : 0;
  const topRivals = view.rivals.slice(0, 3);
  const names = party.candidates.map((c) => c.name);

  const rivalSentence = topRivals.length
    ? `It most often faces ${topRivals
        .map((r) => `${r.name} (${plural(r.races, "race")})`)
        .join(", ")}.`
    : "";

  const summary =
    `${party.name} is running ${plural(n, "candidate")} in ` +
    `${races ? `${party.raceCount} of ${races} races (${coverage}%)` : plural(party.raceCount, "race")} in the ${election.name}. ` +
    rivalSentence +
    (view.uncontested.length
      ? ` It has no candidate in ${plural(view.uncontested.length, "race")} so far.`
      : races
      ? " It is contesting every race."
      : "");

  const faqs: Faq[] = [
    {
      q: `Who are the ${party.name} candidates in the ${election.name}?`,
      a: `${party.name} is running ${plural(n, "candidate")}: ${joinNames(names, 25)}.`,
    },
    {
      q: `In how many races is ${party.name} running in the ${election.name}?`,
      a: `${party.name} is running in ${plural(party.raceCount, "race")}${races ? ` out of ${races}, covering ${coverage}% of the election` : ""}.`,
    },
    {
      q: `Who is ${party.name} running against?`,
      a: topRivals.length
        ? `${party.name} candidates most often face ${topRivals
            .map((r) => `${r.name} candidates (${plural(r.races, "race")})`)
            .join(", ")}. See each race below for the full head-to-head.`
        : `${party.name} candidates have no declared opponents yet.`,
    },
  ];
  if (view.uncontested.length > 0) {
    faqs.push({
      q: `Which races is ${party.name} not contesting?`,
      a: `${party.name} has no candidate in ${plural(view.uncontested.length, "race")}, including ${joinNames(
        view.uncontested.map((s) => s.areaName || s.roleTitle),
        15
      )}.`,
    });
  }
  return { summary: summary.trim(), faqs };
}

// ── Structured data ─────────────────────────────────────────────────────
const abs = (path: string) => `${SITE_URL}${path}`;

export const breadcrumb = (items: Array<{ name: string; path: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    ...items.map((it, i) => ({ "@type": "ListItem", position: i + 2, name: it.name, item: abs(it.path) })),
  ],
});

export const faqPage = (faqs: Faq[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});

export function hubJsonLd(election: ElectionLite, parties: PartySummary[], summary: string, faqs: Faq[]) {
  const named = parties.filter((p) => p.id != null);
  return [
    breadcrumb([
      { name: "Elections & Races", path: "/elections" },
      { name: election.name, path: hubPath(election) },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${election.name} — Parties & Candidates`,
      url: abs(hubPath(election)),
      description: summary,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: named.length,
        itemListElement: named.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `${p.name} candidates`,
          url: abs(partyPath(election, p)),
        })),
      },
    },
    faqPage(faqs),
  ];
}

export function partyJsonLd(
  election: ElectionLite,
  party: PartySummary,
  candidates: RosterCandidate[],
  summary: string,
  faqs: Faq[]
) {
  const isIndep = party.id == null;
  return [
    breadcrumb([
      { name: "Elections & Races", path: "/elections" },
      { name: election.name, path: hubPath(election) },
      { name: party.name, path: partyPath(election, party) },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${party.name} candidates — ${election.name}`,
      url: abs(partyPath(election, party)),
      description: summary,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: candidates.length,
        // Capped: a big party is hundreds of people; the page itself lists them all.
        itemListElement: candidates.slice(0, 100).map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Person",
            name: c.name,
            url: abs(c.href),
            ...(isIndep || c.partyName === UNAFFILIATED_LABEL ? {} : { affiliation: { "@type": "Organization", name: party.name } }),
          },
        })),
      },
    },
    faqPage(faqs),
  ];
}
