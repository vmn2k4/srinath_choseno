import Link from "next/link";
import { Newspaper, ArrowRight } from "lucide-react";
import NewsArticleCard from "@/components/features/NewsArticleCard";
import { categoryToSlug } from "@/lib/utils/newsTaxonomy";
import type { NewsArticle } from "@/lib/services/news";

// "Related Coverage" 3-card grid at the bottom of every article -- the SEO
// audit's #2 finding was that a reader (and a crawler) hits a dead end at
// the end of an article. Fully data-driven off the article's own category,
// so it needs zero manual curation and stays correct as new articles publish.
export default function RelatedNewsSection({
  articles,
  category,
}: {
  articles: NewsArticle[];
  category: string;
}) {
  if (!articles.length) return null;

  return (
    <div className="pt-2 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
          <Newspaper size={16} className="text-primary" /> Related Coverage in {category}
        </h2>
        <Link
          href={`/news/category/${categoryToSlug(category)}`}
          className="text-xs font-bold text-primary hover:text-primary-hover inline-flex items-center gap-1 shrink-0"
        >
          See all {category} news <ArrowRight size={12} />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {articles.map((article) => (
          <NewsArticleCard key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
}
