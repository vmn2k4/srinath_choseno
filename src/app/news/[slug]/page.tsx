import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Clock, Globe, User, ExternalLink, Zap } from "lucide-react";
import { Card, Badge } from "@/components/primitives";
import { createClient } from "@/lib/supabase/server";
import {
  getNewsArticleBySlug,
  estimateReadingMinutes,
  isBreakingNewsActive,
  type NewsArticle,
  type NewsArticleContent,
} from "@/lib/services/news";
import NewsArticleBody from "@/components/features/NewsArticleBody";
import NewsComments from "@/components/features/NewsComments";
import NewsArticleViewTracker from "@/components/analytics/NewsArticleViewTracker";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

// ── generateMetadata (SSR SEO) ─────────────────────────────────────────────

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data, error } = await getNewsArticleBySlug(supabase, slug);

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
  const supabase = await createClient();
  const { data, error } = await getNewsArticleBySlug(supabase, slug);

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

  // ── JSON-LD NewsArticle structured data ──────────────────────────────────
  const jsonLd = {
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
  };

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <NewsArticleViewTracker slug={slug} category={article.category} />

      <div className="w-full max-w-none pb-20 px-4 lg:px-8 space-y-6">
        {/* Back */}
        <Link
          href="/news"
          className="inline-flex items-center gap-2 text-xs font-bold text-text-muted hover:text-text-main transition-colors"
        >
          <ArrowLeft size={14} /> Back to News
        </Link>

        {/* Hero image */}
        {article.hero_image_url && (
          <div className="relative rounded-2xl overflow-hidden h-56 sm:h-72 w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.hero_image_url}
              alt={content?.heroImageAlt ?? article.headline}
              className="w-full h-full object-cover"
            />
            {isBreaking && (
              <span className="absolute top-3 left-3 flex items-center gap-1 bg-danger text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                <Zap size={11} /> BREAKING
              </span>
            )}
            {content?.heroImageCaption && (
              <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-4 py-2">
                {content.heroImageCaption}
              </p>
            )}
          </div>
        )}

        {/* Article header */}
        <Card padding="md" className="space-y-5">
          <div className="space-y-3 pb-5 border-b border-border-light/20">
            <div className="flex items-center flex-wrap gap-2">
              <Badge tone="primary">{article.category}</Badge>
              {isBreaking && !article.hero_image_url && (
                <span className="inline-flex items-center gap-1 bg-danger/10 text-danger text-xs font-bold px-2 py-0.5 rounded-full">
                  <Zap size={10} /> BREAKING
                </span>
              )}
              {content?.tags?.map((tag) => (
                <Badge key={tag} tone="neutral">{tag}</Badge>
              ))}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-main leading-tight">
              {article.headline}
            </h1>

            {article.summary && (
              <p className="text-sm text-text-muted leading-relaxed">{article.summary}</p>
            )}

            <div className="flex items-center flex-wrap gap-4 text-xs text-text-muted">
              {displayDate && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> {displayDate}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock size={12} /> {readingTime} min read
              </span>
              {article.country && (
                <span className="flex items-center gap-1">
                  <Globe size={12} /> {article.country.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Author byline */}
          {content?.author?.name && (
            <div className="flex items-center gap-3 pb-5 border-b border-border-light/20">
              {content.author.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={content.author.photoUrl}
                  alt={content.author.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              <div>
                <p className="text-sm font-semibold text-text-main flex items-center gap-1">
                  <User size={12} className="text-text-muted" />
                  {content.author.name}
                </p>
                {content.author.bio && (
                  <p className="text-xs text-text-muted">{content.author.bio}</p>
                )}
              </div>
            </div>
          )}

          {/* Article body — rendered as Markdown in a client component */}
          {content?.body ? (
            <NewsArticleBody body={content.body} />
          ) : (
            <p className="text-text-muted text-sm italic">No article content yet.</p>
          )}

          {/* Sources */}
          {content?.sources && content.sources.length > 0 && (
            <div className="pt-5 border-t border-border-light/20 space-y-2">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest">Sources</h3>
              <ul className="space-y-1">
                {content.sources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={10} /> {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Comments — client component (requires auth) */}
        <NewsComments articleId={article.id} articleSlug={slug} />
      </div>
    </>
  );
}
