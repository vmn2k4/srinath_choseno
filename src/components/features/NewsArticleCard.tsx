import Link from "next/link";
import { Calendar, Globe, ArrowRight, Zap, UserCheck } from "lucide-react";
import { Card, Badge } from "@/components/primitives";
import ShareMenu, { type ShareData } from "@/components/features/ShareMenu";
import { isBreakingNewsActive, type NewsArticleContent } from "@/lib/services/news";

// Deliberately its own loose shape rather than Pick<NewsArticle, ...> --
// every call site (NewsPageClient's own row type, RelatedNewsSection, the
// category/topic hub pages, the wall page) already fetches this same set of
// columns but with its own slightly different optionality on the nullable
// ones (`created_at?: string | null` vs NewsArticle's `created_at: string`,
// etc.), and this card only ever reads them, never round-trips them back to
// a mutation that would need the stricter shape.
interface CardArticle {
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
  content?: unknown;
}

// The one article card for every /news surface -- main feed, category/topic
// hub pages, RelatedNewsSection. Previously NewsPageClient's main feed kept
// its own near-duplicate card inline (breaking badge, "My Rep" badge, share
// button) instead of this one; those are now optional props here so this
// single component covers every call site instead of two copies drifting
// out of sync (which is exactly how the image-crop bug this component just
// got fixed for went unfixed on the main feed for a separate pass).
//
// Still a server component -- ShareMenu is itself a client component, and a
// server component can render one inline without becoming one itself, so
// this card costs zero extra client JS on the hub pages that don't pass
// `shareData`.
export default function NewsArticleCard({
  article,
  // Renders the share button in the footer next to "Read full article" when
  // provided. Omit it (hub pages, RelatedNewsSection) and the footer is just
  // the link.
  shareData,
  // Highlights that one of this article's tagged politicians is among the
  // signed-in viewer's own representatives. The caller computes this (it
  // needs the viewer's rep list, which this card has no reason to know
  // about) and just passes the resulting boolean.
  showMyRepBadge = false,
}: {
  article: CardArticle;
  shareData?: ShareData;
  showMyRepBadge?: boolean;
}) {
  const content = article.content as NewsArticleContent | undefined;
  const isBreaking = isBreakingNewsActive(article);
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
      <div className="flex flex-col flex-1 p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge tone="primary">{article.category || "News"}</Badge>
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
          </div>
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

        <div className="pt-2 mt-auto border-t border-border-light/20 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:text-primary-hover transition-colors">
            Read full article <ArrowRight size={13} />
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

      {/* Image last, not first -- and object-contain instead of object-cover.
          Articles without a real photo fall back to the auto-generated
          opengraph-image, a wide (1200x630) composite that already has its
          own headline/leaders panel baked into the pixels. object-cover on
          a fixed h-40 was center-cropping that composite, chopping its top
          and bottom off. object-contain shows the whole graphic, letterboxed
          and centered on the card's own background instead of cut. */}
      <div className="relative h-40 w-full shrink-0 overflow-hidden bg-slate-100 border-t border-border-light/20 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={article.hero_image_url || `/news/${article.slug}/opengraph-image`}
          alt={content?.heroImageAlt ?? article.headline}
          className="w-full h-full object-contain object-center transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>
    </Card>
  );
}
