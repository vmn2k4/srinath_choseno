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
} from "lucide-react";
import { Card, Badge } from "@/components/primitives";
import { useTranslation } from "@/contexts/LanguageContext";
import NewsArticleBody from "@/components/features/NewsArticleBody";
import NewsComments from "@/components/features/NewsComments";
import type { NewsArticle, NewsArticleContent } from "@/lib/services/news";

interface NewsArticleDetailClientProps {
  article: NewsArticle;
  slug: string;
  content: NewsArticleContent;
  isBreaking: boolean;
  readingTime: number;
  displayDate: string | null;
}

export default function NewsArticleDetailClient({
  article,
  slug,
  content,
  isBreaking,
  readingTime,
  displayDate,
}: NewsArticleDetailClientProps) {
  const { t, locale } = useTranslation();

  const [translatedHeadline, setTranslatedHeadline] = useState<string | null>(null);
  const [translatedSummary, setTranslatedSummary] = useState<string | null>(null);
  const [translatedBody, setTranslatedBody] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);

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

  return (
    <div className="w-full max-w-none pb-20 px-4 lg:px-8 space-y-6">
      {/* Back & Translate Control Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          href="/news"
          className="inline-flex items-center gap-2 text-xs font-bold text-text-muted hover:text-text-main transition-colors"
        >
          <ArrowLeft size={14} /> {t("newsPage.backToNews")}
        </Link>

        <button
          onClick={handleToggleTranslate}
          disabled={isTranslating}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary transition-all cursor-pointer shadow-sm"
        >
          {isTranslating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>{t("newsPage.translatingArticle")}</span>
            </>
          ) : (
            <>
              <Languages size={14} />
              <span>
                {showTranslated ? t("newsPage.showingOriginal") : t("newsPage.translateArticle")}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Hero image */}
      {article.hero_image_url && (
        <div className="relative rounded-2xl overflow-hidden h-56 sm:h-72 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.hero_image_url}
            alt={content?.heroImageAlt ?? article.headline}
            className="w-full h-full object-cover"
          />
          {isBreaking && (
            <span className="absolute top-3 left-3 flex items-center gap-1 bg-danger text-white text-xs font-bold px-3 py-1 rounded-full shadow">
              <Zap size={11} /> {t("newsPage.breaking")}
            </span>
          )}
          {content?.heroImageCaption && (
            <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-4 py-2">
              {content.heroImageCaption}
            </p>
          )}
        </div>
      )}

      {/* Article header */}
      <Card padding="md" className="space-y-5">
        <div className="space-y-2.5 sm:space-y-3 pb-4 sm:pb-5 border-b border-border-light/20">
          <div className="flex items-center flex-wrap gap-2">
            <Badge tone="primary">{article.category}</Badge>
            {isBreaking && !article.hero_image_url && (
              <span className="inline-flex items-center gap-1 bg-danger/10 text-danger text-xs font-bold px-2 py-0.5 rounded-full">
                <Zap size={10} /> {t("newsPage.breaking")}
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-3xl font-extrabold text-text-main leading-tight">
            {activeHeadline}
          </h1>

          {activeSummary && (
            <p className="hidden sm:block text-sm text-text-muted leading-relaxed">
              {activeSummary}
            </p>
          )}

          <div className="flex items-center flex-wrap gap-3 sm:gap-4 text-xs text-text-muted">
            {content?.author?.name && (
              <span className="sm:hidden flex items-center gap-1 font-semibold text-text-secondary">
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
                <Globe size={12} /> {article.country.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Author byline */}
        {content?.author?.name && (
          <div className="hidden sm:flex items-center gap-3 pb-5 border-b border-border-light/20">
            {content.author.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={content.author.photoUrl}
                alt={content.author.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            )}
            <div>
              <p className="text-sm font-semibold text-text-main flex items-center gap-1">
                <User size={12} className="text-text-muted" />
                {content.author.name}
              </p>
              {content.author.bio && (
                <p className="text-xs text-text-muted">{content.author.bio}</p>
              )}
            </div>
          </div>
        )}

        {/* Article body */}
        {activeBody ? (
          <NewsArticleBody body={activeBody} />
        ) : (
          <p className="text-text-muted text-sm italic">No article content yet.</p>
        )}

        {/* Topics */}
        {content?.tags && content.tags.length > 0 && (
          <div className="pt-5 border-t border-border-light/20 space-y-2">
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

      {/* Comments */}
      <NewsComments articleId={article.id} articleSlug={slug} />
    </div>
  );
}
