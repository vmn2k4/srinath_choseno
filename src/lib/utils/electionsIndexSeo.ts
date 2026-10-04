// Pure SEO copy + structured data for the /elections landing page. Every
// number is derived from the live election summary (nothing generic), so the
// visible cards, the visible FAQ and the JSON-LD all say the same true thing.
// No I/O.
import { SITE_URL } from "@/lib/constants/site";
import type { PublicElectionDirectoryRow, PublicElectionPlaceRow } from "@/lib/services/elections";
import { buildBoundarySlug } from "@/lib/utils/slugs";
import {
  breadcrumb,
  faqPage,
  formatElectionDate,
  hubPath,
  plural,
  type Faq,
} from "@/lib/utils/electionPartySeo";

export interface ElectionPlaceLink {
  name: string;
  href: string;
  candidateCount: number;
}

export interface ElectionCardData {
  id: string;
  name: string;
  dateLabel: string | null;
  seatCount: number;
  candidateCount: number;
  /** Null while an election has no published candidates: its hub is noindex
   *  until then, so the card isn't a link. */
  href: string | null;
  /** Biggest races by candidate count, linking to each place's page. */
  places: ElectionPlaceLink[];
}

export function buildElectionCards(
  rows: PublicElectionDirectoryRow[],
  places: PublicElectionPlaceRow[] = []
): ElectionCardData[] {
  const placesByElection = new Map<string, ElectionPlaceLink[]>();
  for (const p of places) {
    const list = placesByElection.get(p.election_id) ?? [];
    list.push({
      name: p.place_name,
      href: `/elections/${buildBoundarySlug({ id: p.shape_id, name: p.place_name })}`,
      candidateCount: p.candidate_count,
    });
    placesByElection.set(p.election_id, list);
  }
  return rows.map((r) => ({
    id: r.election_id,
    name: r.election_name,
    dateLabel: formatElectionDate(r.election_date),
    seatCount: r.seat_count,
    candidateCount: r.candidate_count,
    href:
      r.candidate_count > 0
        ? hubPath({ id: r.election_id, name: r.election_name, election_date: r.election_date })
        : null,
    places: placesByElection.get(r.election_id) ?? [],
  }));
}

export function buildElectionsIndexFaqs(cards: ElectionCardData[]): Faq[] {
  const withCandidates = cards.filter((c) => c.candidateCount > 0);

  const scheduleLines = withCandidates
    .filter((c) => c.dateLabel)
    .map(
      (c) =>
        `${c.name}: ${c.dateLabel} (${plural(c.candidateCount, "candidate")} in ${plural(c.seatCount, "race")})`
    );

  const faqs: Faq[] = [
    {
      q: "Who is running in my constituency?",
      a:
        "Use the finder on this page: search your address or share your location and Choseno matches you to every riding, ward and district you live in, then lists the races and candidates for each. " +
        (withCandidates.length
          ? `You can also open any of the ${plural(withCandidates.length, "election")} listed above to browse all of its candidates.`
          : "You can also open an election above to browse all of its candidates."),
    },
    {
      q: "How do I find my riding, ward or electoral district?",
      a: "Search your address or use your device's location in the finder above. Choseno maps you to your federal, provincial or state, and municipal boundaries at once, with no login needed.",
    },
  ];

  if (scheduleLines.length) {
    faqs.push({
      q: "When are the 2026 elections?",
      a: `${scheduleLines.join("; ")}.`,
    });
  }

  faqs.push(
    {
      q: "What is the difference between a constituency, riding, ward and district?",
      a: "They all name the area that elects one representative. \"Constituency\" is the general term. \"Riding\" is the Canadian word for a federal or provincial constituency. A \"ward\" is usually a subdivision of a city or town that elects a councillor, and \"district\" is common in the United States (congressional and school districts) and is also used in Canada.",
    },
    {
      q: "Where do the candidate lists come from?",
      a: "Choseno compiles candidate lists from public election sources, including official candidate filings where they are published, and updates them as nominations change. Always confirm with your official election authority before you vote.",
    }
  );

  return faqs;
}

export function electionsIndexJsonLd(cards: ElectionCardData[], faqs: Faq[]) {
  const linked = cards.filter((c) => c.href);
  return [
    breadcrumb([{ name: "Elections & Races", path: "/elections" }]),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Who's Running in My Constituency? 2026 Candidates",
      url: `${SITE_URL}/elections`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: linked.length,
        itemListElement: linked.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          url: `${SITE_URL}${c.href}`,
        })),
      },
    },
    faqPage(faqs),
  ];
}
