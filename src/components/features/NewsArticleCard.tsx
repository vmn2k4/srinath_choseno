import Link from "next/link";
import { Calendar, Globe, ArrowRight } from "lucide-react";
import { Card, Badge } from "@/components/primitives";
import type { NewsArticle, NewsArticleContent } from "@/lib/services/news";

// Shared, server-renderable article card -- no client state or handlers, so
// it costs zero client JS wherever it's used. Used by the /news/category and
// /news/topic hub pages and by RelatedNewsSection; NewsPageClient's main
// feed keeps its own richer card (it needs the share button, "My Rep"
// badge, etc.) rather than being forced through this one.
export default function NewsArticleCard({ article }: { article: Pick<NewsArticle, "id" | "slug" | "headline" | "summary" | "category" | "country" | "hero_image_url" | "published_at" | "event_date" | "created_at" | "content"> }) {
  const content = article.content as NewsArticleContent | undefined;
  const rawDate = article.event_date || article.published_at || article.created_at;
  const displayDate = rawDate
    ? new Date(rawDate).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
    : null;

  return (
    <Card
      as={Link}
      href={`/news/${article.slug}`}
      interactive
      padding="none"
      className="group flex flex-col justify-between h-full overflow-hidden hover:border-primary/40 transition-all duration-200"
    >
      <div className="relative h-40 w-full overflow-hidden bg-slate-100 border-b border-border-light/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={article.hero_image_url || `/news/${article.slug}/opengraph-image`}
          alt={content?.heroImageAlt ?? article.headline}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>

      <div className="flex flex-col flex-1 p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Badge tone="primary">{article.category || "News"}</Badge>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {article.country && (
              <span className="flex items-center gap-1 font-semibold">
                <Globe size={10} /> {article.country.toUpperCase()}
              </span>
            )}
            {displayDate && (
              <span className="flex items-center gap-1 font-medium">
                <Calendar size={10} /> {displayDate}
              </span>
            )}
          </div>
        </div>

        <h3 className="text-base font-bold text-text-main leading-snug line-clamp-2 md:line-clamp-3 group-hover:text-primary transition-colors">
          {article.headline}
        </h3>

        {article.summary && (
          <p className="hidden md:block text-xs text-text-muted leading-relaxed line-clamp-3">{article.summary}</p>
        )}

        <div className="pt-2 mt-auto border-t border-border-light/20 inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:text-primary-hover transition-colors">
          Read full article <ArrowRight size={13} />
        </div>
      </div>
    </Card>
  );
}
