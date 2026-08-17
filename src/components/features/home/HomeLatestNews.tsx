"use client";

import Link from "next/link";
import { Newspaper, ArrowRight, Clock } from "lucide-react";
import { Reveal, HoverLift, StaggerGroup, StaggerItem } from "@/components/features/home/HomeMotion";
import { useTranslation } from "@/contexts/LanguageContext";

export interface HomeLatestNewsArticle {
  slug: string;
  headline: string;
  summary: string | null;
  category: string;
  publishedAt: string | null;
}

interface HomeLatestNewsProps {
  articles: HomeLatestNewsArticle[];
}

// Hub-first internal linking: the homepage is Google's most-crawled page,
// so surfacing fresh articles here (in addition to /news) gives Googlebot a
// direct, high-authority link to follow into new stories the moment they
// publish, instead of relying solely on the sitemap being re-crawled.
// Renders nothing if there's no news yet, rather than an empty section.
export default function HomeLatestNews({ articles }: HomeLatestNewsProps) {
  const { t } = useTranslation();

  if (!articles || articles.length === 0) return null;

  return (
    <section className="relative py-16 sm:py-20 px-4 sm:px-6" aria-label="Latest civic news">
      <div className="max-w-6xl mx-auto">
        <Reveal className="flex flex-wrap items-end justify-between gap-4 mb-10 sm:mb-12">
          <div>
            <div className="flex items-center gap-2 text-primary text-xs sm:text-sm font-bold uppercase tracking-wide mb-2">
              <Newspaper size={16} aria-hidden="true" />
              {t("home.latestNews.eyebrow", "Latest Civic News")}
            </div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
              {t("home.latestNews.title", "Fresh off the wire.")}
            </h2>
          </div>
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-primary hover:underline shrink-0"
          >
            {t("home.latestNews.viewAll", "See all news")}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Reveal>

        <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
          {articles.map((article) => (
            <StaggerItem key={article.slug}>
              <HoverLift lift={5} shine className="h-full">
                <Link
                  href={`/news/${article.slug}`}
                  className="glass-card p-4 sm:p-5 lg:p-6 h-full flex flex-col gap-2 sm:gap-3 hover:border-primary/40 transition-colors duration-300"
                >
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-muted">
                    <span className="text-primary">{article.category}</span>
                    {article.publishedAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} aria-hidden="true" />
                          {new Date(article.publishedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-text-main leading-snug line-clamp-2">
                    {article.headline}
                  </h3>
                  {article.summary && (
                    <p className="text-xs sm:text-sm text-text-muted leading-relaxed line-clamp-2">
                      {article.summary}
                    </p>
                  )}
                </Link>
              </HoverLift>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
