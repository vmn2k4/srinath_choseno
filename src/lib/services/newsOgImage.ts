import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { NewsStatus, NewsArticleContent } from "./news";
import { renderNewsArticleOgCard } from "@/lib/utils/og";

type Client = SupabaseClient<Database>;

// ── Auto-generated share-card image ─────────────────────────────────────
//
// Renders the same branded card as the live opengraph-image.tsx route, but
// bakes it into a static PNG in the news-images bucket once and saves the
// URL to hero_image_url -- every consumer of that column (article metadata,
// sitemap.ts, news-sitemap.xml, JSON-LD, news list cards) then serves the
// static file instead of live-rendering next/og on every request/crawl,
// which is what made the X/Twitter card unreliable (a slow first render —
// e.g. fetching a tagged politician's photo — could blow past X's crawl
// timeout and get cached there as "no image" for the URL).
//
// Called from api/news/[slug]/og-image/route.ts right after an article is
// published, both from AdminNewsPageClient's publish action and from the
// scripts/*.js ingestion scripts -- never a manual step. Idempotent: a
// second call is a no-op once hero_image_url is set, and never overwrites a
// real source photo an article already carries.
//
// Deliberately kept out of services/news.ts -- see the comment there. Only
// ever import this file from server-only code (route handlers); importing
// it from a client component would break the client bundle the same way
// news.ts briefly did.
export async function generateNewsArticleOgImage(
  supabase: Client,
  slug: string
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("news_articles")
    .select(
      "headline, summary, category, country, province, status, event_date, published_at, hero_image_url, content, news_article_politicians(politician_id, profiles(full_name, designation, constituency, politician_profiles(photo_url, avatar_url)))"
    )
    .eq("slug", slug)
    .single();

  if (error || !data) return { url: null, error: error?.message || "Article not found" };

  const article = data as unknown as {
    headline: string;
    summary: string | null;
    category: string;
    country: string | null;
    province: string | null;
    status: NewsStatus;
    event_date: string | null;
    published_at: string | null;
    hero_image_url: string | null;
    content: NewsArticleContent | null;
    news_article_politicians?: Array<{
      profiles?: {
        full_name: string;
        designation?: string | null;
        constituency?: string | null;
        politician_profiles?: { photo_url?: string | null; avatar_url?: string | null } | null;
      } | null;
    }> | null;
  };

  if (article.hero_image_url) return { url: article.hero_image_url, error: null };
  if (article.status !== "published") return { url: null, error: `Article status is "${article.status}", not "published"` };

  const primaryPolitician = article.news_article_politicians?.map((p) => p.profiles).filter(Boolean)[0];

  const image = renderNewsArticleOgCard({
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
  });

  const buffer = await image.arrayBuffer();
  const filePath = `og-cards/${slug}.png`;
  const { error: uploadError } = await supabase.storage
    .from("news-images")
    .upload(filePath, buffer, { contentType: "image/png", upsert: true });
  if (uploadError) return { url: null, error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("news-images").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("news_articles")
    .update({ hero_image_url: publicUrl })
    .eq("slug", slug);
  if (updateError) return { url: null, error: updateError.message };

  return { url: publicUrl, error: null };
}
