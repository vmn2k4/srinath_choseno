// Pure copy + structured data for the "who is running in my riding" page that
// every election gets (/elections/e/<election>/who-is-running). The noun
// ("riding", "district", "ward"...) is derived from the election's own seats so
// a BC provincial election says "riding", a US midterm says "district". Every
// number comes from the live roster. No I/O.
import { SITE_URL } from "@/lib/constants/site";
import {
  breadcrumb,
  clip,
  faqPage,
  formatElectionDate,
  hubPath,
  plural,
  ridingsPath,
  type ElectionLite,
  type Faq,
} from "@/lib/utils/electionPartySeo";

export interface AreaNoun {
  singular: string;
  plural: string;
  /** Title-cased singular for page titles ("Riding"). */
  title: string;
}

const NOUNS: Record<string, string> = {
  riding: "riding",
  district: "district",
  ward: "ward",
  "school district": "school district",
  municipality: "municipality",
  area: "area",
};

const toNoun = (key: string): AreaNoun => {
  const singular = NOUNS[key] ?? "area";
  return {
    singular,
    plural: singular === "municipality" ? "municipalities" : `${singular}s`,
    title: singular.replace(/\b\w/g, (c) => c.toUpperCase()),
  };
};

interface SeatShapeLite {
  map_shapes?: { boundary_type?: string | null; country?: string | null } | null;
}

/** Whichever kind of area most of the election's seats sit in. */
export function areaNounForSeats(seats: SeatShapeLite[]): AreaNoun {
  const tally = new Map<string, number>();
  for (const s of seats) {
    const type = (s.map_shapes?.boundary_type || "").toLowerCase();
    const country = (s.map_shapes?.country || "").toLowerCase();
    let key = "area";
    if (country === "canada" && /provincial|federal/.test(type)) key = "riding";
    else if (country === "usa" || country === "united states") key = "district";
    else if (/ward/.test(type)) key = "ward";
    else if (/school/.test(type)) key = "school district";
    else if (/municipal/.test(type)) key = "municipality";
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  let best = "area";
  let bestN = 0;
  for (const [k, n] of tally) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return toNoun(best);
}

export const ridingsTitle = (election: ElectionLite, noun: AreaNoun) =>
  `Who's Running in My ${noun.title}? ${election.name} | Choseno`;

export function ridingsFacts(
  election: ElectionLite,
  noun: AreaNoun,
  candidateCount: number,
  raceCount: number,
  partyCount: number
) {
  const date = formatElectionDate(election.election_date);
  const summary =
    `${plural(candidateCount, "candidate")} ${candidateCount === 1 ? "is" : "are"} running in the ${election.name}` +
    `${raceCount ? `, across ${plural(raceCount, "race")}` : ""}${date ? ` on ${date}` : ""}. ` +
    `Find your ${noun.singular} below to see who is on your ballot and which party each candidate represents` +
    `${partyCount ? ` (${plural(partyCount, "party", "parties")} are running candidates)` : ""}.`;

  const faqs: Faq[] = [
    {
      q: `Who is running in my ${noun.singular} in the ${election.name}?`,
      a: `The table above lists every race in the ${election.name} by ${noun.singular}, with each candidate's name and party. Find yours in the list, or enter your address in Choseno's find your district tool to see only the races on your ballot.`,
    },
    {
      q: `How many candidates are running in the ${election.name}?`,
      a: `${plural(candidateCount, "candidate")} are running${raceCount ? ` across ${plural(raceCount, "race")}` : ""}${date ? `, with voting on ${date}` : ""}.`,
    },
    {
      q: `How do I find my ${noun.singular}?`,
      a: `Search your address or use your device's location in Choseno's find your district tool. It matches you to every boundary you live in at once, with no login needed. You can also look for your ${noun.singular} by name in the table above.`,
    },
  ];
  if (date) {
    faqs.push({
      q: `When is the ${election.name}?`,
      a: `Voting in the ${election.name} is on ${date}. Check your official election authority for advance voting, voting hours and ID rules.`,
    });
  }
  return { summary, faqs };
}

/** Leads with the searched phrase; hub descriptions already cover the totals. */
export function ridingsDescription(election: ElectionLite, noun: AreaNoun, candidateCount: number, raceCount: number) {
  const date = formatElectionDate(election.election_date);
  return clip(
    `See who's running in your ${noun.singular} in the ${election.name}${date ? ` (${date})` : ""}. ` +
      `${plural(candidateCount, "candidate")} in ${plural(raceCount, "race")}, listed by ${noun.singular} with each candidate's party.`
  );
}

export function ridingsJsonLd(
  election: ElectionLite,
  noun: AreaNoun,
  summary: string,
  faqs: Faq[],
  races: Array<{ name: string; path: string }>
) {
  const listed = races.slice(0, 100);
  return [
    breadcrumb([
      { name: "Elections & Races", path: "/elections" },
      { name: election.name, path: hubPath(election) },
      { name: `Who's running in my ${noun.singular}`, path: ridingsPath(election) },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `Who's Running in My ${noun.title}? ${election.name}`,
      description: summary,
      url: `${SITE_URL}${ridingsPath(election)}`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: races.length,
        itemListElement: listed.map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: r.name,
          url: `${SITE_URL}${r.path}`,
        })),
      },
    },
    faqPage(faqs),
  ];
}
