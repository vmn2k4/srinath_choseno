// Pure helpers behind the admin "Growth Story" panel: roll daily GA4 +
// Search Console rows up into weeks and flag the days that shouldn't be
// trusted yet.

export type GrowthGa4Day = { date: string; sessions: number; newUsers: number; bounceRate: number };
export type GrowthScDay = { date: string; impressions: number; clicks: number };

export type GrowthWeek = {
  label: string; // first day of the week, YYYY-MM-DD
  days: number;
  sessions: number;
  newUsers: number;
  impressions: number;
  clicks: number;
  sessionsPerDay: number;
  wowPct: number | null; // change in sessions/day vs the previous week
  partial: boolean; // fewer than 7 days, or includes a lagging day
};

// GA4 hasn't finished processing its newest days: bounce reads ~100% with
// unattributed sources. Only the trailing days can be affected, so a high
// bounce rate mid-series (a real bad day) is not flagged.
const LAG_BOUNCE_PCT = 90;
const LAG_WINDOW_DAYS = 3;

export function findLaggingDates(ga4: GrowthGa4Day[]): Set<string> {
  const lagging = new Set<string>();
  ga4.slice(-LAG_WINDOW_DAYS).forEach((d) => {
    if (d.bounceRate >= LAG_BOUNCE_PCT && d.sessions >= 20) lagging.add(d.date);
  });
  return lagging;
}

export function buildGrowthWeeks(ga4: GrowthGa4Day[], sc: GrowthScDay[]): GrowthWeek[] {
  const scByDate = new Map(sc.map((d) => [d.date, d]));
  const lagging = findLaggingDates(ga4);
  const weeks: GrowthWeek[] = [];

  for (let i = 0; i < ga4.length; i += 7) {
    const chunk = ga4.slice(i, i + 7);
    const sessions = chunk.reduce((s, d) => s + d.sessions, 0);
    const newUsers = chunk.reduce((s, d) => s + d.newUsers, 0);
    const scChunk = chunk.map((d) => scByDate.get(d.date)).filter((d): d is GrowthScDay => !!d);
    const sessionsPerDay = sessions / chunk.length;
    const prev = weeks[weeks.length - 1];
    weeks.push({
      label: chunk[0].date,
      days: chunk.length,
      sessions,
      newUsers,
      impressions: scChunk.reduce((s, d) => s + d.impressions, 0),
      clicks: scChunk.reduce((s, d) => s + d.clicks, 0),
      sessionsPerDay,
      wowPct: prev && prev.sessionsPerDay > 0 ? ((sessionsPerDay - prev.sessionsPerDay) / prev.sessionsPerDay) * 100 : null,
      partial: chunk.length < 7 || chunk.some((d) => lagging.has(d.date)),
    });
  }
  return weeks;
}

export type GrowthInsight = { tone: "good" | "warn" | "info"; text: string };

export function buildGrowthInsights(ga4: GrowthGa4Day[], sc: GrowthScDay[]): GrowthInsight[] {
  const out: GrowthInsight[] = [];
  if (ga4.length < 14) return out;
  const lagging = findLaggingDates(ga4);
  const trusted = ga4.filter((d) => !lagging.has(d.date));

  // Compare the last 7 trusted days with the 7 before them.
  const recent = trusted.slice(-7);
  const prior = trusted.slice(-14, -7);
  const sum = (rows: GrowthGa4Day[]) => rows.reduce((s, d) => s + d.sessions, 0);
  if (prior.length === 7 && sum(prior) > 0) {
    const pct = ((sum(recent) - sum(prior)) / sum(prior)) * 100;
    out.push({
      tone: pct >= 0 ? "good" : "warn",
      text: `Last 7 trusted days: ${sum(recent).toLocaleString()} sessions, ${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs the 7 days before.`,
    });
  }

  // A day at >=2.5x the trailing 7-day median is a spike worth annotating.
  const spikes = trusted.filter((d, i) => {
    const window = trusted.slice(Math.max(0, i - 7), i).map((x) => x.sessions).sort((a, b) => a - b);
    if (window.length < 5) return false;
    const median = window[Math.floor(window.length / 2)];
    return d.sessions >= 25 && d.sessions >= median * 2.5;
  });
  if (spikes.length > 0) {
    out.push({
      tone: "info",
      text: `Spike days (≥2.5× trailing median): ${spikes.map((d) => `${d.date.slice(5)} (${d.sessions})`).join(", ")}. Check whether they held the next day before counting them as growth.`,
    });
  }

  if (lagging.size > 0) {
    out.push({
      tone: "warn",
      text: `${[...lagging].map((d) => d.slice(5)).join(", ")}: GA4 is still processing (bounce ≥${LAG_BOUNCE_PCT}%). Excluded from the comparison above; recheck in 2–3 days.`,
    });
  }

  // Search Console is the independent check on organic growth.
  const scRecent = sc.slice(-10, -3); // SC lags ~2-3 days
  const scPrior = sc.slice(-17, -10);
  const imp = (rows: GrowthScDay[]) => rows.reduce((s, d) => s + d.impressions, 0);
  if (scRecent.length === 7 && scPrior.length === 7 && imp(scPrior) > 0) {
    const pct = ((imp(scRecent) - imp(scPrior)) / imp(scPrior)) * 100;
    out.push({
      tone: pct >= 0 ? "good" : "warn",
      text: `Google impressions (latest settled week): ${imp(scRecent).toLocaleString()}, ${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% week over week.`,
    });
  }
  return out;
}
