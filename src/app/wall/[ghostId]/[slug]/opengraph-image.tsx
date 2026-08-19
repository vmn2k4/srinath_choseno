import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/ogCard";
import { createPublicClient } from "@/lib/supabase/public";
import { getWallOwnerProfile, getWallPostBySlugOrId, getWallOwnerProfileBySlug } from "@/lib/services/politicianWall";

export const alt = "Candidate Wall Thread | Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
// Cookie-free createPublicClient (see src/lib/supabase/public.ts) keeps this
// route eligible for Next's static image caching; revalidate bounds how
// stale a cached card can get after the post/owner data changes.
export const revalidate = 3600;

interface Props {
  params: Promise<{ ghostId: string; slug: string }>;
}

type WallOwner = {
  id?: string;
  full_name?: string;
  politician_profiles?: { bio?: string; avatar_url?: string } | null;
};

// All rendering lives in the generate-profile-og-image Supabase Edge
// Function, same move as the sibling wall/[ghostId]/opengraph-image.tsx
// route -- see the comment there for why the owner+post lookup (real
// business logic, including the slug-matching fallback in
// getWallPostBySlugOrId) stays on the Next.js side rather than being
// re-derived in Deno. This route does no image generation of any kind.
export default async function Image({ params }: Props) {
  const { ghostId, slug } = await params;
  const supabase = createPublicClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ghostId);
  const { data: ownerData } = isUuid
    ? await getWallOwnerProfile(supabase, ghostId)
    : await getWallOwnerProfileBySlug(supabase, ghostId);
  const resolvedGhostId = ownerData?.current_ghost_id || ghostId;
  const { data: postData } = await getWallPostBySlugOrId(supabase, resolvedGhostId, slug);

  const owner = ownerData as unknown as WallOwner | null;
  const name = owner?.full_name || "Politician";
  const avatarUrl = owner?.politician_profiles?.avatar_url;
  const post = postData as { id?: string; content?: string; image_url?: string } | null;

  const postExcerpt = post?.content
    ? post.content.replace(/\s+/g, " ").trim().slice(0, 100)
    : `Public statement & constituent discussion thread`;
  const cacheKey = `wall-post/${owner?.id || ghostId}/${post?.id || slug}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const functionUrl = `${supabaseUrl}/functions/v1/generate-profile-og-image?cacheKey=${encodeURIComponent(cacheKey)}`;
      const res = await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eyebrow: `${name}'s Wall Thread`,
          title: postExcerpt,
          subtitle: `Join the discussion on Choseno — scoped civic social platform`,
          photoUrl: avatarUrl || null,
        }),
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        return new Response(buffer, {
          headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
        });
      }
    } catch {
      // Fall through to the static fallback below.
    }
  }

  const fallback = await readFile(join(process.cwd(), "public", "og-fallback.png"));
  return new Response(new Uint8Array(fallback), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
  });
}
