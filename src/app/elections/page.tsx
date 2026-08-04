import { Metadata } from "next";
import Link from "next/link";
import { Vote, MapPin, Users, ChevronRight } from "lucide-react";
import { Card, Button, EmptyState, PageHeader } from "@/components/primitives";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveSeatsByShapeIds,
  getActiveSeats,
  getCandidatesBySeatIds,
} from "@/lib/services/elections";
import { getProfileRole, getUserBoundaryShapeIds } from "@/lib/services/profile";

const BASE_URL = "https://choseno.com";

export const metadata: Metadata = {
  title: "Active Elections | Choseno",
  description:
    "Discover active elections and open seats in your electoral boundaries on Choseno.",
  alternates: { canonical: `${BASE_URL}/elections` },
  openGraph: {
    title: "Active Elections | Choseno",
    description:
      "Discover active elections and open seats in your electoral boundaries on Choseno.",
    url: `${BASE_URL}/elections`,
    siteName: "Choseno",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Active Elections | Choseno",
    description:
      "Discover active elections and open seats in your electoral boundaries on Choseno.",
  },
};

interface SeatWithCandidates {
  id: string;
  role_title: string;
  elections?: { name: string; election_date: string } | null;
  map_shapes?: { name: string } | null;
  candidates: unknown[];
}

export default async function ElectionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  let seatRows: SeatWithCandidates[] | null = null;

  if (user) {
    const { data: myProfile } = await getProfileRole(supabase, user.id);
    role = myProfile?.role || null;

    const { data: memberships } = await getUserBoundaryShapeIds(supabase, user.id);
    const shapeIds = ((memberships || []) as Array<{ map_shape_id: number }>).map(
      (m) => m.map_shape_id
    );

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
    const { data: candidateRows } = await getCandidatesBySeatIds(supabase, seatIds);
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
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-8">
      <PageHeader icon={Vote} title="Elections" />

      {role === "normal" && (
        <Card padding="sm" className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-text-secondary">
            Interested in serving your community? Switch to candidate mode to file
            your candidacy.
          </p>
          <Button as={Link} href="/profile" className="shrink-0">
            Run for Office
          </Button>
        </Card>
      )}

      {seats.length === 0 ? (
        <EmptyState
          icon={Vote}
          title="No Active Elections"
          description="There's no election running right now for any group you belong to."
        />
      ) : (
        <div className="space-y-4">
          {seats.map((seat) => (
            <Card
              key={seat.id}
              as={Link}
              href={`/elections/seat/${seat.id}`}
              interactive
              className="w-full text-left overflow-hidden flex items-center justify-between gap-4 group"
            >
              <div className="min-w-0">
                <p className="text-xs text-text-muted mb-1">
                  {seat.elections?.name} · {seat.elections?.election_date}
                </p>
                <h2 className="text-lg font-bold text-text-main flex items-center gap-2 flex-wrap">
                  {seat.role_title}
                  <span className="text-sm font-normal text-text-muted flex items-center gap-1">
                    <MapPin size={13} className="text-accent" /> {seat.map_shapes?.name}
                  </span>
                </h2>
                <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5">
                  <Users size={12} />
                  {seat.candidates.length === 0
                    ? "No candidates yet"
                    : `${seat.candidates.length} candidate${seat.candidates.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <ChevronRight
                size={18}
                className="text-text-darker group-hover:text-primary-light transition-colors shrink-0"
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
