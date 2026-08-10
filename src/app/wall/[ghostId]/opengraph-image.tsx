import { renderOgCard, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/og";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getWallOwnerProfile, getWallOwnerProfileBySlug } from "@/lib/services/politicianWall";

export const alt = "Politician's Public Wall | Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

interface Props {
  params: Promise<{ ghostId: string }>;
}

type WallOwner = {
  full_name?: string;
  politician_profiles?: { bio?: string; avatar_url?: string } | null;
};

export default async function Image({ params }: Props) {
  const { ghostId } = await params;
  const supabase = await createServerClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ghostId);
  const { data } = isUuid
    ? await getWallOwnerProfile(supabase, ghostId)
    : await getWallOwnerProfileBySlug(supabase, ghostId);
  const owner = data as unknown as WallOwner | null;

  const name = owner?.full_name || "Politician";
  const bio = owner?.politician_profiles?.bio;
  const avatarUrl = owner?.politician_profiles?.avatar_url;

  return renderOgCard({
    eyebrow: "Public Wall",
    title: name,
    subtitle: bio || undefined,
    photoUrl: avatarUrl,
  });
}
