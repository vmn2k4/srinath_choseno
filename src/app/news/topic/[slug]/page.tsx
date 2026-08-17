import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import { Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublishedNewsArticles } from "@/lib/services/news";
import { findArticlesByTagSlug, collectTagFrequency } from "@/lib/utils/newsTaxonomy";
import { SITE_URL } from "@/lib/constants/site";
import NewsArticleCard from "@/components/features/NewsArticleCard";
import NewsPager from "@/components/features/NewsPager";

const BASE_URL = SITE_URL;
const PAGE_SIZE = 24;
// Tags are freeform text (content.tags), not a DB enum, so there's no SQL
// filter to push this down to -- instead this scans the N most recent
// published articles and matches tag slugs in JS (see newsTaxonomy.ts). Fine
// at the current corpus size; if published articles grow well past this,
// move tag storage to its own indexed table/column.
const TAG_SCAN_LIMIT = 400;

interface TopicPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

// generateMetadata and the page component both need the same scan+match.
// Deduped via cache() so it's one DB round trip per request, not two.
const getTopicMatch = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await getPublishedNewsArticles(supabase, { limit: TAG_SCAN_LIMIT });
  return findArticlesByTagSlug(data ?? [], slug);
});

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const match = await getTopicMatch(slug);
  if (!match) return { title: "Topic Not Found | Choseno News" };

  const title = `${match.label} News & Updates | Choseno`;
  const description = `Every Choseno story tagged "${match.label}" — civic news and verified candidate updates on this topic.`;
  const canonicalUrl = `${BASE_URL}/news/topic/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, siteName: "Choseno", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function NewsTopicPage({ params, searchParams }: TopicPageProps) {
  const { slug } = await params;
  const match = await getTopicMatch(slug);
  if (!match) notFound();

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const total = match.articles.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = match.articles.slice(offset, offset + PAGE_SIZE);
  const canonicalPath = `/news/topic/${slug}`;

  // Related topics -- other tags co-occurring across this same matched set,
  // so a reader (and a crawler) can keep walking the topic graph.
  const relatedTopics = collectTagFrequency(match.articles)
    .filter((t) => t.slug !== slug)
    .slice(0, 12);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${match.label} News & Updates`,
      description: `Every Choseno story tagged "${match.label}".`,
      url: `${BASE_URL}${canonicalPath}`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: total,
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: offset + index + 1,
          name: item.headline,
          url: `${BASE_URL}/news/${item.slug}`,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem", position: 2, name: "Civic News", item: `${BASE_URL}/news` },
        { "@type": "ListItem", position: 3, name: match.label, item: `${BASE_URL}${canonicalPath}` },
      ],
    },
  ];

  return (
    <div className="w-full max-w-none pb-20 px-4 lg:px-8 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Link href="/news" className="hover:text-text-main hover:underline">Civic News</Link>
        <span>/</span>
        <span className="text-text-main font-semibold">{match.label}</span>
      </div>

      <div className="flex items-center gap-2.5">
        <Tag size={20} className="text-primary" />
        <h1 className="text-xl sm:text-2xl font-extrabold text-text-main">{match.label}</h1>
      </div>
      <p className="text-sm text-text-muted -mt-3">
        {total} {total === 1 ? "story" : "stories"} tagged &ldquo;{match.label}&rdquo;
      </p>

      {relatedTopics.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {relatedTopics.map((t) => (
            <Link
              key={t.slug}
              href={`/news/topic/${t.slug}`}
              className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-surface/60 hover:bg-surface text-text-muted hover:text-text-main border border-border-light/30 transition-all"
            >
              {t.tag}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((article) => (
          <NewsArticleCard key={article.id} article={article} />
        ))}
      </div>
      <NewsPager
        page={page}
        totalPages={totalPages}
        buildHref={(p) => `${canonicalPath}${p > 1 ? `?page=${p}` : ""}`}
      />
    </div>
  );
}
