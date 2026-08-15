import { renderOgCard, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/og";
import { createPublicClient } from "@/lib/supabase/public";
import { getPublicCandidateById } from "@/lib/services/elections";

export const alt = "Candidate | Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
// Cookie-free createPublicClient (see src/lib/supabase/public.ts) keeps this
// route eligible for Next's static image caching; revalidate bounds how
// stale a cached card can get after the candidate's data changes.
export const revalidate = 3600;

interface Props {
  params: Promise<{ candidateId: string }>;
}

type PublicCandidate = {
  statement: string | null;
  election_seats?: { role_title?: string } | null;
  profiles?: { full_name?: string; politician_profiles?: { avatar_url?: string } } | null;
};

export default async function Image({ params }: Props) {
  const { candidateId } = await params;
  const supabase = createPublicClient();
  const { data } = await getPublicCandidateById(supabase, candidateId);
  const candidate = data as unknown as PublicCandidate | null;

  const name = candidate?.profiles?.full_name || "Candidate";
  const roleTitle = candidate?.election_seats?.role_title || "Office";
  const avatarUrl = candidate?.profiles?.politician_profiles?.avatar_url;

  return renderOgCard({
    eyebrow: `Candidate for ${roleTitle}`,
    title: name,
    subtitle: candidate?.statement || undefined,
    photoUrl: avatarUrl,
  });
}
