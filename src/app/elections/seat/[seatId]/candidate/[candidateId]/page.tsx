import { Metadata } from "next";
import ElectionSeatPageClient from "@/components/features/ElectionSeatPageClient";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSeatById, getCandidatesBySeatIds } from "@/lib/services/elections";
import { buildSeatSlug, buildCandidateSlug, extractIdFromSlug } from "@/lib/utils/slugs";

const BASE_URL = "https://choseno.com";

interface CandidateSeatPageProps {
  params: Promise<{ seatId: string; candidateId: string }>;
}

export async function generateMetadata({
  params,
}: CandidateSeatPageProps): Promise<Metadata> {
  const { seatId, candidateId } = await params;
  const supabase = await createServerClient();

  const [{ data: seat }, { data: candidates }] = await Promise.all([
    getSeatById(supabase, seatId),
    getCandidatesBySeatIds(supabase, [seatId]),
  ]);

  if (!seat) {
    return {
      title: "Seat Not Found | Choseno",
      description: "The requested election seat could not be found.",
    };
  }

  const selectedCandidate = candidateId
    ? (candidates as any[])?.find(
        (c) => c.id === candidateId || extractIdFromSlug(candidateId) === c.id || buildCandidateSlug(c) === candidateId
      )
    : null;

  const candidateName = selectedCandidate?.display_name || selectedCandidate?.profiles?.full_name;

  const title = candidateName
    ? `${candidateName} (${seat.role_title}) — ${seat.map_shapes?.name || "Electoral Seat"} | Choseno`
    : `${seat.role_title} — ${seat.map_shapes?.name || "Electoral Seat"} | Choseno`;

  const description = selectedCandidate?.statement
    ? selectedCandidate.statement.slice(0, 160)
    : `View candidates, campaign statements, and discussion for ${seat.role_title} in ${seat.map_shapes?.name || "your district"} on Choseno.`;

  const seatSlug = buildSeatSlug(seat);
  const candSlug = selectedCandidate ? buildCandidateSlug(selectedCandidate) : candidateId;

  const canonicalUrl = `${BASE_URL}/elections/seat/${seatSlug}/candidate/${candSlug}`;

  const ogImageUrl = selectedCandidate
    ? `${BASE_URL}/candidacy/${selectedCandidate.id}/opengraph-image`
    : `${BASE_URL}/elections/seat/${seat.id}/opengraph-image`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Choseno",
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function CandidateSeatPage({ params }: CandidateSeatPageProps) {
  const { seatId, candidateId } = await params;
  const supabase = await createServerClient();

  const [{ data: seat }, { data: candidates }] = await Promise.all([
    getSeatById(supabase, seatId),
    getCandidatesBySeatIds(supabase, [seatId]),
  ]);

  const selectedCandidate = candidateId
    ? (candidates as any[])?.find(
        (c) => c.id === candidateId || extractIdFromSlug(candidateId) === c.id || buildCandidateSlug(c) === candidateId
      )
    : null;

  const realCandidateId = selectedCandidate?.id || candidateId;

  return (
    <ElectionSeatPageClient
      seatId={seatId}
      initialSeat={seat}
      initialCandidates={candidates || []}
      initialCandidateId={realCandidateId}
    />
  );
}
