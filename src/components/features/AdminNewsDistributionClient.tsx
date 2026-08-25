"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import AdminSubNav from "./AdminSubNav";
import {
  Share2,
  Copy,
  Check,
  Download,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  listNewsArticlesForDistribution,
  listDistinctBatches,
  recordNewsArticleShare,
  type DistributionArticle,
  type BatchSummary,
} from "@/lib/services/news";
import ShareMenu, { type ShareData } from "@/components/features/ShareMenu";
import Checkbox from "@/components/primitives/Checkbox";
import { stripEmoji } from "@/lib/utils/text";
import { convertToPackificTime } from "@/lib/utils/timezone";
import { SITE_URL } from "@/lib/constants/site";

/** "2026-08-24 08:09" (raw UTC batch tag) -> "2026-08-24 01:09" (PST) for display. */
function displayBatch(batch: string): string {
  return batch.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/) ? convertToPackificTime(`${batch}:00Z`) : batch;
}

export default function AdminNewsDistributionClient() {
  const supabase = createClient();

  // Articles & Pagination state
  const [articles, setArticles] = useState<DistributionArticle[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Distinct Batches
  const [distinctBatches, setDistinctBatches] = useState<BatchSummary[]>([]);
  const [totalPublishedCount, setTotalPublishedCount] = useState<number>(0);

  // Filters & Sorting state
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]); // empty = All Batches
  const [batchDropdownOpen, setBatchDropdownOpen] = useState(false);
  const batchDropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("viral_desc");

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedTweetSlug, setCopiedTweetSlug] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "info" | "error" = "success") => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // 1. Fetch lightweight distinct batches for the dropdown
  const fetchBatches = useCallback(async () => {
    try {
      const { data } = await listDistinctBatches(supabase);
      if (data) {
        setDistinctBatches(data);
        const sum = data.reduce((acc, b) => acc + b.count, 0);
        setTotalPublishedCount(sum);
      }
    } catch (err) {
      console.error("Failed to load distinct batches:", err);
    }
  }, [supabase]);

  // 2. Fetch paginated articles for current page & filters
  const fetchArticles = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await listNewsArticlesForDistribution(supabase, {
        status: "published",
        page,
        pageSize,
        batchNumber: selectedBatches.length ? selectedBatches : "all",
        search: searchQuery,
        sortBy,
      });

      if (res.error) {
        throw new Error(res.error.message);
      }

      setArticles(res.data || []);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error("Error loading paginated articles:", err);
      showToast(err?.message || "Failed to load news articles", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase, page, pageSize, selectedBatches, searchQuery, sortBy]);

  // Load batches on initial mount
  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Load paginated articles when page, pageSize, batch, search, or sort change
  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Close the batch dropdown on an outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(event.target as Node)) {
        setBatchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle batch selection change (multi-select): reset to page 1
  const toggleBatch = (batch: string) => {
    setSelectedBatches((prev) =>
      prev.includes(batch) ? prev.filter((b) => b !== batch) : [...prev, batch]
    );
    setPage(1);
  };

  const selectOnlyBatch = (batch: string) => {
    setSelectedBatches([batch]);
    setPage(1);
    setBatchDropdownOpen(false);
  };

  const clearBatchSelection = () => {
    setSelectedBatches([]);
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    setPage(1);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  // Handle recording a share event triggered via ShareMenu
  const handlePlatformShared = async (articleId: string, platform?: string) => {
    if (!platform) return;

    // Optimistically update local state
    setArticles((prev) =>
      prev.map((art) => {
        if (art.id !== articleId) return art;
        const current = art.sharedPlatforms || [];
        if (current.includes(platform)) return art;
        return {
          ...art,
          sharedPlatforms: [...current, platform],
        };
      })
    );

    if (platform === "Facebook" || platform === "LinkedIn" || platform === "Instagram") {
      showToast(`Marked shared on ${platform}! Caption copied to clipboard — press Paste (Cmd+V) into your post`, "success");
    } else if (platform === "X (Article)") {
      showToast("Opening X composer with article text! Image copied to clipboard — press Paste (Cmd+V) to attach image", "success");
    } else {
      showToast(`Marked shared on ${platform}`, "success");
    }

    try {
      await recordNewsArticleShare(supabase, articleId, platform);
    } catch (err) {
      console.error("Failed to persist platform share:", err);
    }
  };

  // Copy Tweet Hook
  const handleCopyTweet = (article: DistributionArticle) => {
    const tweetText = article.content?.tweet || article.headline;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(tweetText);
      setCopiedTweetSlug(article.slug);
      setTimeout(() => setCopiedTweetSlug(null), 2500);
      showToast("Tweet copied to clipboard", "info");
    }
  };

  // Export CSV of current view or full filtered batch
  const handleExportCsv = async () => {
    if (articles.length === 0) return;

    try {
      // If there are more items than on the current page, fetch full batch for export
      let exportData = articles;
      if (totalCount > articles.length) {
        showToast("Preparing full CSV export...", "info");
        const fullRes = await listNewsArticlesForDistribution(supabase, {
          status: "published",
          page: 1,
          pageSize: Math.min(1000, totalCount),
          batchNumber: selectedBatches.length ? selectedBatches : "all",
          search: searchQuery,
          sortBy,
        });
        if (fullRes.data && fullRes.data.length > 0) {
          exportData = fullRes.data;
        }
      }

      const headers = [
        "id",
        "score",
        "published_at",
        "headline",
        "shared_in",
        "batch_number",
        "category",
        "jurisdiction",
        "primary_official",
        "tweet_copy",
        "live_news_url",
        "politician_wall_url",
      ];

      const rows = exportData.map((art, idx) => {
        const jurisdiction = [art.province, art.country].filter(Boolean).join(", ") || "National";
        const liveUrl = `${SITE_URL}/news/${art.slug}`;
        const wallUrl = art.primaryWallSlug ? `${SITE_URL}/wall/${art.primaryWallSlug}` : liveUrl;
        const sharedStr = (art.sharedPlatforms || []).join(", ") || "None";
        const tweetCopy = art.content?.tweet || art.headline;

        const sanitize = (str: string | number | null | undefined) => {
          if (str === null || str === undefined) return '""';
          const s = String(str).replace(/"/g, '""');
          return `"${s}"`;
        };

        return [
          idx + 1,
          art.viralScore || 8.0,
          sanitize(convertToPackificTime(art.published_at || art.created_at)),
          sanitize(art.headline),
          sanitize(sharedStr),
          sanitize(art.batchNumber),
          sanitize(art.category),
          sanitize(jurisdiction),
          sanitize(art.primaryPoliticianName || "Civic Authority"),
          sanitize(tweetCopy),
          sanitize(liveUrl),
          sanitize(wallUrl),
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = `published-news-${
        selectedBatches.length === 0
          ? "all"
          : selectedBatches.map((b) => b.replace(/[^a-zA-Z0-9]/g, "-")).join("_")
      }.csv`;
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`Exported ${exportData.length} rows to CSV`, "success");
    } catch (err) {
      console.error("Export CSV failed:", err);
      showToast("Export failed", "error");
    }
  };

  const getShareDataForArticle = (article: DistributionArticle): ShareData => {
    const shareUrl = `${SITE_URL}/news/${article.slug}`;
    const politicianTags = (article.allPoliticianNames || [])
      .map((name) => name.replace(/[^a-zA-Z0-9]/g, ""))
      .filter(Boolean);
    const categoryTag = article.category ? article.category.replace(/[^a-zA-Z0-9]/g, "") : "News";
    const locationTag = article.province ? article.province.replace(/[^a-zA-Z0-9]/g, "") : (article.country || "");
    const topicTags = (article.content?.tags || []).map((t) => t.replace(/[^a-zA-Z0-9]/g, "")).filter(Boolean);

    const combinedTagList = Array.from(
      new Set([...politicianTags, ...topicTags, categoryTag, locationTag, "Choseno"].filter(Boolean))
    );

    const formattedHashtagString = combinedTagList.map((t) => `#${t}`).join(" ");

    const customTweet = article.content?.tweet?.trim();
    const taggedReps = article.allPoliticianNames || [];
    const basePostText = stripEmoji(
      customTweet ||
        (taggedReps.length > 0
          ? `${article.headline}\n\nRate ${taggedReps.join(", ")} and track local democracy on @choseno!`
          : `${article.headline}\n\nTrack local democracy and rate your representatives on @choseno!`)
    );

    // Build or fetch long-form tweetarticle for X Premium
    const customTweetArticle = (article.content as any)?.tweetarticle?.trim();
    const wallUrl = article.primaryWallSlug ? `${SITE_URL}/wall/${article.primaryWallSlug}` : undefined;
    const politicianMentions = taggedReps.length > 0 ? taggedReps.join(", ") : (article.primaryPoliticianName || "Elected Officials");
    const jurisdiction = [article.province, article.country].filter(Boolean).join(", ") || "National";
    const summaryText = article.summary || "";

    const tweetArticleText =
      customTweetArticle ||
      `${article.headline}\n\n📍 KEY FACTS & SCOPE:\n• Jurisdiction: ${jurisdiction}\n• Officials Involved: ${politicianMentions}\n• Overview: ${summaryText}\n\n🗣️ THE PERSPECTIVES:\n• Civic Context: Detailed reporting, debate, and community impact analysis are available on Choseno.\n• Transparency: Follow legislative milestones, vote counts, and budget line-items.\n\n🗳️ Rate this decision and view the official public record on Choseno:\n📰 Full Article: ${shareUrl}${wallUrl ? `\n👤 Politician Wall: ${wallUrl}` : ""}\n\n${formattedHashtagString}`;

    const shareText = `${basePostText}\n\n${formattedHashtagString}\n${shareUrl}`;
    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      basePostText
    )}&url=${encodeURIComponent(shareUrl)}&hashtags=${encodeURIComponent(combinedTagList.join(","))}`;

    const imageUrl = article.hero_image_url || `${SITE_URL}/api/news/${article.slug}/og-image`;

    return {
      url: shareUrl,
      basePostText,
      hashtagList: formattedHashtagString,
      shareText,
      hashtags: combinedTagList,
      twitterUrl: twitterShareUrl,
      tweetArticleText,
      imageUrl,
    };
  };

  // Pagination calculation
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  return (
    <div className="min-h-screen bg-background text-text-main p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Navigation Tabs */}
        <AdminSubNav active="news-distribution" />

        {/* Clean Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3.5 rounded-xl border border-border">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-base font-bold text-text-main flex items-center gap-2">
              <span>Published News Batches</span>
              <span className="text-xs font-mono font-normal text-text-muted bg-background px-2 py-0.5 rounded border border-border">
                {totalCount} {selectedBatches.length === 0 ? "total" : "in selection"}
              </span>
            </h1>

            {/* Batch Filter Dropdown (multi-select) */}
            <div className="flex items-center gap-1.5" ref={batchDropdownRef}>
              <span className="text-xs text-text-muted font-medium">Batch <span className="text-[10px] text-text-muted/60">(PST)</span>:</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBatchDropdownOpen((prev) => !prev)}
                  aria-label="Filter by batch"
                  aria-expanded={batchDropdownOpen}
                  aria-haspopup="true"
                  className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-mono text-text-main focus:outline-none focus:border-primary hover:border-primary/50 transition-colors cursor-pointer flex items-center gap-1.5 min-w-[160px] justify-between"
                >
                  <span className="truncate">
                    {selectedBatches.length === 0
                      ? `All Batches (${totalPublishedCount || "..."})`
                      : selectedBatches.length === 1
                      ? `${displayBatch(selectedBatches[0])} (${
                          distinctBatches.find((b) => b.batch === selectedBatches[0])?.count ?? 0
                        })`
                      : `${selectedBatches.length} batches selected`}
                  </span>
                  <ChevronDown size={13} className={`shrink-0 transition-transform ${batchDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {batchDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-72 max-h-96 overflow-y-auto bg-surface border border-border rounded-lg shadow-lg py-1">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 sticky top-0 bg-surface">
                      <button
                        type="button"
                        onClick={clearBatchSelection}
                        className={`text-xs font-semibold cursor-pointer hover:text-primary transition-colors ${
                          selectedBatches.length === 0 ? "text-primary" : "text-text-muted"
                        }`}
                      >
                        {selectedBatches.length === 0 ? "✓ " : ""}All Batches ({totalPublishedCount || "..."})
                      </button>
                      {selectedBatches.length > 0 && (
                        <button
                          type="button"
                          onClick={clearBatchSelection}
                          className="text-[11px] text-text-muted hover:text-primary transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {distinctBatches.map(({ batch, count }) => (
                      <div
                        key={batch}
                        className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-surface-hover/60 group"
                      >
                        <Checkbox
                          id={`batch-${batch}`}
                          checked={selectedBatches.includes(batch)}
                          onChange={() => toggleBatch(batch)}
                          label={
                            <span className="text-xs font-mono text-text-main">
                              {displayBatch(batch)} <span className="text-text-muted">({count})</span>
                            </span>
                          }
                        />
                        <button
                          type="button"
                          onClick={() => selectOnlyBatch(batch)}
                          title="Show only this batch"
                          className="text-[10px] text-text-muted hover:text-primary transition-colors cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          only
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                aria-label="Sort articles"
                className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-primary"
              >
                <option value="viral_desc">Viral Score (High → Low)</option>
                <option value="viral_asc">Viral Score (Low → High)</option>
                <option value="date_desc">Published (Newest first)</option>
                <option value="date_asc">Published (Oldest first)</option>
                <option value="headline_asc">Headline (A → Z)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search headlines..."
                className="pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs text-text-main placeholder:text-text-muted w-44 sm:w-56 focus:outline-none focus:border-primary"
              />
            </div>

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              disabled={articles.length === 0}
              title="Download filtered view as CSV"
              className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => {
                fetchBatches();
                fetchArticles(true);
              }}
              disabled={refreshing}
              title="Refresh database records"
              className="p-1.5 bg-background border border-border rounded-lg text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between border ${
              statusMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : statusMessage.type === "error"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : "bg-sky-500/10 border-sky-500/30 text-sky-400"
            }`}
          >
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)} className="ml-3 hover:opacity-80">
              ✕
            </button>
          </div>
        )}

        {/* Spreadsheet Table */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-xs text-text-muted">Loading articles (page {page})...</div>
            ) : articles.length === 0 ? (
              <div className="p-12 text-center text-xs text-text-muted">No published articles found for this selection.</div>
            ) : (
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="border-b border-border bg-surface-hover/60 text-text-muted font-mono font-semibold uppercase text-[11px]">
                    <th className="py-2.5 px-3 w-12 text-center border-r border-border/40">#</th>
                    <th className="py-2.5 px-3 w-16 text-center border-r border-border/40">
                      <button
                        type="button"
                        onClick={() => handleSortChange(sortBy === "viral_desc" ? "viral_asc" : "viral_desc")}
                        title="Sort by score"
                        className="inline-flex items-center gap-0.5 hover:text-primary transition-colors cursor-pointer uppercase font-mono font-semibold text-[11px]"
                      >
                        Score
                        {sortBy === "viral_desc" ? (
                          <ArrowDown size={11} className="text-primary" />
                        ) : sortBy === "viral_asc" ? (
                          <ArrowUp size={11} className="text-primary" />
                        ) : null}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 min-w-[125px] border-r border-border/40">Published <span className="text-[10px] text-text-muted/60">(PST)</span></th>
                    <th className="py-2.5 px-3 min-w-[280px] border-r border-border/40">Headline</th>
                    <th className="py-2.5 px-3 w-28 text-center border-r border-border/40">Share</th>
                    <th className="py-2.5 px-3 min-w-[140px] border-r border-border/40">Shared In</th>
                    <th className="py-2.5 px-3 min-w-[130px] border-r border-border/40">Batch</th>
                    <th className="py-2.5 px-3 min-w-[100px] border-r border-border/40">Category</th>
                    <th className="py-2.5 px-3 min-w-[90px] border-r border-border/40">Jurisdiction</th>
                    <th className="py-2.5 px-3 min-w-[140px] border-r border-border/40">Primary Official</th>
                    <th className="py-2.5 px-3 min-w-[240px]">Tweet Copy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-[12px]">
                  {articles.map((article, index) => {
                    const shareData = getShareDataForArticle(article);
                    const tweetCopy = article.content?.tweet || article.headline;
                    const jurisdiction = [article.province, article.country].filter(Boolean).join(", ");
                    const score = article.viralScore || 8.0;
                    const isCopied = copiedTweetSlug === article.slug;
                    const sharedList = article.sharedPlatforms || [];
                    const rowNumber = (page - 1) * pageSize + index + 1;

                    return (
                      <tr
                        key={article.id}
                        className="hover:bg-surface-hover/50 transition-colors group"
                      >
                        {/* 1. ID / Rank */}
                        <td className="py-2 px-3 text-center font-mono text-text-muted border-r border-border/40">
                          {rowNumber}
                        </td>

                        {/* 2. Score */}
                        <td className="py-2 px-3 text-center font-mono font-bold border-r border-border/40">
                          <span
                            className={
                              score >= 9.5
                                ? "text-amber-400 font-bold"
                                : score >= 9.0
                                ? "text-emerald-400 font-bold"
                                : "text-text-main"
                            }
                          >
                            {score.toFixed(1)}
                          </span>
                        </td>

                        {/* 3. Published Time */}
                        <td className="py-2 px-3 font-mono text-[11px] text-text-muted border-r border-border/40 whitespace-nowrap">
                          {article.published_at
                            ? convertToPackificTime(article.published_at)
                            : "—"}
                        </td>

                        {/* 4. Title / Headline */}
                        <td className="py-2 px-3 border-r border-border/40">
                          <a
                            href={`/news/${article.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-text-main hover:text-primary transition-colors line-clamp-1 inline-flex items-center gap-1"
                          >
                            <span>{article.headline}</span>
                            <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 text-text-muted shrink-0" />
                          </a>
                        </td>

                        {/* 5. Share Button */}
                        <td className="py-2 px-3 text-center border-r border-border/40 whitespace-nowrap">
                          <div className="inline-flex items-center justify-center">
                            <ShareMenu
                              articleId={article.id}
                              shareData={shareData}
                              onShare={(platform) => handlePlatformShared(article.id, platform)}
                              label="Share"
                              menuAlign="below"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-xs font-bold text-orange-600 transition-all cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
                              iconSize={13}
                            />
                          </div>
                        </td>

                        {/* 6. Shared In */}
                        <td className="py-2 px-3 font-medium border-r border-border/40 whitespace-nowrap">
                          {sharedList.length > 0 ? (
                            <span className="text-emerald-400 font-mono text-[11px]">
                              {sharedList.join(", ")}
                            </span>
                          ) : (
                            <span className="text-text-muted font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* 7. Batch */}
                        <td className="py-2 px-3 font-mono text-[11px] text-text-muted border-r border-border/40 whitespace-nowrap">
                          <button
                            onClick={() => selectOnlyBatch(article.batchNumber)}
                            title={`Click to filter: ${article.batchNumber}`}
                            className="hover:text-primary transition-colors cursor-pointer text-left"
                          >
                            {displayBatch(article.batchNumber)}
                          </button>
                        </td>

                        {/* 8. Category */}
                        <td className="py-2 px-3 text-text-muted border-r border-border/40 whitespace-nowrap">
                          {article.category}
                        </td>

                        {/* 9. Jurisdiction */}
                        <td className="py-2 px-3 text-text-muted border-r border-border/40 font-mono text-[11px] whitespace-nowrap">
                          {jurisdiction || "—"}
                        </td>

                        {/* 10. Primary Official */}
                        <td className="py-2 px-3 border-r border-border/40 whitespace-nowrap">
                          {article.primaryPoliticianName ? (
                            article.primaryWallSlug ? (
                              <Link
                                href={`/wall/${article.primaryWallSlug}`}
                                target="_blank"
                                className="text-text-main hover:text-primary transition-colors truncate max-w-[130px] block"
                              >
                                {article.primaryPoliticianName}
                              </Link>
                            ) : (
                              <span className="text-text-main truncate max-w-[130px] block">
                                {article.primaryPoliticianName}
                              </span>
                            )
                          ) : (
                            <span className="text-text-muted italic">—</span>
                          )}
                        </td>

                        {/* 11. Tweet Copy + Copy Button */}
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-between gap-2 max-w-md">
                            <span className="truncate text-text-muted text-[11px]" title={tweetCopy}>
                              {tweetCopy}
                            </span>
                            <button
                              onClick={() => handleCopyTweet(article)}
                              title="Copy tweet copy"
                              className="p-1 text-text-muted hover:text-primary transition-colors shrink-0 cursor-pointer"
                            >
                              {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Clean Pagination Footer */}
          {!loading && totalCount > 0 && (
            <div className="px-4 py-3 bg-surface-hover/30 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-text-muted">
                <span>
                  Showing <span className="font-semibold text-text-main">{startIndex}</span>–
                  <span className="font-semibold text-text-main">{endIndex}</span> of{" "}
                  <span className="font-semibold text-text-main">{totalCount}</span> articles
                </span>

                <span className="text-border">|</span>

                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    aria-label="Items per page"
                    className="px-2 py-0.5 bg-background border border-border rounded text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Navigation Controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                    title="First page"
                    className="p-1.5 bg-background border border-border rounded hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronsLeft size={14} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    title="Previous page"
                    className="p-1.5 bg-background border border-border rounded hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <span className="px-3 py-1 font-mono text-text-muted text-xs">
                    Page <span className="font-bold text-text-main">{page}</span> of{" "}
                    <span className="font-bold text-text-main">{totalPages}</span>
                  </span>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    title="Next page"
                    className="p-1.5 bg-background border border-border rounded hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                    title="Last page"
                    className="p-1.5 bg-background border border-border rounded hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronsRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
