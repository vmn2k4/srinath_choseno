"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import AdminSubNav from "./AdminSubNav";
import GrowthStoryPanel from "./GrowthStoryPanel";
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
import { GA4_DATE_RANGES, GA4_TREND_RANGES, type Ga4DateRangeDays, type Ga4TrendRangeDays } from "@/lib/constants/ga4";
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

type HourlyByDay = Ga4Overview["hourlyByDay"];

type DailyPoint = Ga4Overview["dailyTrend"][number];

// Segmented "1d 3d 5d ..." picker shared by the two trend charts. Each chart
// owns its own range, independent of the page-level date range.
function TrendRangePicker({ value, onChange }: { value: Ga4TrendRangeDays; onChange: (d: Ga4TrendRangeDays) => void }) {
  return (
    <div role="group" aria-label="Chart range in days" className="flex rounded-md border border-border-light/40 overflow-hidden text-[11px]">
      {GA4_TREND_RANGES.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={value === d}
          onClick={() => onChange(d)}
          className={`px-2 py-1 ${value === d ? "bg-accent text-white" : "text-text-muted hover:bg-surface"}`}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

type BarItem = { key: string; value: number; title: string; hoverLabel: string };

// Tailwind only sees complete class strings, so the two gradients are spelled
// out in full rather than built from the tone name.
const BAR_TONES = {
  accent: "bg-gradient-to-t from-accent to-accent/60 hover:from-accent hover:to-accent",
  primary: "bg-gradient-to-t from-primary to-primary/60 hover:from-primary hover:to-primary",
} as const;

// Bar chart with the actual number printed above each bar. The label adapts
// to the room: full "2,710" when it fits, compact "2.7k" when it doesn't, and
// every Nth bar when even that is too tight (the newest bar is always
// labelled).
function SessionBars({
  items,
  tone,
  footerLeft,
  footerRight,
  busy = false,
}: {
  items: BarItem[];
  tone: keyof typeof BAR_TONES;
  footerLeft?: string;
  footerRight?: string;
  busy?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = items.length;
  const max = Math.max(...items.map((i) => i.value), 1);
  const compact = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(v));
  const full = (v: number) => v.toLocaleString();
  const dense = n > 16;
  const charW = dense ? 5.4 : 6;
  const slot = width > 0 ? (width - 24 - (n - 1) * 2) / n : 0;
  const widest = (f: (v: number) => string) => Math.max(...items.map((i) => f(i.value).length)) * charW + 4;
  const fmt = slot >= widest(full) ? full : compact;
  const stride = slot > 0 ? Math.max(1, Math.ceil(widest(fmt) / slot)) : 0;

  return (
    <div className={`flex gap-3 transition-opacity ${busy ? "opacity-60" : ""}`}>
      {/* Y-axis labels, aligned to the bars' top and baseline */}
      <div className="flex flex-col justify-between h-44 text-right pr-2 pt-6 pb-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="text-[10px] text-text-muted font-mono leading-none">
            {Math.round((max / 4) * (4 - i)).toLocaleString()}
          </div>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div ref={wrapRef} className="flex items-end gap-0.5 h-44 bg-surface/30 rounded-lg px-3 pb-3 pt-6 border border-border-light/20">
          {items.map((it, i) => {
            const heightPct = Math.max((it.value / max) * 100, 2);
            const labelled = stride > 0 && (n - 1 - i) % stride === 0;
            return (
              <div key={it.key} className="flex-1 group relative" style={{ height: `${heightPct}%` }}>
                {labelled && (
                  <span
                    className="pointer-events-none absolute left-1/2 -top-4 -translate-x-1/2 whitespace-nowrap font-mono leading-none text-text-muted"
                    style={{ fontSize: dense ? 9 : 10 }}
                  >
                    {fmt(it.value)}
                  </span>
                )}
                <div title={it.title} className={`w-full h-full ${BAR_TONES[tone]} rounded-sm transition-all cursor-pointer`} />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-6 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  <div className="text-[10px] text-text-muted font-mono">{it.hoverLabel}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-6 text-[10px] text-text-muted font-mono">
          <span>{footerLeft}</span>
          <span>{footerRight}</span>
        </div>
      </div>
    </div>
  );
}

function lerpHex(a: string, b: string, t: number): string {
  const part = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const ch = (i: number) => Math.round(part(a, i) + (part(b, i) - part(a, i)) * t).toString(16).padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

type ChartLine = {
  key: string;
  name: string;
  total: number;
  vals: (number | null)[];
  color: string;
  width: number;
  opacity: number;
  dash?: string;
  legend: boolean;
};

// Overlaid lines sharing an hour-of-day axis. Up to 7 days each get their own
// line, newest thick and last, older days fading back. Beyond 7 days that
// would be spaghetti, so the older days become a faint backdrop and the chart
// highlights the newest day, the day before, and a dashed average of all the
// previous days. The Cumulative toggle answers "are we ahead of or behind so
// far?".
function HourlyByDayChart({
  days,
  rangeDays,
  onRangeChange,
  loading,
}: {
  days: HourlyByDay;
  rangeDays: Ga4TrendRangeDays;
  onRangeChange: (d: Ga4TrendRangeDays) => void;
  loading: boolean;
}) {
  const [mode, setMode] = useState<"hourly" | "cumulative">("hourly");
  const [hover, setHover] = useState<number | null>(null);
  // Render at the container's real pixel width (not a scaled viewBox) so the
  // chart fills the card like the other charts and stays crisp at any size.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1000);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setW(Math.max(280, Math.floor(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = W < 520;
  const H = narrow ? 200 : 240, PL = 40, PR = 12, PT = 12, PB = 24;
  const LIGHT = "#c4a8ee", MID = "#9b6fdc", DARK = "#6d1fc9";

  const series = days.map((d) => {
    let run = 0;
    return d.hours.map((v) => (v == null ? null : mode === "cumulative" ? (run += v) : v));
  });
  const n = days.length;
  const many = n > 7;
  const label = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const lines: ChartLine[] = [];
  if (!many) {
    days.forEach((d, i) => {
      const t = n > 1 ? i / (n - 1) : 1;
      lines.push({
        key: d.date,
        name: label(d.date),
        total: d.total,
        vals: series[i],
        color: lerpHex(LIGHT, DARK, t),
        width: i === n - 1 ? 3 : 1.75 + t * 0.5,
        opacity: 1,
        legend: true,
      });
    });
  } else {
    for (let i = 0; i < n - 2; i++) {
      lines.push({ key: days[i].date, name: label(days[i].date), total: days[i].total, vals: series[i], color: LIGHT, width: 1, opacity: 0.35, legend: false });
    }
    const prior = series.slice(0, n - 1);
    const avgVals = Array.from({ length: 24 }, (_, h) => {
      const present = prior.map((v) => v[h]).filter((v): v is number => v != null);
      return present.length ? present.reduce((a, v) => a + v, 0) / present.length : null;
    });
    const avgTotal = Math.round(days.slice(0, n - 1).reduce((a, d) => a + d.total, 0) / (n - 1));
    lines.push({ key: "avg", name: `Avg of previous ${n - 1} days`, total: avgTotal, vals: avgVals, color: "#64748b", width: 2.25, opacity: 1, dash: "6 4", legend: true });
    lines.push({ key: days[n - 2].date, name: label(days[n - 2].date), total: days[n - 2].total, vals: series[n - 2], color: MID, width: 2, opacity: 1, legend: true });
    lines.push({ key: days[n - 1].date, name: label(days[n - 1].date), total: days[n - 1].total, vals: series[n - 1], color: DARK, width: 3, opacity: 1, legend: true });
  }
  const shown = lines.filter((l) => l.legend);
  const newest = lines[lines.length - 1];

  const max = Math.max(...lines.flatMap((l) => l.vals).map((v) => v ?? 0), 1);
  const x = (h: number) => PL + (h / 23) * (W - PL - PR);
  const y = (v: number) => PT + (1 - v / max) * (H - PT - PB);
  const path = (vals: (number | null)[]) =>
    vals.map((v, h) => (v == null ? "" : `${h === 0 || vals[h - 1] == null ? "M" : "L"}${x(h).toFixed(1)},${y(v).toFixed(1)}`)).join(" ");
  const lastToday = newest.vals.reduce<number>((m, v, h) => (v == null ? m : h), -1);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
          Hourly Traffic — {rangeDays === 1 ? "Today" : `Last ${rangeDays} Days`}
          {loading && <span className="ml-2 normal-case font-normal">Loading…</span>}
        </h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
            {shown.map((l) => (
              <span key={l.key} className="flex items-center gap-1">
                <span
                  className="inline-block w-3 rounded"
                  style={{ background: l.dash ? "transparent" : l.color, height: l.width, borderTop: l.dash ? `2px dashed ${l.color}` : undefined }}
                />
                {l.name} · {l.total.toLocaleString()}
              </span>
            ))}
          </div>
          <TrendRangePicker value={rangeDays} onChange={onRangeChange} />
          <div className="flex rounded-md border border-border-light/40 overflow-hidden text-[11px]">
            {(["hourly", "cumulative"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2 py-1 capitalize ${mode === m ? "bg-accent text-white" : "text-text-muted hover:bg-surface"}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div ref={wrapRef} className={`relative bg-surface/30 rounded-lg border border-border-light/20 transition-opacity ${loading ? "opacity-60" : ""}`}>
        <svg
          width={W}
          height={H}
          className="block"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            setHover(Math.min(23, Math.max(0, Math.round(((px - PL) / (W - PL - PR)) * 23))));
          }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={PL} x2={W - PR} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" strokeOpacity={0.1} />
              <text x={PL - 6} y={y(max * f) + 3} textAnchor="end" fontSize={11} fill="currentColor" opacity={0.5}>
                {Math.round(max * f).toLocaleString()}
              </text>
            </g>
          ))}
          {Array.from({ length: narrow ? 4 : 8 }, (_, i) => i * (narrow ? 6 : 3)).map((h) => (
            <text key={h} x={x(h)} y={H - 6} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.5}>
              {String(h).padStart(2, "0")}:00
            </text>
          ))}
          {lines.map((l) => (
            <path key={l.key} d={path(l.vals)} fill="none" stroke={l.color} strokeWidth={l.width} strokeOpacity={l.opacity} strokeDasharray={l.dash} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {lastToday >= 0 && (
            <circle cx={x(lastToday)} cy={y(newest.vals[lastToday] ?? 0)} r={4.5} fill={newest.color} stroke="white" strokeWidth={1.5} />
          )}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
              {shown.map((l) => l.vals[hover] != null && (
                <circle key={l.key} cx={x(hover)} cy={y(l.vals[hover] as number)} r={3.5} fill={l.color} />
              ))}
            </g>
          )}
        </svg>
        {hover != null && (
          <div
            className="pointer-events-none absolute top-2 rounded-md border border-border-light/40 bg-surface px-2.5 py-1.5 text-[11px] shadow-md"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > 16 ? "translateX(calc(-100% - 8px))" : "translateX(8px)" }}
          >
            <div className="font-mono text-text-muted mb-0.5">
              {String(hover).padStart(2, "0")}:00{mode === "cumulative" ? " (running total)" : ""}
            </div>
            {shown.map((l) => (
              <div key={l.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: l.color }} />
                  {l.name}
                </span>
                <span className="font-semibold text-text-main">
                  {l.vals[hover] == null ? "—" : Math.round(l.vals[hover] as number).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GoogleAnalyticsAdminClient() {
  const [days, setDays] = useState<Ga4DateRangeDays>(1);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Ga4Overview | null>(null);

  // Per-chart ranges for the hourly overlay and the daily sessions chart,
  // independent of the page-level date range. Results are cached per range so
  // flipping back is instant. Loads are triggered by the pickers and by the
  // overview finishing -- never in parallel with the overview, since GA4 caps
  // concurrent requests per property and the overview fires ten.
  const [hourlyDays, setHourlyDays] = useState<Ga4TrendRangeDays>(3);
  const [dailyDays, setDailyDays] = useState<Ga4TrendRangeDays>(7);
  const hourlyDaysRef = useRef<Ga4TrendRangeDays>(3);
  const dailyDaysRef = useRef<Ga4TrendRangeDays>(7);
  const [hourlyCache, setHourlyCache] = useState<Partial<Record<number, HourlyByDay>>>({});
  const [dailyCache, setDailyCache] = useState<Partial<Record<number, DailyPoint[]>>>({});
  const [trendBusy, setTrendBusy] = useState({ hourly: false, daily: false });
  const [trendError, setTrendError] = useState<string | null>(null);
  const trendInFlight = useRef(new Set<string>());
  const trendLoaded = useRef(new Set<string>());

  const loadTrend = useCallback(async (kind: "hourly" | "daily", n: Ga4TrendRangeDays) => {
    // The overview response already carries the 3-day hourly series.
    if (kind === "hourly" && n === 3) return;
    const key = `${kind}:${n}`;
    if (trendInFlight.current.has(key) || trendLoaded.current.has(key)) return;
    trendInFlight.current.add(key);
    setTrendBusy((b) => ({ ...b, [kind]: true }));
    setTrendError(null);
    try {
      const res = await fetch(`/api/admin/ga4/trends?kind=${kind}&days=${n}`);
      const body = await res.json();
      if (!res.ok || body.error) throw new Error(body?.error || "Failed to load trend data.");
      if (kind === "hourly") setHourlyCache((c) => ({ ...c, [n]: body.hourlyByDay as HourlyByDay }));
      else setDailyCache((c) => ({ ...c, [n]: body.dailyTrend as DailyPoint[] }));
      trendLoaded.current.add(key);
    } catch (err) {
      setTrendError(err instanceof Error ? err.message : "Failed to load trend data.");
    } finally {
      trendInFlight.current.delete(key);
      setTrendBusy((b) => ({ ...b, [kind]: false }));
    }
  }, []);

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
        void loadTrend("daily", dailyDaysRef.current);
        void loadTrend("hourly", hourlyDaysRef.current);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Google Analytics data.");
    } finally {
      setLoading(false);
    }
  }, [loadTrend]);

  useEffect(() => {
    fetchGa4(days);
  }, [days, fetchGa4]);

  const handleRefresh = () => {
    trendLoaded.current.clear();
    setHourlyCache({});
    setDailyCache({});
    fetchGa4(days);
  };

  const pickHourly = (n: Ga4TrendRangeDays) => {
    hourlyDaysRef.current = n;
    setHourlyDays(n);
    void loadTrend("hourly", n);
  };
  const pickDaily = (n: Ga4TrendRangeDays) => {
    dailyDaysRef.current = n;
    setDailyDays(n);
    void loadTrend("daily", n);
  };
  const hourlyData = hourlyCache[hourlyDays] ?? (hourlyDays === 3 ? data?.hourlyByDay : undefined);

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
          onClick={handleRefresh}
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
                <SessionBars
                  tone="accent"
                  items={data.hourlyTrend.map((h) => ({
                    key: h.dateHour,
                    value: h.sessions,
                    title: `${h.hourLabel}: ${h.sessions} sessions, ${h.activeUsers} users, ${h.newUsers} new`,
                    hoverLabel: h.hourLabel,
                  }))}
                  footerLeft={data.hourlyTrend[0]?.hourLabel}
                  footerRight={data.hourlyTrend[data.hourlyTrend.length - 1]?.hourLabel}
                />
              </div>
            )}

            {/* Same clock hour, last N days overlaid -- N picked on the chart */}
            {hourlyData?.length ? (
              <HourlyByDayChart
                days={hourlyData}
                rangeDays={hourlyDays}
                onRangeChange={pickHourly}
                loading={trendBusy.hourly}
              />
            ) : (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Hourly Traffic — {hourlyDays === 1 ? "Today" : `Last ${hourlyDays} Days`}
                  </h3>
                  <TrendRangePicker value={hourlyDays} onChange={pickHourly} />
                </div>
                <div className="h-40 flex items-center justify-center text-xs text-text-muted bg-surface/30 rounded-lg border border-border-light/20">
                  {trendBusy.hourly ? "Loading…" : "No data for this range."}
                </div>
              </div>
            )}
            {trendError && <p className="text-xs text-danger">{trendError}</p>}

            {/* Daily sessions trend with y-axis labels -- its own range picker */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Daily Sessions Trend
                  <span className="ml-2 normal-case font-normal">
                    {trendBusy.daily ? "Loading…" : dailyDays === 1 ? "today" : `last ${dailyDays} days`}
                  </span>
                </h3>
                <TrendRangePicker value={dailyDays} onChange={pickDaily} />
              </div>
              {(() => {
                const daily = dailyCache[dailyDays];
                if (!daily?.length) {
                  return (
                    <div className="h-40 flex items-center justify-center text-xs text-text-muted bg-surface/30 rounded-lg border border-border-light/20">
                      {trendBusy.daily ? "Loading…" : "No data for this range."}
                    </div>
                  );
                }
                return (
                  <SessionBars
                    tone="primary"
                    busy={trendBusy.daily}
                    items={daily.map((day) => ({
                      key: day.date,
                      value: day.sessions,
                      title: `${day.date}: ${day.sessions} sessions, ${day.activeUsers} users (${day.newUsers} new), ${day.bounceRate.toFixed(1)}% bounce`,
                      hoverLabel: day.date,
                    }))}
                    footerLeft={daily[0]?.date}
                    footerRight={daily[daily.length - 1]?.date}
                  />
                );
              })()}
            </div>

            <GrowthStoryPanel />

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
