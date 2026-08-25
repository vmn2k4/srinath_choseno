"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Calendar, Globe, Zap, ArrowRight, UserCheck } from "lucide-react";
import { Card, Badge } from "@/components/primitives";
import ShareMenu, { type ShareData } from "@/components/features/ShareMenu";
import { isBreakingNewsActive, type NewsArticleContent } from "@/lib/services/news";
import NewsArticleLinkedPoliticians, { type LinkedPolitician } from "@/components/features/NewsArticleLinkedPoliticians";

// The one "news feed post" card for every /news surface that reads as a
// timeline (the default feed, and the rep-filtered/paginated fallback grid
// that used to fall back to the smaller NewsArticleCard instead -- see
// NewsPageClient's comment on why that read as a different, lesser page).
// Pulled out of NewsInfiniteFeed (where it was a private FeedPost) so both
// surfaces render the exact same card instead of two copies drifting apart,
// the same lesson NewsArticleCard's own doc comment already describes for
// its own consolidation.
interface FeedPostArticle {
  id: string;
  slug: string;
  headline: string;
  summary?: string | null;
  category?: string | null;
  country?: string | null;
  hero_image_url?: string | null;
  published_at?: string | null;
  event_date?: string | null;
  created_at?: string | null;
  is_breaking?: boolean;
  breaking_until?: string | null;
  content?: unknown;
  // Deliberately loose on `profiles` (full_name as `string | null`, not the
  // stricter `string` LinkedPolitician wants) -- callers fetch this join
  // with their own slightly different optionality (see NewsArticleCard's
  // own CardArticle comment on the same pattern), and it's narrowed to
  // LinkedPolitician below, dropping any row without a name to show.
  news_article_politicians?: Array<{
    politician_id: string;
    profiles?: { id: string; full_name: string | null } | Partial<LinkedPolitician> | null;
  }>;
}

export default function NewsFeedPostCard({
  article,
  // Renders the share button in the footer next to "Read full article" when
  // provided -- same optional-prop pattern as NewsArticleCard, so callers
  // that don't have share text handy (none currently) just omit it.
  shareData,
  // Highlights that one of this article's tagged politicians is among the
  // signed-in viewer's own representatives. The caller computes this (it
  // needs the viewer's rep list, which this card has no reason to know
  // about) and just passes the resulting boolean.
  showMyRepBadge = false,
}: {
  article: FeedPostArticle;
  shareData?: ShareData;
  showMyRepBadge?: boolean;
}) {
  const content = article.content as NewsArticleContent | undefined;
  const isBreaking = isBreakingNewsActive(article);
  const rawDate = article.event_date || article.published_at || article.created_at;
  const displayDate = rawDate
    ? new Date(rawDate).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
    : null;

  const taggedPoliticians = (article.news_article_politicians ?? [])
    .map((p) => p.profiles)
    .filter((p): p is LinkedPolitician => Boolean(p && p.full_name));

  // Landscape images (real hero photos, and every auto-generated
  // opengraph-image fallback -- those are a fixed 1200x630 composite) read
  // better beside the text than stretched full-width above it; a tall
  // portrait photo works the other way round. Not knowable up front (only
  // the URL is stored, not dimensions), so it's measured client-side once
  // the image actually loads and the layout switches accordingly. Defaults
  // to 1200/630 -- the OG-composite's fixed size, and the common case for
  // real photos too -- so there's no layout jump for most cards; only flips
  // to stacked for the portrait minority once its real ratio loads.
  //
  // The container is sized to this exact ratio (CSS aspect-ratio, not a
  // fixed h-* class) and the image is object-contain, not object-cover:
  // a fixed-height container force-cropping the wide OG composite chopped
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
            {showMyRepBadge && (
              <Badge tone="accent" className="flex items-center gap-1">
                <UserCheck size={10} /> My Rep
              </Badge>
            )}
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
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-primary group-hover:text-primary-hover transition-colors">
              Read full article <ArrowRight size={14} />
            </span>
            {shareData && (
              <ShareMenu
                articleId={article.id}
                shareData={shareData}
                className="p-1.5 rounded-lg bg-surface/80 hover:bg-orange-500/20 text-text-muted hover:text-orange-500 transition-colors cursor-pointer"
                iconSize={13}
              />
            )}
          </div>
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
