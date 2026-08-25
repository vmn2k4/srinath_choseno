"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import {
  getPublishedNewsArticles,
  getPublishedNewsArticlesByEngagement,
  type NewsArticle,
} from "@/lib/services/news";
import NewsFeedPostCard from "@/components/features/NewsFeedPostCard";
import NewsFeedControls, { type NewsFeedSortMode, type NewsFeedTimeRange } from "@/components/features/NewsFeedControls";

const PAGE_SIZE = 12;

const TIME_RANGE_LABELS: Record<NewsFeedTimeRange, string> = {
  "2d": "the last 2 days",
  week: "the last week",
  month: "the last month",
};

function timeRangeToIso(range: NewsFeedTimeRange): string {
  const days = range === "month" ? 30 : range === "week" ? 7 : 2;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// The main /news feed body -- unfiltered, or scoped to a country/category
// pill (see news/page.tsx's useInfiniteFeed) -- a Facebook-timeline read of
// the article data. The only things page.tsx threads through are
// `country`/`category`, resolved server-side from the URL the same way the
// pill bar above this component already reads them -- clicking a pill is a
// real navigation (same crawlable-link reasoning as always), and this
// component picks the new filter back up from its props on the resulting
// page.
//
// Sort (recent/engagement/interesting) and the time-range filter default to
// recent + last 2 days and live entirely here as a browsing preference, not
// round-tripped through the URL/page.tsx the way country/category are. This
// outer component owns only that preference state; NewsInfiniteFeedList
// below owns the actual fetched article list, keyed on everything that
// defines "what page 1 means" (sort/time/country/category) so a change to
// any of those remounts it with fresh state instead of needing a manual
// reset effect (which react-hooks/set-state-in-effect flags -- see that
// component's own comment).
export default function NewsInfiniteFeed({
  country,
  category,
}: {
  country?: string | null;
  category?: string | null;
}) {
  const [sortMode, setSortMode] = useState<NewsFeedSortMode>("recent");
  const [timeRange, setTimeRange] = useState<NewsFeedTimeRange>("2d");

  return (
    <div className="space-y-6">
      <NewsFeedControls
        sortMode={sortMode}
        onSortChange={setSortMode}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />
      <NewsInfiniteFeedList
        key={`${sortMode}|${timeRange}|${country ?? ""}|${category ?? ""}`}
        sortMode={sortMode}
        timeRange={timeRange}
        country={country}
        category={category}
      />
    </div>
  );
}

// Remounted (via the `key` above) on every sort/time/country/category
// change -- its useState initializers ARE the "reset", so there's no reset
// effect to fight React's set-state-in-effect rule over.
//
// Every post that tags a politician gets NewsArticleLinkedPoliticians (the
// same "rate the people mentioned in this article" strip the full article
// page has) rendered right under it -- reused as-is, not reimplemented, so
// a rating cast here is the exact same politician_ratings row the article
// page, wall page, and candidate chips all read back.
function NewsInfiniteFeedList({
  sortMode,
  timeRange,
  country,
  category,
}: {
  sortMode: NewsFeedSortMode;
  timeRange: NewsFeedTimeRange;
  country?: string | null;
  category?: string | null;
}) {
  const supabase = createClient();

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false); // guards against the observer firing a second fetch before state catches up

  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setErrored(false);

    const eventDateAfter = timeRangeToIso(timeRange);
    const { data, error } =
      sortMode === "engagement"
        ? await getPublishedNewsArticlesByEngagement(supabase, {
            country: country ?? undefined,
            category: category ?? undefined,
            eventDateAfter,
            limit: PAGE_SIZE,
            offset,
            withPoliticianDetails: true,
          })
        : await getPublishedNewsArticles(supabase, {
            country: country ?? undefined,
            category: category ?? undefined,
            eventDateAfter,
            orderBy: sortMode === "interesting" ? "interesting" : "recent",
            limit: PAGE_SIZE,
            offset,
            withPoliticianDetails: true,
          });

    if (error) {
      setErrored(true);
      setLoading(false);
      loadingRef.current = false;
      return;
    }

    const rows = data ?? [];
    setArticles((prev) => [...prev, ...rows]);
    setOffset((prev) => prev + rows.length);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
    setInitialLoading(false);
    loadingRef.current = false;
  }, [supabase, offset, hasMore, sortMode, timeRange, country, category]);

  // One observer covers both the first page and every page after it -- no
  // separate "kick off on mount" effect calling loadNextPage() directly,
  // which react-hooks/set-state-in-effect flags (calling a function that
  // sets state synchronously in an effect body, as opposed to from a
  // subscription callback). The sentinel renders unconditionally from the
  // very first paint (hasMore starts true), so with nothing else above it
  // yet it's already within the 600px rootMargin and the observer's own
  // callback -- an allowed place to setState -- fires immediately and loads
  // page one the same way it loads every page after.
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadNextPage();
      },
      { rootMargin: "600px" } // start fetching well before the sentinel is actually on screen
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadNextPage]);

  return (
    <>
      {initialLoading ? (
        <div className="py-12 flex justify-center">
          <Spinner />
        </div>
      ) : articles.length === 0 && !errored ? (
        <p className="text-sm text-text-muted text-center py-8">
          No stories in {TIME_RANGE_LABELS[timeRange]}. Try a wider range above.
        </p>
      ) : (
        <div className="space-y-5">
          {articles.map((article) => (
            <NewsFeedPostCard key={article.id} article={article} />
          ))}
        </div>
      )}

      {/* Sentinel -- always rendered while more pages might exist so the
          observer has something to watch even before the first page comes
          back; harmless to sit just past an empty list momentarily. */}
      {hasMore && !errored && (
        <div ref={sentinelRef} className="py-6 flex justify-center">
          {loading && !initialLoading && <Spinner />}
        </div>
      )}

      {errored && (
        <div className="py-6 text-center space-y-2">
          <p className="text-sm text-danger">Couldn&apos;t load more stories.</p>
          <button
            type="button"
            onClick={() => {
              setErrored(false);
              loadNextPage();
            }}
            className="text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {!hasMore && !errored && articles.length > 0 && (
        <div className="py-8 text-center text-xs text-text-muted flex items-center justify-center gap-1.5">
          <CheckCircle2 size={14} className="text-primary" />
          You&apos;re all caught up — {articles.length} more {articles.length === 1 ? "story" : "stories"} shown
        </div>
      )}
    </>
  );
}

