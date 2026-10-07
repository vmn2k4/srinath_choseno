// Reader-research articles linked from the BC 2026 election pages. Slugs are
// the source of truth; titles/blurbs are static so the election hub, party
// pages and the explainer article render them without an extra DB read.
// Add a leader's pair here and the matching party id below to surface it.

export const BC_2026_ELECTION_ID = "0832d7b5-e607-4342-8eb3-8ca25db70d9a";

export interface ElectionResearchLink {
  slug: string;
  title: string;
  blurb: string;
}

const EBY_SUPPORT: ElectionResearchLink = {
  slug: "why-people-support-david-eby-bc-election-2026",
  title: "Why people support David Eby",
  blurb: "Housing, health care, cost of living and keeping the Conservatives out.",
};
const EBY_OPPOSE: ElectionResearchLink = {
  slug: "why-people-oppose-david-eby-bc-election-2026",
  title: "Why people don't support David Eby",
  blurb: "The snap election, the $190K tax bracket, deficit and leadership doubts.",
};
const DOERKSON_SUPPORT: ElectionResearchLink = {
  slug: "why-people-support-lorne-doerkson-bc-election-2026",
  title: "Why people support Lorne Doerkson",
  blurb: "Anger at the NDP, a steady image and a push for fiscal restraint.",
};
const DOERKSON_OPPOSE: ElectionResearchLink = {
  slug: "why-people-oppose-lorne-doerkson-bc-election-2026",
  title: "Why people don't support Lorne Doerkson",
  blurb: "The Human Rights Code vote, candidate controversies and interim leadership.",
};

const INFORMED_VOTE_GUIDE: ElectionResearchLink = {
  slug: "bc-provincial-snap-election-2026-informed-vote",
  title: "Why an informed vote matters",
  blurb: "Your guide to the Oct. 24 snap election, with links to every explainer.",
};

export const BC_2026_RESEARCH_LINKS: ElectionResearchLink[] = [
  INFORMED_VOTE_GUIDE,
  EBY_SUPPORT,
  EBY_OPPOSE,
  DOERKSON_SUPPORT,
  DOERKSON_OPPOSE,
];

// political_parties.id -> that party leader's research pair.
const BC_2026_PARTY_RESEARCH: Record<number, { heading: string; links: ElectionResearchLink[] }> = {
  3: { heading: "What voters say about David Eby and the NDP", links: [EBY_SUPPORT, EBY_OPPOSE] },
  2: { heading: "What voters say about Lorne Doerkson and the Conservatives", links: [DOERKSON_SUPPORT, DOERKSON_OPPOSE] },
};

export function getPartyResearch(electionId: string, partyId: number | null | undefined) {
  if (electionId !== BC_2026_ELECTION_ID || partyId == null) return null;
  return BC_2026_PARTY_RESEARCH[partyId] ?? null;
}
