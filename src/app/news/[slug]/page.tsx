import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/publicServer";
import {
  getNewsArticleBySlug,
  getPublishedNewsArticles,
  estimateReadingMinutes,
  isBreakingNewsActive,
  type NewsArticle,
  type NewsArticleContent,
} from "@/lib/services/news";
import NewsArticleDetailClient from "@/components/features/NewsArticleDetailClient";
import NewsArticleViewTracker from "@/components/analytics/NewsArticleViewTracker";
import GoogleNewsShowcaseSync from "@/components/analytics/GoogleNewsShowcaseSync";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

// Published articles are public regardless of who's asking -- the RLS
// policy ("status = 'published' AND published_at <= now()") never branches
// on auth.uid(), so this page uses the cookie-free client and can actually
// benefit from `revalidate` below. See src/lib/supabase/publicServer.ts.
//
// 5 minutes: long enough to spare the DB on a viral article's traffic
// spike, short enough that a published correction (see /corrections-policy)
// shows up promptly instead of sitting stale for hours.
export const revalidate = 300;

// generateMetadata and the page component below both look up the same
// article. Deduped via React cache() so it's one DB round trip per request
// instead of two.
const getArticle = cache(async (slug: string) => {
  const supabase = await createPublicClient();
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
  const rawTitle = content?.seoTitle || article.headline;
  const title = rawTitle.replace(/\s*\|\s*Choseno(?:\s+Civic\s+News)?$/i, "").trim();
  const description =
    content?.metaDescription ||
    article.summary ||
    content?.body?.replace(/[#*`\[\]]/g, "").trim().slice(0, 160) ||
    "";
  const canonicalUrl = `${SITE_URL}/news/${slug}`;
  const publishedTime = (article.published_at || article.event_date || article.created_at) ?? undefined;
  const modifiedTime = article.updated_at ?? publishedTime;
  const tags = content?.tags || [article.category, article.country || "Civic News"];

  // Prefer the static, pre-generated card (see generateNewsArticleOgImage in
  // src/lib/services/newsOgImage.ts) over live-rendering next/og on every
  // crawl -- same hero_image_url-first fallback already used by
  // sitemap.ts, news-sitemap.xml/route.ts, and the JSON-LD `image` field
  // below. This is the one that actually matters for social cards: it's
  // what X/Twitter/Facebook's crawlers read as og:image / twitter:image.
  const ogImageUrl = article.hero_image_url || `${SITE_URL}/news/${slug}/opengraph-image`;

  return {
    title: `${title} | Choseno Civic News`,
    description,
    keywords: tags,
    category: article.category,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${title} | Choseno`,
      description,
      url: canonicalUrl,
      siteName: "Choseno",
      type: "article",
      publishedTime,
      modifiedTime,
      section: article.category,
      tags,
      authors: [content?.author?.name || "Choseno Civic News Desk"],
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
      title: `${title} | Choseno`,
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

  // "Related Coverage" grid at the bottom of the article -- same category,
  // excluding this article, most recent first. Purely data-driven off
  // article.category so it needs no manual curation as new stories publish.
  const supabaseForRelated = await createPublicClient();
  const { data: relatedArticles } = await getPublishedNewsArticles(supabaseForRelated, {
    category: article.category,
    excludeSlug: slug,
    limit: 3,
  });
  const displayDate = (article.published_at || article.event_date || article.created_at)
    ? new Date(article.published_at || article.event_date || article.created_at || "").toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const ogImageUrl = `${SITE_URL}/news/${slug}/opengraph-image`;

  // Politicians tagged on this article -- surfaced as schema.org `mentions`
  // Person entities so an AI answer engine reading this article can also
  // resolve who's actually being written about, their role/district, and
  // how to reach them, instead of just seeing prose that names them.
  const mentionedPersons = ((article as any).news_article_politicians || [])
    .map((np: any) => np.profiles)
    .filter((p: any) => p?.id && p?.full_name)
    .map((p: any) => {
      const pp = p.politician_profiles;
      const wallSlug = pp?.wall_slug;
      const wallUrl = wallSlug ? `${SITE_URL}/wall/${wallSlug}` : p.current_ghost_id ? `${SITE_URL}/wall/${p.current_ghost_id}` : undefined;
      const jobTitle = p.designation || pp?.political_target_role || undefined;
      return {
        "@type": "Person",
        name: p.full_name,
        ...(jobTitle ? { jobTitle } : {}),
        ...(p.constituency
          ? { worksFor: { "@type": "GovernmentOrganization", name: jobTitle ? `${jobTitle} — ${p.constituency}` : p.constituency } }
          : {}),
        ...(pp?.contact_phone ? { telephone: pp.contact_phone } : {}),
        ...(pp?.contact_email ? { email: pp.contact_email } : {}),
        ...(wallUrl ? { url: wallUrl } : {}),
      };
    });

  // ── JSON-LD NewsArticle + Breadcrumb structured data ──────────────────────
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `${SITE_URL}/news/${slug}`,
      },
      headline: article.headline,
      description: content?.metaDescription || article.summary || undefined,
      articleSection: article.category,
      inLanguage: "en",
      datePublished: article.published_at ?? article.event_date ?? article.created_at,
      dateModified: article.updated_at ?? article.published_at ?? article.event_date,
      url: `${SITE_URL}/news/${slug}`,
      publisher: {
        "@type": "NewsMediaOrganization",
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icon.svg`,
        },
        publishingPrinciples: `${SITE_URL}/editorial-standards`,
        correctionsPolicy: `${SITE_URL}/corrections-policy`,
      },
      author: {
        "@type": "Organization",
        name: content?.author?.name || "Choseno Civic News Desk",
        url: SITE_URL,
      },
      image: {
        "@type": "ImageObject",
        url: article.hero_image_url || ogImageUrl,
        description: content?.heroImageAlt ?? article.headline,
      },
      ...(content?.tags?.length && {
        keywords: content.tags.join(", "),
      }),
      ...(mentionedPersons.length > 0 && {
        mentions: mentionedPersons,
      }),
      ...(article.country && {
        spatialCoverage: {
          "@type": "Place",
          name: `${article.province ? article.province + ", " : ""}${article.country}`,
        },
      }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Civic News", item: `${SITE_URL}/news` },
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
      <GoogleNewsShowcaseSync />

      <NewsArticleDetailClient
        article={article}
        slug={slug}
        content={content}
        isBreaking={isBreaking}
        readingTime={readingTime}
        displayDate={displayDate}
        ogImageUrl={ogImageUrl}
        relatedArticles={(relatedArticles ?? []) as NewsArticle[]}
      />
    </>
  );
}
