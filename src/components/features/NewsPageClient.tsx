"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Newspaper, Calendar, ArrowRight, Globe, Zap, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Card, PageHeader, Badge, Button } from "@/components/primitives";
import { useTranslation } from "@/contexts/LanguageContext";
import { isBreakingNewsActive, type NewsArticleContent } from "@/lib/services/news";

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
}

const ITEMS_PER_PAGE = 12;

export default function NewsPageClient({
  items,
  error,
}: {
  items: NewsArticleRow[];
  error: any;
}) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Sort strictly by the date the news happened (event_date falling back to published_at/created_at)
  const sortedItems = useMemo(() => {
    const getTimestamp = (a: NewsArticleRow) => {
      const dateStr = a.event_date || a.published_at || a.created_at;
      return dateStr ? new Date(dateStr).getTime() : 0;
    };
    return [...items].sort((a, b) => getTimestamp(b) - getTimestamp(a));
  }, [items]);

  // Extract unique categories for quick tabs
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return ["All", ...Array.from(set).sort()];
  }, [items]);

  // Filter by category if selected
  const filteredItems = useMemo(() => {
    if (selectedCategory === "All") return sortedItems;
    return sortedItems.filter(
      (item) => item.category?.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [sortedItems, selectedCategory]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  // Helper for generating page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (validPage <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (validPage >= totalPages - 3) {
        pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", validPage - 1, validPage, validPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="w-full max-w-none pb-20 px-4 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader icon={Newspaper} title={t("newsPage.title")} />
        
        {/* Results counter */}
        {filteredItems.length > 0 && (
          <div className="text-xs text-text-muted font-medium bg-surface/50 px-3 py-1.5 rounded-full border border-border-light/30 w-fit">
            Showing <span className="text-text-main font-semibold">{startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredItems.length)}</span> of <span className="text-text-main font-semibold">{filteredItems.length}</span> stories
          </div>
        )}
      </div>

      {/* Category Filter Pills */}
      {categories.length > 2 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          <Filter size={14} className="text-text-muted shrink-0 mr-1 hidden sm:inline-block" />
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategorySelect(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary text-white shadow-sm"
                    : "bg-surface/60 hover:bg-surface text-text-muted hover:text-text-main border border-border-light/30"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
          {t("newsPage.failedToLoad")}
        </div>
      )}

      {filteredItems.length === 0 && !error ? (
        <Card padding="md" className="text-center py-16 text-text-muted text-sm">
          {t("newsPage.noArticles")}
        </Card>
      ) : (
        <>
          {/* News Article Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedItems.map((article) => {
              const content = article.content as NewsArticleContent;
              const isBreaking = isBreakingNewsActive(article as any);
              
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
                  {/* Hero image */}
                  {article.hero_image_url && (
                    <div className="relative h-40 w-full overflow-hidden bg-surface/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={article.hero_image_url}
                        alt={content?.heroImageAlt ?? article.headline}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {isBreaking && (
                        <span className="absolute top-2 left-2 flex items-center gap-1 bg-danger text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                          <Zap size={10} /> {t("newsPage.breaking")}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col flex-1 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge tone="primary">{article.category || "News"}</Badge>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        {article.country && (
                          <span className="flex items-center gap-1">
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

          {/* Pagination Navigation Controls */}
          {totalPages > 1 && (
            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(validPage - 1)}
                  disabled={validPage === 1}
                  className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Previous
                </Button>

                {getPageNumbers().map((page, idx) => {
                  if (page === "...") {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-text-muted select-none">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = page === validPage;
                  return (
                    <button
                      key={`page-${page}`}
                      onClick={() => handlePageChange(Number(page))}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-primary text-white shadow-sm"
                          : "bg-surface/50 hover:bg-surface text-text-muted hover:text-text-main border border-border-light/30"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(validPage + 1)}
                  disabled={validPage === totalPages}
                  className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1 disabled:opacity-40"
                >
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
