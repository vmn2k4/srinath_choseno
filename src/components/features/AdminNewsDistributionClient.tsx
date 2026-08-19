"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import AdminSubNav from "./AdminSubNav";
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Spinner,
  PageHeader,
} from "@/components/primitives";
import {
  Share2,
  Copy,
  Check,
  Download,
  Filter,
  RefreshCw,
  Search,
  ExternalLink,
  Flame,
  Layers,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Globe,
  Tag,
  CheckCircle2,
  XCircle,
  Plus,
  ArrowUpDown,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  listNewsArticlesForDistribution,
  recordNewsArticleShare,
  updateNewsArticleSharedPlatforms,
  NEWS_CATEGORIES,
  type DistributionArticle,
} from "@/lib/services/news";
import ShareMenu, { type ShareData } from "@/components/features/ShareMenu";
import { stripEmoji } from "@/lib/utils/text";
import { SITE_URL } from "@/lib/constants/site";

// Common social platforms tracked
const TRACKED_PLATFORMS = [
  { key: "X", label: "X (Twitter)", color: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
  { key: "Facebook", label: "Facebook", color: "bg-blue-600/10 text-blue-400 border-blue-600/30" },
  { key: "LinkedIn", label: "LinkedIn", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" },
  { key: "WhatsApp", label: "WhatsApp", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  { key: "Telegram", label: "Telegram", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  { key: "Pinterest", label: "Pinterest", color: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
  { key: "Email", label: "Email", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  { key: "Copy Link", label: "Copied Link", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
];

export default function AdminNewsDistributionClient() {
  const supabase = createClient();

  const [articles, setArticles] = useState<DistributionArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting state
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>("all");
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("viral_desc");

  // UI state
  const [copiedTweetSlug, setCopiedTweetSlug] = useState<string | null>(null);
  const [copiedLinkSlug, setCopiedLinkSlug] = useState<string | null>(null);
  const [editingPlatformsArticleId, setEditingPlatformsArticleId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  const fetchArticles = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const { data, error: fetchErr } = await listNewsArticlesForDistribution(supabase, {
        status: "published",
        limit: 500,
      });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      setArticles(data || []);
    } catch (err: any) {
      console.error("Error loading articles for distribution:", err);
      setError(err?.message || "Failed to load news articles");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const showToast = (text: string, type: "success" | "info" | "error" = "success") => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Derive distinct batches from articles with counts
  const distinctBatches = useMemo(() => {
    const map = new Map<string, number>();
    articles.forEach((art) => {
      const b = art.batchNumber || "Unassigned";
      map.set(b, (map.get(b) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([batch, count]) => ({ batch, count }))
      .sort((a, b) => b.batch.localeCompare(a.batch)); // Sort newest batch timestamp first
  }, [articles]);

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

    showToast(`Recorded share on ${platform}!`, "success");

    // Persist to Supabase
    try {
      await recordNewsArticleShare(supabase, articleId, platform);
    } catch (err) {
      console.error("Failed to persist platform share to Supabase:", err);
    }
  };

  // Toggle specific platform manually
  const handleTogglePlatform = async (article: DistributionArticle, platformKey: string) => {
    const current = article.sharedPlatforms || [];
    const exists = current.includes(platformKey);
    const updated = exists ? current.filter((p) => p !== platformKey) : [...current, platformKey];

    // Optimistic UI update
    setArticles((prev) =>
      prev.map((art) => (art.id === article.id ? { ...art, sharedPlatforms: updated } : art))
    );

    try {
      await updateNewsArticleSharedPlatforms(supabase, article.id, updated);
      showToast(exists ? `Removed ${platformKey}` : `Marked as shared on ${platformKey}`, "info");
    } catch (err) {
      console.error("Failed to update shared platforms:", err);
      showToast("Failed to update platform status", "error");
    }
  };

  // Copy Tweet Hook
  const handleCopyTweet = (article: DistributionArticle) => {
    const tweetText = article.content?.tweet || article.headline;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(tweetText);
      setCopiedTweetSlug(article.slug);
      setTimeout(() => setCopiedTweetSlug(null), 2500);
      showToast("Tweet copy copied to clipboard!", "success");
    }
  };

  // Copy Live URL
  const handleCopyLink = (article: DistributionArticle) => {
    const url = `${SITE_URL}/news/${article.slug}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLinkSlug(article.slug);
      setTimeout(() => setCopiedLinkSlug(null), 2500);
      showToast("Article URL copied to clipboard!", "success");
    }
  };

  // Filter and sort articles
  const filteredArticles = useMemo(() => {
    return articles
      .filter((art) => {
        // Batch filter
        if (selectedBatch !== "all" && art.batchNumber !== selectedBatch) {
          return false;
        }

        // Category filter
        if (selectedCategory !== "all" && art.category !== selectedCategory) {
          return false;
        }

        // Jurisdiction filter
        if (selectedJurisdiction !== "all") {
          if (selectedJurisdiction === "US" && art.country !== "US") return false;
          if (selectedJurisdiction === "CA" && art.country !== "CA") return false;
          if (selectedJurisdiction !== "US" && selectedJurisdiction !== "CA") {
            const jur = `${art.province || ""}, ${art.country || ""}`.trim();
            if (!jur.includes(selectedJurisdiction)) return false;
          }
        }

        // Platform shared filter
        if (selectedPlatformFilter !== "all") {
          const platforms = art.sharedPlatforms || [];
          if (selectedPlatformFilter === "shared_any" && platforms.length === 0) return false;
          if (selectedPlatformFilter === "not_shared" && platforms.length > 0) return false;
          if (
            selectedPlatformFilter !== "shared_any" &&
            selectedPlatformFilter !== "not_shared" &&
            !platforms.includes(selectedPlatformFilter)
          ) {
            return false;
          }
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchHeadline = art.headline.toLowerCase().includes(q);
          const matchSlug = art.slug.toLowerCase().includes(q);
          const matchSummary = (art.summary || "").toLowerCase().includes(q);
          const matchTweet = (art.content?.tweet || "").toLowerCase().includes(q);
          const matchPolitician = (art.allPoliticianNames || []).some((p) => p.toLowerCase().includes(q));
          const matchBatch = (art.batchNumber || "").toLowerCase().includes(q);
          if (!matchHeadline && !matchSlug && !matchSummary && !matchTweet && !matchPolitician && !matchBatch) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "viral_desc":
            return (b.viralScore || 0) - (a.viralScore || 0);
          case "viral_asc":
            return (a.viralScore || 0) - (b.viralScore || 0);
          case "batch_desc":
            return (b.batchNumber || "").localeCompare(a.batchNumber || "");
          case "batch_asc":
            return (a.batchNumber || "").localeCompare(b.batchNumber || "");
          case "date_desc":
            return new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime();
          case "date_asc":
            return new Date(a.published_at || a.created_at).getTime() - new Date(b.published_at || b.created_at).getTime();
          case "headline_asc":
            return a.headline.localeCompare(b.headline);
          default:
            return 0;
        }
      });
  }, [articles, selectedBatch, selectedCategory, selectedJurisdiction, selectedPlatformFilter, searchQuery, sortBy]);

  // Export filtered articles to CSV format
  const handleExportCsv = () => {
    if (!filteredArticles.length) {
      showToast("No articles match the current filter to export", "error");
      return;
    }

    const headers = [
      "batch_rank",
      "viral_score",
      "batch_number",
      "headline",
      "category",
      "jurisdiction",
      "primary_official",
      "published_at",
      "recommended_post_window",
      "tweet_copy",
      "shared_platforms",
      "live_news_url",
      "politician_wall_url",
    ];

    const rows = filteredArticles.map((art, idx) => {
      const jurisdiction = [art.province, art.country].filter(Boolean).join(", ") || "National";
      const liveUrl = `${SITE_URL}/news/${art.slug}`;
      const wallUrl = art.primaryWallSlug ? `${SITE_URL}/wall/${art.primaryWallSlug}` : liveUrl;
      const sharedStr = (art.sharedPlatforms || []).join(", ");
      const tweetCopy = art.content?.tweet || art.headline;

      const sanitize = (str: string | number | null | undefined) => {
        if (str === null || str === undefined) return '""';
        const s = String(str).replace(/"/g, '""');
        return `"${s}"`;
      };

      return [
        idx + 1,
        art.viralScore || 8.0,
        sanitize(art.batchNumber),
        sanitize(art.headline),
        sanitize(art.category),
        sanitize(jurisdiction),
        sanitize(art.primaryPoliticianName || "Civic Authority"),
        sanitize(art.published_at || art.created_at),
        sanitize("Evening Primetime (6:00 PM - 9:00 PM EST)"),
        sanitize(tweetCopy),
        sanitize(sharedStr),
        sanitize(liveUrl),
        sanitize(wallUrl),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = `news-distribution-${selectedBatch === "all" ? "all-batches" : selectedBatch.replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now()}.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${filteredArticles.length} stories to CSV!`, "success");
  };

  // Helper to construct ShareData for an article row
  const getShareDataForArticle = (article: DistributionArticle): ShareData => {
    const shareUrl = `${SITE_URL}/news/${article.slug}`;
    const customTweet = article.content?.tweet?.trim();
    const tags = article.content?.tags || [article.category, article.country || "News"].filter(Boolean);
    const formattedHashtagString = tags.map((t) => `#${t.replace(/[^a-zA-Z0-9]/g, "")}`).join(" ");

    const basePostText = stripEmoji(
      customTweet || `${article.headline}\n\nTrack local democracy and rate your representatives on @choseno!`
    );
    const shareText = `${basePostText}\n\n${formattedHashtagString}\n${shareUrl}`;
    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      basePostText
    )}&url=${encodeURIComponent(shareUrl)}&hashtags=${encodeURIComponent(tags.join(","))}`;

    return {
      url: shareUrl,
      basePostText,
      hashtagList: formattedHashtagString,
      shareText,
      hashtags: tags,
      twitterUrl: twitterShareUrl,
    };
  };

  // Calculate metrics
  const totalCount = articles.length;
  const sharedCount = articles.filter((a) => a.sharedPlatforms && a.sharedPlatforms.length > 0).length;
  const sharePercentage = totalCount > 0 ? Math.round((sharedCount / totalCount) * 100) : 0;
  const avgViralScore =
    totalCount > 0
      ? (articles.reduce((acc, curr) => acc + (curr.viralScore || 8.0), 0) / totalCount).toFixed(1)
      : "0.0";

  return (
    <div className="min-h-screen bg-background text-text-main p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Tabs */}
        <AdminSubNav active="news-distribution" />

        {/* Page Header */}
        <PageHeader
          title="News Distribution & Ranked Batches"
          subtitle="Track, filter, sort, and distribute published news articles across social media channels with batch management."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchArticles(true)}
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
                <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleExportCsv}
                disabled={filteredArticles.length === 0}
                className="flex items-center gap-2"
              >
                <Download size={15} />
                <span>Export CSV ({filteredArticles.length})</span>
              </Button>
            </div>
          }
        />

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-sm transition-all shadow-lg ${
              statusMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : statusMessage.type === "error"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : "bg-sky-500/10 border-sky-500/30 text-sky-400"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {statusMessage.type === "success" && <CheckCircle2 size={16} />}
              {statusMessage.type === "error" && <XCircle size={16} />}
              {statusMessage.type === "info" && <Sparkles size={16} />}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-text-muted hover:text-text-main p-1"
            >
              ×
            </button>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 bg-surface border-border">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Layers size={14} className="text-primary" />
              Published Stories
            </div>
            <div className="text-2xl font-bold text-text-main">{totalCount}</div>
            <div className="text-xs text-text-muted mt-1">Total live articles</div>
          </Card>

          <Card className="p-4 bg-surface border-border">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Calendar size={14} className="text-amber-500" />
              Distinct Batches
            </div>
            <div className="text-2xl font-bold text-text-main">{distinctBatches.length}</div>
            <div className="text-xs text-text-muted mt-1">Publishing windows</div>
          </Card>

          <Card className="p-4 bg-surface border-border">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Share2 size={14} className="text-emerald-500" />
              Distributed on Social
            </div>
            <div className="text-2xl font-bold text-text-main">
              {sharedCount}{" "}
              <span className="text-sm font-normal text-text-muted">({sharePercentage}%)</span>
            </div>
            <div className="text-xs text-text-muted mt-1">Shared to &ge; 1 platform</div>
          </Card>

          <Card className="p-4 bg-surface border-border">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Flame size={14} className="text-orange-500" />
              Avg Viral Score
            </div>
            <div className="text-2xl font-bold text-text-main">{avgViralScore} / 10</div>
            <div className="text-xs text-text-muted mt-1">Calculated potential</div>
          </Card>
        </div>

        {/* Filters and Controls Toolbar */}
        <Card className="p-4 sm:p-5 bg-surface border-border space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search headline, rep, slug..."
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Batch Filter Dropdown */}
            <div>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                aria-label="Filter by publishing batch"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-text-main focus:outline-none focus:border-primary transition-colors"
              >
                <option value="all">📁 All Batches ({articles.length} stories)</option>
                {distinctBatches.map(({ batch, count }) => (
                  <option key={batch} value={batch}>
                    📦 {batch} ({count} stories)
                  </option>
                ))}
              </select>
            </div>

            {/* Platform Share Status Filter */}
            <div>
              <select
                value={selectedPlatformFilter}
                onChange={(e) => setSelectedPlatformFilter(e.target.value)}
                aria-label="Filter by social sharing status"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-text-main focus:outline-none focus:border-primary transition-colors"
              >
                <option value="all">🌐 All Distribution Statuses</option>
                <option value="shared_any">✅ Shared on Any Platform</option>
                <option value="not_shared">⏳ Not Shared Yet</option>
                <option value="X">🐦 Shared on X</option>
                <option value="Facebook">📘 Shared on Facebook</option>
                <option value="LinkedIn">💼 Shared on LinkedIn</option>
                <option value="WhatsApp">💬 Shared on WhatsApp</option>
              </select>
            </div>

            {/* Sort Selector */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort articles by criteria"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-text-main focus:outline-none focus:border-primary transition-colors"
              >
                <option value="viral_desc">🔥 Highest Viral Score (Default)</option>
                <option value="viral_asc">❄️ Lowest Viral Score</option>
                <option value="batch_desc">📦 Batch Number (Newest first)</option>
                <option value="batch_asc">📦 Batch Number (Oldest first)</option>
                <option value="date_desc">📅 Published Time (Newest)</option>
                <option value="date_asc">📅 Published Time (Oldest)</option>
                <option value="headline_asc">🔤 Headline (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Secondary Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-text-muted font-semibold flex items-center gap-1">
                <Filter size={12} /> Filter:
              </span>

              {/* Jurisdiction Pills */}
              <div className="flex items-center gap-1 bg-background/50 p-1 rounded-lg border border-border">
                {["all", "US", "CA"].map((jur) => (
                  <button
                    key={jur}
                    onClick={() => setSelectedJurisdiction(jur)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      selectedJurisdiction === jur
                        ? "bg-primary text-white font-semibold"
                        : "text-text-muted hover:text-text-main"
                    }`}
                  >
                    {jur === "all" ? "All Regions" : jur === "US" ? "🇺🇸 United States" : "🇨🇦 Canada"}
                  </button>
                ))}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto max-w-xl py-0.5">
                {["all", "Elections", "Economy", "Policy", "Justice", "Infrastructure"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap ${
                      selectedCategory === cat
                        ? "bg-surface-hover text-text-main border-primary/50 font-semibold"
                        : "bg-background border-border text-text-muted hover:text-text-main"
                    }`}
                  >
                    {cat === "all" ? "All Categories" : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-text-muted">
              Showing <span className="font-semibold text-text-main">{filteredArticles.length}</span> of{" "}
              {articles.length} articles
              {selectedBatch !== "all" && (
                <button
                  onClick={() => setSelectedBatch("all")}
                  className="ml-2 text-primary hover:underline"
                >
                  (Reset Batch)
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Main Distribution Table */}
        <Card className="bg-surface border-border overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <Spinner size="md" />
              <div className="text-sm text-text-muted font-medium">Loading distribution records...</div>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-surface-hover mx-auto flex items-center justify-center text-text-muted">
                <Filter size={24} />
              </div>
              <div className="text-base font-semibold text-text-main">No news articles found</div>
              <div className="text-sm text-text-muted max-w-md mx-auto">
                No published articles matched the selected batch or filter criteria. Try adjusting your search query or batch selection.
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedBatch("all");
                  setSelectedCategory("all");
                  setSelectedJurisdiction("all");
                  setSelectedPlatformFilter("all");
                  setSearchQuery("");
                }}
              >
                Clear All Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-hover/50 text-text-muted font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-3 w-12 text-center">#</th>
                    <th className="py-3.5 px-3 min-w-[140px]">Batch Number</th>
                    <th className="py-3.5 px-4 min-w-[320px]">Headline & Details</th>
                    <th className="py-3.5 px-3 text-center min-w-[90px]">Viral Score</th>
                    <th className="py-3.5 px-3 min-w-[150px]">Primary Official / Wall</th>
                    <th className="py-3.5 px-3 min-w-[130px]">Published Time</th>
                    <th className="py-3.5 px-4 min-w-[280px]">Tweet Hook / Copy</th>
                    <th className="py-3.5 px-3 text-center min-w-[80px]">Share</th>
                    <th className="py-3.5 px-4 min-w-[220px]">Shared In Platforms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredArticles.map((article, index) => {
                    const shareData = getShareDataForArticle(article);
                    const tweetCopy = article.content?.tweet || article.headline;
                    const jurisdiction = [article.province, article.country].filter(Boolean).join(", ");
                    const score = article.viralScore || 8.0;
                    const isCopiedTweet = copiedTweetSlug === article.slug;
                    const isCopiedLink = copiedLinkSlug === article.slug;
                    const sharedPlatforms = article.sharedPlatforms || [];

                    return (
                      <tr
                        key={article.id}
                        className="hover:bg-surface-hover/40 transition-colors group"
                      >
                        {/* 1. Batch Rank / Index */}
                        <td className="py-3.5 px-3 text-center font-mono text-text-muted font-semibold">
                          {index + 1}
                        </td>

                        {/* 2. Batch Number (human readable, clickable to filter) */}
                        <td className="py-3.5 px-3">
                          <button
                            onClick={() => setSelectedBatch(article.batchNumber)}
                            title={`Filter to batch: ${article.batchNumber}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border/80 text-text-main font-mono text-[11px] hover:border-primary hover:text-primary transition-colors cursor-pointer"
                          >
                            <Calendar size={11} className="text-amber-500 shrink-0" />
                            <span>{article.batchNumber}</span>
                          </button>
                          <div className="text-[10px] font-mono text-text-muted mt-1 truncate max-w-[120px]">
                            {article.id.slice(0, 8)}…
                          </div>
                        </td>

                        {/* 3. Headline & Links */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1.5">
                            <a
                              href={`/news/${article.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-text-main hover:text-primary transition-colors text-sm leading-snug line-clamp-2 inline-flex items-center gap-1.5"
                            >
                              <span>{article.headline}</span>
                              <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-text-muted" />
                            </a>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Category badge */}
                              <span className="px-2 py-0.5 rounded-md bg-background border border-border text-[10px] font-medium text-text-muted">
                                {article.category}
                              </span>

                              {/* Jurisdiction badge */}
                              {jurisdiction && (
                                <span className="px-2 py-0.5 rounded-md bg-background border border-border text-[10px] font-medium text-text-muted flex items-center gap-1">
                                  <Globe size={10} />
                                  {jurisdiction}
                                </span>
                              )}

                              {/* Breaking Badge */}
                              {article.content?.breakingNews && (
                                <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">
                                  Breaking
                                </span>
                              )}

                              {/* Quick link copy */}
                              <button
                                onClick={() => handleCopyLink(article)}
                                title="Copy article link"
                                className="p-1 rounded text-text-muted hover:text-text-main hover:bg-background transition-colors"
                              >
                                {isCopiedLink ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* 4. Viral Score */}
                        <td className="py-3.5 px-3 text-center">
                          <div
                            className={`inline-flex flex-col items-center justify-center px-2.5 py-1 rounded-xl font-bold font-mono text-xs border shadow-sm ${
                              score >= 9.5
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                                : score >= 9.0
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                                : score >= 8.0
                                ? "bg-sky-500/15 text-sky-300 border-sky-500/40"
                                : "bg-slate-500/15 text-slate-300 border-slate-500/40"
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              {score >= 9.0 && <Flame size={12} className="text-amber-400" />}
                              {score.toFixed(1)}
                            </span>
                          </div>
                        </td>

                        {/* 5. Primary Official / Wall */}
                        <td className="py-3.5 px-3">
                          {article.primaryPoliticianName ? (
                            <div className="space-y-1">
                              {article.primaryWallSlug ? (
                                <Link
                                  href={`/wall/${article.primaryWallSlug}`}
                                  target="_blank"
                                  className="font-medium text-text-main hover:text-primary transition-colors flex items-center gap-1 truncate max-w-[140px]"
                                >
                                  <User size={12} className="text-primary shrink-0" />
                                  <span className="truncate">{article.primaryPoliticianName}</span>
                                </Link>
                              ) : (
                                <div className="font-medium text-text-main truncate max-w-[140px] flex items-center gap-1">
                                  <User size={12} className="text-text-muted shrink-0" />
                                  <span className="truncate">{article.primaryPoliticianName}</span>
                                </div>
                              )}

                              {article.allPoliticianNames && article.allPoliticianNames.length > 1 && (
                                <div className="text-[10px] text-text-muted">
                                  +{article.allPoliticianNames.length - 1} more rep(s)
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-text-muted italic">Civic Authority</span>
                          )}
                        </td>

                        {/* 6. Published Time */}
                        <td className="py-3.5 px-3 text-text-muted font-mono text-[11px]">
                          <div>
                            {article.published_at
                              ? new Date(article.published_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Draft"}
                          </div>
                          <div className="text-[10px] text-text-muted/70">
                            {article.published_at
                              ? new Date(article.published_at).toLocaleTimeString(undefined, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </div>
                        </td>

                        {/* 7. Tweet Hook / Copy with 1-Click Copy */}
                        <td className="py-3.5 px-4">
                          <div className="relative group/tweet bg-background/80 p-2 rounded-lg border border-border/80 text-[11px] text-text-main/90 leading-relaxed max-w-sm">
                            <p className="line-clamp-2 pr-6">{tweetCopy}</p>
                            <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-border/40 text-[10px] text-text-muted">
                              <span>{tweetCopy.length} chars</span>
                              <button
                                onClick={() => handleCopyTweet(article)}
                                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                              >
                                {isCopiedTweet ? (
                                  <>
                                    <Check size={11} className="text-emerald-500" />
                                    <span className="text-emerald-500">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={11} />
                                    <span>Copy Post</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* 8. Reusable Social Share Button */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="inline-flex items-center justify-center">
                            <ShareMenu
                              articleId={article.id}
                              shareData={shareData}
                              onShare={(platform) => handlePlatformShared(article.id, platform)}
                              menuAlign="above"
                              className="p-2 rounded-xl bg-background border border-border hover:border-primary hover:text-primary transition-all text-text-muted cursor-pointer shadow-sm hover:shadow"
                              iconSize={15}
                            />
                          </div>
                        </td>

                        {/* 9. Shared In Status Column (X, Facebook, etc.) */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1.5">
                            {sharedPlatforms.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {sharedPlatforms.map((p) => {
                                  const platformMeta = TRACKED_PLATFORMS.find((tp) => tp.key === p);
                                  const badgeClass =
                                    platformMeta?.color ||
                                    "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";

                                  return (
                                    <span
                                      key={p}
                                      className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold flex items-center gap-1 ${badgeClass}`}
                                    >
                                      <Check size={10} className="stroke-[3]" />
                                      <span>{p}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-[11px] text-text-muted italic flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
                                Not shared yet
                              </span>
                            )}

                            {/* Quick Platform Checkbox/Toggle Trigger */}
                            <div className="relative">
                              {editingPlatformsArticleId === article.id ? (
                                <div className="p-2 bg-background border border-border rounded-xl shadow-xl space-y-2 mt-1 z-30 relative max-w-xs">
                                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                    Mark Platforms Shared:
                                  </div>
                                  <div className="grid grid-cols-2 gap-1">
                                    {TRACKED_PLATFORMS.map((plat) => {
                                      const isChecked = sharedPlatforms.includes(plat.key);
                                      return (
                                        <button
                                          key={plat.key}
                                          onClick={() => handleTogglePlatform(article, plat.key)}
                                          className={`px-2 py-1 rounded-md text-[10px] font-medium border text-left flex items-center justify-between transition-colors ${
                                            isChecked
                                              ? "bg-primary/20 text-primary border-primary/40 font-semibold"
                                              : "bg-surface border-border text-text-muted hover:text-text-main"
                                          }`}
                                        >
                                          <span>{plat.key}</span>
                                          {isChecked && <Check size={10} />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <button
                                    onClick={() => setEditingPlatformsArticleId(null)}
                                    className="w-full text-center py-1 text-[10px] font-semibold text-text-muted hover:text-text-main bg-surface-hover rounded-md"
                                  >
                                    Done
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingPlatformsArticleId(article.id)}
                                  className="text-[10px] text-text-muted hover:text-primary transition-colors flex items-center gap-1 font-medium"
                                >
                                  <Plus size={10} />
                                  <span>Edit status</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
