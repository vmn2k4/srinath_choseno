import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/ogCard";
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

// All rendering lives in the generate-profile-og-image Supabase Edge
// Function -- same move and same reasoning as the wall opengraph-image
// routes: the candidate lookup (getPublicCandidateById) stays on the
// Next.js side, the Edge Function does the render + 24h cache. This route
// does no image generation of any kind.
export default async function Image({ params }: Props) {
  const { candidateId } = await params;
  const supabase = createPublicClient();
  const { data } = await getPublicCandidateById(supabase, candidateId);
  const candidate = data as unknown as PublicCandidate | null;

  const name = candidate?.profiles?.full_name || "Candidate";
  const roleTitle = candidate?.election_seats?.role_title || "Office";
  const avatarUrl = candidate?.profiles?.politician_profiles?.avatar_url;
  const cacheKey = `candidacy/${candidateId}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const functionUrl = `${supabaseUrl}/functions/v1/generate-profile-og-image?cacheKey=${encodeURIComponent(cacheKey)}`;
      const res = await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eyebrow: `Candidate for ${roleTitle}`,
          title: name,
          subtitle: candidate?.statement || null,
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
