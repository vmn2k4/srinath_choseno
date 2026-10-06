"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/primitives";
import { TrendingUp, AlertTriangle, Info } from "lucide-react";
import type { Ga4Overview } from "@/lib/analytics/ga4Reporting";
import {
  buildGrowthInsights,
  buildGrowthWeeks,
  findLaggingDates,
  type GrowthScDay,
} from "@/lib/utils/growthStory";

// Always the last 90 days, independent of the page's date-range selector --
// a growth story needs the full arc.
export default function GrowthStoryPanel() {
  const [ga4, setGa4] = useState<Ga4Overview["dailyTrend"] | null>(null);
  const [sc, setSc] = useState<GrowthScDay[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const gaRes = await fetch("/api/admin/ga4?days=90");
        const gaBody = await gaRes.json();
        if (!gaRes.ok || !gaBody.data) throw new Error("ga4");
        // Search Console is a nice-to-have: the story still renders without it.
        const scBody = await fetch("/api/admin/search-console?days=90")
          .then((r) => r.json())
          .catch(() => null);
        if (cancelled) return;
        setGa4(gaBody.data.dailyTrend);
        setSc(scBody?.data?.dailyTrend ?? []);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const weeks = useMemo(() => (ga4 ? buildGrowthWeeks(ga4, sc) : []), [ga4, sc]);
  const insights = useMemo(() => (ga4 ? buildGrowthInsights(ga4, sc) : []), [ga4, sc]);
  const lagging = useMemo(() => (ga4 ? findLaggingDates(ga4) : new Set<string>()), [ga4]);

  if (failed) return null;

  const maxPerDay = Math.max(...weeks.map((w) => w.sessionsPerDay), 1);

  return (
    <div>
      <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <TrendingUp size={13} /> Growth Story <span className="normal-case font-normal">· last 90 days, weekly</span>
      </h3>
      {!ga4 ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          {insights.length > 0 && (
            <ul className="space-y-1.5">
              {insights.map((i, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-text-main">
                  {i.tone === "warn" ? (
                    <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                  ) : i.tone === "good" ? (
                    <TrendingUp size={14} className="text-success shrink-0 mt-0.5" />
                  ) : (
                    <Info size={14} className="text-text-muted shrink-0 mt-0.5" />
                  )}
                  <span>{i.text}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
                  <th className="py-1.5 pr-3 font-semibold">Week of</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">Sessions</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">New users</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">Google impr.</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">Google clicks</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">WoW</th>
                  <th className="py-1.5 font-semibold w-40">Sessions / day</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.label} className="border-t border-border-light/20">
                    <td className="py-1.5 pr-3 font-mono text-text-main">
                      {w.label}
                      {w.partial && (
                        <span
                          title="Fewer than 7 days, or includes days GA4 is still processing"
                          className="ml-1.5 text-warning"
                        >
                          *
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">{w.sessions.toLocaleString()}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{w.newUsers.toLocaleString()}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{w.impressions.toLocaleString()}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{w.clicks.toLocaleString()}</td>
                    <td
                      className={`py-1.5 pr-3 text-right font-mono ${
                        w.wowPct === null ? "text-text-muted" : w.wowPct >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {w.wowPct === null ? "—" : `${w.wowPct >= 0 ? "+" : ""}${w.wowPct.toFixed(0)}%`}
                    </td>
                    <td className="py-1.5">
                      <div className="h-2 rounded-sm bg-surface/50">
                        <div
                          className="h-2 rounded-sm bg-primary"
                          style={{ width: `${Math.max((w.sessionsPerDay / maxPerDay) * 100, 2)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-text-muted">
            * Partial week{lagging.size > 0 ? " or contains days GA4 hasn't finished processing" : ""}. Google
            impressions/clicks are from Search Console, which lags 2–3 days.
          </p>
        </div>
      )}
    </div>
  );
}
