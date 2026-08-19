// Edge Function: generate-news-og-image
//
// Generates (once) and stores the branded share-card PNG for one published
// news article. GET/POST ?slug=<news_articles.slug>.
//
// Two response shapes, selected by ?format=:
//   - (default) raw PNG bytes -- for src/app/news/[slug]/opengraph-image.tsx,
//     which proxies these bytes through so the public og:image URL stays
//     same-origin, mirroring generate-election-og-image's
//     src/app/elections/seat/[seatId]/opengraph-image.tsx proxy.
//   - ?format=json -> { url, error } -- for the publish-time caller
//     (generateNewsArticleOgImage in src/lib/services/newsOgImage.ts, called
//     from api/news/[slug]/og-image/route.ts right after an admin publishes
//     or the scripts/*.js ingestion pipeline inserts a published article).
//
// Idempotent: if news_articles.hero_image_url is already set, this returns
// that stored image (json mode) or fetches+serves it (bytes mode) without
// re-rendering -- so repeated calls for an already-generated article (e.g.
// a second social crawl, or the ingestion script retrying) are a cheap DB
// read + Storage download, not a fresh Satori render. This is also what
// bounds the cost of this function being reachable without caller auth (see
// below): a given slug only ever pays the real render cost once.
//
// Deliberately server-authoritative like generate-election-og-image: this
// runs with the service-role key and derives everything from the DB itself
// (headline, summary, tagged politician) -- nobody can hand it fake content
// to render. It also only ever generates for articles whose status is
// "published", so an unauthenticated caller can only trigger generation for
// content that's already public. --no-verify-jwt on deploy, matching
// generate-election-og-image (see Supabase's own "Generating OG Images"
// example), since the live fallback route calls this with no Authorization
// header -- same public-image-endpoint reasoning.
//
// This used to run as next/og's ImageResponse inside a Vercel Function
// (generateNewsArticleOgImage, before 2026-08-19) -- moved here because that
// function fired synchronously once per article from the automated news
// ingestion pipeline (scripts/insert-news-batch.js), which is Vercel CPU
// Satori text-layout + PNG-encode doesn't belong paying for on every batch
// import.
import { ImageResponse } from 'npm:@vercel/og@^0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { NewsArticleOgCard } from './card.tsx';

const BUCKET = 'news-images';
const SIZE = { width: 1200, height: 630 };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const format = url.searchParams.get('format'); // 'json' or unset (bytes)
  if (!slug) {
    return jsonOrBytes(format, { error: 'slug query param is required' }, 400);
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { data: article, error: fetchError } = await supabaseAdmin
      .from('news_articles')
      .select(
        'slug, headline, summary, category, country, province, status, event_date, published_at, hero_image_url, content, news_article_politicians(politician_id, profiles(full_name, designation, constituency, politician_profiles(photo_url, avatar_url)))',
      )
      .eq('slug', slug)
      .single();

    if (fetchError || !article) {
      return jsonOrBytes(format, { error: fetchError?.message || 'Article not found' }, 404);
    }

    // Already generated -- serve the stored image instead of re-rendering.
    if (article.hero_image_url) {
      if (format === 'json') {
        return new Response(JSON.stringify({ url: article.hero_image_url, error: null }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      const res = await fetch(article.hero_image_url);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        return new Response(buffer, {
          headers: { ...CORS_HEADERS, 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
        });
      }
      // Stored URL 404s (deleted from Storage out-of-band) -- fall through
      // and regenerate rather than dead-ending the request.
    }

    if (article.status !== 'published') {
      return jsonOrBytes(format, { error: `Article status is "${article.status}", not "published"` }, 400);
    }

    const primaryPolitician = (article.news_article_politicians as any[] | null)
      ?.map((p) => p.profiles)
      .filter(Boolean)[0];

    const png = await renderCard(article as any, primaryPolitician);

    const filePath = `og-cards/${slug}.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, png, { contentType: 'image/png', upsert: true });
    if (uploadError) {
      return jsonOrBytes(format, { error: `Upload failed: ${uploadError.message}` }, 502);
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);

    const { error: updateError } = await supabaseAdmin
      .from('news_articles')
      .update({ hero_image_url: publicUrl })
      .eq('slug', slug);
    if (updateError) {
      return jsonOrBytes(format, { error: `Saving hero_image_url failed: ${updateError.message}` }, 502);
    }

    if (format === 'json') {
      return new Response(JSON.stringify({ url: publicUrl, error: null }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    return new Response(png, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('news-og-image generation failed:', message);
    return jsonOrBytes(format, { error: `OG image generation failed: ${message}` }, 500);
  }
});

function jsonOrBytes(format: string | null, body: { error: string; url?: null }, status: number): Response {
  return new Response(JSON.stringify(format === 'json' ? { url: null, ...body } : body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function renderCard(
  article: {
    headline: string;
    summary: string | null;
    category: string;
    country: string | null;
    province: string | null;
    event_date: string | null;
    published_at: string | null;
    content: { body?: string | null } | null;
  },
  primaryPolitician:
    | {
        full_name: string;
        designation?: string | null;
        constituency?: string | null;
        politician_profiles?: { photo_url?: string | null; avatar_url?: string | null } | null;
      }
    | undefined,
): Promise<ArrayBuffer> {
  const image = new ImageResponse(
    NewsArticleOgCard({
      headline: article.headline,
      summary: article.summary,
      category: article.category,
      country: article.country,
      province: article.province,
      eventDate: article.event_date,
      publishedAt: article.published_at,
      bodyMarkdown: article.content?.body,
      politicianName: primaryPolitician?.full_name,
      politicianDesignation: primaryPolitician?.designation,
      politicianConstituency: primaryPolitician?.constituency,
      politicianPhotoUrl:
        primaryPolitician?.politician_profiles?.photo_url || primaryPolitician?.politician_profiles?.avatar_url,
    }) as any,
    { ...SIZE },
  );
  return await image.arrayBuffer();
}
