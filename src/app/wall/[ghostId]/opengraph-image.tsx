import { renderOgCard, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/og";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getWallOwnerProfile } from "@/lib/services/politicianWall";

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
  const { data } = await getWallOwnerProfile(supabase, ghostId);
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
