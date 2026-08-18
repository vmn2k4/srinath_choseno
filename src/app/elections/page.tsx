import { Metadata } from "next";
import ElectionsPageClient, {
  SeatWithCandidates,
  MatchedBoundary,
} from "@/components/features/ElectionsPageClient";
import { createPublicClient } from "@/lib/supabase/publicServer";
import { getActiveSeats, getCandidatesBySeatIds } from "@/lib/services/elections";
import { buildSeatSlug } from "@/lib/utils/slugs";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

// This page used to call auth.getUser() server-side to decide between a
// personalized (your boundary's seats) or anonymous (platform-wide, capped)
// view -- which meant every visit was fully dynamic, cached or not.
// Personalization now happens client-side instead (ElectionsPageClient's
// own effect, mirroring the pattern already used for its guest-location
// flow): this SSR shell always renders the same anonymous, cacheable view,
// and a signed-in visitor's real boundary-scoped seats replace it
// client-side right after mount using their own session. Unlike the
// candidate-facing pages (which just re-render the same content on a
// flash), this one visibly SWAPS from the generic list to the personalized
// one for a returning signed-in user -- a real, if brief, UI change worth
// knowing about if it ever needs revisiting.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Track 2026 Election Candidates by District | Choseno",
  description:
    "Explore 2026 U.S., Canada & India election seats by district. Compare candidates, rate policy stances, and read verified constituent reviews before voting.",
  alternates: { canonical: `${BASE_URL}/elections` },
  openGraph: {
    title: "Track All 2026 Candidates. Pitch Stances & Rate Who's Running | Choseno",
    description:
      "Explore 2026 election seats by district. Compare candidates, rate policy stances, and read verified constituent reviews before voting.",
    url: `${BASE_URL}/elections`,
    siteName: "Choseno",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/og-elections.jpg`,
        width: 1200,
        height: 630,
        alt: "Track All 2026 Candidates. Pitch Stances & Rate Who's Running | Choseno",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Track All 2026 Candidates. Pitch Stances & Rate Who's Running | Choseno",
    description:
      "Explore 2026 election seats by district. Compare candidates, rate policy stances, and read verified constituent reviews before voting.",
    images: [`${BASE_URL}/og-elections.jpg`],
  },
};

export default async function ElectionsPage() {
  const supabase = await createPublicClient();

  // Always the anonymous, platform-wide view now (capped — the one branch
  // that can actually run into the hundreds-of-seats crawl-budget problem,
  // see the SEO audit; the render itself is windowed client-side too,
  // ElectionsPageClient, regardless). A signed-in visitor's real
  // boundary-scoped seats replace this client-side right after mount.
  const res = await getActiveSeats(supabase, { limit: 300 });
  const seatRows = res.data as SeatWithCandidates[] | null;
  const role: string | null = null;
  const initialBoundaries: MatchedBoundary[] = [];

  const seatIds = (seatRows || []).map((s) => s.id);
  const candidatesBySeat: Record<string, unknown[]> = {};
  if (seatIds.length > 0) {
    const { data: candidateRows } = await getCandidatesBySeatIds(
      supabase,
      seatIds
    );
    (candidateRows || []).forEach((c: { seat_id: string }) => {
      candidatesBySeat[c.seat_id] = candidatesBySeat[c.seat_id] || [];
      candidatesBySeat[c.seat_id].push(c);
    });
  }

  const seats: SeatWithCandidates[] = (seatRows || []).map((s) => ({
    ...s,
    candidates: candidatesBySeat[s.id] || [],
  }));

  // Cap the schema to the first 30 seats -- previously this dumped every
  // active seat platform-wide (900+ in the unscoped/anonymous case) into a
  // single ItemList, which is what the SEO audit's "908 items in JSON-LD"
  // finding was pointing at. numberOfItems still reports the true total.
  const JSON_LD_ITEM_CAP = 30;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Active Elections & Races",
    description: "Discover active electoral seats and candidate races on Choseno.",
    url: `${BASE_URL}/elections`,
    numberOfItems: seats.length,
    itemListElement: seats.slice(0, JSON_LD_ITEM_CAP).map((seat, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${seat.role_title} — ${seat.map_shapes?.name || ""}`,
      url: `${BASE_URL}/elections/seat/${buildSeatSlug(seat)}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ElectionsPageClient
        initialSeats={seats}
        initialRole={role}
        initialBoundaries={initialBoundaries}
      />
    </>
  );
}
