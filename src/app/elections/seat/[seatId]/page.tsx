import { Metadata } from "next";
import ElectionSeatPageClient from "@/components/features/ElectionSeatPageClient";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSeatById, getCandidatesBySeatIds } from "@/lib/services/elections";
import { buildSeatSlug, buildCandidateSlug, extractIdFromSlug } from "@/lib/utils/slugs";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

interface SeatPageProps {
  params: Promise<{ seatId: string }>;
  searchParams: Promise<{ candidate?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: SeatPageProps): Promise<Metadata> {
  const { seatId } = await params;
  const { candidate: candidateId } = await searchParams;
  const supabase = await createServerClient();

  const { data: seat } = await getSeatById(supabase, seatId);
  const { data: candidates } = await getCandidatesBySeatIds(
    supabase,
    seat?.id ? [seat.id] : []
  );

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

  const roleTitle = seat.role_title || "Electoral Seat";
  const boundaryName = seat.map_shapes?.name || "District";
  const electionName = seat.elections?.name || "2026 US Midterm Elections";
  const electionYear = seat.elections?.election_date?.slice(0, 4) || "2026";
  const candCount = (candidates as any[])?.length || 0;

  const candidateListNames = (candidates as any[])
    ?.slice(0, 3)
    .map((c) => c.display_name || c.profiles?.full_name)
    .filter(Boolean);

  const topMatchup =
    candidateListNames && candidateListNames.length >= 2
      ? `${candidateListNames[0]} vs. ${candidateListNames[1]}`
      : candidateListNames && candidateListNames.length === 1
      ? candidateListNames[0]
      : "";

  const title = candidateName
    ? `${candidateName} (${roleTitle}, ${boundaryName}) — 2026 Candidate & Voter Ratings | Choseno`
    : topMatchup
    ? `${electionYear} ${roleTitle} (${boundaryName}): ${topMatchup} — Voter Ratings | Choseno`
    : `2026 ${roleTitle} Race (${boundaryName}) — Candidate Roster & Voter Reviews | Choseno`;

  const candidateNamesFormatted =
    candidateListNames && candidateListNames.length > 0
      ? ` Candidates include ${candidateListNames.join(", ")}${candCount > 3 ? ` & ${candCount - 3} others` : ""}.`
      : "";

  const description = selectedCandidate?.statement
    ? selectedCandidate.statement.slice(0, 160)
    : `Who is running for ${roleTitle} in ${boundaryName}?${candidateNamesFormatted} Compare all ${candCount > 0 ? `${candCount} ` : ""}candidates, read policy stances, constituent reviews & ratings on Choseno.`;

  const seatSlug = buildSeatSlug(seat);
  const candSlug = selectedCandidate ? buildCandidateSlug(selectedCandidate) : candidateId;

  const canonicalUrl = candidateId
    ? `${BASE_URL}/elections/seat/${seatSlug}?candidate=${candSlug}`
    : `${BASE_URL}/elections/seat/${seatSlug}`;

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

export default async function ElectionSeatPage({ params }: SeatPageProps) {
  const { seatId } = await params;
  const supabase = await createServerClient();

  const { data: seat } = await getSeatById(supabase, seatId);
  const { data: candidates } = await getCandidatesBySeatIds(
    supabase,
    seat?.id ? [seat.id] : []
  );

  const roleTitle = seat?.role_title || "Electoral Seat";
  const boundaryName = seat?.map_shapes?.name || "District";
  const seatSlug = seat ? buildSeatSlug(seat) : seatId;
  const canonicalUrl = `${BASE_URL}/elections/seat/${seatSlug}`;

  const jsonLd = seat
    ? [
        {
          "@context": "https://schema.org",
          "@type": "ItemPage",
          name: `${roleTitle} Candidates — ${boundaryName}`,
          description: `View candidates, policy positions, and constituent discussion for ${roleTitle} in ${boundaryName}.`,
          url: canonicalUrl,
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
            { "@type": "ListItem", position: 2, name: "Elections & Races", item: `${BASE_URL}/elections` },
            {
              "@type": "ListItem",
              position: 3,
              name: `${roleTitle} (${boundaryName})`,
              item: canonicalUrl,
            },
          ],
        },
      ]
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <ElectionSeatPageClient
        seatId={seatId}
        initialSeat={seat}
        initialCandidates={(candidates as any[]) || []}
      />
    </>
  );
}
