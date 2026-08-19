import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/ogCard";

export const alt = "Choseno News — Rate Your Politician";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
// Cookie-free (see src/lib/supabase/public.ts pattern used elsewhere) keeps
// this route eligible for Next's static image caching; revalidate bounds
// how stale a cached card can get.
export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

// All rendering lives in the generate-news-og-image Supabase Edge Function
// (supabase/functions/generate-news-og-image) -- this route does no image
// generation of any kind, just proxies bytes through so the public og:image
// URL stays same-origin (choseno.com/news/[slug]/opengraph-image).
//
// In practice this route rarely fires: generateNewsArticleOgImage already
// generates and stores hero_image_url right at publish time (see
// src/lib/services/newsOgImage.ts), so this is only reached by a crawler
// hitting an article from before that existed, or one where generation
// failed. If the Edge Function is ever unreachable, this serves the static
// public/og-fallback.png file (a plain disk read, not a render) rather than
// a broken image.
export default async function Image({ params }: Props) {
  const { slug } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (slug && supabaseUrl) {
    try {
      const functionUrl = `${supabaseUrl}/functions/v1/generate-news-og-image?slug=${encodeURIComponent(slug)}`;
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
