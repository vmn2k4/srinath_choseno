"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminSubNav from "./AdminSubNav";
import { Card, Button, Spinner, PageHeader, Badge, Select } from "@/components/primitives";
import {
  RefreshCw,
  AlertCircle,
  BarChart3,
  Globe2,
  MapPin,
  Clock,
  Eye,
  LogIn,
  LogOut,
  MousePointerClick,
  Info,
} from "lucide-react";
import {
  GA4_DATE_RANGES,
  DEFAULT_GA4_DATE_RANGE_DAYS,
  type Ga4DateRangeDays,
  GA4_GRANULARITIES,
  DEFAULT_GA4_GRANULARITY,
  type Ga4Granularity,
} from "@/lib/constants/ga4";
import type { Ga4GeoRow, Ga4RegionExplorer } from "@/lib/analytics/ga4Reporting";

const RANGE_LABELS: Record<Ga4DateRangeDays, string> = {
  1: "Last 24 hours",
  3: "Last 3 days",
  7: "Last 7 days",
  14: "Last 14 days",
  28: "Last 28 days",
  30: "Last 30 days",
  90: "Last 90 days",
};

const GRANULARITY_LABELS: Record<Ga4Granularity, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

const ALL_VALUE = "__all__";

export default function RegionExplorerAdminClient() {
  const [days, setDays] = useState<Ga4DateRangeDays>(DEFAULT_GA4_DATE_RANGE_DAYS);
  const [granularity, setGranularity] = useState<Ga4Granularity>(DEFAULT_GA4_GRANULARITY);

  const [country, setCountry] = useState<string>(ALL_VALUE);
  const [region, setRegion] = useState<string>(ALL_VALUE);
  const [city, setCity] = useState<string>(ALL_VALUE);

  const [configured, setConfigured] = useState(true);
  const [geoRows, setGeoRows] = useState<Ga4GeoRow[]>([]);
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [explorer, setExplorer] = useState<Ga4RegionExplorer | null>(null);
  const [explorerLoading, setExplorerLoading] = useState(true);
  const [explorerError, setExplorerError] = useState<string | null>(null);

  const fetchGeo = useCallback(async (rangeDays: Ga4DateRangeDays) => {
    setGeoLoading(true);
    setGeoError(null);
    try {
      const res = await fetch(`/api/admin/ga4/geo?days=${rangeDays}`);
      const body = await res.json();
      if (!res.ok) {
        setGeoError(body?.error || "Failed to load geography data.");
      } else if (body.configured === false) {
        setConfigured(false);
      } else if (body.error) {
        setGeoError(body.error);
      } else {
        setGeoRows((body.data as Ga4GeoRow[]) || []);
      }
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Failed to load geography data.");
    } finally {
      setGeoLoading(false);
    }
  }, []);

  const fetchExplorer = useCallback(
    async (rangeDays: Ga4DateRangeDays, gran: Ga4Granularity, c: string, r: string, ci: string) => {
      setExplorerLoading(true);
      setExplorerError(null);
      try {
        const qs = new URLSearchParams({ days: String(rangeDays), granularity: gran });
        if (c !== ALL_VALUE) qs.set("country", c);
        if (r !== ALL_VALUE) qs.set("region", r);
        if (ci !== ALL_VALUE) qs.set("city", ci);
        const res = await fetch(`/api/admin/ga4/explorer?${qs.toString()}`);
        const body = await res.json();
        if (!res.ok) {
          setExplorerError(body?.error || "Failed to load region data.");
        } else if (body.configured === false) {
          setConfigured(false);
        } else if (body.error) {
          setExplorerError(body.error);
        } else {
          setExplorer(body.data as Ga4RegionExplorer);
        }
      } catch (err) {
        setExplorerError(err instanceof Error ? err.message : "Failed to load region data.");
      } finally {
        setExplorerLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchGeo(days);
  }, [days, fetchGeo]);

  useEffect(() => {
    fetchExplorer(days, granularity, country, region, city);
  }, [days, granularity, country, region, city, fetchExplorer]);

  // Reset narrower filters whenever a broader one changes so the UI never
  // sits in an impossible combination (e.g. a city that doesn't belong to
  // the newly-selected country).
  const handleCountryChange = (value: string) => {
    setCountry(value);
    setRegion(ALL_VALUE);
    setCity(ALL_VALUE);
  };
  const handleRegionChange = (value: string) => {
    setRegion(value);
    setCity(ALL_VALUE);
  };

  const countries = useMemo(() => {
    const map = new Map<string, number>();
    geoRows.forEach((r) => map.set(r.country, (map.get(r.country) || 0) + r.sessions));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [geoRows]);

  const regions = useMemo(() => {
    const map = new Map<string, number>();
    geoRows
      .filter((r) => country === ALL_VALUE || r.country === country)
      .forEach((r) => map.set(r.region, (map.get(r.region) || 0) + r.sessions));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [geoRows, country]);

  const cities = useMemo(() => {
    const map = new Map<string, number>();
    geoRows
      .filter((r) => country === ALL_VALUE || r.country === country)
      .filter((r) => region === ALL_VALUE || r.region === region)
      .forEach((r) => map.set(r.city, (map.get(r.city) || 0) + r.sessions));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [geoRows, country, region]);

  const activeFilterLabel =
    city !== ALL_VALUE ? city : region !== ALL_VALUE ? region : country !== ALL_VALUE ? country : "All visitors";

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-8">
      <PageHeader
        title="Region & Funnel Explorer"
        subtitle="What visitors from a specific country, province/state, or city actually did — pages viewed, time spent, landing page, and which CTAs they clicked."
      />

      <AdminSubNav active="region-explorer" />

      {!configured ? (
        <Card padding="lg">
          <div className="text-center py-10 space-y-2 border border-dashed border-border-light/30 rounded-xl">
            <BarChart3 size={32} className="mx-auto text-text-muted opacity-50" />
            <p className="text-sm font-semibold text-text-main">Google Analytics isn&apos;t connected yet</p>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              Set GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_EMAIL, and GA4_SERVICE_ACCOUNT_PRIVATE_KEY in your
              environment to enable this section.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <Card padding="md" className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Date range
                </span>
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

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Group trend by
                </span>
                <Select
                  size="sm"
                  value={granularity}
                  onChange={(e) => setGranularity(e.target.value as Ga4Granularity)}
                  className="w-auto min-w-[8rem]"
                >
                  {GA4_GRANULARITIES.map((g) => (
                    <option key={g} value={g}>
                      {GRANULARITY_LABELS[g]}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Country</span>
                <Select
                  size="sm"
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-auto min-w-[10rem]"
                  disabled={geoLoading}
                >
                  <option value={ALL_VALUE}>All countries</option>
                  {countries.map(([name, sessions]) => (
                    <option key={name} value={name}>
                      {name} ({sessions.toLocaleString()})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Province / State
                </span>
                <Select
                  size="sm"
                  value={region}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  className="w-auto min-w-[10rem]"
                  disabled={geoLoading}
                >
                  <option value={ALL_VALUE}>All regions</option>
                  {regions.map(([name, sessions]) => (
                    <option key={name} value={name}>
                      {name} ({sessions.toLocaleString()})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">City</span>
                <Select
                  size="sm"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-auto min-w-[10rem]"
                  disabled={geoLoading}
                >
                  <option value={ALL_VALUE}>All cities</option>
                  {cities.map(([name, sessions]) => (
                    <option key={name} value={name}>
                      {name} ({sessions.toLocaleString()})
                    </option>
                  ))}
                </Select>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  fetchGeo(days);
                  fetchExplorer(days, granularity, country, region, city);
                }}
                disabled={geoLoading || explorerLoading}
                className="gap-1.5 text-xs"
              >
                <RefreshCw size={14} className={geoLoading || explorerLoading ? "animate-spin" : ""} />
                Refresh
              </Button>
            </div>

            {geoError && (
              <p className="text-[11px] text-danger flex items-center gap-1.5">
                <AlertCircle size={12} /> {geoError}
              </p>
            )}
          </Card>

          {/* Currently viewing */}
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={15} className="text-primary" />
            <span className="font-semibold text-text-main">{activeFilterLabel}</span>
            <span className="text-text-muted">· {RANGE_LABELS[days].toLowerCase()}</span>
          </div>

          <Card padding="lg" className="space-y-8">
            {explorerLoading && !explorer ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : explorerError ? (
              <div className="text-center py-10 space-y-2 border border-dashed border-danger/30 rounded-xl">
                <AlertCircle size={32} className="mx-auto text-danger opacity-70" />
                <p className="text-sm font-semibold text-text-main">Couldn&apos;t load region data</p>
                <p className="text-xs text-text-muted max-w-md mx-auto font-mono">{explorerError}</p>
              </div>
            ) : explorer ? (
              <>
                {/* KPI row for the selected slice */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Card padding="sm" className="border-l-4 border-l-primary space-y-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Sessions</span>
                    <p className="text-xl font-bold text-text-main">{explorer.totals.sessions.toLocaleString()}</p>
                  </Card>
                  <Card padding="sm" className="border-l-4 border-l-success space-y-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Users</span>
                    <p className="text-xl font-bold text-text-main">{explorer.totals.activeUsers.toLocaleString()}</p>
                  </Card>
                  <Card padding="sm" className="border-l-4 border-l-accent space-y-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">New</span>
                    <p className="text-xl font-bold text-text-main">{explorer.totals.newUsers.toLocaleString()}</p>
                  </Card>
                  <Card padding="sm" className="border-l-4 border-l-warning space-y-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Page Views</span>
                    <p className="text-xl font-bold text-text-main">{explorer.totals.pageViews.toLocaleString()}</p>
                  </Card>
                  <Card padding="sm" className="border-l-4 border-l-primary space-y-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Avg Time</span>
                    <p className="text-xl font-bold text-text-main">{formatDuration(explorer.totals.avgEngagementSec)}</p>
                  </Card>
                  <Card padding="sm" className="border-l-4 border-l-danger space-y-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Bounce</span>
                    <p className="text-xl font-bold text-text-main">{explorer.totals.bounceRate.toFixed(1)}%</p>
                  </Card>
                </div>

                {explorer.totals.sessions === 0 && (
                  <p className="text-xs text-text-muted text-center py-4 border border-dashed border-border-light/30 rounded-xl">
                    No sessions in this window for {activeFilterLabel}. Try a wider date range.
                  </p>
                )}

                {/* Trend */}
                {explorer.trend.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                        {GRANULARITY_LABELS[granularity]} Trend — {activeFilterLabel}
                      </h3>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex flex-col justify-between h-32 text-right pr-2 py-2">
                        {(() => {
                          const max = Math.max(...explorer.trend.map((t) => t.sessions), 1);
                          const labels = [];
                          for (let i = 0; i <= 3; i++) labels.push(Math.round((max / 3) * (3 - i)));
                          return labels.map((label, idx) => (
                            <div key={idx} className="text-[10px] text-text-muted font-mono leading-none">
                              {label.toLocaleString()}
                            </div>
                          ));
                        })()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-end gap-0.5 h-32 bg-surface/30 rounded-lg p-3 border border-border-light/20">
                          {explorer.trend.map((t) => {
                            const max = Math.max(...explorer.trend.map((x) => x.sessions), 1);
                            const heightPct = Math.max((t.sessions / max) * 100, 2);
                            return (
                              <div key={t.period} className="flex-1 group relative" style={{ height: `${heightPct}%` }}>
                                <div
                                  title={`${t.period}: ${t.sessions} sessions, ${t.activeUsers} users, ${t.pageViews} views`}
                                  className="w-full h-full bg-gradient-to-t from-primary to-primary/60 hover:from-primary hover:to-primary rounded-sm transition-all cursor-pointer"
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] text-text-muted font-mono">
                          <span>{explorer.trend[0]?.period}</span>
                          <span>{explorer.trend[explorer.trend.length - 1]?.period}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Landing pages (entrances) */}
                <div>
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <LogIn size={13} /> Landing Pages — where they entered
                  </h3>
                  {explorer.landingPages.length === 0 ? (
                    <p className="text-xs text-text-muted">No entrance data for this slice.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-text-muted uppercase tracking-wider text-[10px] border-b border-border-light/30">
                            <th className="py-2 pr-3 font-semibold">Entry Page</th>
                            <th className="py-2 pr-3 font-semibold text-right">Sessions</th>
                            <th className="py-2 pr-3 font-semibold text-right">Bounce</th>
                            <th className="py-2 pr-3 font-semibold text-right">Avg Time</th>
                            <th className="py-2 font-semibold text-right">New Users</th>
                          </tr>
                        </thead>
                        <tbody>
                          {explorer.landingPages.map((p) => (
                            <tr key={p.path} className="border-b border-border-light/15 hover:bg-surface/40">
                              <td className="py-2 pr-3 font-mono text-text-main truncate max-w-[220px]">{p.path}</td>
                              <td className="py-2 pr-3 text-right font-semibold text-text-main">
                                {p.sessions.toLocaleString()}
                              </td>
                              <td className="py-2 pr-3 text-right text-danger">{p.bounceRate.toFixed(1)}%</td>
                              <td className="py-2 pr-3 text-right text-text-muted">{formatDuration(p.avgEngagementSec)}</td>
                              <td className="py-2 text-right text-text-muted">{p.newUsers.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Pages viewed + exit rate */}
                <div>
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Eye size={13} /> Pages Viewed & Time Spent
                  </h3>
                  {explorer.pages.length === 0 ? (
                    <p className="text-xs text-text-muted">No page view data for this slice.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-text-muted uppercase tracking-wider text-[10px] border-b border-border-light/30">
                            <th className="py-2 pr-3 font-semibold">Page</th>
                            <th className="py-2 pr-3 font-semibold text-right">Views</th>
                            <th className="py-2 pr-3 font-semibold text-right">Avg Time on Page</th>
                            {explorer.exitsSupported && (
                              <th className="py-2 font-semibold text-right flex items-center justify-end gap-1">
                                <LogOut size={11} /> Exit Rate
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {explorer.pages.map((p) => (
                            <tr key={p.path} className="border-b border-border-light/15 hover:bg-surface/40">
                              <td className="py-2 pr-3 font-mono text-text-main truncate max-w-[260px]">{p.path}</td>
                              <td className="py-2 pr-3 text-right font-semibold text-text-main">
                                {p.views.toLocaleString()}
                              </td>
                              <td className="py-2 pr-3 text-right text-text-muted flex items-center justify-end gap-1">
                                <Clock size={11} /> {formatDuration(p.avgEngagementSec)}
                              </td>
                              {explorer.exitsSupported && (
                                <td className="py-2 text-right">
                                  <Badge tone={p.exitRatePct && p.exitRatePct > 50 ? "rose" : "neutral"} size="sm">
                                    {p.exitRatePct !== null ? `${p.exitRatePct}%` : "—"}
                                  </Badge>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!explorer.exitsSupported && (
                    <p className="text-[10px] text-text-muted mt-2 flex items-center gap-1">
                      <Info size={11} /> Exit-rate metric wasn&apos;t available from GA4 for this property.
                    </p>
                  )}
                </div>

                {/* CTA / event breakdown by page */}
                <div>
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <MousePointerClick size={13} /> What They Clicked, By Page
                  </h3>
                  {explorer.eventsByPage.length === 0 ? (
                    <p className="text-xs text-text-muted">No custom CTA events recorded for this slice yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-text-muted uppercase tracking-wider text-[10px] border-b border-border-light/30">
                            <th className="py-2 pr-3 font-semibold">Page</th>
                            <th className="py-2 pr-3 font-semibold">Event / CTA</th>
                            <th className="py-2 font-semibold text-right">Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {explorer.eventsByPage.map((e, idx) => (
                            <tr key={`${e.page}-${e.eventName}-${idx}`} className="border-b border-border-light/15 hover:bg-surface/40">
                              <td className="py-2 pr-3 font-mono text-text-main truncate max-w-[220px]">{e.page}</td>
                              <td className="py-2 pr-3 text-text-main">{e.eventName}</td>
                              <td className="py-2 text-right font-semibold text-text-main">{e.count.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </Card>

          {/* All regions table */}
          <Card padding="lg" className="space-y-3">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Globe2 size={13} /> All Regions ({RANGE_LABELS[days].toLowerCase()})
            </h3>
            {geoLoading && geoRows.length === 0 ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : geoRows.length === 0 ? (
              <p className="text-xs text-text-muted">No geography data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-text-muted uppercase tracking-wider text-[10px] border-b border-border-light/30">
                      <th className="py-2 pr-3 font-semibold">Country</th>
                      <th className="py-2 pr-3 font-semibold">Province / State</th>
                      <th className="py-2 pr-3 font-semibold">City</th>
                      <th className="py-2 pr-3 font-semibold text-right">Sessions</th>
                      <th className="py-2 pr-3 font-semibold text-right">Users</th>
                      <th className="py-2 pr-3 font-semibold text-right">Avg Time</th>
                      <th className="py-2 font-semibold text-right">Bounce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {geoRows.slice(0, 100).map((r, idx) => (
                      <tr
                        key={`${r.country}-${r.region}-${r.city}-${idx}`}
                        className="border-b border-border-light/15 hover:bg-surface/40 cursor-pointer"
                        onClick={() => {
                          setCountry(r.country);
                          setRegion(r.region);
                          setCity(r.city);
                        }}
                        title="Click to filter the explorer above to this city"
                      >
                        <td className="py-2 pr-3 text-text-main">{r.country}</td>
                        <td className="py-2 pr-3 text-text-main">{r.region}</td>
                        <td className="py-2 pr-3 text-text-main font-medium">{r.city}</td>
                        <td className="py-2 pr-3 text-right font-semibold text-text-main">{r.sessions.toLocaleString()}</td>
                        <td className="py-2 pr-3 text-right text-text-muted">{r.activeUsers.toLocaleString()}</td>
                        <td className="py-2 pr-3 text-right text-text-muted">{formatDuration(r.avgEngagementSec)}</td>
                        <td className="py-2 text-right text-danger">{r.bounceRate.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Honest limitation callout */}
          <Card padding="md" className="border border-dashed border-border-light/40 bg-surface/30">
            <div className="flex gap-2.5">
              <Info size={16} className="text-text-muted shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs text-text-muted">
                <p className="font-semibold text-text-main">
                  What this doesn&apos;t show: exact per-visitor page order (A → B → C in one session).
                </p>
                <p>
                  Everything above is real GA4 data — pages, engagement time, landing pages, and CTA clicks — but the
                  GA4 reporting API returns aggregated totals, not raw per-session event sequences, so it can&apos;t
                  draw a true session-by-session path. For that, use{" "}
                  <span className="font-semibold text-text-main">GA4 → Explore → Path Exploration</span> directly
                  in Google Analytics (free, already available, no build needed) — or link this property to{" "}
                  <span className="font-semibold text-text-main">BigQuery export</span> if you want raw session
                  paths queryable inside this admin panel too.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
