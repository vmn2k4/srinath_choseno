"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Globe,
  User,
  ExternalLink,
  Zap,
  Tag,
  Languages,
  Loader2,
  Check,
  Copy,
  Star,
  ArrowRight,
  MapPin,
  Landmark,
} from "lucide-react";
import { Card, Badge, Button, Avatar, Spinner } from "@/components/primitives";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import NewsArticleBody from "@/components/features/NewsArticleBody";
import NewsComments from "@/components/features/NewsComments";
import MissionRegisterCTA from "@/components/features/MissionRegisterCTA";
import NewsArticleLinkedPoliticians from "@/components/features/NewsArticleLinkedPoliticians";
import PoliticianInlineRating from "@/components/features/PoliticianInlineRating";
import PoliticianEngagementStats from "@/components/features/PoliticianEngagementStats";
import RelatedNewsSection from "@/components/features/RelatedNewsSection";
import ShareMenu, { type ShareData } from "@/components/features/ShareMenu";
import HomeLocateWidget from "@/components/features/home/HomeLocateWidget";
import { createClient } from "@/lib/supabase/client";
import { getKeyLeadersForCountry } from "@/lib/services/elections";
import { getPoliticianEngagementSummaries } from "@/lib/services/ratings";
import type { NewsArticle, NewsArticleContent } from "@/lib/services/news";
import { stripEmoji } from "@/lib/utils/text";
import { SITE_URL } from "@/lib/constants/site";
import { categoryToSlug, tagToSlug } from "@/lib/utils/newsTaxonomy";
import { isoCountryToMapShapesCountry } from "@/lib/utils/newsGeography";

// A "key leader" card in the right rail below the article image -- shape
// matches what getOfficeHoldersForShapes / getFeaturedOfficeHolders (both
// src/lib/services/elections.ts) already return, trimmed to the fields
// this card actually renders.
interface KeyLeaderItem {
  id: string;
  full_name: string;
  photo_url: string | null;
  election_role_types?: { role_title?: string | null } | null;
  profiles?: {
    id: string;
    current_ghost_id?: string | null;
    politician_profiles?: { photo_url?: string | null; avatar_url?: string | null; wall_slug?: string | null } | null;
  } | null;
}

interface NewsArticleDetailClientProps {
  article: NewsArticle;
  slug: string;
  content: NewsArticleContent;
  isBreaking: boolean;
  readingTime: number;
  displayDate: string | null;
  ogImageUrl?: string;
  relatedArticles?: NewsArticle[];
}

export default function NewsArticleDetailClient({
  article,
  slug,
  content,
  isBreaking,
  readingTime,
  displayDate,
  ogImageUrl,
  relatedArticles = [],
}: NewsArticleDetailClientProps) {
  const { t, locale } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  // Inline (not modal) so opening it pushes the floated image + body text
  // down the page instead of covering them.
  const [showFindInline, setShowFindInline] = useState(false);

  // Key Leaders rail (right side, below the image) — a couple of the
  // country's top office holders. Resolution + a 15-min cache both live in
  // getKeyLeadersForCountry (src/lib/services/elections.ts) since the
  // answer is identical for every article from the same country.
  const [keyLeaders, setKeyLeaders] = useState<KeyLeaderItem[]>([]);
  const [loadingLeaders, setLoadingLeaders] = useState(true);
  const [leaderEngagement, setLeaderEngagement] = useState<
    Map<string, { avgRating: number; ratingCount: number; commentCount: number; supporterCount: number }>
  >(new Map());

  useEffect(() => {
    let isMounted = true;
    async function loadKeyLeaders() {
      if (!article.country) {
        if (isMounted) setLoadingLeaders(false);
        return;
      }
      setLoadingLeaders(true);
      try {
        const supabase = createClient();
        // map_shapes.country / profiles.country store a free-text country name
        // ("Canada", "USA") -- a different vocabulary than the ISO-2 code
        // news_articles.country is normalized to ("CA", "US"). Translate before
        // querying, or the country filter below silently matches nothing.
        const mapShapesCountry = isoCountryToMapShapesCountry(article.country);

        // Cached per-country (see getKeyLeadersForCountry) -- every other
        // article from this same country reuses this instead of re-running
        // the underlying query.
        const { data } = await getKeyLeadersForCountry(supabase, mapShapesCountry);

        if (!isMounted) return;
        const list = (data || []) as KeyLeaderItem[];
        setKeyLeaders(list);
        setLoadingLeaders(false);

        const profileIds = list.map((h) => h.profiles?.id).filter((id): id is string => Boolean(id));
        if (profileIds.length > 0) {
          const { data: summaries } = await getPoliticianEngagementSummaries(supabase, profileIds);
          if (!isMounted || !summaries) return;
          const map = new Map<string, { avgRating: number; ratingCount: number; commentCount: number; supporterCount: number }>();
          (summaries as any[]).forEach((row) => {
            map.set(row.politician_id, {
              avgRating: row.avg_rating || 0,
              ratingCount: row.rating_count || 0,
              commentCount: row.comment_count || 0,
              supporterCount: row.supporter_count || 0,
            });
          });
          setLeaderEngagement(map);
        }
      } catch {
        // Best-effort widget -- an errored lookup (network blip, aborted
        // request from a fast unmount/remount) just leaves the rail empty
        // instead of spinning forever.
        if (isMounted) {
          setKeyLeaders([]);
          setLoadingLeaders(false);
        }
      }
    }
    loadKeyLeaders();
    return () => {
      isMounted = false;
    };
  }, [article.country]);

  const [translatedHeadline, setTranslatedHeadline] = useState<string | null>(null);
  const [translatedSummary, setTranslatedSummary] = useState<string | null>(null);
  const [translatedBody, setTranslatedBody] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  // Set when MyMemory has nothing to translate (article is already in the
  // requested language) -- shown next to the button instead of silently
  // doing nothing, or worse, displaying the API's own error string as if it
  // were the translation (see extractTranslation below).
  const [translateNotice, setTranslateNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Top "Review [Name]" CTA — expands the inline rating panel right here
  // instead of navigating to their wall, when there's exactly one tagged
  // politician to rate.
  const [showTopInlineRating, setShowTopInlineRating] = useState(false);
  // Same idea for the multi-politician case: which of the per-person top
  // buttons has its inline rating panel open (at most one at a time).
  const [expandedTopPoliticianId, setExpandedTopPoliticianId] = useState<string | null>(null);

  // A translation already fetched for one site language is wrong once the
  // visitor switches to another -- without this, handleToggleTranslate's
  // "already have a translation, just toggle visibility" shortcut below
  // would flip a stale (or, from a same-language no-op, unchanged) cached
  // translation into view instead of re-fetching for the new language. This
  // is what made "select Tamil, translate" sometimes show up in whatever
  // language had been translated to earlier in the session.
  useEffect(() => {
    setTranslatedHeadline(null);
    setTranslatedSummary(null);
    setTranslatedBody(null);
    setShowTranslated(false);
    setTranslateNotice(null);
  }, [locale]);

  // MyMemory returns HTTP 200 with a translatedText field even when it
  // couldn't actually translate anything -- e.g. requesting autodetect|en
  // on English source text comes back `{"translatedText":"PLEASE SELECT
  // TWO DISTINCT LANGUAGES","responseStatus":"403"}`. The translatedText
  // field alone looked like a real (if odd) translation and got rendered
  // as the article's headline/body verbatim. responseStatus is the actual
  // success signal -- only "200" is a real translation.
  const extractTranslation = (data: any): string | null => {
    if (String(data?.responseStatus) !== "200") return null;
    const text = data?.responseData?.translatedText;
    return typeof text === "string" && text.trim() ? text : null;
  };

  const handleToggleTranslate = async () => {
    if (translatedBody || translatedHeadline) {
      setShowTranslated((prev) => !prev);
      return;
    }

    setIsTranslating(true);
    setTranslateNotice(null);
    try {
      let gotAnyTranslation = false;

      // 1. Translate headline
      if (article.headline) {
        const hRes = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(article.headline)}&langpair=autodetect|${locale}`
        );
        const translated = extractTranslation(await hRes.json());
        if (translated) {
          setTranslatedHeadline(translated);
          gotAnyTranslation = true;
        }
      }

      // 2. Translate summary if present
      if (article.summary) {
        const sRes = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(article.summary)}&langpair=autodetect|${locale}`
        );
        const translated = extractTranslation(await sRes.json());
        if (translated) {
          setTranslatedSummary(translated);
          gotAnyTranslation = true;
        }
      }

      // 3. Translate body by paragraph chunks to respect API limits
      let joinedBody: string | null = null;
      if (content?.body) {
        const paragraphs = content.body.split("\n\n");
        const translatedParas = await Promise.all(
          paragraphs.map(async (para) => {
            if (!para.trim()) return para;
            try {
              const res = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(para)}&langpair=autodetect|${locale}`
              );
              const translated = extractTranslation(await res.json());
              if (translated) gotAnyTranslation = true;
              return translated || para;
            } catch {
              return para;
            }
          })
        );
        joinedBody = translatedParas.join("\n\n");
      }

      if (gotAnyTranslation) {
        // Only commit translatedBody once we know at least one field really
        // translated -- setting it unconditionally (even to a reassembled
        // string that's identical to the original) would make the "already
        // translated, just toggle" shortcut above treat a same-language
        // no-op as a cached translation on the next click.
        if (joinedBody !== null) setTranslatedBody(joinedBody);
        setShowTranslated(true);
      } else {
        // Nothing came back translated -- almost always because the
        // article is already in the selected language. Say so instead of
        // silently doing nothing (or, before this fix, showing MyMemory's
        // raw error string as if it were the article).
        setTranslateNotice("This article already appears to be in your selected language.");
      }
    } catch {
      setTranslateNotice("Translation is unavailable right now — please try again later.");
    } finally {
      setIsTranslating(false);
    }
  };

  const activeHeadline = showTranslated && translatedHeadline ? translatedHeadline : article.headline;
  const activeSummary = showTranslated && translatedSummary ? translatedSummary : article.summary;
  const activeBody = showTranslated && translatedBody ? translatedBody : content?.body;

  const imageVersion = article.updated_at || article.published_at || "v2";
  // ogImageUrl (from generateMetadata) is an ABSOLUTE SITE_URL (production)
  // URL -- correct for <meta og:image>, which social crawlers need
  // absolute, but wrong for this on-page <img>: using it as-is made the
  // visible image always fetch from production even when the page itself
  // was being served from localhost or a staging deploy, breaking for any
  // article that only exists in that environment's own database. Strip to
  // a relative path so the browser resolves it against whatever origin is
  // actually serving the page.
  const rawOgUrl = ogImageUrl
    ? (() => {
        try {
          const u = new URL(ogImageUrl);
          return `${u.pathname}${u.search}`;
        } catch {
          return ogImageUrl;
        }
      })()
    : `/news/${slug}/opengraph-image`;
  // article.hero_image_url (a real source photo, or the PNG saved by
  // generateNewsArticleOgImage) lives on Supabase Storage -- one absolute
  // URL, identical in every environment, unlike the dynamic route above.
  // Use it as-is rather than running it through the relative-path
  // rewrite, which would strip its storage host and try to resolve the
  // bare path against this app's own origin (404). No cache-busting
  // needed here either: hero uploads get a unique per-upload filename, and
  // generateNewsArticleOgImage never re-renders once the URL is set.
  const currentOgImageUrl = article.hero_image_url
    ? article.hero_image_url
    : rawOgUrl.includes("?")
      ? `${rawOgUrl}&v=${encodeURIComponent(imageVersion)}`
      : `${rawOgUrl}?v=${encodeURIComponent(imageVersion)}`;
  
  // Always share the canonical production URL so social platforms (X, LinkedIn, WhatsApp)
  // fetch the real OpenGraph metadata and render the rich image card (localhost is not reachable by social crawlers)
  const shareUrl = `${SITE_URL}/news/${slug}`;

  // 1. Extract tagged politician names
  const taggedReps = ((article as any).news_article_politicians
    ?.map((p: any) => p?.profiles?.full_name)
    .filter(Boolean) as string[]) || [];

  // 2. Extract all article topic tags and convert to clean PascalCase hashtags
  const topicTags = (content?.tags || []).map((tag) =>
    tag
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("")
      .replace(/[^a-zA-Z0-9]/g, "")
  ).filter(Boolean);

  const politicianTags = taggedReps.map((name) =>
    name
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("")
      .replace(/[^a-zA-Z0-9]/g, "")
  ).filter(Boolean);

  const categoryTag = article.category ? article.category.replace(/[^a-zA-Z0-9]/g, "") : "";
  const locationTag = article.province ? article.province.replace(/[^a-zA-Z0-9]/g, "") : "";

  // Combine unique tags (Topics + Politicians + Category + Location + Choseno)
  const combinedTagList = Array.from(
    new Set([...politicianTags, ...topicTags, categoryTag, locationTag, "Choseno"].filter(Boolean))
  );

  const formattedHashtagString = combinedTagList.map((t) => `#${t}`).join(" ");

  // The article's own hand-written `content.tweet` wins when set (admin/AI
  // JSON, see docs/NEWS_JSON_SCHEMA.md); otherwise fall back to the
  // auto-generated headline + CTA line. Either way it goes through
  // stripEmoji() — the schema tells authors not to put emoji in `tweet`, but
  // this is the one place actually posted to X, so it's the backstop that
  // guarantees it regardless of what slipped into the source JSON.
  const customTweet = content?.tweet?.trim();
  const basePostText = stripEmoji(
    customTweet ||
      (taggedReps.length > 0
        ? `${activeHeadline}\n\nRate ${taggedReps.join(", ")} and track local democracy on @choseno!`
        : `${activeHeadline}\n\nTrack local democracy and rate your representatives on @choseno!`)
  );

  const shareText = `${basePostText}\n\n${formattedHashtagString}\n${shareUrl}`;

  // Twitter/X intent parameters:
  // - text: basePostText (custom `content.tweet` if the article has one, else the auto-generated headline + CTA)
  // - url: Canonical URL (X automatically renders this as a rich Summary Large Image Card)
  // - hashtags: Comma-separated list of all topics
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    basePostText
  )}&url=${encodeURIComponent(shareUrl)}&hashtags=${encodeURIComponent(combinedTagList.join(","))}`;

  const customTweetArticle = (content as any)?.tweetarticle?.trim();
  const politicianMentions = taggedReps.length > 0 ? taggedReps.join(", ") : "Elected Officials";
  const jurisdiction = [article.province, article.country].filter(Boolean).join(", ") || "National";
  const summaryText = activeSummary || "";

  const tweetArticleText =
    customTweetArticle ||
    `${activeHeadline}\n\n📍 KEY FACTS & SCOPE:\n• Jurisdiction: ${jurisdiction}\n• Officials Involved: ${politicianMentions}\n• Overview: ${summaryText}\n\n🗣️ THE PERSPECTIVES:\n• Civic Context: Detailed reporting, debate, and community impact analysis are available on Choseno.\n• Transparency: Follow legislative milestones, vote counts, and budget line-items.\n\n🗳️ Rate this decision and view the official public record on Choseno:\n📰 Full Article: ${shareUrl}\n\n${formattedHashtagString}`;

  const imageUrl = article.hero_image_url || `${SITE_URL}/api/news/${article.slug}/og-image`;

  // Feeds the shared <ShareMenu/> -- both the header "Share" button and the
  // briefing card's "Share This Briefing" button pass this same object, so
  // they open the exact same set of destinations (Copy Link, X, WhatsApp,
  // LinkedIn, Facebook, Telegram, Pinterest, Email) as the /news list cards
  // instead of maintaining their own subset.
  const shareData: ShareData = {
    url: shareUrl,
    basePostText,
    hashtagList: formattedHashtagString,
    shareText,
    hashtags: combinedTagList,
    twitterUrl: twitterShareUrl,
    tweetArticleText,
    imageUrl,
  };

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Politician data used by the top CTA button — resolved once here so both
  // the button and its anchor/wall link share the same source of truth.
  const linkedPoliticians = ((article as any).news_article_politicians?.filter((p: any) => p.profiles?.id) || []) as any[];
  const primaryPolitician = linkedPoliticians[0]?.profiles;
  const primaryWallSlug = primaryPolitician?.politician_profiles?.wall_slug;
  const primaryWallUrl = primaryWallSlug
    ? `/wall/${primaryWallSlug}`
    : primaryPolitician?.current_ghost_id
      ? `/wall/${primaryPolitician.current_ghost_id}`
      : null;
  const rateCtaLabel =
    linkedPoliticians.length === 1
      ? `Review ${primaryPolitician?.full_name || "now"}`
      : linkedPoliticians.length > 1
        ? `Review ${linkedPoliticians.length} people in this article`
        : null;
  // Single politician -> straight to their wall. Multiple -> jump to the
  // rating cards below (id set on NewsArticleLinkedPoliticians' wrapper).
  const rateCtaHref = linkedPoliticians.length === 1 && primaryWallUrl ? primaryWallUrl : "#rate-politicians";

  return (
    <div className="w-full max-w-none pb-20 px-4 lg:px-8 space-y-6">
      <MissionRegisterCTA variant="news" nextPath={`/news/${slug}`} />

      {/* Consolidated Nav + Article Meta Bar — back link, category, breaking
          badge on the left; quick copy, share, translate on the right.
          flex-nowrap keeps this pinned to a single row at every width;
          labels drop to icon-only below `sm` instead of wrapping. */}
      <div className="flex items-center justify-between gap-2 flex-nowrap">
        <div className="flex items-center flex-nowrap gap-2 sm:gap-3 min-w-0">
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-main transition-colors shrink-0"
          >
            <ArrowLeft size={14} className="shrink-0" /> <span className="hidden sm:inline">{t("newsPage.backToNews")}</span>
          </Link>
          <span className="w-px h-4 bg-border-light/40 shrink-0 hidden sm:block" />
          {article.category && (
            <Link href={`/news/category/${categoryToSlug(article.category)}`} className="shrink-0">
              <Badge tone="primary" className="shrink-0 hover:bg-primary/30 transition-colors">{article.category}</Badge>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 relative flex-nowrap shrink-0">
          {/* Quick Copy Pill */}
          <button
            onClick={handleCopyLink}
            title="Quick Copy Link"
            className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            {copied ? <Check size={12} className="text-green-600 shrink-0" /> : <Copy size={12} className="shrink-0" />}
            <span className="hidden sm:inline">{copied ? "Link Copied!" : "Quick Copy Link"}</span>
          </button>

          {/* Share Button with Dropdown / Native Share */}
          <ShareMenu
            articleId={article.id}
            shareData={shareData}
            label="Share"
            hideLabelOnMobile
            menuAlign="below"
            className="inline-flex items-center gap-1.5 px-2 sm:px-3.5 py-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-xs font-bold text-orange-600 transition-all cursor-pointer shadow-sm shrink-0"
            iconSize={14}
          />

          {/* Translate Button */}
          <button
            onClick={handleToggleTranslate}
            disabled={isTranslating}
            title={showTranslated ? t("newsPage.showingOriginal") : t("newsPage.translateArticle")}
            className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary transition-all cursor-pointer shadow-sm shrink-0"
          >
            {isTranslating ? (
              <>
                <Loader2 size={14} className="animate-spin shrink-0" />
                <span className="hidden sm:inline">{t("newsPage.translatingArticle")}</span>
              </>
            ) : (
              <>
                <Languages size={14} className="shrink-0" />
                <span className="hidden sm:inline">
                  {showTranslated ? t("newsPage.showingOriginal") : t("newsPage.translateArticle")}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {translateNotice && (
        <p className="-mt-4 text-right text-[11px] text-text-muted">{translateNotice}</p>
      )}

      {/* Article header & Wrapped Body Card */}
      <Card padding="md" className="space-y-6">
        {/* Article title & metadata bar */}
        <div className="space-y-3 pb-5 border-b border-border-light/20">
          {/* Breaking badge lives here, not the compact top nav bar — that
              row is already tight at mobile widths and the badge's text
              would get squeezed until it visually overlapped the Quick
              Copy/Share/Translate buttons. Full width here, own line, never
              collides with anything. */}
          {isBreaking && (
            <span className="inline-flex items-center gap-1 bg-danger/10 text-danger text-xs font-bold px-2.5 py-1 rounded-full">
              <Zap size={12} /> {t("newsPage.breaking")}
            </span>
          )}
          <h1 className="text-[clamp(1.25rem,1rem+3vw,2.25rem)] font-extrabold text-text-main leading-tight tracking-tight text-balance">
            {activeHeadline}
          </h1>

          {activeSummary && (
            <p className="text-[clamp(0.9375rem,0.85rem+0.5vw,1.125rem)] text-text-muted leading-relaxed font-medium text-pretty">
              {activeSummary}
            </p>
          )}

          <div className="flex items-center flex-wrap gap-4 text-[clamp(0.6875rem,0.65rem+0.2vw,0.75rem)] text-text-muted pt-1 justify-between">
            <div className="flex items-center flex-wrap gap-4">
              {content?.author?.name && (
                <span className="flex items-center gap-1 font-semibold text-text-secondary">
                  <User size={12} /> {content.author.name}
                </span>
              )}
              {displayDate && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> {displayDate}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock size={12} /> {readingTime} {t("newsPage.minRead")}
              </span>
              {article.country && (
                <span className="flex items-center gap-1">
                  <Globe size={12} /> {article.province ? `${article.province}, ` : ""}{article.country.toUpperCase()}
                </span>
              )}
            </div>

            {/* Primary Rate CTA — a real button, not a label: solid fill,
                full name. One tagged politician -> expands the inline rating
                panel right here (no navigation). Multiple -> one button per
                politician, all on a single row, straight to their wall page.
                Label/name truncates or shortens by breakpoint so the row
                stays one tidy line at every viewport. */}
            {rateCtaLabel && (
              primaryWallUrl && linkedPoliticians.length === 1 ? (
                <button
                  type="button"
                  onClick={() => setShowTopInlineRating((v) => !v)}
                  aria-expanded={showTopInlineRating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[clamp(0.6875rem,0.65rem+0.2vw,0.8125rem)] font-bold shadow-sm hover:shadow-md transition-all max-w-full cursor-pointer"
                >
                  <Star size={13} className="fill-white shrink-0" />
                  <span className="truncate">{rateCtaLabel}</span>
                  <ArrowRight size={13} className={`shrink-0 transition-transform ${showTopInlineRating ? "rotate-90" : ""}`} />
                </button>
              ) : linkedPoliticians.length > 1 ? (
                <div className="flex items-center flex-nowrap gap-1.5 sm:gap-2 max-w-full overflow-x-auto">
                  {linkedPoliticians.map((lp: any) => {
                    const politician = lp.profiles;
                    if (!politician?.id) return null;
                    const fullName: string = politician.full_name || "Politician";
                    const nameParts = fullName.trim().split(" ");
                    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : fullName;
                    const isExpanded = expandedTopPoliticianId === politician.id;
                    return (
                      <button
                        key={politician.id}
                        type="button"
                        onClick={() => setExpandedTopPoliticianId(isExpanded ? null : politician.id)}
                        aria-expanded={isExpanded}
                        title={`Review ${fullName}`}
                        className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[clamp(0.625rem,0.6rem+0.15vw,0.75rem)] font-bold shadow-sm hover:shadow-md transition-all shrink-0 cursor-pointer"
                      >
                        <Star size={12} className="hidden sm:inline-block fill-white shrink-0" />
                        <span className="md:hidden">{lastName}</span>
                        <span className="hidden md:inline truncate max-w-[140px]">{fullName}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Link
                  href={rateCtaHref}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[clamp(0.6875rem,0.65rem+0.2vw,0.8125rem)] font-bold shadow-sm hover:shadow-md transition-all max-w-full"
                >
                  <Star size={13} className="fill-white shrink-0" />
                  <span className="truncate">{rateCtaLabel}</span>
                  <ArrowRight size={13} className="shrink-0" />
                </Link>
              )
            )}
          </div>

          {/* Inline rating panel for the single-politician case — expands
              in place under the metadata row instead of the CTA navigating
              away. Reuses the exact same widget as the wall page and the
              rate-cards section below. */}
          {showTopInlineRating && primaryPolitician?.id && (
            <PoliticianInlineRating
              politicianId={primaryPolitician.id}
              politicianName={primaryPolitician.full_name || "This politician"}
              onCancel={() => setShowTopInlineRating(false)}
            />
          )}

          {/* Same inline rating panel for the multi-politician case — opens
              under the metadata row for whichever per-person button was
              clicked, same centralized widget, no navigation away. */}
          {expandedTopPoliticianId && (() => {
            const activePolitician = linkedPoliticians.find(
              (lp: any) => lp.profiles?.id === expandedTopPoliticianId
            )?.profiles;
            if (!activePolitician) return null;
            return (
              <PoliticianInlineRating
                politicianId={activePolitician.id}
                politicianName={activePolitician.full_name || "This politician"}
                onCancel={() => setExpandedTopPoliticianId(null)}
              />
            );
          })()}
        </div>

        {/* Content Section: Text with Wrapped Visual Card on Right */}
        <div className="clearfix relative">
          {/* Find My Representatives -- inline, not a modal: sits above the
              image (a plain block before the float below, so it's laid out
              first) and, when expanded, pushes the image and body text down
              rather than covering them. Same HomeLocateWidget location→
              boundary→office-holder lookup used on the homepage hero and the
              /news listing page; its "Rate" buttons feed the same rating
              system as everything else on this page. */}
          {!authLoading && !user && (
            <div className="space-y-3 mb-5">
              <div className="p-3 bg-primary/5 rounded-2xl border border-primary/20 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <MapPin size={15} />
                  <span>See who represents you, then say what you think of them</span>
                </div>
                <Button size="sm" variant="primary" onClick={() => setShowFindInline((v) => !v)}>
                  {showFindInline ? "Hide" : "Find My Representatives"}
                </Button>
              </div>
              {showFindInline && <HomeLocateWidget className="!bg-surface" />}
            </div>
          )}

          {/* Right-Aligned Floated Visual Card for Desktop / Block for Mobile */}
          <div className="w-full lg:w-[460px] xl:w-[500px] lg:float-right lg:ml-8 lg:mb-6 mb-6">
            {/* No overflow-hidden here (unlike the inner image wrapper below,
                which still clips the <img> to its own rounded corners) --
                this outer frame doesn't need to clip anything, and having it
                did was silently clipping the "Share This Briefing" popover
                below instead of just letting it render on top. */}
            <div className="relative rounded-2xl border border-border-light/40 bg-gradient-to-br from-white via-surface-elevated to-orange-50/30 p-2 sm:p-3 shadow-lg hover:shadow-xl transition-shadow">
              <div className="relative rounded-xl overflow-hidden border border-slate-200/90 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentOgImageUrl}
                  alt={`Visual summary for ${article.headline}`}
                  className="w-full h-auto object-cover"
                  loading="eager"
                />
              </div>
              <div className="mt-2.5 px-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-orange-600 flex items-center gap-1">
                  ★ Choseno Civic Briefing
                </span>
                <ShareMenu
                  articleId={article.id}
                  shareData={shareData}
                  label="Share This Briefing"
                  menuAlign="below"
                  className="inline-flex items-center gap-1 font-bold text-orange-600 hover:text-orange-700 bg-orange-100/80 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  iconSize={11}
                />
              </div>
            </div>

            {/* Key Leaders -- a couple of the article's country's top office
                holders (face + name + current rating), right below the
                image. Avatar + PoliticianEngagementStats are the same
                widgets PoliticianSidebar uses for this exact "current office
                holders" list; clicking the rating opens the same
                PoliticianRatingModal as everywhere else. */}
            {article.country && (
              <div className="mt-4 rounded-2xl border border-border-light/40 bg-surface-elevated/70 p-3 sm:p-4 space-y-2.5">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                  <Landmark size={12} /> Key Leaders
                </h3>
                {loadingLeaders ? (
                  <div className="flex justify-center py-3">
                    <Spinner size="sm" />
                  </div>
                ) : keyLeaders.length === 0 ? (
                  <p className="text-xs text-text-muted">No profiled leaders yet for this country.</p>
                ) : (
                  <div className="space-y-1.5">
                    {keyLeaders.map((leader) => {
                      const roleTitle = leader.election_role_types?.role_title || "Leader";
                      const photo =
                        leader.photo_url ||
                        leader.profiles?.politician_profiles?.photo_url ||
                        leader.profiles?.politician_profiles?.avatar_url ||
                        null;
                      const engagement = leader.profiles?.id ? leaderEngagement.get(leader.profiles.id) : undefined;
                      const leaderWallSlug = leader.profiles?.politician_profiles?.wall_slug;
                      const leaderWallUrl = leaderWallSlug
                        ? `/wall/${leaderWallSlug}`
                        : leader.profiles?.current_ghost_id
                          ? `/wall/${leader.profiles.current_ghost_id}`
                          : null;

                      const cardContent = (
                        <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-hover/40 border border-transparent hover:border-border-light/40 transition-all">
                          <Avatar src={photo} name={leader.full_name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-text-main truncate">{leader.full_name}</p>
                            <p className="text-[10px] text-primary font-semibold truncate">{roleTitle}</p>
                            {leader.profiles?.id && (
                              <PoliticianEngagementStats
                                politicianId={leader.profiles.id}
                                politicianName={leader.full_name}
                                supporterCount={engagement?.supporterCount ?? 0}
                                avgRating={engagement?.avgRating ?? 0}
                                ratingCount={engagement?.ratingCount ?? 0}
                                commentCount={engagement?.commentCount ?? 0}
                                size="xs"
                                className="mt-0.5"
                              />
                            )}
                          </div>
                        </div>
                      );

                      return leaderWallUrl ? (
                        <Link key={leader.id} href={leaderWallUrl} className="block">
                          {cardContent}
                        </Link>
                      ) : (
                        <div key={leader.id}>{cardContent}</div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Body text that wraps cleanly around the right floated visual card */}
          {activeBody ? (
            <div className="prose prose-slate max-w-none text-text-main leading-relaxed">
              <NewsArticleBody body={activeBody} />
            </div>
          ) : (
            <p className="text-text-muted text-sm italic">No article content yet.</p>
          )}
        </div>

        {/* Topics */}
        {content?.tags && content.tags.length > 0 && (
          <div className="pt-6 border-t border-border-light/20 space-y-2">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
              <Tag size={12} /> {t("newsPage.topics")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {content.tags.map((tag) => (
                <Link key={tag} href={`/news/topic/${tagToSlug(tag)}`}>
                  <Badge tone="neutral" className="hover:bg-surface-active transition-colors cursor-pointer">{tag}</Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Sources */}
        {content?.sources && content.sources.length > 0 && (
          <div className="pt-5 border-t border-border-light/20 space-y-2">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest">
              {t("newsPage.sources")}
            </h3>
            <ul className="space-y-1">
              {content.sources.map((s, i) => (
                <li key={i}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={10} /> {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Linked Politicians - Rate & Discuss */}
      <NewsArticleLinkedPoliticians
        politicians={
          ((article as any).news_article_politicians
            ?.map((p: any) => ({
              id: p.profiles?.id,
              full_name: p.profiles?.full_name,
              designation: p.profiles?.designation,
              constituency: p.profiles?.constituency,
              current_ghost_id: p.profiles?.current_ghost_id,
              politician_profiles: p.profiles?.politician_profiles,
            }))
            .filter((p: any) => p.id) as any[]) || []
        }
        articleTitle={article.headline}
        articleId={article.id}
      />

      {/* Related Coverage -- same category, keeps a reader (and a crawler)
          from hitting a dead end at the end of an article. */}
      {article.category && (
        <RelatedNewsSection articles={relatedArticles} category={article.category} />
      )}

      {/* Comments */}
      <NewsComments articleId={article.id} articleSlug={slug} />
    </div>
  );
}
