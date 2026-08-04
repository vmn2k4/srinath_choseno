import { Metadata } from "next";
import ElectionSeatPageClient from "@/components/features/ElectionSeatPageClient";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSeatById, getCandidatesBySeatIds } from "@/lib/services/elections";

const BASE_URL = "https://choseno.com";

interface SeatPageProps {
  params: Promise<{ seatId: string }>;
}

export async function generateMetadata({
  params,
}: SeatPageProps): Promise<Metadata> {
  const { seatId } = await params;
  const supabase = await createServerClient();
  const { data: seat } = await getSeatById(supabase, seatId);

  if (!seat) {
    return {
      title: "Seat Not Found | Choseno",
      description: "The requested election seat could not be found.",
    };
  }

  const title = `${seat.role_title} — ${seat.map_shapes?.name || "Electoral Seat"} | Choseno`;
  const description = `View candidates, campaign statements, and discussion for ${seat.role_title} in ${seat.map_shapes?.name || "your district"} on Choseno.`;
  const canonicalUrl = `${BASE_URL}/elections/seat/${seatId}`;

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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ElectionSeatPage({ params }: SeatPageProps) {
  const { seatId } = await params;
  const supabase = await createServerClient();

  const [{ data: seat }, { data: candidates }] = await Promise.all([
    getSeatById(supabase, seatId),
    getCandidatesBySeatIds(supabase, [seatId]),
  ]);

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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ElectionSeatPageClient
        seatId={seatId}
        initialSeat={seat}
        initialCandidates={candidates || []}
      />
    </>
  );
}
