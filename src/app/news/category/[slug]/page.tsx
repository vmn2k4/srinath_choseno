import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/publicServer";
import { getPublishedNewsArticles, NEWS_CATEGORIES } from "@/lib/services/news";
import { categoryToSlug, resolveCategoryFromSlug } from "@/lib/utils/newsTaxonomy";
import { SITE_URL } from "@/lib/constants/site";
import NewsArticleCard from "@/components/features/NewsArticleCard";
import NewsPager from "@/components/features/NewsPager";

const BASE_URL = SITE_URL;
const PAGE_SIZE = 24;
// news_articles' public policy ("status = 'published' AND published_at <=
// now()") doesn't branch on auth.uid() -- safe for the cookie-free client.
export const revalidate = 300;

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

// Every category is a fixed, known slug (see NEWS_CATEGORIES) -- pre-render
// them all so a crawler can discover the hub even before any article in
// that category has ever been indexed elsewhere.
export function generateStaticParams() {
  return NEWS_CATEGORIES.map((c) => ({ slug: categoryToSlug(c) }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = resolveCategoryFromSlug(slug);
  if (!category) return { title: "Category Not Found | Choseno News" };

  const title = `${category} News & Updates | Choseno`;
  const description = `Browse every ${category} story on Choseno — civic news, policy announcements, and verified candidate updates tagged ${category}.`;
  const canonicalUrl = `${BASE_URL}/news/category/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, siteName: "Choseno", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function NewsCategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const category = resolveCategoryFromSlug(slug);
  if (!category) notFound();

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createPublicClient();
  const { data: articles, count } = await getPublishedNewsArticles(supabase, {
    category,
    limit: PAGE_SIZE,
    offset,
    withCount: true,
  });

  const items = articles ?? [];
  const total = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canonicalPath = `/news/category/${slug}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${category} News & Updates`,
      description: `Every ${category} story published on Choseno.`,
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
        { "@type": "ListItem", position: 3, name: category, item: `${BASE_URL}${canonicalPath}` },
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
        <span className="text-text-main font-semibold">{category}</span>
      </div>

      <div className="flex items-center gap-2.5">
        <Newspaper size={22} className="text-primary" />
        <h1 className="text-xl sm:text-2xl font-extrabold text-text-main">{category} News</h1>
      </div>
      <p className="text-sm text-text-muted -mt-3">
        {total} {total === 1 ? "story" : "stories"} tagged {category}
      </p>

      {/* Other categories -- every hub page cross-links every other hub. */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {NEWS_CATEGORIES.filter((c) => c !== category).map((c) => (
          <Link
            key={c}
            href={`/news/category/${categoryToSlug(c)}`}
            className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-surface/60 hover:bg-surface text-text-muted hover:text-text-main border border-border-light/30 transition-all"
          >
            {c}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">
          No {category} stories published yet.{" "}
          <Link href="/news" className="text-primary hover:underline font-semibold">
            Browse all news
          </Link>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
