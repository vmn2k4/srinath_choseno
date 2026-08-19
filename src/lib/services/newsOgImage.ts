// ── Auto-generated share-card image ─────────────────────────────────────
//
// Generation itself lives in the generate-news-og-image Supabase Edge
// Function now (supabase/functions/generate-news-og-image): it renders the
// branded card with next/og's engine (via npm:@vercel/og in Deno), bakes it
// into a static PNG in the news-images bucket, and saves the URL to
// hero_image_url -- every consumer of that column (article metadata,
// sitemap.ts, news-sitemap.xml, JSON-LD, news list cards) then serves the
// static file instead of live-rendering on every request/crawl, which is
// what made the X/Twitter card unreliable (a slow first render -- e.g.
// fetching a tagged politician's photo -- could blow past X's crawl timeout
// and get cached there as "no image" for the URL).
//
// This function is a thin proxy to that Edge Function, not a renderer --
// moved off Vercel entirely on 2026-08-19 because this used to run next/og's
// ImageResponse (Satori text-layout + PNG-encode) directly inside a Vercel
// Function, fired synchronously once per article from the automated news
// ingestion pipeline (scripts/insert-news-batch.js). That's real CPU Vercel
// doesn't need to pay for any more; Supabase (already the DB/Storage owner
// of this data) does the rendering now.
//
// Called from api/news/[slug]/og-image/route.ts right after an article is
// published, both from AdminNewsPageClient's publish action and from the
// scripts/*.js ingestion scripts -- never a manual step. Idempotent on the
// Edge Function's side: a second call is a no-op once hero_image_url is
// set, and never overwrites a real source photo an article already carries.
//
// Only ever import this file from server-only code (route handlers) --
// matches the constraint this file always had, even back when it rendered
// locally; importing it from a client component would still pull in
// Next.js server-only module resolution.
export async function generateNewsArticleOgImage(
  _supabase: unknown,
  slug: string
): Promise<{ url: string | null; error: string | null }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return { url: null, error: "Supabase URL not configured" };

  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/generate-news-og-image?slug=${encodeURIComponent(slug)}&format=json`,
      { method: "POST" }
    );
    const body = (await res.json().catch(() => null)) as { url: string | null; error: string | null } | null;
    if (!res.ok) return { url: null, error: body?.error || `generate-news-og-image returned ${res.status}` };
    return { url: body?.url ?? null, error: body?.error ?? null };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : "Failed to reach generate-news-og-image" };
  }
}
