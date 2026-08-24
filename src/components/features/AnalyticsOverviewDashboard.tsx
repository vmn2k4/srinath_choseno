"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, Spinner, Badge, PageHeader } from "@/components/primitives";
import {
  Users,
  MessageSquare,
  FileText,
  Activity,
  TrendingUp,
  Globe2,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  MousePointerClick,
} from "lucide-react";

interface AdminAnalyticsMetrics {
  totalPosts: number;
  totalComments: number;
  totalUsers: number;
  dnu: number;
  dau: number;
  wau: number;
  mau: number;
  activity: {
    postsToday: number;
    posts7d: number;
    posts30d: number;
    commentsToday: number;
    comments7d: number;
    comments30d: number;
  };
  rolesBreakdown: { citizen: number; politician: number; candidate: number; admin: number };
}

interface Ga4Overview {
  totals: {
    sessions: number;
    activeUsers: number;
    newUsers: number;
    pageViews: number;
    avgEngagementSec: number;
    bounceRate: number;
    conversions: number;
  };
  topCountries: Array<{
    country: string;
    sessions: number;
    activeUsers: number;
    bounceRate: number;
  }>;
  topPages: Array<{
    path: string;
    views: number;
    avgEngagementSec: number;
  }>;
  topEvents: Array<{
    name: string;
    count: number;
  }>;
}

interface SearchConsoleData {
  totals: {
    impressions: number;
    clicks: number;
    ctr: number;
    avgPosition: number;
  };
  topQueries: Array<{
    query: string;
    impressions: number;
    clicks: number;
    ctr: number;
    avgPosition: number;
  }>;
  topPages: Array<{
    page: string;
    impressions: number;
    clicks: number;
    ctr: number;
    avgPosition: number;
  }>;
}

export default function AnalyticsOverviewDashboard() {
  const [metrics, setMetrics] = useState<AdminAnalyticsMetrics | null>(null);
  const [ga4Data, setGa4Data] = useState<Ga4Overview | null>(null);
  const [scData, setScData] = useState<SearchConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"platform" | "traffic" | "seo">("platform");

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, ga4Res, scRes] = await Promise.all([
        fetch("/api/admin/analytics").then((r) => r.json()),
        fetch("/api/admin/ga4?days=30").then((r) => r.json()),
        fetch("/api/admin/search-console?days=30").then((r) => r.json()),
      ]);

      if (metricsRes.success && metricsRes.metrics) {
        setMetrics(metricsRes.metrics);
      }
      if (ga4Res.configured && ga4Res.data) {
        setGa4Data(ga4Res.data);
      }
      if (scRes.configured && scRes.data) {
        setScData(scRes.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch analytics data");
    } finally {
      setLoading(false);
    }
  };

  // Calculate key insights
  const insights = useMemo(() => {
    if (!metrics || !ga4Data || !scData) return [];

    const insights = [];

    // Platform health
    if (metrics.dau > 0) {
      const engagementRate = ((metrics.dau / metrics.totalUsers) * 100).toFixed(1);
      insights.push({
        type: "positive",
        title: "Healthy Daily Engagement",
        value: `${engagementRate}% DAU`,
        desc: `${metrics.dau} daily active users out of ${metrics.totalUsers} total`,
      });
    }

    // Content velocity
    if (metrics.activity.posts30d > 0 && metrics.activity.comments30d > 0) {
      const postsPer = (metrics.activity.posts30d / 30).toFixed(1);
      const commentsPer = (metrics.activity.comments30d / 30).toFixed(1);
      insights.push({
        type: "positive",
        title: "Content Activity",
        value: `${postsPer} posts/day`,
        desc: `${commentsPer} comments/day — healthy discussion velocity`,
      });
    }

    // User growth
    if (metrics.dnu > 0) {
      insights.push({
        type: "info",
        title: "New Signups Today",
        value: `+${metrics.dnu} users`,
        desc: `Growing from ${metrics.totalUsers} total accounts`,
      });
    }

    // Traffic quality
    if (ga4Data.totals.bounceRate > 0) {
      const engagementQuality =
        ga4Data.totals.bounceRate < 50
          ? "good"
          : ga4Data.totals.bounceRate < 65
          ? "moderate"
          : "needs-attention";
      insights.push({
        type: engagementQuality === "good" ? "positive" : "warning",
        title: "Traffic Quality",
        value: `${ga4Data.totals.bounceRate.toFixed(1)}% bounce rate`,
        desc:
          engagementQuality === "good"
            ? "Strong visitor engagement"
            : "Consider optimizing landing pages",
      });
    }

    // SEO performance
    if (scData.totals.impressions > 0 && scData.totals.avgPosition > 0) {
      const positionQuality = scData.totals.avgPosition < 10 ? "excellent" : scData.totals.avgPosition < 20 ? "good" : "needs-work";
      insights.push({
        type: positionQuality === "excellent" ? "positive" : "warning",
        title: "Search Visibility",
        value: `Position #${scData.totals.avgPosition.toFixed(1)}`,
        desc: `${scData.totals.impressions.toLocaleString()} search impressions`,
      });
    }

    return insights;
  }, [metrics, ga4Data, scData]);

  if (loading) {
    return (
      <div className="w-full max-w-none pb-20 px-4 lg:px-8 space-y-8">
        <PageHeader
          title="Analytics Overview"
          subtitle="Real-time performance across platform, traffic, and SEO"
        />
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none pb-20 px-4 lg:px-8 space-y-8 animate-fade-in">
      <PageHeader
        title="Analytics Overview"
        subtitle="Real-time performance across platform, traffic, and SEO"
      />

      {error && (
        <Card padding="md" className="border border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Failed to load analytics</p>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Key Insights */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {insights.map((insight, idx) => (
            <Card key={idx} padding="md" className="border-l-4 border-l-blue-500 space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{insight.title}</p>
              <p className="text-2xl font-bold text-gray-900">{insight.value}</p>
              <p className="text-sm text-gray-600">{insight.desc}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: "platform", label: "Platform Metrics", icon: "📊" },
          { id: "traffic", label: "Traffic & Visitors", icon: "📈" },
          { id: "seo", label: "SEO Performance", icon: "🔍" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Platform Metrics Tab */}
      {activeTab === "platform" && metrics && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card padding="md" className="border-l-4 border-l-purple-500 space-y-2">
              <span className="text-xs font-bold text-gray-600 uppercase">Total Users</span>
              <p className="text-3xl font-bold text-gray-900">{metrics.totalUsers.toLocaleString()}</p>
              <p className="text-sm text-gray-600">+{metrics.dnu} today</p>
            </Card>

            <Card padding="md" className="border-l-4 border-l-blue-500 space-y-2">
              <span className="text-xs font-bold text-gray-600 uppercase">Daily Active</span>
              <p className="text-3xl font-bold text-gray-900">{metrics.dau.toLocaleString()}</p>
              <p className="text-sm text-gray-600">
                {((metrics.dau / metrics.totalUsers) * 100).toFixed(1)}% of total
              </p>
            </Card>

            <Card padding="md" className="border-l-4 border-l-green-500 space-y-2">
              <span className="text-xs font-bold text-gray-600 uppercase">Posts</span>
              <p className="text-3xl font-bold text-gray-900">{metrics.totalPosts.toLocaleString()}</p>
              <p className="text-sm text-gray-600">+{metrics.activity.postsToday} today</p>
            </Card>

            <Card padding="md" className="border-l-4 border-l-orange-500 space-y-2">
              <span className="text-xs font-bold text-gray-600 uppercase">Comments</span>
              <p className="text-3xl font-bold text-gray-900">{metrics.totalComments.toLocaleString()}</p>
              <p className="text-sm text-gray-600">+{metrics.activity.commentsToday} today</p>
            </Card>
          </div>

          {/* Cohorts */}
          <Card padding="lg" className="space-y-4">
            <h3 className="font-semibold text-gray-900">User Roles</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(metrics.rolesBreakdown).map(([role, count]) => (
                <div key={role} className="space-y-2 p-3 bg-gray-50 rounded-lg">
                  <span className="text-xs font-semibold text-gray-600 uppercase">{role}</span>
                  <p className="text-2xl font-bold text-gray-900">{count.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* 30-Day Trends */}
          <Card padding="lg" className="space-y-4">
            <h3 className="font-semibold text-gray-900">Last 30 Days</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <span className="text-xs font-semibold text-gray-600 uppercase">Posts</span>
                <p className="text-2xl font-bold text-gray-900">{metrics.activity.posts30d}</p>
                <p className="text-sm text-gray-600">
                  ~{(metrics.activity.posts30d / 30).toFixed(1)} per day
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <span className="text-xs font-semibold text-gray-600 uppercase">Comments</span>
                <p className="text-2xl font-bold text-gray-900">{metrics.activity.comments30d}</p>
                <p className="text-sm text-gray-600">
                  ~{(metrics.activity.comments30d / 30).toFixed(1)} per day
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <span className="text-xs font-semibold text-gray-600 uppercase">Active Users</span>
                <p className="text-2xl font-bold text-gray-900">{metrics.mau.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Monthly active users</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Traffic Tab */}
      {activeTab === "traffic" && ga4Data && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card padding="md" className="border-l-4 border-l-blue-500 space-y-2">
              <span className="text-xs font-bold text-gray-600 uppercase">Sessions</span>
              <p className="text-3xl font-bold text-gray-900">{ga4Data.totals.sessions.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Last 30 days</p>
            </Card>

            <Card padding="md" className="border-l-4 border-l-green-500 space-y-2">
              <span className="text-xs font-bold text-gray-600 uppercase">Active Users</span>
              <p className="text-3xl font-bold text-gray-900">{ga4Data.totals.activeUsers.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Unique visitors</p>
            </Card>

            <Card padding="md" className="border-l-4 border-l-purple-500 space-y-2">
              <span className="text-xs font-bold text-gray-600 uppercase">Page Views</span>
              <p className="text-3xl font-bold text-gray-900">{ga4Data.totals.pageViews.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Total interactions</p>
            </Card>

            <Card padding="md" className="border-l-4 border-l-orange-500 space-y-2">
              <span className="text-xs font-bold text-gray-600 uppercase">Bounce Rate</span>
              <p className="text-3xl font-bold text-gray-900">{ga4Data.totals.bounceRate.toFixed(1)}%</p>
              <p className="text-sm text-gray-600">Single-interaction sessions</p>
            </Card>
          </div>

          {/* Top Pages */}
          {ga4Data.topPages.length > 0 && (
            <Card padding="lg" className="space-y-4">
              <h3 className="font-semibold text-gray-900">Top Pages</h3>
              <div className="space-y-3">
                {ga4Data.topPages.slice(0, 5).map((page, idx) => (
                  <div key={page.path} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-500">#{idx + 1}</span>
                      <span className="text-sm font-mono text-gray-900">{page.path}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{page.views.toLocaleString()} views</p>
                      <p className="text-xs text-gray-600">
                        {Math.floor(page.avgEngagementSec / 60)}m {page.avgEngagementSec % 60}s avg
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Top Countries */}
          {ga4Data.topCountries.length > 0 && (
            <Card padding="lg" className="space-y-4">
              <h3 className="font-semibold text-gray-900">Geographic Performance</h3>
              <div className="space-y-3">
                {ga4Data.topCountries.slice(0, 5).map((country) => (
                  <div key={country.country} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{country.country}</span>
                      <span className="text-sm font-bold text-gray-600">{country.sessions.toLocaleString()} sessions</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{
                          width: `${Math.min((country.sessions / (ga4Data.topCountries[0]?.sessions || 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* SEO Tab */}
      {activeTab === "seo" && scData && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card padding="md" className="border-l-4 border-l-blue-500 space-y-2">
              <span className="text-xs font-bold text-gray-600 uppercase">Impressions</span>
              <p className="text-3xl font-bold text-gray-900">{scData.totals.impressions.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Search results shown</p>
            </Card>

            <Card padding="md" className="border-l-4 border-l-green-500 space-y-2">
              <span className="text-xs font-bold text-gray-600 uppercase">Clicks</span>
              <p className="text-3xl font-bold text-gray-900">{scData.totals.clicks.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Clicks from search</p>
            </Card>

            <Card padding="md" className="border-l-4 border-l-purple-500 space-y-2">
              <span className="text-xs font-bold text-gray-600 uppercase">CTR</span>
              <p className="text-3xl font-bold text-gray-900">{scData.totals.ctr.toFixed(2)}%</p>
              <p className="text-sm text-gray-600">Click-through rate</p>
            </Card>

            <Card padding="md" className="border-l-4 border-l-orange-500 space-y-2">
              <span className="text-xs font-bold text-gray-600 uppercase">Avg Position</span>
              <p className="text-3xl font-bold text-gray-900">#{scData.totals.avgPosition.toFixed(1)}</p>
              <p className="text-sm text-gray-600">Average ranking</p>
            </Card>
          </div>

          {/* Top Queries */}
          {scData.topQueries.length > 0 && (
            <Card padding="lg" className="space-y-4">
              <h3 className="font-semibold text-gray-900">Top Search Queries</h3>
              <div className="space-y-3">
                {scData.topQueries.slice(0, 5).map((query, idx) => (
                  <div key={query.query} className="p-3 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-sm font-bold text-gray-500">#{idx + 1}</span>
                        <p className="text-sm font-medium text-gray-900 mt-1">{query.query}</p>
                      </div>
                      <Badge tone="neutral" size="sm">
                        #{query.avgPosition.toFixed(1)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="font-mono font-bold">{query.impressions}</span> impressions
                      </div>
                      <div>
                        <span className="font-mono font-bold">{query.clicks}</span> clicks
                      </div>
                      <div>
                        <span className="font-mono font-bold">{query.ctr.toFixed(1)}%</span> CTR
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Top Landing Pages */}
          {scData.topPages.length > 0 && (
            <Card padding="lg" className="space-y-4">
              <h3 className="font-semibold text-gray-900">Top Pages in Search</h3>
              <div className="space-y-3">
                {scData.topPages.slice(0, 5).map((page, idx) => (
                  <div key={page.page} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-bold text-gray-500 shrink-0">#{idx + 1}</span>
                      <span className="text-sm font-mono text-gray-900 truncate">{page.page}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{page.impressions.toLocaleString()}</p>
                      <p className="text-xs text-gray-600">{page.ctr.toFixed(1)}% CTR</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-center pt-8">
        <button
          onClick={fetchAllData}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh Data
        </button>
      </div>
    </div>
  );
}
