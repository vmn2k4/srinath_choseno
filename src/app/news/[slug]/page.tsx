import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  getNewsArticleBySlug,
  estimateReadingMinutes,
  isBreakingNewsActive,
  type NewsArticle,
  type NewsArticleContent,
} from "@/lib/services/news";
import NewsArticleDetailClient from "@/components/features/NewsArticleDetailClient";
import NewsArticleViewTracker from "@/components/analytics/NewsArticleViewTracker";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

// generateMetadata and the page component below both look up the same
// article. Deduped via React cache() so it's one DB round trip per request
// instead of two.
const getArticle = cache(async (slug: string) => {
  const supabase = await createClient();
  return getNewsArticleBySlug(supabase, slug);
});

// ── generateMetadata (SSR SEO) ─────────────────────────────────────────────

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data, error } = await getArticle(slug);

  if (error || !data) {
    return {
      title: "Article Not Found | Choseno News",
      description: "The requested news article could not be found.",
    };
  }

  const article = data as unknown as NewsArticle;
  const content = article.content as NewsArticleContent;
  const title = content?.seoTitle || article.headline;
  const description =
    content?.metaDescription ||
    article.summary ||
    (content?.body?.replace(/[#*`\[\]]/g, "").trim().slice(0, 160)) ||
    "";
  const canonicalUrl = `${SITE_URL}/news/${slug}`;
  const publishedTime = article.published_at ?? undefined;

  const ogImageUrl = article.hero_image_url || `${SITE_URL}/news/${slug}/opengraph-image`;

  return {
    title: `${title} | Choseno News`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Choseno",
      type: "article",
      publishedTime,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function NewsArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const { data, error } = await getArticle(slug);

  if (error || !data) {
    notFound();
  }

  const article = data as unknown as NewsArticle;
  const content = article.content as NewsArticleContent;
  const isBreaking = isBreakingNewsActive(article);
  const readingTime = estimateReadingMinutes(content?.body);
  const displayDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // ── JSON-LD NewsArticle + Breadcrumb structured data ──────────────────────
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: article.headline,
      description:
        content?.metaDescription || article.summary || undefined,
      datePublished: article.published_at ?? article.created_at,
      dateModified: article.updated_at,
      url: `${SITE_URL}/news/${slug}`,
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
      },
      ...(article.hero_image_url && {
        image: {
          "@type": "ImageObject",
          url: article.hero_image_url,
          description: content?.heroImageAlt ?? article.headline,
        },
      }),
      ...(content?.author?.name && {
        author: {
          "@type": "Person",
          name: content.author.name,
        },
      }),
      ...(content?.tags?.length && {
        keywords: content.tags.join(", "),
      }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "News", item: `${SITE_URL}/news` },
        { "@type": "ListItem", position: 3, name: article.headline, item: `${SITE_URL}/news/${slug}` },
      ],
    },
  ];

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <NewsArticleViewTracker slug={slug} category={article.category} />

      <NewsArticleDetailClient
        article={article}
        slug={slug}
        content={content}
        isBreaking={isBreaking}
        readingTime={readingTime}
        displayDate={displayDate}
      />
    </>
  );
}
