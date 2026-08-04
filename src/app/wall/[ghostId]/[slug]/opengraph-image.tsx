import { renderOgCard, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/og";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getWallOwnerProfile, getWallPostBySlugOrId } from "@/lib/services/politicianWall";

export const alt = "Candidate Wall Thread | Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

interface Props {
  params: Promise<{ ghostId: string; slug: string }>;
}

type WallOwner = {
  full_name?: string;
  politician_profiles?: { bio?: string; avatar_url?: string } | null;
};

export default async function Image({ params }: Props) {
  const { ghostId, slug } = await params;
  const supabase = await createServerClient();

  const [{ data: ownerData }, { data: postData }] = await Promise.all([
    getWallOwnerProfile(supabase, ghostId),
    getWallPostBySlugOrId(supabase, ghostId, slug),
  ]);

  const owner = ownerData as unknown as WallOwner | null;
  const name = owner?.full_name || "Politician";
  const avatarUrl = owner?.politician_profiles?.avatar_url;
  const post = postData as { content?: string; image_url?: string } | null;

  const postExcerpt = post?.content
    ? post.content.replace(/\s+/g, " ").trim().slice(0, 100)
    : `Public statement & constituent discussion thread`;

  return renderOgCard({
    eyebrow: `${name}'s Wall Thread`,
    title: postExcerpt,
    subtitle: `Join the discussion on Choseno — scoped civic social platform`,
    photoUrl: avatarUrl,
  });
}
