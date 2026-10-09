// Pure copy for the crawlable guide under the /find-my-district finder. The
// finder itself is client-rendered, so without this the page's HTML is a
// heading and a button. Election dates are from Elections BC's 2026 provincial
// election page; hours and ID rules are deliberately not restated here (they
// are Elections BC's to set and change), the answers send people to it instead.
// No I/O.
import type { Faq } from "@/lib/utils/electionPartySeo";

export const ELECTIONS_BC_URLS = {
  whereToVote: "https://elections.bc.ca/voting/where-to-vote/",
  voterId: "https://elections.bc.ca/voting/what-you-need-to-vote/voter-id/",
  waysToVote: "https://elections.bc.ca/voting/ways-to-vote/",
  candidateList: "https://elections.bc.ca/2026-provincial-election/candidate-list/",
} as const;

export function findMyDistrictFaqs(): Faq[] {
  return [
    {
      q: "How do I find out who is running in my riding, ward or district?",
      a: "Enter your address, use your device's location or click the map in the finder above. Choseno matches you to every federal, provincial or state, and municipal boundary you live in, then lists the races and candidates for each. It's free and needs no login.",
    },
    {
      q: "When is the 2026 BC provincial election?",
      a: "Final voting day is Saturday, October 24, 2026, and advance voting runs October 16 to 21, 2026, according to Elections BC. Municipal elections in B.C. are a separate vote on Saturday, October 17, 2026.",
    },
    {
      q: "Where do I vote in the BC election?",
      a: "Elections BC assigns your voting place by address and sends registered voters a Where to Vote card; its Where to Vote tool also looks up advance and final voting places. For many B.C. municipal races, Choseno's race pages list advance and election-day voting places with their dates, nearest first.",
    },
    {
      q: "How do I vote by mail in BC?",
      a: "Elections BC lists October 18, 2026 as the last day to request a vote-by-mail package online or by phone for the provincial election. Check Elections BC for how and when to return it.",
    },
    {
      q: "What ID do I need to vote in BC?",
      a: "Elections BC sets the identification rules for provincial elections. Check its Voter ID page before you go; municipal elections have their own rules, set by each local government.",
    },
    {
      q: "What is the difference between a riding, a ward and an electoral district?",
      a: "They all name the area that elects one representative. \"Riding\" is the Canadian word for a federal or provincial constituency, \"electoral district\" is the formal term used in both Canada and the United States, and a \"ward\" is usually a subdivision of a city or town that elects a councillor.",
    },
    {
      q: "Is Choseno an official source for election information?",
      a: "No. Elections BC and your local election office are the official sources for voting rules, places and results. Choseno is independent and non-partisan: it compiles candidate lists from public sources, including official candidate filings where they are published, and updates them as nominations change.",
    },
  ];
}
