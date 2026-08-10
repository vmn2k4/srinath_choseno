import { Metadata } from "next";
import { redirect } from "next/navigation";
import ElectionSeatPageClient from "@/components/features/ElectionSeatPageClient";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSeatById, getCandidatesBySeatIds } from "@/lib/services/elections";
import { buildSeatSlug, buildCandidateSlug, buildPoliticianWallSlug, extractIdFromSlug } from "@/lib/utils/slugs";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

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
  const roleTitle = seat.role_title || "Office";
  const ghostId = selectedCandidate?.profiles?.current_ghost_id;

  const seatSlug = buildSeatSlug(seat);
  const candSlug = selectedCandidate ? buildCandidateSlug(selectedCandidate) : candidateId;

  const title = candidateName
    ? `${candidateName} (${seat.role_title}, ${seat.map_shapes?.name || "District"}) — Voter Ratings & Stances`
    : `${seat.role_title} Candidates — ${seat.map_shapes?.name || "Electoral Seat"} | Choseno`;

  const description = selectedCandidate?.statement
    ? `${selectedCandidate.statement.slice(0, 140)} — See voter ratings & constituent discussion on Choseno.`
    : `What do voters think of ${candidateName || "this candidate"}? Read constituent feedback, policy stances, and ratings for ${seat.role_title} on Choseno.`;

  const canonicalUrl = ghostId
    ? `${BASE_URL}/wall/${buildPoliticianWallSlug(candidateName, roleTitle)}`
    : `${BASE_URL}/elections/seat/${seatSlug}/candidate/${candSlug}`;

  const ogImageUrl = selectedCandidate
    ? `${BASE_URL}/candidacy/${selectedCandidate.id}/opengraph-image`
    : `${BASE_URL}/elections/seat/${seatSlug}/opengraph-image`;

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
  const seatSlug = seat ? buildSeatSlug(seat) : seatId;
  const candidateSlug = selectedCandidate ? buildCandidateSlug(selectedCandidate) : candidateId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(seatId);
  if (seat && isUuid && seatSlug !== seatId) {
    redirect(`/elections/seat/${seatSlug}/candidate/${candidateSlug}`);
  }

  return (
    <ElectionSeatPageClient
      seatId={seatId}
      initialSeat={seat}
      initialCandidates={candidates || []}
      initialCandidateId={realCandidateId}
    />
  );
}
