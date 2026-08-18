import { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE, renderNewsArticleOgCard } from "@/lib/utils/og";
import { createPublicClient } from "@/lib/supabase/public";
import { ImageResponse } from "next/og";

export const alt = "Choseno News — Rate Your Politician";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
// Cookie-free createPublicClient keeps this route eligible for static caching;
// revalidate bounds how stale a cached card can get after an article is edited.
//
// This route is now only the *fallback* renderer: generateNewsArticleOgImage
// (src/lib/services/news.ts) generates the same card once at publish time and
// saves it to news_articles.hero_image_url, so every page/sitemap/JSON-LD
// consumer serves that static file instead of hitting this route on every
// crawl. This still exists for articles published before that existed, or if
// generation/upload ever failed for one.
export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const supabase = createPublicClient();

  const { data } = await supabase
    .from("news_articles")
    .select(
      "id, slug, headline, summary, category, country, province, event_date, published_at, content, news_article_politicians(politician_id, profiles(id, full_name, designation, constituency, politician_profiles(photo_url, avatar_url)))"
    )
    .eq("slug", slug)
    .single();

  const article = data as {
    id: string;
    slug: string;
    headline: string;
    summary: string | null;
    category: string;
    country: string | null;
    province: string | null;
    event_date?: string | null;
    published_at?: string | null;
    content?: {
      body?: string | null;
      tags?: string[] | null;
    } | null;
    news_article_politicians?: Array<{
      profiles?: {
        id: string;
        full_name: string;
        designation?: string | null;
        constituency?: string | null;
        politician_profiles?: {
          photo_url?: string | null;
          avatar_url?: string | null;
        } | null;
      } | null;
    }> | null;
  } | null;

  if (!article) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "#ffffff",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 900, color: "#0f172a" }}>Choseno Civic News</div>
        </div>
      ),
      { ...OG_IMAGE_SIZE }
    );
  }

  const primaryPolitician = article.news_article_politicians?.map((p) => p.profiles).filter(Boolean)[0];

  return renderNewsArticleOgCard({
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
}
