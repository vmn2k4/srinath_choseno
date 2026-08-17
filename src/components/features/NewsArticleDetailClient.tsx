"use client";

import React, { useState } from "react";
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
  Share2,
  Check,
  Copy,
  MessageCircle,
  Star,
  ArrowRight,
} from "lucide-react";
import { Card, Badge } from "@/components/primitives";
import { useTranslation } from "@/contexts/LanguageContext";
import NewsArticleBody from "@/components/features/NewsArticleBody";
import NewsComments from "@/components/features/NewsComments";
import NewsArticleLinkedPoliticians from "@/components/features/NewsArticleLinkedPoliticians";
import PoliticianInlineRating from "@/components/features/PoliticianInlineRating";
import type { NewsArticle, NewsArticleContent } from "@/lib/services/news";
import { stripEmoji } from "@/lib/utils/text";

interface NewsArticleDetailClientProps {
  article: NewsArticle;
  slug: string;
  content: NewsArticleContent;
  isBreaking: boolean;
  readingTime: number;
  displayDate: string | null;
  ogImageUrl?: string;
}

export default function NewsArticleDetailClient({
  article,
  slug,
  content,
  isBreaking,
  readingTime,
  displayDate,
  ogImageUrl,
}: NewsArticleDetailClientProps) {
  const { t, locale } = useTranslation();

  const [translatedHeadline, setTranslatedHeadline] = useState<string | null>(null);
  const [translatedSummary, setTranslatedSummary] = useState<string | null>(null);
  const [translatedBody, setTranslatedBody] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  // Top "Review [Name]" CTA — expands the inline rating panel right here
  // instead of navigating to their wall, when there's exactly one tagged
  // politician to rate.
  const [showTopInlineRating, setShowTopInlineRating] = useState(false);

  const handleToggleTranslate = async () => {
    if (translatedBody || translatedHeadline) {
      setShowTranslated((prev) => !prev);
      return;
    }

    setIsTranslating(true);
    try {
      // 1. Translate headline
      if (article.headline) {
        const hRes = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(article.headline)}&langpair=autodetect|${locale}`
        );
        const hData = await hRes.json();
        if (hData?.responseData?.translatedText) {
          setTranslatedHeadline(hData.responseData.translatedText);
        }
      }

      // 2. Translate summary if present
      if (article.summary) {
        const sRes = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(article.summary)}&langpair=autodetect|${locale}`
        );
        const sData = await sRes.json();
        if (sData?.responseData?.translatedText) {
          setTranslatedSummary(sData.responseData.translatedText);
        }
      }

      // 3. Translate body by paragraph chunks to respect API limits
      if (content?.body) {
        const paragraphs = content.body.split("\n\n");
        const translatedParas = await Promise.all(
          paragraphs.map(async (para) => {
            if (!para.trim()) return para;
            try {
              const res = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(para)}&langpair=autodetect|${locale}`
              );
              const data = await res.json();
              return data?.responseData?.translatedText || para;
            } catch {
              return para;
            }
          })
        );
        setTranslatedBody(translatedParas.join("\n\n"));
      }

      setShowTranslated(true);
    } catch {
      // Graceful fallback if translation API is unavailable
    } finally {
      setIsTranslating(false);
    }
  };

  const activeHeadline = showTranslated && translatedHeadline ? translatedHeadline : article.headline;
  const activeSummary = showTranslated && translatedSummary ? translatedSummary : article.summary;
  const activeBody = showTranslated && translatedBody ? translatedBody : content?.body;

  const imageVersion = article.updated_at || article.published_at || "v2";
  const rawOgUrl = ogImageUrl || `/news/${slug}/opengraph-image`;
  const currentOgImageUrl = rawOgUrl.includes("?")
    ? `${rawOgUrl}&v=${encodeURIComponent(imageVersion)}`
    : `${rawOgUrl}?v=${encodeURIComponent(imageVersion)}`;
  
  // Always share the canonical production URL so social platforms (X, LinkedIn, WhatsApp)
  // fetch the real OpenGraph metadata and render the rich image card (localhost is not reachable by social crawlers)
  const shareUrl = `https://www.choseno.com/news/${slug}`;

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

  const handleNativeShareOrCopy = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: activeHeadline,
          text: `${basePostText}\n\n${formattedHashtagString}`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to menu toggle if share dialog dismissed or unsupported
      }
    }
    handleCopyLink();
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
  const primaryWallUrl = primaryPolitician?.current_ghost_id ? `/wall/${primaryPolitician.current_ghost_id}` : null;
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
          <Badge tone="primary" className="shrink-0">{article.category}</Badge>
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
          <div className="relative shrink-0">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="inline-flex items-center gap-1.5 px-2 sm:px-3.5 py-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-xs font-bold text-orange-600 transition-all cursor-pointer shadow-sm shrink-0"
              title="Share news article"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-green-600 shrink-0" />
                  <span className="hidden sm:inline text-green-700">Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 size={14} className="shrink-0" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>

            {/* Share Popover Menu */}
            {showShareMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 p-2 rounded-xl bg-white border border-slate-200 shadow-xl z-50 flex flex-col gap-1 text-xs">
                <button
                  onClick={handleNativeShareOrCopy}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 font-semibold transition-colors text-left w-full cursor-pointer"
                >
                  {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  <span>{copied ? "Copied to Clipboard!" : "Copy Link"}</span>
                </button>

                <a
                  href={twitterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-sky-50 text-sky-700 font-semibold transition-colors text-left w-full"
                  onClick={() => setShowShareMenu(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>Share on X (Twitter)</span>
                </a>

                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-emerald-50 text-emerald-700 font-semibold transition-colors text-left w-full"
                  onClick={() => setShowShareMenu(false)}
                >
                  <MessageCircle size={14} />
                  <span>Share on WhatsApp</span>
                </a>

                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-700 font-semibold transition-colors text-left w-full"
                  onClick={() => setShowShareMenu(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                  </svg>
                  <span>Share on LinkedIn</span>
                </a>
              </div>
            )}
          </div>

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
                panel right here (no navigation). Multiple -> jumps to the
                rating cards below, where each person already rates inline.
                Label truncates instead of wrapping so the button stays one
                tidy line at every viewport. */}
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
        </div>

        {/* Content Section: Text with Wrapped Visual Card on Right */}
        <div className="clearfix relative">
          {/* Right-Aligned Floated Visual Card for Desktop / Block for Mobile */}
          <div className="w-full lg:w-[460px] xl:w-[500px] lg:float-right lg:ml-8 lg:mb-6 mb-6">
            <div className="relative rounded-2xl overflow-hidden border border-border-light/40 bg-gradient-to-br from-white via-surface-elevated to-orange-50/30 p-2 sm:p-3 shadow-lg hover:shadow-xl transition-shadow">
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
                <button
                  onClick={handleNativeShareOrCopy}
                  className="inline-flex items-center gap-1 font-bold text-orange-600 hover:text-orange-700 bg-orange-100/80 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                >
                  <Share2 size={11} />
                  <span>Share This Briefing</span>
                </button>
              </div>
            </div>
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
                <Badge key={tag} tone="neutral">{tag}</Badge>
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
      />

      {/* Comments */}
      <NewsComments articleId={article.id} articleSlug={slug} />
    </div>
  );
}
