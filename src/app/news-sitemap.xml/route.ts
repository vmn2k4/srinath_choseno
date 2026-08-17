import { createClient } from "@/lib/supabase/server";
import { getPublishedNewsArticles } from "@/lib/services/news";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";

// ── Google News Sitemap ──────────────────────────────────────────────────
//
// Separate from the regular sitemap.ts on purpose: Google News only wants
// articles from the last 48 hours (https://support.google.com/news/publisher-center/answer/9606710),
// tagged with the <news:news> extension, capped at 1000 URLs. The main
// sitemap keeps the full archive indefinitely for regular Search; this one
// is a rolling window that self-prunes as articles age out -- no cron job
// or manual cleanup needed, the WHERE clause does it every request.
//
// Uses createClient() (reads cookies()), which -- same as sitemap.ts and
// robots.ts -- makes this route dynamic by default, so it's always querying
// live data, never a stale build-time snapshot.

const NEWS_SITEMAP_WINDOW_HOURS = 48;
const MAX_NEWS_SITEMAP_URLS = 1000;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const supabase = await createClient();
  const publishedAfter = new Date(Date.now() - NEWS_SITEMAP_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const { data: articles } = await getPublishedNewsArticles(supabase, {
    publishedAfter,
    limit: MAX_NEWS_SITEMAP_URLS,
  });

  const urlEntries = (articles || [])
    .filter((a) => a.published_at)
    .map((a) => {
      const loc = `${SITE_URL}/news/${a.slug}`;
      const pubDate = new Date(a.published_at as string).toISOString();
      const title = escapeXml(a.headline);
      const keywords = escapeXml([a.category, a.country].filter(Boolean).join(", "));
      // Google News reads the thumbnail from this <image:image> entry, not
      // from og:image/JSON-LD -- those are for social cards / rich results.
      // Fall back to the generated OG image so every article still has one.
      const imageUrl = a.hero_image_url || `${SITE_URL}/news/${a.slug}/opengraph-image`;

      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE_NAME)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${title}</news:title>
      ${keywords ? `<news:keywords>${keywords}</news:keywords>` : ""}
    </news:news>
    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:title>${title}</image:title>
    </image:image>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/0.9">
${urlEntries}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      // Short edge cache -- articles enter/exit the 48h window continuously,
      // so this should never be treated as static.
      "Cache-Control": "public, max-age=0, s-maxage=300, must-revalidate",
    },
  });
}
