import { readFile } from "node:fs/promises";
import { after } from "next/server";
import { join } from "node:path";
import { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/ogCard";
import { extractIdFromSlug, extractPartyIdFromSlug, UNAFFILIATED_PARTY_SLUG } from "@/lib/utils/slugs";

export const alt = "Party candidates in the election | Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
// Always evaluated per request: the Edge Function serves the stored PNG (cheap)
// and re-renders only when the roster changed, so nothing here should pin a
// result -- in particular a fallback from a transient failure.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ electionSlug: string; partySlug: string }>;
}

// Same approach as the seat share card (elections/seat/[seatId]/opengraph-image):
// the card is rendered in the generate-election-parties-og-image Supabase Edge
// Function (party grid from live data, PNG cached in the election-og-images
// bucket for 1h), and this route just proxies those bytes so the public
// og:image URL stays same-origin (choseno.com/elections/e/[slug]/opengraph-image).
// No image generation happens here. If the function is unreachable, the site's
// main og image (public/og-home-v2.jpg, same as the homepage card) is served
// with a short cache so a transient failure can't stick.
//
// CARD_VERSION mirrors the same-named constant in the Edge Function's index.ts
// -- bump both together when card.tsx's layout/copy changes. Folded into the
// fetch URL purely to change Next's Data Cache key (it persists across deploys).
const CARD_VERSION = "v1";

// The Edge Function re-renders only when the roster changes; let CDNs/crawlers
// revalidate hourly so a new card is picked up soon after, without re-hitting
// the function on every request.
const SUCCESS_CACHE = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

// Asks the Edge Function to re-render a stale/missing card. A render can die
// with a worker resource limit (uncatchable inside the function), so retry.
async function refreshCard(functionUrl: string, attempts: number) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${functionUrl}&refresh=1`, { cache: "no-store" });
      if (res.ok) return true;
    } catch {
      // retry
    }
  }
  return false;
}

export default async function Image({ params }: Props) {
  const { electionSlug, partySlug } = await params;
  const partyId = extractPartyIdFromSlug(partySlug);
  const partyKey = partyId != null ? String(partyId) : partySlug === UNAFFILIATED_PARTY_SLUG ? "none" : null;
  const electionId = extractIdFromSlug(electionSlug);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (electionId.length === 36 && partyKey && supabaseUrl) {
    const functionUrl = `${supabaseUrl}/functions/v1/generate-election-parties-og-image?electionId=${electionId}&partyId=${partyKey}&v=${CARD_VERSION}`;
    try {
      let res = await fetch(functionUrl, { cache: "no-store" });
      // The function serves the stored card (possibly stale) instantly; it only
      // renders inline when nothing is stored yet, and that render can fail.
      if (!res.ok && (await refreshCard(functionUrl, 3))) {
        res = await fetch(functionUrl, { cache: "no-store" });
      }
      if (res.ok) {
        if (res.headers.get("x-og-stale") === "1") {
          after(() => refreshCard(functionUrl, 4));
        }
        const buffer = await res.arrayBuffer();
        return new Response(buffer, {
          headers: { "Content-Type": "image/png", "Cache-Control": SUCCESS_CACHE },
        });
      }
    } catch {
      // Fall through to the main-site fallback below.
    }
  }

  const fallback = await readFile(join(process.cwd(), "public", "og-home-v2.jpg"));
  return new Response(new Uint8Array(fallback), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=60" },
  });
}
