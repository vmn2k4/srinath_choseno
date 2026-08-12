"use client";

import React from "react";
import Link from "next/link";
import { Newspaper, Calendar, ArrowRight, Globe, Zap } from "lucide-react";
import { Card, PageHeader, Badge } from "@/components/primitives";
import { useTranslation } from "@/contexts/LanguageContext";
import { isBreakingNewsActive, type NewsArticleContent } from "@/lib/services/news";

interface NewsArticleRow {
  id: string;
  slug: string;
  headline: string;
  summary?: string | null;
  category: string;
  country?: string | null;
  hero_image_url?: string | null;
  published_at?: string | null;
  is_breaking?: boolean;
  breaking_until?: string | null;
  content: unknown;
}

export default function NewsPageClient({
  items,
  error,
}: {
  items: NewsArticleRow[];
  error: any;
}) {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-none pb-20 px-4 lg:px-8 space-y-8">
      <PageHeader icon={Newspaper} title={t("newsPage.title")} />

      {error && (
        <div className="px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
          {t("newsPage.failedToLoad")}
        </div>
      )}

      {items.length === 0 && !error ? (
        <Card padding="md" className="text-center py-16 text-text-muted text-sm">
          {t("newsPage.noArticles")}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((article) => {
            const content = article.content as NewsArticleContent;
            const isBreaking = isBreakingNewsActive(article as any);
            const displayDate = article.published_at
              ? new Date(article.published_at).toLocaleDateString("en-CA", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : null;

            return (
              <Card
                key={article.id}
                as={Link}
                href={`/news/${article.slug}`}
                interactive
                padding="none"
                className="group flex flex-col justify-between h-full overflow-hidden cursor-pointer"
              >
                {/* Hero image */}
                {article.hero_image_url && (
                  <div className="relative h-40 w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={article.hero_image_url}
                      alt={content?.heroImageAlt ?? article.headline}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {isBreaking && (
                      <span className="absolute top-2 left-2 flex items-center gap-1 bg-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        <Zap size={10} /> {t("newsPage.breaking")}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-col flex-1 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge tone="primary">{article.category}</Badge>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      {article.country && (
                        <span className="flex items-center gap-1">
                          <Globe size={10} /> {article.country.toUpperCase()}
                        </span>
                      )}
                      {displayDate && (
                        <span className="flex items-center gap-1">
                          <Calendar size={10} /> {displayDate}
                        </span>
                      )}
                    </div>
                  </div>

                  {isBreaking && !article.hero_image_url && (
                    <span className="inline-flex items-center gap-1 bg-danger/10 text-danger text-xs font-bold px-2 py-0.5 rounded-full w-fit">
                      <Zap size={10} /> {t("newsPage.breaking")}
                    </span>
                  )}

                  <h2 className="text-base font-bold text-text-main leading-snug line-clamp-2 md:line-clamp-3 group-hover:text-primary transition-colors">
                    {article.headline}
                  </h2>

                  {article.summary && (
                    <p className="hidden md:block text-xs text-text-muted leading-relaxed line-clamp-3">
                      {article.summary}
                    </p>
                  )}

                  <div className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:text-primary-hover transition-colors pt-2 mt-auto border-t border-border-light/20">
                    {t("newsPage.readFull")} <ArrowRight size={13} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
