import { renderOgCard, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/og";
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
// now (supabase/functions/generate-election-og-image): it renders ALL
// candidates with photo/party/community-support share, caches the PNG in
// the election-og-images Storage bucket for 24h, and regenerates on the
// first request after that. This route just proxies those bytes through so
// the public og:image URL stays same-origin
// (choseno.com/elections/seat/[seatId]/opengraph-image) -- Vercel does no
// PNG rendering here any more, Supabase does. Falls back to the old live
// next/og card if the Edge Function is ever unreachable or errors, so a
// Supabase hiccup never breaks the share card outright.
export default async function Image({ params }: Props) {
  const { seatId } = await params;
  const supabase = createPublicClient();
  const { data: seat } = await getSeatById(supabase, seatId);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (seat?.id && supabaseUrl) {
    try {
      const functionUrl = `${supabaseUrl}/functions/v1/generate-election-og-image?seatId=${seat.id}`;
      const res = await fetch(functionUrl, { next: { revalidate: 3600 } });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        return new Response(buffer, {
          headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
        });
      }
    } catch {
      // Fall through to the live next/og render below.
    }
  }

  return renderOgCard({
    eyebrow: "Election Seat",
    title: seat?.role_title || "Electoral Seat",
    subtitle: seat?.map_shapes?.name || undefined,
  });
}
