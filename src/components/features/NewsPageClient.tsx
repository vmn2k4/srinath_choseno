"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Newspaper,
  Calendar,
  ArrowRight,
  Globe,
  Zap,
  ChevronLeft,
  ChevronRight,
  Filter,
  UserCheck,
  Users,
} from "lucide-react";
import { Card, PageHeader, Badge, Button } from "@/components/primitives";
import { useTranslation } from "@/contexts/LanguageContext";
import { isBreakingNewsActive, type NewsArticleContent } from "@/lib/services/news";
import ShareMenu, { type ShareData } from "@/components/features/ShareMenu";
import MissionRegisterCTA from "@/components/features/MissionRegisterCTA";
import { SITE_URL } from "@/lib/constants/site";

interface NewsArticleRow {
  id: string;
  slug: string;
  headline: string;
  summary?: string | null;
  category: string;
  country?: string | null;
  province?: string | null;
  hero_image_url?: string | null;
  published_at?: string | null;
  event_date?: string | null;
  created_at?: string | null;
  is_breaking?: boolean;
  breaking_until?: string | null;
  content: unknown;
  news_article_politicians?: Array<{
    politician_id: string;
    profiles?: { id: string; full_name: string | null } | null;
  }>;
}

export interface UserRepresentative {
  id: string;
  name: string;
  role?: string | null;
  district?: string | null;
}

interface NewsPageClientProps {
  items: NewsArticleRow[];
  error: any;
  userRepresentatives?: UserRepresentative[];
  isLoggedIn?: boolean;
  // Pagination + active filters -- all resolved server-side (see
  // news/page.tsx) from the URL's searchParams. This component no longer
  // holds the full article corpus and slices/filters it client-side: every
  // filter or page change is a real navigation to a new `/news?...` URL, so
  // the server only ever fetches (and schemas) the page actually being
  // viewed. See docs discussion in the SEO audit this replaced.
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  category: string | null;
  country: string | null;
  rep: string | null;
  categories: string[];
  countries: string[];
}

export default function NewsPageClient({
  items,
  error,
  userRepresentatives = [],
  isLoggedIn = false,
  page,
  totalPages,
  total,
  pageSize,
  category,
  country,
  rep,
  categories,
  countries,
}: NewsPageClientProps) {
  const { t } = useTranslation();

  // Builds a /news?... href starting from the current filter state, applying
  // only the overrides passed in. Any category/country/rep override resets
  // to page 1 (a fresh filter always starts its own first page) unless the
  // caller is explicitly changing the page itself.
  const buildHref = (overrides: {
    category?: string | null;
    country?: string | null;
    rep?: string | null;
    page?: number;
  }) => {
    const filtersChanged = "category" in overrides || "country" in overrides || "rep" in overrides;
    const next = {
      category: "category" in overrides ? overrides.category : category,
      country: "country" in overrides ? overrides.country : country,
      rep: "rep" in overrides ? overrides.rep : rep,
      page: "page" in overrides ? overrides.page! : filtersChanged ? 1 : page,
    };
    const params = new URLSearchParams();
    if (next.category) params.set("category", next.category);
    if (next.country) params.set("country", next.country);
    if (next.rep) params.set("rep", next.rep);
    if (next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    return `/news${qs ? `?${qs}` : ""}`;
  };

  const hasActiveFilters = Boolean(category || country || rep);
  const startIndex = (page - 1) * pageSize;

  // Helper for generating page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (page >= totalPages - 3) {
        pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
      }
    }
    return pages;
  };

  // Generate share data for an article
  const generateShareData = (article: NewsArticleRow): ShareData => {
    const shareUrl = `${SITE_URL}/news/${article.slug}`;
    const basePostText = `📰 ${article.headline}\n\nTrack local democracy & rate officials on @choseno!`;
    const categoryTag = article.category ? `#${article.category.replace(/[^a-zA-Z0-9]/g, "")}` : "#CivicNews";
    const locTag = article.country ? `#${article.country.toUpperCase()}` : "";
    const hashtagList = [categoryTag, locTag, "#Choseno", "#RateYourPolitician"].filter(Boolean).join(" ");
    const shareText = `${basePostText}\n\n${hashtagList}\n${shareUrl}`;
    const hashtags = [categoryTag.replace("#", ""), locTag.replace("#", ""), "Choseno", "RateYourPolitician"].filter(Boolean);

    return {
      url: shareUrl,
      basePostText,
      hashtagList,
      shareText,
      hashtags,
      twitterUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(basePostText)}&url=${encodeURIComponent(shareUrl)}&hashtags=${encodeURIComponent(hashtags.join(","))}`,
    };
  };

  return (
    <div className="w-full max-w-none pb-20 px-4 lg:px-8 space-y-6">
      <MissionRegisterCTA variant="news" nextPath="/news" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader icon={Newspaper} title={t("newsPage.title")} />

        {/* Results counter */}
        {total > 0 && (
          <div className="text-xs text-text-muted font-medium bg-surface/50 px-3 py-1.5 rounded-full border border-border-light/30 w-fit">
            Showing <span className="text-text-main font-semibold">{startIndex + 1}–{Math.min(startIndex + pageSize, total)}</span> of <span className="text-text-main font-semibold">{total}</span> stories
          </div>
        )}
      </div>

      {/* Logged in Representatives Filter Bar */}
      {isLoggedIn && userRepresentatives.length > 0 && (
        <div className="p-3 bg-primary/5 rounded-2xl border border-primary/20 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <UserCheck size={15} />
              <span>Filter by My Representatives ({userRepresentatives.length})</span>
            </div>
            {rep && (
              <Link href={buildHref({ rep: null })} className="text-[11px] text-primary hover:underline font-semibold">
                Clear Representative Filter
              </Link>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <Link
              href={buildHref({ rep: rep === "all_reps" ? null : "all_reps" })}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                rep === "all_reps"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface/80 hover:bg-surface text-text-main border border-border-light/40"
              }`}
            >
              <Users size={12} />
              All My Representatives
            </Link>

            {userRepresentatives.map((r) => {
              const isSelected = rep === r.id;
              return (
                <Link
                  key={r.id}
                  href={buildHref({ rep: isSelected ? null : r.id })}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                    isSelected
                      ? "bg-primary text-white shadow-sm"
                      : "bg-surface/60 hover:bg-surface text-text-muted hover:text-text-main border border-border-light/30"
                  }`}
                >
                  <span>{r.name}</span>
                  {r.role && <span className="opacity-75 text-[10px]">({r.role})</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Country & Category Filter Bar -- real crawlable links to
          /news?category=... and /news?country=..., not client-only state,
          so a category tab is itself an internal-linking path a bot can
          follow and index independently. */}
      <div className="space-y-2">
        {countries.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <Globe size={14} className="text-text-muted shrink-0 mr-1 hidden sm:inline-block" />
            {["All", ...countries].map((c) => {
              const isSelected = (country ?? "All") === c;
              const label = c === "All" ? "All Countries" : c === "CA" ? "Canada 🇨🇦" : c === "US" ? "United States 🇺🇸" : c;
              return (
                <Link
                  key={c}
                  href={buildHref({ country: c === "All" ? null : c, rep: null })}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? "bg-primary text-white shadow-sm"
                      : "bg-surface/60 hover:bg-surface text-text-muted hover:text-text-main border border-border-light/30"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}

        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            <Filter size={14} className="text-text-muted shrink-0 mr-1 hidden sm:inline-block" />
            {["All", ...categories].map((cat) => {
              const isSelected = (category ?? "All") === cat;
              return (
                <Link
                  key={cat}
                  href={buildHref({ category: cat === "All" ? null : cat, rep: null })}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    isSelected
                      ? "bg-primary text-white shadow-sm"
                      : "bg-surface/60 hover:bg-surface text-text-muted hover:text-text-main border border-border-light/30"
                  }`}
                >
                  {cat}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
          {t("newsPage.failedToLoad")}
        </div>
      )}

      {items.length === 0 && !error ? (
        <Card padding="md" className="text-center py-16 text-text-muted text-sm space-y-3">
          <p>{rep ? "No news articles found for the selected representative." : t("newsPage.noArticles")}</p>
          {hasActiveFilters && (
            <Button as={Link} href="/news" variant="outline" size="sm" className="text-xs">
              Show All News Articles
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* News Article Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((article) => {
              const content = article.content as NewsArticleContent;
              const isBreaking = isBreakingNewsActive(article as any);

              // Check if this article tags any of the user's representatives
              const repIdsSet = new Set(userRepresentatives.map((r) => r.id));
              const taggedUserReps = (article.news_article_politicians ?? []).filter((p) =>
                repIdsSet.has(p.politician_id)
              );

              // Prioritize event_date to reflect when the news happened
              const rawDate = article.event_date || article.published_at || article.created_at;
              const displayDate = rawDate
                ? new Date(rawDate).toLocaleDateString("en-CA", {
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
                  className="group flex flex-col justify-between h-full overflow-hidden cursor-pointer hover:border-primary/40 transition-all duration-200"
                >
                  {/* Hero or Dynamic Visual Briefing Image */}
                  <div className="relative h-44 w-full overflow-hidden bg-slate-100 border-b border-border-light/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={article.hero_image_url || `/news/${article.slug}/opengraph-image`}
                      alt={content?.heroImageAlt ?? article.headline}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    {isBreaking && (
                      <span className="absolute top-2 left-2 flex items-center gap-1 bg-danger text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md z-10">
                        <Zap size={10} /> {t("newsPage.breaking")}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col flex-1 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge tone="primary">{article.category || "News"}</Badge>
                        {taggedUserReps.length > 0 && (
                          <Badge tone="accent" className="flex items-center gap-1">
                            <UserCheck size={10} /> My Rep
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        {article.country && (
                          <span className="flex items-center gap-1 font-semibold">
                            <Globe size={10} /> {article.country.toUpperCase() === "US" ? "USA 🇺🇸" : article.country.toUpperCase() === "CA" ? "CAN 🇨🇦" : article.country.toUpperCase()}
                          </span>
                        )}
                        {displayDate && (
                          <span className="flex items-center gap-1 font-medium">
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

                    <div className="flex items-center justify-between pt-2 mt-auto border-t border-border-light/20">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:text-primary-hover transition-colors">
                        {t("newsPage.readFull")} <ArrowRight size={13} />
                      </div>

                      <ShareMenu
                        articleId={article.id}
                        shareData={generateShareData(article)}
                        className="p-1.5 rounded-lg bg-surface/80 hover:bg-orange-500/20 text-text-muted hover:text-orange-500 transition-colors cursor-pointer"
                        iconSize={13}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination Navigation Controls -- real /news?page=N links */}
          {totalPages > 1 && (
            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <div className="flex items-center gap-1.5">
                {page === 1 ? (
                  <span className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1 opacity-40 border border-border-light/30 rounded-lg">
                    <ChevronLeft size={14} /> Previous
                  </span>
                ) : (
                  <Link
                    href={buildHref({ page: page - 1 })}
                    className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1 border border-border-light/40 rounded-lg hover:bg-surface transition-colors"
                  >
                    <ChevronLeft size={14} /> Previous
                  </Link>
                )}

                {getPageNumbers().map((p, idx) => {
                  if (p === "...") {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-text-muted select-none">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = p === page;
                  return isCurrent ? (
                    <span
                      key={`page-${p}`}
                      className="min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold bg-primary text-white shadow-sm inline-flex items-center justify-center"
                    >
                      {p}
                    </span>
                  ) : (
                    <Link
                      key={`page-${p}`}
                      href={buildHref({ page: Number(p) })}
                      className="min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all bg-surface/50 hover:bg-surface text-text-muted hover:text-text-main border border-border-light/30 inline-flex items-center justify-center"
                    >
                      {p}
                    </Link>
                  );
                })}

                {page === totalPages ? (
                  <span className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1 opacity-40 border border-border-light/30 rounded-lg">
                    Next <ChevronRight size={14} />
                  </span>
                ) : (
                  <Link
                    href={buildHref({ page: page + 1 })}
                    className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1 border border-border-light/40 rounded-lg hover:bg-surface transition-colors"
                  >
                    Next <ChevronRight size={14} />
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
