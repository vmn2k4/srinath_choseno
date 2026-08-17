import { Metadata } from "next";
import ElectionsPageClient, {
  SeatWithCandidates,
  MatchedBoundary,
} from "@/components/features/ElectionsPageClient";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveSeatsByShapeIds,
  getActiveSeats,
  getCandidatesBySeatIds,
} from "@/lib/services/elections";
import {
  getProfileRole,
  getUserBoundaryMemberships,
} from "@/lib/services/profile";
import { buildSeatSlug } from "@/lib/utils/slugs";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  let seatRows: SeatWithCandidates[] | null = null;
  let initialBoundaries: MatchedBoundary[] = [];

  if (user) {
    const [{ data: myProfile }, { data: memberships }] = await Promise.all([
      getProfileRole(supabase, user.id),
      getUserBoundaryMemberships(supabase, user.id),
    ]);
    role = myProfile?.role || null;

    const memRows = (memberships || []) as Array<{
      map_shape_id: number;
      map_shapes?: {
        id: number;
        name: string;
        country?: string;
        boundary_type?: string;
      } | null;
    }>;

    initialBoundaries = memRows
      .map((m) => m.map_shapes)
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({
        id: s.id,
        name: s.name,
        country: s.country,
        boundary_type: s.boundary_type,
      }));

    const shapeIds = initialBoundaries.map((b) => b.id);

    if (shapeIds.length > 0) {
      const res = await getActiveSeatsByShapeIds(supabase, shapeIds);
      seatRows = res.data as SeatWithCandidates[] | null;
    } else {
      seatRows = [];
    }
  } else {
    // Anonymous/no-boundary view — platform-wide, so it's the one branch
    // that can actually run into the hundreds-of-seats crawl-budget problem
    // (see the SEO audit). Capped here as a payload safety net; the render
    // itself is windowed client-side (ElectionsPageClient) regardless.
    const res = await getActiveSeats(supabase, { limit: 300 });
    seatRows = res.data as SeatWithCandidates[] | null;
  }

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
