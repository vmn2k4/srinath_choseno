import { Metadata } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";
import ElectionSeatPageClient from "@/components/features/ElectionSeatPageClient";
import { createPublicClient } from "@/lib/supabase/publicServer";
import { getSeatById, getCandidatesBySeatIds } from "@/lib/services/elections";
import { buildSeatSlug, buildCandidateSlug, extractIdFromSlug } from "@/lib/utils/slugs";
import { buildCandidateDescription, buildCandidateTitle } from "@/lib/utils/seatRaceSeo";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

// Same reasoning as the parent seat page (src/app/elections/seat/[seatId]/
// page.tsx) — ElectionSeatPageClient re-fetches with the real session
// client-side regardless of this SSR shell, so an admin previewing a draft
// election just sees a brief loading state instead of instant content.
export const revalidate = 86400; // daily; /api/revalidate/elections refreshes sooner when the roster changes

// Without this export Next renders a dynamic-segment route on every request
// and ignores `revalidate`. An empty list prerenders nothing at build time
// but lets each URL be generated once on first visit, then served from the
// cache (ISR) until `revalidate` expires.
export function generateStaticParams() {
  return [];
}

interface CandidateSeatPageProps {
  params: Promise<{ seatId: string; candidateId: string }>;
}

// generateMetadata and the page component below both need the seat +
// candidates for the same seatId. Deduped via React cache() so it's one
// pair of DB round trips per request instead of two.
const getSeatWithCandidates = cache(async (seatId: string) => {
  const supabase = await createPublicClient();
  const [{ data: seat }, { data: candidates }] = await Promise.all([
    getSeatById(supabase, seatId),
    getCandidatesBySeatIds(supabase, [seatId]),
  ]);
  return { seat, candidates };
});

export async function generateMetadata({
  params,
}: CandidateSeatPageProps): Promise<Metadata> {
  const { seatId, candidateId } = await params;

  const { seat, candidates } = await getSeatWithCandidates(seatId);

  if (!seat) {
    return {
      title: "Seat Not Found | Choseno",
      description: "The requested election seat could not be found.",
      robots: { index: false, follow: false },
    };
  }

  const selectedCandidate = candidateId
    ? (candidates as any[])?.find(
        (c) => c.id === candidateId || extractIdFromSlug(candidateId) === c.id || buildCandidateSlug(c) === candidateId
      )
    : null;

  const candidateName = selectedCandidate?.display_name || selectedCandidate?.profiles?.full_name;

  const seatSlug = buildSeatSlug(seat);
  const candSlug = selectedCandidate ? buildCandidateSlug(selectedCandidate) : candidateId;

  const title = candidateName
    ? buildCandidateTitle({ name: candidateName, roleTitle: seat.role_title, boundaryName: seat.map_shapes?.name })
    : `${seat.role_title} Candidates — ${seat.map_shapes?.name || "Electoral Seat"} | Choseno`;

  const pp = selectedCandidate?.profiles?.politician_profiles;
  const party = Array.isArray(pp?.political_parties) ? pp.political_parties[0] : pp?.political_parties;
  const description = buildCandidateDescription({
    name: candidateName || "This candidate",
    roleTitle: seat.role_title,
    boundaryName: seat.map_shapes?.name,
    party: party?.name ?? null,
    electionName: seat.elections?.name,
    electionDate: seat.elections?.election_date,
    statement: selectedCandidate?.statement || pp?.bio,
  });

  // The candidate's own /candidacy/ page is the one canonical URL for a
  // candidate (it carries the server-rendered bio; this route is the same
  // person inside the seat view). rel=canonical consolidates ranking signals
  // there while this page itself stays exactly as it is for visitors --
  // no redirect, so prev/next, back-to-results and history are untouched.
  const canonicalUrl = selectedCandidate
    ? `${BASE_URL}/candidacy/${candSlug}`
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

  const { seat, candidates } = await getSeatWithCandidates(seatId);

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

  const personSchema = buildPersonSchema(seat, selectedCandidate, seatSlug, candidateSlug);

  return (
    <>
      {personSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema).replace(/</g, "\\u003c") }}
        />
      )}
      <ElectionSeatPageClient
        seatId={seatId}
        initialSeat={seat}
        initialCandidates={candidates || []}
        initialCandidateId={realCandidateId}
      />
    </>
  );
}

// Structured data so search engines can surface the candidate as a known
// Person tied to the office/jurisdiction they're running in, rather than
// just an untyped page. Only emitted once a specific candidate is selected
// (the bare seat view has no single Person to describe).
function buildPersonSchema(
  seat: any,
  candidate: any,
  seatSlug: string,
  candidateSlug: string
) {
  if (!seat || !candidate) return null;

  const candidateName = candidate.display_name || candidate.profiles?.full_name;
  if (!candidateName) return null;

  const pol = candidate.profiles?.politician_profiles;
  const p = Array.isArray(pol) ? pol[0] : pol;
  const avatarUrl = p?.avatar_url;
  const districtName = seat.map_shapes?.name;

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: candidateName,
    url: `${BASE_URL}/elections/seat/${seatSlug}/candidate/${candidateSlug}`,
    ...(avatarUrl ? { image: avatarUrl } : {}),
    ...(candidate.statement ? { description: candidate.statement } : {}),
    jobTitle: `${seat.role_title} Candidate`,
    // Candidate contact details (from politician_profiles, when the
    // person has claimed/filled out a profile) -- so a page about someone
    // running for office can also answer "how do I contact this
    // candidate", not just who they are.
    ...(p?.contact_phone ? { telephone: p.contact_phone } : {}),
    ...(p?.contact_email ? { email: p.contact_email } : {}),
    ...(districtName
      ? {
          affiliation: {
            "@type": "GovernmentOrganization",
            name: `${seat.role_title} — ${districtName}`,
          },
        }
      : {}),
  };
}
