import { Metadata } from "next";
import CandidacyWall from "@/components/features/CandidacyWall";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  getPublicCandidateById,
  getPublicCandidateAnswers,
  getCandidacyWallPosts,
} from "@/lib/services/elections";
import { getPoliticianProfile } from "@/lib/services/profile";
import { getSupporterCount } from "@/lib/services/politicianWall";
import { buildCandidateSlug, buildSeatSlug, extractIdFromSlug } from "@/lib/utils/slugs";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

interface CandidatePageProps {
  params: Promise<{ candidateId: string }>;
}

type PublicCandidate = {
  id: string;
  seat_id?: string;
  statement: string | null;
  politician_id: string;
  election_seats?: { role_title?: string; map_shapes?: { name?: string } | null } | null;
  profiles?: { full_name?: string; current_ghost_id?: string; politician_profiles?: { avatar_url?: string } } | null;
};

export async function generateMetadata({
  params,
}: CandidatePageProps): Promise<Metadata> {
  const { candidateId } = await params;
  const realCandidateId = extractIdFromSlug(candidateId);
  const supabase = await createServerClient();
  const { data } = await getPublicCandidateById(supabase, realCandidateId);
  const candidate = data as unknown as PublicCandidate | null;

  if (!candidate) {
    return {
      title: "Candidate Not Found | Choseno",
      description: "The requested candidate wall could not be found.",
    };
  }

  const name = candidate.profiles?.full_name || "Candidate";
  const roleTitle = candidate.election_seats?.role_title || "Office";
  const slug = buildCandidateSlug(candidate);
  const ghostId = candidate.profiles?.current_ghost_id;
  const canonicalUrl = ghostId
    ? `${BASE_URL}/wall/${ghostId}/${slug}`
    : `${BASE_URL}/candidacy/${slug}`;
  const ogImageUrl = `${BASE_URL}/candidacy/${realCandidateId}/opengraph-image`;

  const title = `${name} — 2026 ${roleTitle} Candidate | Voter Reviews`;
  const description = candidate.statement
    ? `${candidate.statement.slice(0, 140)} — Read constituent ratings & voter feedback on Choseno.`
    : `What do voters think of ${name}? Read anonymous constituent reviews, policy stances & ratings for ${roleTitle} on Choseno.`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Choseno",
      type: "profile",
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

export default async function CandidacyPage({ params }: CandidatePageProps) {
  const { candidateId } = await params;
  const realCandidateId = extractIdFromSlug(candidateId);
  const supabase = await createServerClient();

  const { data: candidateData } = await getPublicCandidateById(supabase, realCandidateId);
  const candidate = candidateData as unknown as PublicCandidate | null;

  const [{ data: answers }, { data: posts }, supportCountRes] = await Promise.all([
    getPublicCandidateAnswers(supabase, realCandidateId),
    getCandidacyWallPosts(supabase, realCandidateId, candidate?.profiles?.current_ghost_id),
    candidate?.politician_id
      ? getSupporterCount(supabase, candidate.politician_id)
      : Promise.resolve({ count: 0 }),
  ]);

  const candidateProfile = candidate?.politician_id
    ? (await getPoliticianProfile(supabase, candidate.politician_id)).data
    : null;

  const visibleAnswers = ((answers as any[]) || []).filter(
    (a) => a.election_questions?.visible_to_public
  );

  const name = candidate?.profiles?.full_name || "Candidate";
  const jsonLd = candidate
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name,
        description: candidate.statement || undefined,
        jobTitle: candidate.election_seats?.role_title || undefined,
        image: candidate.profiles?.politician_profiles?.avatar_url || undefined,
        url: `${BASE_URL}/candidacy/${buildCandidateSlug(candidate)}`,
      }
    : null;

  const seatName = candidate?.election_seats?.role_title
    ? `${candidate.election_seats.role_title} — ${candidate.election_seats.map_shapes?.name || ""}`
    : null;
  const seatUrl =
    candidate?.seat_id && candidate.election_seats?.role_title
      ? `${BASE_URL}/elections/seat/${buildSeatSlug({
          id: candidate.seat_id,
          role_title: candidate.election_seats.role_title,
          map_shapes: { name: candidate.election_seats.map_shapes?.name },
        })}`
      : null;
  const breadcrumbJsonLd = candidate
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Elections", item: `${BASE_URL}/elections` },
          ...(seatName && seatUrl
            ? [{ "@type": "ListItem", position: 2, name: seatName, item: seatUrl }]
            : []),
          {
            "@type": "ListItem",
            position: seatName && seatUrl ? 3 : 2,
            name,
            item: `${BASE_URL}/candidacy/${buildCandidateSlug(candidate)}`,
          },
        ],
      }
    : null;

  return (
    <div className="w-full max-w-none pb-20 px-4 lg:px-8">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <CandidacyWall
        candidateId={candidateId}
        initialCandidate={candidate as any}
        initialCandidateProfile={candidateProfile}
        initialAnswers={visibleAnswers as any}
        initialPosts={(posts as any) || []}
        initialSupportCount={"count" in supportCountRes ? supportCountRes.count || 0 : 0}
      />
    </div>
  );
}
