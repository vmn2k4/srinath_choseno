"use client";

import React, { useCallback, useEffect, useState } from "react";
import AdminSubNav from "./AdminSubNav";
import { Card, Button, Spinner, PageHeader, Badge, Select } from "@/components/primitives";
import {
  RefreshCw,
  Eye,
  MousePointerClick,
  TrendingUp,
  BarChart3,
  AlertCircle,
  Globe2,
  Smartphone,
  Search,
} from "lucide-react";
import { GA4_DATE_RANGES, DEFAULT_GA4_DATE_RANGE_DAYS, type Ga4DateRangeDays } from "@/lib/constants/ga4";

export interface SearchConsoleData {
  totals: {
    impressions: number;
    clicks: number;
    ctr: number; // Click-through rate as percentage
    avgPosition: number;
  };
  dailyTrend: Array<{
    date: string;
    impressions: number;
    clicks: number;
    ctr: number;
    avgPosition: number;
  }>;
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
  countryData: Array<{
    country: string;
    impressions: number;
    clicks: number;
    ctr: number;
    avgPosition: number;
  }>;
  deviceData: Array<{
    device: string;
    impressions: number;
    clicks: number;
    ctr: number;
    avgPosition: number;
  }>;
}

const RANGE_LABELS: Record<Ga4DateRangeDays, string> = {
  1: "Last 24 hours",
  3: "Last 3 days",
  7: "Last 7 days",
  14: "Last 14 days",
  28: "Last 28 days",
  30: "Last 30 days",
  90: "Last 90 days",
};

export default function SearchConsoleAdminClient() {
  const [days, setDays] = useState<Ga4DateRangeDays>(DEFAULT_GA4_DATE_RANGE_DAYS);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchConsoleData | null>(null);

  const fetchSearchConsole = useCallback(async (rangeDays: Ga4DateRangeDays) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/search-console?days=${rangeDays}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || "Failed to load Google Search Console data.");
      } else if (body.configured === false) {
        setConfigured(false);
      } else if (body.error) {
        setConfigured(true);
        setError(body.error);
      } else {
        setConfigured(true);
        setData(body.data as SearchConsoleData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Google Search Console data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearchConsole(days);
  }, [days, fetchSearchConsole]);

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-8">
      <PageHeader
        title="Google Search Console"
        subtitle="SEO performance, search queries, impressions, and click-through rates from Google Search Console."
      />

      <AdminSubNav active="search-console" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Date range</span>
          <Select
            size="sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as Ga4DateRangeDays)}
            className="w-auto min-w-[9rem]"
          >
            {GA4_DATE_RANGES.map((d) => (
              <option key={d} value={d}>
                {RANGE_LABELS[d]}
              </option>
            ))}
          </Select>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchSearchConsole(days)}
          disabled={loading}
          className="gap-1.5 text-xs"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      <Card padding="lg" className="space-y-6">
        {loading && !data ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : !configured ? (
          <div className="text-center py-10 space-y-2 border border-dashed border-border-light/30 rounded-xl">
            <BarChart3 size={32} className="mx-auto text-text-muted opacity-50" />
            <p className="text-sm font-semibold text-text-main">
              Google Search Console isn&apos;t connected yet
            </p>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              Set GOOGLE_SEARCH_CONSOLE_EMAIL, GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY, and GOOGLE_SEARCH_CONSOLE_PROPERTY_URL
              in your environment to enable this section.
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-10 space-y-2 border border-dashed border-danger/30 rounded-xl">
            <AlertCircle size={32} className="mx-auto text-danger opacity-70" />
            <p className="text-sm font-semibold text-text-main">Couldn&apos;t load Search Console data</p>
            <p className="text-xs text-text-muted max-w-md mx-auto font-mono">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Primary KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card padding="md" className="border-l-4 border-l-primary space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Impressions</span>
                  <Eye size={18} className="text-primary" />
                </div>
                <p className="text-2xl font-bold text-text-main">{data.totals.impressions.toLocaleString()}</p>
                <p className="text-xs text-text-muted">Total search impressions</p>
              </Card>

              <Card padding="md" className="border-l-4 border-l-success space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Clicks</span>
                  <MousePointerClick size={18} className="text-success" />
                </div>
                <p className="text-2xl font-bold text-text-main">{data.totals.clicks.toLocaleString()}</p>
                <p className="text-xs text-text-muted">Total clicks from search</p>
              </Card>

              <Card padding="md" className="border-l-4 border-l-accent space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">CTR</span>
                  <TrendingUp size={18} className="text-accent" />
                </div>
                <p className="text-2xl font-bold text-text-main">{data.totals.ctr.toFixed(2)}%</p>
                <p className="text-xs text-text-muted">Click-through rate</p>
              </Card>

              <Card padding="md" className="border-l-4 border-l-warning space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Avg Position</span>
                  <BarChart3 size={18} className="text-warning" />
                </div>
                <p className="text-2xl font-bold text-text-main">{data.totals.avgPosition.toFixed(1)}</p>
                <p className="text-xs text-text-muted">Average search result position</p>
              </Card>
            </div>

            {/* Daily Trend Chart */}
            {data.dailyTrend.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Daily Performance Trend
                  </h3>
                  <span className="text-[11px] text-text-muted">{RANGE_LABELS[days].toLowerCase()}</span>
                </div>
                <div className="flex gap-3">
                  {/* Y-axis labels */}
                  <div className="flex flex-col justify-between h-40 text-right pr-2 py-2">
                    {(() => {
                      const max = Math.max(...data.dailyTrend.map((d) => d.impressions), 1);
                      const labels = [];
                      for (let i = 0; i <= 4; i++) {
                        labels.push(Math.round((max / 4) * (4 - i)));
                      }
                      return labels.map((label, idx) => (
                        <div key={idx} className="text-[10px] text-text-muted font-mono leading-none">
                          {label.toLocaleString()}
                        </div>
                      ));
                    })()}
                  </div>
                  {/* Chart */}
                  <div className="flex-1">
                    <div className="flex items-end gap-0.5 h-40 bg-surface/30 rounded-lg p-3 border border-border-light/20">
                      {data.dailyTrend.map((day) => {
                        const max = Math.max(...data.dailyTrend.map((d) => d.impressions), 1);
                        const heightPct = Math.max((day.impressions / max) * 100, 2);
                        return (
                          <div
                            key={day.date}
                            className="flex-1 group relative"
                            style={{ height: `${heightPct}%` }}
                          >
                            <div
                              title={`${day.date}: ${day.impressions} impressions, ${day.clicks} clicks, ${day.ctr.toFixed(2)}% CTR, position ${day.avgPosition.toFixed(1)}`}
                              className="w-full h-full bg-gradient-to-t from-primary to-primary/60 hover:from-primary hover:to-primary rounded-sm transition-all cursor-pointer"
                            />
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-6 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              <div className="text-[10px] text-text-muted font-mono">{day.date}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-6 text-[10px] text-text-muted font-mono">
                      <span>{data.dailyTrend[0]?.date}</span>
                      <span>{data.dailyTrend[data.dailyTrend.length - 1]?.date}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Top Queries & Top Pages */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Queries */}
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Search size={13} /> Top Search Queries
                </h3>
                <div className="space-y-2.5">
                  {data.topQueries.length === 0 ? (
                    <p className="text-xs text-text-muted">No query data yet.</p>
                  ) : (
                    data.topQueries.map((q, idx) => (
                      <div key={q.query} className="border border-border-light/30 rounded-lg p-2.5 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-text-muted bg-surface/80 px-1.5 py-0.5 rounded">
                                #{idx + 1}
                              </span>
                              <span className="text-xs text-text-main truncate font-medium">{q.query}</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-text-muted">
                          <div>
                            <span className="font-mono font-semibold">{q.impressions.toLocaleString()}</span>
                            {" "}impressions
                          </div>
                          <div>
                            <span className="font-mono font-semibold">{q.clicks.toLocaleString()}</span>
                            {" "}clicks
                          </div>
                          <div>
                            <span className="font-mono font-semibold">{q.ctr.toFixed(2)}%</span>
                            {" "}CTR
                          </div>
                          <div>
                            <span className="font-mono font-semibold">#{q.avgPosition.toFixed(1)}</span>
                            {" "}position
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Pages */}
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Top Pages</h3>
                <div className="space-y-2.5">
                  {data.topPages.length === 0 ? (
                    <p className="text-xs text-text-muted">No page data yet.</p>
                  ) : (
                    data.topPages.map((p, idx) => (
                      <div key={p.page} className="border border-border-light/30 rounded-lg p-2.5 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-text-muted bg-surface/80 px-1.5 py-0.5 rounded">
                                #{idx + 1}
                              </span>
                              <span className="font-mono text-xs text-text-main truncate">{p.page}</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-text-muted">
                          <div>
                            <span className="font-mono font-semibold">{p.impressions.toLocaleString()}</span>
                            {" "}impressions
                          </div>
                          <div>
                            <span className="font-mono font-semibold">{p.clicks.toLocaleString()}</span>
                            {" "}clicks
                          </div>
                          <div>
                            <span className="font-mono font-semibold">{p.ctr.toFixed(2)}%</span>
                            {" "}CTR
                          </div>
                          <div>
                            <span className="font-mono font-semibold">#{p.avgPosition.toFixed(1)}</span>
                            {" "}position
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Country & Device Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Country Data */}
              {data.countryData.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Globe2 size={13} /> Geographic Performance
                  </h3>
                  <div className="space-y-2.5">
                    {data.countryData.map((c) => {
                      const max = Math.max(...data.countryData.map((x) => x.impressions), 1);
                      const pct = Math.max((c.impressions / max) * 100, 3);
                      return (
                        <div key={c.country} className="border border-border-light/30 rounded-lg p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-text-main">{c.country}</span>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-text-muted font-mono">{c.impressions.toLocaleString()}</span>
                              <span className="text-text-muted/60">•</span>
                              <span className="text-text-muted font-mono">{c.ctr.toFixed(2)}% CTR</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-surface/60 overflow-hidden">
                              <div
                                className="h-full bg-primary/70 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-text-muted font-mono shrink-0">
                              #{c.avgPosition.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Device Data */}
              {data.deviceData.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Smartphone size={13} /> Device Performance
                  </h3>
                  <div className="space-y-2.5">
                    {data.deviceData.map((d) => {
                      const max = Math.max(...data.deviceData.map((x) => x.impressions), 1);
                      const pct = Math.max((d.impressions / max) * 100, 3);
                      return (
                        <div key={d.device} className="border border-border-light/30 rounded-lg p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-text-main capitalize">{d.device}</span>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-text-muted font-mono">{d.clicks.toLocaleString()}</span>
                              <span className="text-text-muted/60">•</span>
                              <span className="text-text-muted font-mono">{d.ctr.toFixed(2)}%</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-surface/60 overflow-hidden">
                              <div
                                className="h-full bg-accent/70 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-text-muted font-mono shrink-0">
                              {d.impressions.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
