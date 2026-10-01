import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/ogCard";
import { extractIdFromSlug } from "@/lib/utils/slugs";

export const alt = "Parties and candidates in the election | Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
// Bounds how stale a cached card can get after candidates are added.
export const revalidate = 3600;

interface Props {
  params: Promise<{ electionSlug: string }>;
}

// Same approach as the seat share card (elections/seat/[seatId]/opengraph-image):
// the card is rendered in the generate-election-parties-og-image Supabase Edge
// Function (party grid from live data, PNG cached in the election-og-images
// bucket for 1h), and this route just proxies those bytes so the public
// og:image URL stays same-origin (choseno.com/elections/e/[slug]/opengraph-image).
// No image generation happens here. If the function is unreachable, the static
// public/og-fallback.png is served instead of a broken/half-empty card.
//
// CARD_VERSION mirrors the same-named constant in the Edge Function's index.ts
// -- bump both together when card.tsx's layout/copy changes. Folded into the
// fetch URL purely to change Next's Data Cache key (it persists across deploys).
const CARD_VERSION = "v1";

export default async function Image({ params }: Props) {
  const { electionSlug } = await params;
  const electionId = extractIdFromSlug(electionSlug);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (electionId.length === 36 && supabaseUrl) {
    try {
      const functionUrl = `${supabaseUrl}/functions/v1/generate-election-parties-og-image?electionId=${electionId}&v=${CARD_VERSION}`;
      const res = await fetch(functionUrl, { next: { revalidate: 3600 } });
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
