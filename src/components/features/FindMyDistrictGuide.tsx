import Link from "next/link";
import FaqSection from "@/components/features/FaqSection";
import { BC_2026_ELECTION_ID } from "@/lib/constants/electionResearch";
import { hubPath } from "@/lib/utils/electionPartySeo";
import { ELECTIONS_BC_URLS, findMyDistrictFaqs } from "@/lib/utils/findMyDistrictSeo";

const BC_HUB = hubPath({ id: BC_2026_ELECTION_ID, name: "2026 BC Provincial Election" });

// Server-rendered text under the client-side finder, so crawlers (and people
// who scroll before searching) get the answers the finder gives after a lookup.
export default function FindMyDistrictGuide() {
  return (
    <section className="mx-auto max-w-3xl space-y-8 px-4 pb-16 lg:px-8" aria-labelledby="fmd-guide-heading">
      <div className="space-y-3">
        <h2 id="fmd-guide-heading" className="text-xl font-bold text-text-main">
          Who&apos;s running in my riding, and where do I vote?
        </h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          Search your address above to see your riding, ward or district, your elected representatives and the candidates
          running in 2026, and your voting places where they are published. Advance voting in the 2026 BC provincial election
          runs October 16 to 21 and final voting day is Saturday, October 24, 2026.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>
            <Link href={BC_HUB} className="text-primary hover:underline">
              2026 BC provincial election: every candidate and riding
            </Link>
          </li>
          <li>
            <Link href="/elections" className="text-primary hover:underline">
              All 2026 elections and races
            </Link>
          </li>
          <li>
            <a href={ELECTIONS_BC_URLS.whereToVote} className="text-primary hover:underline" rel="noopener noreferrer">
              Elections BC: where to vote
            </a>
          </li>
        </ul>
      </div>
      <FaqSection faqs={findMyDistrictFaqs()} heading="Find your riding, candidates and voting place: common questions" />
    </section>
  );
}
