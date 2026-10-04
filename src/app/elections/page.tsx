import { Metadata } from "next";
import ElectionsPageClient from "@/components/features/ElectionsPageClient";
import FaqSection from "@/components/features/FaqSection";
import JsonLdScript from "@/components/features/JsonLdScript";
import { createPublicClient } from "@/lib/supabase/publicServer";
import { getPublicElectionDirectory, getPublicElectionPlaces } from "@/lib/services/elections";
import { withRetry } from "@/lib/utils/withRetry";
import {
  buildElectionCards,
  buildElectionsIndexFaqs,
  electionsIndexJsonLd,
} from "@/lib/utils/electionsIndexSeo";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

// This page used to call auth.getUser() server-side to decide between a
// personalized (your boundary's seats) or anonymous (platform-wide, capped)
// view -- which meant every visit was fully dynamic, cached or not.
// Personalization now happens client-side instead (ElectionsPageClient's
// own effect, mirroring the pattern already used for its guest-location
// flow): this SSR shell always renders the same anonymous, cacheable view,
// and a signed-in visitor's real boundary-scoped seats replace it
// client-side right after mount using their own session.
//
// The anonymous view is a short list of election cards (one link per election
// hub), not a 300-row seat list: the seat list was sorted by role, so it never
// reached most elections, and it cost a 300-seat + candidates query per render.
export const revalidate = 86400; // daily; /api/revalidate/elections refreshes sooner when the roster changes

const pageTitle = "Who's Running in My Constituency? 2026 Candidates | Choseno";
const pageDescription =
  "See who's running in your riding, ward or district in 2026. Browse every election's candidates, then find your constituency by address or location.";
const shareTitle = "Who's Running in Your Constituency? Every 2026 Candidate | Choseno";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: `${BASE_URL}/elections` },
  openGraph: {
    title: shareTitle,
    description: pageDescription,
    url: `${BASE_URL}/elections`,
    siteName: "Choseno",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/og-elections-v2.jpg`,
        width: 1200,
        height: 630,
        alt: "Know who's on your ballot. Find who's running in your area, compare the candidates and rate who's running. Choseno",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: shareTitle,
    description: pageDescription,
    images: [`${BASE_URL}/og-elections-v2.jpg`],
  },
};

export default async function ElectionsPage() {
  const supabase = await createPublicClient();

  // A failed query throws at runtime so Next keeps serving the last good copy
  // of this page. During `next build` there is no last good copy and one DB
  // blip must not block a deploy (it matters most when deploying a fix during
  // an outage), so only there it degrades to an empty list; the next
  // revalidation restores it.
  const [directory, places] = await Promise.all([
    withRetry(() => getPublicElectionDirectory(supabase)),
    withRetry(() => getPublicElectionPlaces(supabase)),
  ]);
  const loadError = directory.error ?? places.error;
  if (loadError && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error(`elections: failed to load election directory: ${loadError.message}`);
  }
  const cards = buildElectionCards(directory.data ?? [], places.data ?? []);
  const faqs = buildElectionsIndexFaqs(cards);

  return (
    <>
      <JsonLdScript data={electionsIndexJsonLd(cards, faqs)} />
      <ElectionsPageClient elections={cards} />
      <div className="px-4 lg:px-8 pb-16">
        <FaqSection faqs={faqs} heading="Who's running in my constituency? Frequently asked questions" />
      </div>
    </>
  );
}
