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

  const title = candidateName
    ? `${candidateName} (${seat.role_title}) — ${seat.map_shapes?.name || "Electoral Seat"} | Choseno`
    : `${seat.role_title} — ${seat.map_shapes?.name || "Electoral Seat"} | Choseno`;

  const description = selectedCandidate?.statement
    ? selectedCandidate.statement.slice(0, 160)
    : `View candidates, campaign statements, and discussion for ${seat.role_title} in ${seat.map_shapes?.name || "your district"} on Choseno.`;

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

  const jsonLd = seat
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Elections", item: `${BASE_URL}/elections` },
          {
            "@type": "ListItem",
            position: 2,
            name: `${seat.role_title} — ${seat.map_shapes?.name || ""}`,
            item: `${BASE_URL}/elections/seat/${seatId}`,
          },
        ],
      }
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
        seatId={seat?.id || seatId}
        initialSeat={seat}
        initialCandidates={candidates || []}
      />
    </>
  );
}
