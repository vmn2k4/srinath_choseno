import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/ogCard";
import { createPublicClient } from "@/lib/supabase/public";
import { getSEOProfileSummary, getSEOProfileSummaryBySlug } from "@/lib/services/politicianWall";
import { getNewsArticlesByPolitician } from "@/lib/services/news";

export const alt = "Politician's Public Wall | Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
// Cookie-free createPublicClient (see src/lib/supabase/public.ts) keeps this
// route eligible for Next's static image caching; revalidate bounds how
// stale a cached card can get after the wall owner's profile changes.
export const revalidate = 3600;

interface Props {
  params: Promise<{ ghostId: string }>;
}

type WallOwner = {
  id?: string;
  full_name?: string;
  politician_profiles?: {
    bio?: string;
    avatar_url?: string;
    photo_url?: string | null;
    political_parties?: { name?: string } | null;
  } | null;
};

// All rendering lives in the generate-profile-og-image Supabase Edge
// Function (supabase/functions/generate-profile-og-image) -- this route
// does no image generation of any kind. It keeps doing its own DB lookup
// (via getWallOwnerProfile/BySlug, unchanged) rather than moving that into
// the Edge Function: that carries real business logic (merged-wall redirect
// resolution, contact-info fallback enrichment) that already lives in
// src/lib/services/politicianWall.ts, and duplicating it in Deno would mean
// two copies drifting apart. So this route resolves the owner (cost it
// already pays for the page itself), then POSTs just the display fields the
// card needs -- the Edge Function does the render and caches the result for
// 24h keyed by owner id.
export default async function Image({ params }: Props) {
  const { ghostId } = await params;
  const supabase = createPublicClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ghostId);
  // getSEOProfileSummary(BySlug) instead of the bare owner lookup -- same
  // rating aggregate the page's own generateMetadata already computes, so
  // the share card can say "4.6★ from 12 reviews" or "Be the first to
  // rate" instead of carrying no rating context at all.
  const { owner: data, rating } = isUuid
    ? await getSEOProfileSummary(supabase, ghostId)
    : await getSEOProfileSummaryBySlug(supabase, ghostId);
  const owner = data as unknown as WallOwner | null;

  const name = owner?.full_name || "Politician";
  const bio = owner?.politician_profiles?.bio;
  // photo_url (set by enrichProfileWithContactFallback from a linked
  // office_holders record, e.g. an official government headshot) takes
  // priority over avatar_url (a self-uploaded photo) -- this route used to
  // read only avatar_url, which meant a profile with a real official photo
  // via the office_holders fallback (not self-uploaded) always fell through
  // to the plain letter-circle instead. Same priority PoliticianWallClient
  // already uses for its own Avatar.
  const avatarUrl = owner?.politician_profiles?.photo_url || owner?.politician_profiles?.avatar_url;
  const partyName = owner?.politician_profiles?.political_parties?.name;
  const cacheKey = `wall/${owner?.id || ghostId}`;

  // Latest tagged article + total count -- lets the card say something real
  // and specific to this person ("In the news: '...'" / "69 news stories")
  // instead of the same generic tagline on every wall regardless of how
  // much real coverage exists.
  let latestHeadline: string | null = null;
  let newsCount = 0;
  if (owner?.id) {
    const { data: latestNews, count } = await getNewsArticlesByPolitician(supabase, owner.id, { limit: 1, withCount: true });
    latestHeadline = latestNews?.[0]?.headline || null;
    newsCount = count ?? 0;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const functionUrl = `${supabaseUrl}/functions/v1/generate-profile-og-image?cacheKey=${encodeURIComponent(cacheKey)}`;
      const res = await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eyebrow: "Public Wall",
          title: name,
          subtitle: bio || null,
          photoUrl: avatarUrl || null,
          partyName: partyName || null,
          ratingAvg: rating?.avg ?? null,
          ratingCount: rating?.count ?? 0,
          latestHeadline,
          newsCount,
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
