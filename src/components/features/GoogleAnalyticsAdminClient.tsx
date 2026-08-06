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
} from "lucide-react";
import { GA4_DATE_RANGES, DEFAULT_GA4_DATE_RANGE_DAYS, type Ga4DateRangeDays } from "@/lib/constants/ga4";
import type { Ga4Overview } from "@/lib/analytics/ga4Reporting";

const RANGE_LABELS: Record<Ga4DateRangeDays, string> = {
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
            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card padding="md" className="border-l-4 border-l-primary space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Sessions</span>
                  <Activity size={18} className="text-primary" />
                </div>
                <p className="text-2xl font-bold text-text-main">{data.totals.sessions.toLocaleString()}</p>
              </Card>
              <Card padding="md" className="border-l-4 border-l-success space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Active Users</span>
                  <Users size={18} className="text-success" />
                </div>
                <p className="text-2xl font-bold text-text-main">{data.totals.activeUsers.toLocaleString()}</p>
              </Card>
              <Card padding="md" className="border-l-4 border-l-accent space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Page Views</span>
                  <Eye size={18} className="text-accent" />
                </div>
                <p className="text-2xl font-bold text-text-main">{data.totals.pageViews.toLocaleString()}</p>
              </Card>
              <Card padding="md" className="border-l-4 border-l-warning space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Avg Engagement</span>
                  <Clock size={18} className="text-warning" />
                </div>
                <p className="text-2xl font-bold text-text-main">
                  {Math.floor(data.totals.avgEngagementSec / 60)}m {data.totals.avgEngagementSec % 60}s
                </p>
              </Card>
            </div>

            {/* Daily sessions trend — plain CSS bars, no charting lib in this project */}
            {data.dailyTrend.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Sessions, {RANGE_LABELS[days].toLowerCase()}
                  </h3>
                </div>
                <div className="flex items-end gap-0.5 h-24 bg-surface/30 rounded-lg p-2">
                  {data.dailyTrend.map((day) => {
                    const max = Math.max(...data.dailyTrend.map((d) => d.sessions), 1);
                    const heightPct = Math.max((day.sessions / max) * 100, 2);
                    return (
                      <div
                        key={day.date}
                        title={`${day.date}: ${day.sessions} sessions`}
                        className="flex-1 bg-primary/60 hover:bg-primary rounded-sm transition-colors"
                        style={{ height: `${heightPct}%` }}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-text-muted font-mono">
                  <span>{data.dailyTrend[0]?.date}</span>
                  <span>{data.dailyTrend[data.dailyTrend.length - 1]?.date}</span>
                </div>
              </div>
            )}

            {/* Geography — where visitors are from */}
            <div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Globe2 size={13} /> Where visitors are from
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Countries */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Top Countries</p>
                  {data.topCountries.length === 0 ? (
                    <p className="text-xs text-text-muted">No geography data yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.topCountries.map((c) => {
                        const max = Math.max(...data.topCountries.map((x) => x.sessions), 1);
                        const pct = Math.max((c.sessions / max) * 100, 3);
                        return (
                          <div key={c.country} className="space-y-0.5">
                            <div className="flex items-center justify-between text-xs gap-3">
                              <span className="text-text-main font-medium truncate">{c.country}</span>
                              <span className="text-text-muted font-semibold shrink-0 font-mono">
                                {c.sessions.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-surface/60 overflow-hidden">
                              <div
                                className="h-full bg-primary/70 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
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
                    <div className="space-y-1.5">
                      {data.topCities.map((c, i) => (
                        <div key={`${c.city}-${c.country}-${i}`} className="flex items-center justify-between text-xs gap-3">
                          <span className="text-text-main truncate">
                            {c.city}
                            {c.country && <span className="text-text-muted"> · {c.country}</span>}
                          </span>
                          <span className="text-text-muted font-semibold shrink-0 font-mono">
                            {c.sessions.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Pages */}
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Top Pages</h3>
                <div className="space-y-1.5">
                  {data.topPages.length === 0 ? (
                    <p className="text-xs text-text-muted">No page view data yet.</p>
                  ) : (
                    data.topPages.map((p) => (
                      <div key={p.path} className="flex items-center justify-between text-xs gap-3">
                        <span className="font-mono text-text-main truncate">{p.path}</span>
                        <span className="text-text-muted font-semibold shrink-0">{p.views.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Events — this is where our custom gtag events show up */}
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Top Events</h3>
                <div className="space-y-1.5">
                  {data.topEvents.length === 0 ? (
                    <p className="text-xs text-text-muted">No event data yet.</p>
                  ) : (
                    data.topEvents.map((e) => (
                      <div key={e.name} className="flex items-center justify-between text-xs gap-3">
                        <span className="font-mono text-text-main truncate">{e.name}</span>
                        <span className="text-text-muted font-semibold shrink-0">{e.count.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Device breakdown */}
            {data.devices.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Smartphone size={13} /> Device Breakdown
                </h3>
                <div className="flex flex-wrap gap-2">
                  {data.devices.map((d) => {
                    const total = data.devices.reduce((acc, x) => acc + x.sessions, 0) || 1;
                    const pct = Math.round((d.sessions / total) * 100);
                    return (
                      <Badge key={d.category} tone="neutral" size="sm">
                        {d.category}: {pct}%
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
