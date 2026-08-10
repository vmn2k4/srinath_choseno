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
  title: "2026 Midterm Election Candidates by District | Choseno",
  description:
    "Browse all 2026 U.S. House & Senate candidates by state and district. Read voter ratings, policy stances & constituent reviews. Find who's on your ballot today.",
  alternates: { canonical: `${BASE_URL}/elections` },
  openGraph: {
    title: "2026 Midterm Election Candidates by District | Choseno",
    description:
      "Browse all 2026 U.S. House & Senate candidates by state and district. Read voter ratings, policy stances & constituent reviews. Find who's on your ballot today.",
    url: `${BASE_URL}/elections`,
    siteName: "Choseno",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/elections/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "2026 Midterm Election Candidates by District | Choseno",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "2026 Midterm Election Candidates by District | Choseno",
    description:
      "Browse all 2026 U.S. House & Senate candidates by state and district. Read voter ratings, policy stances & constituent reviews.",
    images: [`${BASE_URL}/elections/opengraph-image`],
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
    const { data: myProfile } = await getProfileRole(supabase, user.id);
    role = myProfile?.role || null;

    const { data: memberships } = await getUserBoundaryMemberships(
      supabase,
      user.id
    );

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
    const res = await getActiveSeats(supabase);
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Active Elections & Races",
    description: "Discover active electoral seats and candidate races on Choseno.",
    url: `${BASE_URL}/elections`,
    numberOfItems: seats.length,
    itemListElement: seats.map((seat, index) => ({
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
