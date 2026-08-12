import { Metadata } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";
import ElectionSeatPageClient from "@/components/features/ElectionSeatPageClient";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSeatById, getCandidatesBySeatIds } from "@/lib/services/elections";
import {
  buildSeatSlug,
  buildCandidateSlug,
  buildPoliticianWallSlug,
  extractIdFromSlug,
} from "@/lib/utils/slugs";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

interface SeatPageProps {
  params: Promise<{ seatId: string }>;
  searchParams: Promise<{ candidate?: string }>;
}

// generateMetadata and the page component below both need the seat +
// candidates for the same seatId. Deduped via React cache() so it's one
// pair of DB round trips per request instead of two.
const getSeatWithCandidates = cache(async (seatId: string) => {
  const supabase = await createServerClient();
  const { data: seat } = await getSeatById(supabase, seatId);
  const { data: candidates } = await getCandidatesBySeatIds(
    supabase,
    seat?.id ? [seat.id] : []
  );
  return { seat, candidates };
});

export async function generateMetadata({
  params,
  searchParams,
}: SeatPageProps): Promise<Metadata> {
  const { seatId } = await params;
  const { candidate: candidateId } = await searchParams;

  const { seat, candidates } = await getSeatWithCandidates(seatId);

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

  const rawDesc = selectedCandidate?.statement
    ? selectedCandidate.statement
    : candidateListNames && candidateListNames.length > 0
    ? `${roleTitle} candidates in ${boundaryName}: ${candidateListNames.join(", ")}. Read policy stances & voter ratings on Choseno.`
    : `Who is running for ${roleTitle} in ${boundaryName}? Compare candidates, policy stances & voter ratings on Choseno.`;

  const description = rawDesc.length > 155 ? `${rawDesc.slice(0, 152)}...` : rawDesc;

  const seatSlug = buildSeatSlug(seat);
  const candSlug = selectedCandidate ? buildCandidateSlug(selectedCandidate) : candidateId;

  const canonicalUrl = candidateId
    ? `${BASE_URL}/elections/seat/${seatSlug}?candidate=${candSlug}`
    : `${BASE_URL}/elections/seat/${seatSlug}`;

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

export default async function ElectionSeatPage({ params }: SeatPageProps) {
  const { seatId } = await params;

  const { seat, candidates } = await getSeatWithCandidates(seatId);

  const roleTitle = seat?.role_title || "Electoral Seat";
  const boundaryName = seat?.map_shapes?.name || "District";
  const electionYear = seat?.elections?.election_date?.slice(0, 4) || "2026";
  const seatSlug = seat ? buildSeatSlug(seat) : seatId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(seatId);
  if (seat && isUuid && seatSlug !== seatId) {
    redirect(`/elections/seat/${seatSlug}`);
  }
  const canonicalUrl = `${BASE_URL}/elections/seat/${seatSlug}`;

  const candList = (candidates as any[]) || [];
  const candidateNames = candList
    .map((c) => c.display_name || c.profiles?.full_name)
    .filter(Boolean);

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
          "@type": "ItemList",
          name: `2026 ${roleTitle} Candidates — ${boundaryName}`,
          description: `List of official candidates running for ${roleTitle} in ${boundaryName} on Choseno.`,
          numberOfItems: candList.length,
          itemListElement: candList.map((c, idx) => {
            const candName = c.display_name || c.profiles?.full_name || "Candidate";
            const candSlug = buildCandidateSlug(c);
            const candWallSlug = c.profiles?.politician_profiles?.wall_slug;
            const candUrl = c.profiles?.current_ghost_id
              ? `${BASE_URL}/wall/${candWallSlug || buildPoliticianWallSlug(candName, roleTitle)}`
              : `${canonicalUrl}/candidate/${candSlug}`;

            return {
              "@type": "ListItem",
              position: idx + 1,
              name: candName,
              url: candUrl,
            };
          }),
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: `Who is running for ${roleTitle} in ${boundaryName} in ${electionYear}?`,
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  candidateNames.length > 0
                    ? `Official candidates running for ${roleTitle} in ${boundaryName} (${electionYear} Elections) on Choseno include: ${candidateNames.join(", ")}.`
                    : `Candidates for ${roleTitle} in ${boundaryName} are being updated on Choseno as nominations are filed.`,
              },
            },
          ],
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

      {/* SSR Content Snapshot for AI Crawlers (ChatGPT, Perplexity, Gemini) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        <h1>
          2026 {roleTitle} Candidates — {boundaryName}
        </h1>
        <p>
          Who is running for {roleTitle} in {boundaryName} in {electionYear}?
        </p>
        {candidateNames.length > 0 ? (
          <p>
            Official candidates running for {roleTitle} in {boundaryName} on Choseno:{" "}
            {candidateNames.join(", ")}.
          </p>
        ) : (
          <p>
            Nominations for {roleTitle} in {boundaryName} are currently active on Choseno.
          </p>
        )}
        {candList.length > 0 && (
          <ul>
            {candList.map((c: any) => {
              const candName = c.display_name || c.profiles?.full_name || "Candidate";
              return (
                <li key={c.id}>
                  {candName} — Candidate for {roleTitle} ({boundaryName})
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ElectionSeatPageClient
        seatId={seatId}
        initialSeat={seat}
        initialCandidates={(candidates as any[]) || []}
      />
    </>
  );
}
