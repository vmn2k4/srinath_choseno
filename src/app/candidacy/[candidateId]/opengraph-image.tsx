import { renderOgCard, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/og";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getPublicCandidateById } from "@/lib/services/elections";

export const alt = "Candidate | Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

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
  const supabase = await createServerClient();
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
