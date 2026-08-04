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

const BASE_URL = "https://choseno.com";

export const metadata: Metadata = {
  title: "Active Elections & Races | Choseno",
  description:
    "Discover active elections, open seats, and candidates in your electoral boundaries on Choseno.",
  alternates: { canonical: `${BASE_URL}/elections` },
  openGraph: {
    title: "Active Elections & Races | Choseno",
    description:
      "Discover active elections, open seats, and candidates in your electoral boundaries on Choseno.",
    url: `${BASE_URL}/elections`,
    siteName: "Choseno",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Active Elections & Races | Choseno",
    description:
      "Discover active elections, open seats, and candidates in your electoral boundaries on Choseno.",
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

  return (
    <ElectionsPageClient
      initialSeats={seats}
      initialRole={role}
      initialBoundaries={initialBoundaries}
    />
  );
}
