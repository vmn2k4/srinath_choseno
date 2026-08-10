"use client";

import React, { useCallback, useEffect, useState } from "react";
import AdminSubNav from "./AdminSubNav";
import { Card, Button, Spinner, PageHeader, Badge, Select } from "@/components/primitives";
import {
  Users,
  RefreshCw,
  Activity,
  BarChart3,
  Eye,
  Clock,
  Smartphone,
  AlertCircle,
  Globe2,
  MapPin,
  TrendingUp,
  Link2,
  Zap,
  UserPlus,
} from "lucide-react";
import { GA4_DATE_RANGES, DEFAULT_GA4_DATE_RANGE_DAYS, type Ga4DateRangeDays } from "@/lib/constants/ga4";
import type { Ga4Overview } from "@/lib/analytics/ga4Reporting";

const RANGE_LABELS: Record<Ga4DateRangeDays, string> = {
  1: "Last 24 hours",
  3: "Last 3 days",
  7: "Last 7 days",
  14: "Last 14 days",
  28: "Last 28 days",
  30: "Last 30 days",
  90: "Last 90 days",
};

export default function GoogleAnalyticsAdminClient() {
  const [days, setDays] = useState<Ga4DateRangeDays>(DEFAULT_GA4_DATE_RANGE_DAYS);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Ga4Overview | null>(null);

  const fetchGa4 = useCallback(async (rangeDays: Ga4DateRangeDays) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ga4?days=${rangeDays}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || "Failed to load Google Analytics data.");
      } else if (body.configured === false) {
        setConfigured(false);
      } else if (body.error) {
        setConfigured(true);
        setError(body.error);
      } else {
        setConfigured(true);
        setData(body.data as Ga4Overview);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Google Analytics data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGa4(days);
  }, [days, fetchGa4]);

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-8">
      <PageHeader
        title="Google Analytics"
        subtitle="Real visitor traffic, geography, and engagement from GA4 — separate from the platform activity metrics, which come from Supabase."
      />

      <AdminSubNav active="traffic" />

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
          onClick={() => fetchGa4(days)}
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
            <p className="text-sm font-semibold text-text-main">Google Analytics isn&apos;t connected yet</p>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              Set GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_EMAIL, and GA4_SERVICE_ACCOUNT_PRIVATE_KEY
              in your environment to enable this section.
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-10 space-y-2 border border-dashed border-danger/30 rounded-xl">
            <AlertCircle size={32} className="mx-auto text-danger opacity-70" />
            <p className="text-sm font-semibold text-text-main">Couldn&apos;t load Google Analytics data</p>
            <p className="text-xs text-text-muted max-w-md mx-auto font-mono">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Primary KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card padding="md" className="border-l-4 border-l-primary space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Sessions</span>
                  <Activity size={18} className="text-primary" />
                </div>
                <p className="text-2xl font-bold text-text-main">{data.totals.sessions.toLocaleString()}</p>
                <p className="text-xs text-text-muted">Total user sessions</p>
              </Card>
              <Card padding="md" className="border-l-4 border-l-success space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Active Users</span>
                  <Users size={18} className="text-success" />
                </div>
                <p className="text-2xl font-bold text-text-main">{data.totals.activeUsers.toLocaleString()}</p>
                <p className="text-xs text-text-muted">Unique visitors</p>
              </Card>
              <Card padding="md" className="border-l-4 border-l-accent space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Page Views</span>
                  <Eye size={18} className="text-accent" />
                </div>
                <p className="text-2xl font-bold text-text-main">{data.totals.pageViews.toLocaleString()}</p>
                <p className="text-xs text-text-muted">Total page views</p>
              </Card>
              <Card padding="md" className="border-l-4 border-l-warning space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Avg Engagement</span>
                  <Clock size={18} className="text-warning" />
                </div>
                <p className="text-2xl font-bold text-text-main">
                  {Math.floor(data.totals.avgEngagementSec / 60)}m {data.totals.avgEngagementSec % 60}s
                </p>
                <p className="text-xs text-text-muted">Per session</p>
              </Card>
            </div>

            {/* Secondary KPI Grid — New Users, Bounce Rate & Conversions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card padding="md" className="border-l-4 border-l-accent space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">New Users</span>
                  <UserPlus size={18} className="text-accent" />
                </div>
                <p className="text-2xl font-bold text-text-main">{data.totals.newUsers.toLocaleString()}</p>
                <p className="text-xs text-text-muted">
                  {data.totals.activeUsers > 0
                    ? `${Math.round((data.totals.newUsers / data.totals.activeUsers) * 100)}% of active users`
                    : "First-time visitors"}
                </p>
              </Card>
              <Card padding="md" className="border-l-4 border-l-danger space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Bounce Rate</span>
                  <TrendingUp size={18} className="text-danger" />
                </div>
                <p className="text-2xl font-bold text-text-main">{data.totals.bounceRate.toFixed(2)}%</p>
                <p className="text-xs text-text-muted">Sessions with single interaction</p>
              </Card>
              <Card padding="md" className="border-l-4 border-l-success space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Conversions</span>
                  <Zap size={18} className="text-success" />
                </div>
                <p className="text-2xl font-bold text-text-main">{data.totals.conversions.toLocaleString()}</p>
                <p className="text-xs text-text-muted">Total goal completions</p>
              </Card>
            </div>

            {/* Hourly traffic — always last 24 hours, independent of the date range selector */}
            {data.hourlyTrend.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Hourly Traffic
                  </h3>
                  <span className="text-[11px] text-text-muted">last 24 hours</span>
                </div>
                <div className="flex gap-3">
                  {/* Y-axis labels */}
                  <div className="flex flex-col justify-between h-40 text-right pr-2 py-2">
                    {(() => {
                      const max = Math.max(...data.hourlyTrend.map((h) => h.sessions), 1);
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
                      {data.hourlyTrend.map((hour) => {
                        const max = Math.max(...data.hourlyTrend.map((h) => h.sessions), 1);
                        const heightPct = Math.max((hour.sessions / max) * 100, 2);
                        return (
                          <div
                            key={hour.dateHour}
                            className="flex-1 group relative"
                            style={{ height: `${heightPct}%` }}
                          >
                            <div
                              title={`${hour.hourLabel}: ${hour.sessions} sessions, ${hour.activeUsers} users, ${hour.newUsers} new`}
                              className="w-full h-full bg-gradient-to-t from-accent to-accent/60 hover:from-accent hover:to-accent rounded-sm transition-all cursor-pointer"
                            />
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-6 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              <div className="text-[10px] text-text-muted font-mono">{hour.hourLabel}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-6 text-[10px] text-text-muted font-mono">
                      <span>{data.hourlyTrend[0]?.hourLabel}</span>
                      <span>{data.hourlyTrend[data.hourlyTrend.length - 1]?.hourLabel}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Daily sessions trend with y-axis labels */}
            {data.dailyTrend.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Daily Sessions Trend
                  </h3>
                  <span className="text-[11px] text-text-muted">{RANGE_LABELS[days].toLowerCase()}</span>
                </div>
                <div className="flex gap-3">
                  {/* Y-axis labels */}
                  <div className="flex flex-col justify-between h-40 text-right pr-2 py-2">
                    {(() => {
                      const max = Math.max(...data.dailyTrend.map((d) => d.sessions), 1);
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
                        const max = Math.max(...data.dailyTrend.map((d) => d.sessions), 1);
                        const heightPct = Math.max((day.sessions / max) * 100, 2);
                        return (
                          <div
                            key={day.date}
                            className="flex-1 group relative"
                            style={{ height: `${heightPct}%` }}
                          >
                            <div
                              title={`${day.date}: ${day.sessions} sessions, ${day.activeUsers} users (${day.newUsers} new), ${day.bounceRate.toFixed(1)}% bounce`}
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

            {/* Geography — where visitors are from */}
            <div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Globe2 size={13} /> Geographic Performance
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Countries */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Top Countries</p>
                  {data.topCountries.length === 0 ? (
                    <p className="text-xs text-text-muted">No geography data yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {data.topCountries.map((c, idx) => {
                        const max = Math.max(...data.topCountries.map((x) => x.sessions), 1);
                        const pct = Math.max((c.sessions / max) * 100, 3);
                        return (
                          <div key={c.country} className="border border-border-light/30 rounded-lg p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-text-main">{c.country}</span>
                              <div className="flex items-center gap-1 text-[10px]">
                                <span className="text-text-muted font-mono">{c.sessions.toLocaleString()}</span>
                                <span className="text-text-muted/60">•</span>
                                <span className="text-text-muted font-mono">{c.activeUsers.toLocaleString()} users</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-surface/60 overflow-hidden">
                                <div
                                  className="h-full bg-primary/70 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-danger font-mono shrink-0">
                                {c.bounceRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Top Cities */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1">
                    <MapPin size={11} /> Top Cities
                  </p>
                  {data.topCities.length === 0 ? (
                    <p className="text-xs text-text-muted">No city-level data yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.topCities.map((c, i) => {
                        const max = Math.max(...data.topCities.map((x) => x.sessions), 1);
                        const pct = Math.max((c.sessions / max) * 100, 3);
                        return (
                          <div key={`${c.city}-${c.country}-${i}`} className="space-y-1">
                            <div className="flex items-center justify-between text-xs gap-3">
                              <span className="text-text-main font-medium truncate">
                                {c.city}
                                {c.country && <span className="text-text-muted text-[10px]"> · {c.country}</span>}
                              </span>
                              <span className="text-text-muted font-semibold shrink-0 font-mono">
                                {c.sessions.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-surface/60 overflow-hidden">
                              <div
                                className="h-full bg-accent/70 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Traffic Sources Overview */}
            <div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Link2 size={13} /> Traffic Sources
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {data.trafficSources.length === 0 ? (
                  <p className="text-xs text-text-muted col-span-3">No traffic source data yet.</p>
                ) : (
                  data.trafficSources.map((source) => {
                    const total = data.trafficSources.reduce((acc, s) => acc + s.sessions, 0) || 1;
                    const pct = Math.round((source.sessions / total) * 100);
                    return (
                      <div key={source.source} className="border border-border-light/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-text-main truncate">{source.source}</span>
                          <Badge tone="neutral" size="sm">
                            {pct}%
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="h-1.5 rounded-full bg-surface/60 overflow-hidden">
                            <div
                              className="h-full bg-primary/70 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-text-muted">
                            <span>{source.sessions.toLocaleString()} sessions</span>
                            <span>{source.activeUsers.toLocaleString()} users</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Top Pages & Top Events Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Pages with Engagement */}
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Top Pages</h3>
                <div className="space-y-2.5">
                  {data.topPages.length === 0 ? (
                    <p className="text-xs text-text-muted">No page view data yet.</p>
                  ) : (
                    data.topPages.map((p, idx) => (
                      <div key={p.path} className="border border-border-light/30 rounded-lg p-2.5 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-text-muted bg-surface/80 px-1.5 py-0.5 rounded">
                                #{idx + 1}
                              </span>
                              <span className="font-mono text-xs text-text-main truncate">{p.path}</span>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-primary shrink-0">{p.views.toLocaleString()}</span>
                        </div>
                        <div className="text-[10px] text-text-muted">
                          Avg engagement: {Math.floor(p.avgEngagementSec / 60)}m {p.avgEngagementSec % 60}s
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Events */}
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Top Events</h3>
                <div className="space-y-2.5">
                  {data.topEvents.length === 0 ? (
                    <p className="text-xs text-text-muted">No event data yet.</p>
                  ) : (
                    data.topEvents.map((e, idx) => {
                      const max = Math.max(...data.topEvents.map((x) => x.count), 1);
                      const pct = Math.max((e.count / max) * 100, 5);
                      return (
                        <div key={e.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs gap-3">
                            <span className="text-text-main font-medium truncate">
                              <span className="text-[10px] font-bold text-text-muted bg-surface/80 px-1.5 py-0.5 rounded mr-2">
                                #{idx + 1}
                              </span>
                              {e.name}
                            </span>
                            <span className="text-text-muted font-semibold shrink-0 font-mono">
                              {e.count.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface/60 overflow-hidden">
                            <div
                              className="h-full bg-accent/70 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Bounce Rate by Device & Top Referrers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Device Breakdown with Bounce Rate */}
              {data.devices.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Smartphone size={13} /> Device Performance
                  </h3>
                  <div className="space-y-2.5">
                    {data.devices.map((d) => {
                      const total = data.devices.reduce((acc, x) => acc + x.sessions, 0) || 1;
                      const pct = Math.round((d.sessions / total) * 100);
                      return (
                        <div key={d.category} className="border border-border-light/30 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-text-main capitalize">{d.category}</span>
                            <div className="flex items-center gap-2">
                              <Badge tone="neutral" size="sm">
                                {pct}%
                              </Badge>
                              <span className="text-[10px] font-mono text-danger">
                                {d.bounceRate.toFixed(1)}% bounce
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface/60 overflow-hidden">
                            <div
                              className="h-full bg-primary/70 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-text-muted">
                            {d.sessions.toLocaleString()} sessions
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top Referrers */}
              {data.topReferrers && data.topReferrers.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Link2 size={13} /> Top Referrers
                  </h3>
                  <div className="space-y-2">
                    {data.topReferrers.map((r, idx) => {
                      const max = Math.max(...data.topReferrers.map((x) => x.sessions), 1);
                      const pct = Math.max((r.sessions / max) * 100, 5);
                      return (
                        <div key={`${r.referrer}-${idx}`} className="space-y-1">
                          <div className="flex items-center justify-between text-xs gap-3">
                            <span className="text-text-main truncate font-mono text-[11px]">{r.referrer || "(direct)"}</span>
                            <span className="text-text-muted font-semibold shrink-0">
                              {r.sessions.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface/60 overflow-hidden">
                            <div
                              className="h-full bg-success/70 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
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
