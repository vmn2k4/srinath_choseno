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

const BASE_URL = "https://choseno.com";

interface CandidatePageProps {
  params: Promise<{ candidateId: string }>;
}

type PublicCandidate = {
  id: string;
  statement: string | null;
  politician_id: string;
  election_seats?: { role_title?: string } | null;
  profiles?: { full_name?: string; current_ghost_id?: string; politician_profiles?: { avatar_url?: string } } | null;
};

export async function generateMetadata({
  params,
}: CandidatePageProps): Promise<Metadata> {
  const { candidateId } = await params;
  const supabase = await createServerClient();
  const { data } = await getPublicCandidateById(supabase, candidateId);
  const candidate = data as unknown as PublicCandidate | null;

  if (!candidate) {
    return {
      title: "Candidate Not Found | Choseno",
      description: "The requested candidate wall could not be found.",
    };
  }

  const name = candidate.profiles?.full_name || "Candidate";
  const roleTitle = candidate.election_seats?.role_title || "Office";
  const canonicalUrl = `${BASE_URL}/candidacy/${candidateId}`;

  const title = `${name} — Candidate for ${roleTitle} | Choseno`;
  const description = candidate.statement
    ? candidate.statement.slice(0, 160)
    : `View official campaign statements, positions, and updates from ${name} on Choseno.`;

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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function CandidacyPage({ params }: CandidatePageProps) {
  const { candidateId } = await params;
  const supabase = await createServerClient();

  const { data: candidateData } = await getPublicCandidateById(supabase, candidateId);
  const candidate = candidateData as unknown as PublicCandidate | null;

  const [{ data: answers }, { data: posts }, supportCountRes] = await Promise.all([
    getPublicCandidateAnswers(supabase, candidateId),
    getCandidacyWallPosts(supabase, candidateId, candidate?.profiles?.current_ghost_id),
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
        url: `${BASE_URL}/candidacy/${candidateId}`,
      }
    : null;

  return (
    <div className="w-full max-w-none pb-20 px-4 lg:px-8">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
