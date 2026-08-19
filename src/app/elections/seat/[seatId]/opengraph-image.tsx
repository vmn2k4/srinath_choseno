import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/ogCard";
import { createPublicClient } from "@/lib/supabase/public";
import { getSeatById } from "@/lib/services/elections";

export const alt = "Election Seat | Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
// Cookie-free createPublicClient (see src/lib/supabase/public.ts) keeps this
// route eligible for Next's static image caching; revalidate bounds how
// stale a cached card can get after the seat's data changes.
export const revalidate = 3600;

interface Props {
  params: Promise<{ seatId: string }>;
}

// Generation lives in the generate-election-og-image Supabase Edge Function
// (supabase/functions/generate-election-og-image): it renders ALL
// candidates with photo/party/community-support share, caches the PNG in
// the election-og-images Storage bucket for 24h, and regenerates on the
// first request after that. This route just proxies those bytes through so
// the public og:image URL stays same-origin
// (choseno.com/elections/seat/[seatId]/opengraph-image) -- this route does
// no image generation of any kind.
//
// If the Edge Function is ever unreachable, this serves the static
// public/og-fallback.png file (a plain disk read, not a render) rather than
// a seat-specific-but-sparse generic card -- a half-empty "Election Seat /
// {role title}" card with no candidate content reads as broken to anyone
// who sees it shared, whereas the shared site fallback is a complete,
// intentional design that never looks like a failure.
//
// CARD_VERSION mirrors the same-named constant in the Edge Function's
// index.ts -- bump both together whenever card.tsx's layout/copy changes.
// It's folded into the fetch URL below purely to change Next's Data Cache
// key, since that cache persists across deployments and otherwise keeps
// serving pre-redesign bytes for up to an hour after a fix ships (the
// Storage-bucket-side version bust alone isn't visible to this cache).
const CARD_VERSION = 'v3';

export default async function Image({ params }: Props) {
  const { seatId } = await params;
  const supabase = createPublicClient();
  const { data: seat } = await getSeatById(supabase, seatId);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (seat?.id && supabaseUrl) {
    try {
      const functionUrl = `${supabaseUrl}/functions/v1/generate-election-og-image?seatId=${seat.id}&v=${CARD_VERSION}`;
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
