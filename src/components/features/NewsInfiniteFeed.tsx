"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Calendar, Globe, Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, Spinner } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import {
  getPublishedNewsArticles,
  getPublishedNewsArticlesByEngagement,
  isBreakingNewsActive,
  type NewsArticle,
  type NewsArticleContent,
} from "@/lib/services/news";
import NewsArticleLinkedPoliticians, { type LinkedPolitician } from "@/components/features/NewsArticleLinkedPoliticians";
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
            <FeedPost key={article.id} article={article} />
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

function FeedPost({ article }: { article: NewsArticle }) {
  const content = article.content as NewsArticleContent | undefined;
  const isBreaking = isBreakingNewsActive(article);
  const rawDate = article.event_date || article.published_at || article.created_at;
  const displayDate = rawDate
    ? new Date(rawDate).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
    : null;

  // news_article_politicians isn't on the NewsArticle type (it's a query-
  // shaped join, not a column -- see getPublishedNewsArticles's comment),
  // so it's read off the row loosely here the same way NewsPageClient does
  // for the same join.
  const taggedPoliticians = (
    (
      article as unknown as {
        news_article_politicians?: Array<{ politician_id: string; profiles: LinkedPolitician | null }>;
      }
    ).news_article_politicians ?? []
  )
    .map((p) => p.profiles)
    .filter((p): p is LinkedPolitician => Boolean(p));

  // Landscape images (real hero photos, and every auto-generated
  // opengraph-image fallback -- those are a fixed 1200x630 composite) read
  // better beside the text than stretched full-width above it; a tall
  // portrait photo works the other way round. Not knowable up front (only
  // the URL is stored, not dimensions), so it's measured client-side once
  // the image actually loads and the layout switches accordingly. Defaults
  // to 1200/630 -- the OG-composite's fixed size, and the common case for
  // real photos too -- so there's no layout jump for most cards; only
  // flips to stacked for the portrait minority once its real ratio loads.
  //
  // The container is sized to this exact ratio (CSS aspect-ratio, not a
  // fixed h-* class) and the image is object-contain, not object-cover --
  // NewsArticleCard hit this same problem first (see its own comment): a
  // fixed-height container force-cropping the wide OG composite chopped
  // its edges off. Matching the container's aspect ratio to the image's
  // real one means the image scales fully responsively with card width and
  // is never cropped, on any screen size.
  const [aspectRatio, setAspectRatio] = useState(1200 / 630);
  const isWide = aspectRatio >= 1.2;

  return (
    <Card padding="none" className="overflow-hidden">
      <Link href={`/news/${article.slug}`} className={`group block ${isWide ? "sm:flex sm:flex-row" : ""}`}>
        <div
          className={`relative shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center ${
            isWide ? "sm:w-2/5" : "w-full"
          }`}
          style={{ aspectRatio }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.hero_image_url || `/news/${article.slug}/opengraph-image`}
            alt={content?.heroImageAlt ?? article.headline}
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              if (naturalWidth && naturalHeight) setAspectRatio(naturalWidth / naturalHeight);
            }}
            className="w-full h-full object-contain object-center transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
        <div className="flex-1 p-4 md:p-5 space-y-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
              {article.category || "News"}
            </span>
            {isBreaking && (
              <span className="inline-flex items-center gap-1 bg-danger/10 text-danger text-xs font-bold px-2 py-0.5 rounded-full">
                <Zap size={10} /> Breaking
              </span>
            )}
            {article.country && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted">
                <Globe size={10} /> {article.country.toUpperCase()}
              </span>
            )}
            {displayDate && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-text-muted">
                <Calendar size={10} /> {displayDate}
              </span>
            )}
          </div>
          <h3 className="text-lg font-extrabold text-text-main leading-snug group-hover:text-primary transition-colors">
            {article.headline}
          </h3>
          {article.summary && <p className="text-sm text-text-muted leading-relaxed">{article.summary}</p>}
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-primary group-hover:text-primary-hover transition-colors">
            Read full article <ArrowRight size={14} />
          </span>
        </div>
      </Link>

      {/* Outside the Link -- NewsArticleLinkedPoliticians renders its own
          buttons/links (rate, view wall), which can't nest inside one. */}
      {taggedPoliticians.length > 0 && (
        <div className="px-4 md:px-5 pb-4 md:pb-5 pt-1 border-t border-border-light/20">
          <NewsArticleLinkedPoliticians
            politicians={taggedPoliticians}
            articleTitle={article.headline}
            articleId={article.id}
          />
        </div>
      )}
    </Card>
  );
}
