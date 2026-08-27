import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { DEFAULT_GA4_DATE_RANGE_DAYS, type Ga4DateRangeDays, type Ga4Granularity } from "@/lib/constants/ga4";

// Server-only -- uses a service account private key, must never be imported
// from a Client Component. Talks to the GA4 Data API (read-only reporting),
// which is a separate credential/API from the gtag.js measurement ID in
// src/lib/constants/analytics.ts. Setup: GCP service account with GA4 Data
// API enabled, granted Viewer access on the property in GA4 Admin > Property
// Access Management. See docs/GA4_DASHBOARD_SETUP.md.
const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const CLIENT_EMAIL = process.env.GA4_SERVICE_ACCOUNT_EMAIL;
// Service account keys are exported as JSON with literal "\n" in the PEM
// string; env files can't hold real newlines in one value, so this un-escapes
// them back into a valid PEM before handing it to the client library.
const PRIVATE_KEY = process.env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

export function isGa4ReportingConfigured(): boolean {
  return Boolean(PROPERTY_ID && CLIENT_EMAIL && PRIVATE_KEY);
}

let cachedClient: BetaAnalyticsDataClient | null = null;
function getClient(): BetaAnalyticsDataClient {
  if (!cachedClient) {
    cachedClient = new BetaAnalyticsDataClient({
      credentials: { client_email: CLIENT_EMAIL, private_key: PRIVATE_KEY },
    });
  }
  return cachedClient;
}

export type Ga4Overview = {
  totals: {
    sessions: number;
    activeUsers: number;
    newUsers: number;
    pageViews: number;
    avgEngagementSec: number;
    bounceRate: number;
    conversions: number;
  };
  dailyTrend: {
    date: string;
    sessions: number;
    activeUsers: number;
    newUsers: number;
    pageViews: number;
    bounceRate: number;
  }[];
  // Last 24 hours, regardless of the selected date range -- lets the admin
  // see intraday traffic shape even when looking at a 30/90-day window.
  hourlyTrend: { hourLabel: string; dateHour: string; sessions: number; activeUsers: number; newUsers: number }[];
  topPages: { path: string; views: number; avgEngagementSec: number }[];
  topEvents: { name: string; count: number }[];
  devices: { category: string; sessions: number; bounceRate: number }[];
  topCountries: { country: string; sessions: number; activeUsers: number; bounceRate: number }[];
  topCities: { city: string; country: string; sessions: number }[];
  topReferrers: { referrer: string; sessions: number }[];
  trafficSources: { source: string; sessions: number; activeUsers: number }[];
};

function metricNum(row: { metricValues?: { value?: string | null }[] | null } | undefined, index: number): number {
  const raw = row?.metricValues?.[index]?.value;
  return raw ? Number(raw) : 0;
}

function dimStr(row: { dimensionValues?: { value?: string | null }[] | null } | undefined, index: number): string {
  return row?.dimensionValues?.[index]?.value || "";
}

// GA4's "bounceRate" metric comes back as a 0-1 fraction (e.g. 0.6234 for a
// 62.34% bounce rate) -- unlike Search Console's "ctr", which the client
// library there already returns the same way but this codebase converts to
// points at the call site (see searchConsole.ts: `(row.ctr || 0) * 100`).
// Every bounceRate field in this file needs that same *100 conversion --
// route them all through here so the previous bug (rounding the raw
// fraction to 2dp and calling it done, e.g. 0.6234 -> "0.62") can't sneak
// back in one call site at a time. Every consumer (AnalyticsOverviewDashboard's
// <50/<65 "traffic quality" thresholds, GoogleAnalyticsAdminClient's
// `.toFixed(n)}%`) already assumes 0-100 -- this is the fix, not a followup
// change to those.
function bounceRatePct(row: { metricValues?: { value?: string | null }[] | null } | undefined, index: number): number {
  return Math.round(metricNum(row, index) * 10000) / 100;
}

// GA4's "date" dimension comes back as YYYYMMDD with no separators.
function formatGa4Date(raw: string): string {
  if (raw.length !== 8) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

// GA4's "dateHour" dimension comes back as YYYYMMDDHH (property timezone,
// not necessarily UTC) -- format as "HH:00" for the hourly chart label.
function formatGa4Hour(raw: string): string {
  if (raw.length !== 10) return raw;
  return `${raw.slice(8, 10)}:00`;
}

export async function getGa4Overview(
  days: Ga4DateRangeDays = DEFAULT_GA4_DATE_RANGE_DAYS
): Promise<{ success: boolean; data?: Ga4Overview; error?: string }> {
  if (!isGa4ReportingConfigured()) {
    return { success: false, error: "Google Analytics reporting is not configured yet." };
  }

  try {
    const client = getClient();
    const property = `properties/${PROPERTY_ID}`;
    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];

    const [
      [totalsRes],
      [trendRes],
      [hourlyRes],
      [pagesRes],
      [eventsRes],
      [deviceRes],
      [countryRes],
      [cityRes],
      [referrerRes],
      [sourceRes],
    ] = await Promise.all([
        client.runReport({
          property,
          dateRanges,
          metrics: [
            { name: "sessions" },
            { name: "activeUsers" },
            { name: "screenPageViews" },
            { name: "averageSessionDuration" },
            { name: "bounceRate" },
            { name: "conversions" },
            { name: "newUsers" },
          ],
        }),
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "date" }],
          metrics: [
            { name: "sessions" },
            { name: "activeUsers" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "newUsers" },
          ],
          orderBys: [{ dimension: { dimensionName: "date" } }],
        }),
        // Hourly trend is always "last 24 hours" regardless of the `days`
        // selector -- fetch a 2-day window so a partial "today" plus all of
        // "yesterday" gives us at least 24 rows, then slice to the last 24.
        client.runReport({
          property,
          dateRanges: [{ startDate: "1daysAgo", endDate: "today" }],
          dimensions: [{ name: "dateHour" }],
          metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "newUsers" }],
          orderBys: [{ dimension: { dimensionName: "dateHour" } }],
        }),
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }, { name: "averageSessionDuration" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: 10,
        }),
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
          limit: 15,
        }),
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "deviceCategory" }],
          metrics: [{ name: "sessions" }, { name: "bounceRate" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        }),
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "country" }],
          metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "bounceRate" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 15,
        }),
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "city" }, { name: "country" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 10,
        }),
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "firstUserMedium" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 10,
        }),
        client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "firstUserSource" }],
          metrics: [{ name: "sessions" }, { name: "activeUsers" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 10,
        }),
      ]);

    const totalsRow = totalsRes.rows?.[0];

    const data: Ga4Overview = {
      totals: {
        sessions: metricNum(totalsRow, 0),
        activeUsers: metricNum(totalsRow, 1),
        pageViews: metricNum(totalsRow, 2),
        avgEngagementSec: Math.round(metricNum(totalsRow, 3)),
        bounceRate: bounceRatePct(totalsRow, 4),
        conversions: metricNum(totalsRow, 5),
        newUsers: metricNum(totalsRow, 6),
      },
      dailyTrend: (trendRes.rows || []).map((row) => ({
        date: formatGa4Date(dimStr(row, 0)),
        sessions: metricNum(row, 0),
        activeUsers: metricNum(row, 1),
        pageViews: metricNum(row, 2),
        bounceRate: bounceRatePct(row, 3),
        newUsers: metricNum(row, 4),
      })),
      hourlyTrend: (hourlyRes.rows || [])
        .map((row) => {
          const raw = dimStr(row, 0);
          return {
            dateHour: raw,
            hourLabel: formatGa4Hour(raw),
            sessions: metricNum(row, 0),
            activeUsers: metricNum(row, 1),
            newUsers: metricNum(row, 2),
          };
        })
        .slice(-24),
      topPages: (pagesRes.rows || []).map((row) => ({
        path: dimStr(row, 0) || "/",
        views: metricNum(row, 0),
        avgEngagementSec: Math.round(metricNum(row, 1)),
      })),
      topEvents: (eventsRes.rows || []).map((row) => ({
        name: dimStr(row, 0),
        count: metricNum(row, 0),
      })),
      devices: (deviceRes.rows || []).map((row) => ({
        category: dimStr(row, 0) || "unknown",
        sessions: metricNum(row, 0),
        bounceRate: bounceRatePct(row, 1),
      })),
      topCountries: (countryRes.rows || []).map((row) => ({
        country: dimStr(row, 0) || "Unknown",
        sessions: metricNum(row, 0),
        activeUsers: metricNum(row, 1),
        bounceRate: bounceRatePct(row, 2),
      })),
      topCities: (cityRes.rows || []).map((row) => ({
        city: dimStr(row, 0) || "Unknown",
        country: dimStr(row, 1) || "",
        sessions: metricNum(row, 0),
      })),
      topReferrers: (referrerRes.rows || []).map((row) => ({
        referrer: dimStr(row, 0) || "(direct)",
        sessions: metricNum(row, 0),
      })),
      trafficSources: (sourceRes.rows || []).map((row) => ({
        source: dimStr(row, 0) || "direct",
        sessions: metricNum(row, 0),
        activeUsers: metricNum(row, 1),
      })),
    };

    return { success: true, data };
  } catch (err) {
    console.error("GA4 Data API request failed:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Region & Funnel Explorer -- answers "what did visitors from <city/state/
// country> actually do": which pages they viewed, how long they engaged,
// which page they landed on, and which custom events (our CTA clicks) fired
// on which page. Built on the same GA4 Data API the overview above uses --
// no separate tracking pipeline. The one thing genuinely NOT available here
// is an ordered, per-session "page A -> page B -> page C" path: the Data API
// only returns aggregated dimension/metric rows, never raw per-session event
// sequences. For that, use GA4's own Explore > Path Exploration report (free,
// already available in the GA4 UI, no build needed) or link the property to
// BigQuery export for raw event-level querying. Everything queryable in
// aggregate -- geo x page x engagement, landing pages, CTA/event breakdown,
// day/week/month trends -- is implemented below.

export type Ga4RegionFilters = { country?: string; region?: string; city?: string };

export type Ga4GeoRow = {
  country: string;
  region: string;
  city: string;
  sessions: number;
  activeUsers: number;
  newUsers: number;
  avgEngagementSec: number;
  bounceRate: number;
};

export type Ga4RegionExplorer = {
  filters: Ga4RegionFilters;
  totals: {
    sessions: number;
    activeUsers: number;
    pageViews: number;
    avgEngagementSec: number;
    newUsers: number;
    bounceRate: number;
  };
  pages: {
    path: string;
    views: number;
    sessions: number;
    avgEngagementSec: number;
    totalEngagementSec: number;
    exits: number | null;
    exitRatePct: number | null;
  }[];
  landingPages: {
    path: string;
    sessions: number;
    bounceRate: number;
    avgEngagementSec: number;
    newUsers: number;
  }[];
  eventsByPage: { page: string; eventName: string; count: number }[];
  trend: { period: string; sessions: number; activeUsers: number; pageViews: number }[];
  exitsSupported: boolean;
};

// GA4's "yearWeek" comes back as YYYYWW, "yearMonth" as YYYYMM -- neither has
// a natural separator to slice on like formatGa4Date's YYYYMMDD does.
function formatGa4YearWeek(raw: string): string {
  if (raw.length !== 6) return raw;
  return `${raw.slice(0, 4)}-W${raw.slice(4, 6)}`;
}
function formatGa4YearMonth(raw: string): string {
  if (raw.length !== 6) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}`;
}

const GRANULARITY_DIMENSION: Record<Ga4Granularity, string> = {
  day: "date",
  week: "yearWeek",
  month: "yearMonth",
};

function formatGa4Period(granularity: Ga4Granularity, raw: string): string {
  if (granularity === "day") return formatGa4Date(raw);
  if (granularity === "week") return formatGa4YearWeek(raw);
  return formatGa4YearMonth(raw);
}

// Noisy auto-collected events that aren't meaningful "what did they click"
// signals -- excluded from the CTA/event-by-page breakdown so it stays
// readable. Page views themselves are already covered by the `pages` table.
const NOISE_EVENTS = new Set([
  "page_view",
  "session_start",
  "first_visit",
  "user_engagement",
  "scroll",
  "click",
]);

function buildGeoFilter(filters: Ga4RegionFilters) {
  const clauses: Record<string, unknown>[] = [];
  if (filters.country) {
    clauses.push({ filter: { fieldName: "country", stringFilter: { matchType: "EXACT", value: filters.country } } });
  }
  if (filters.region) {
    clauses.push({ filter: { fieldName: "region", stringFilter: { matchType: "EXACT", value: filters.region } } });
  }
  if (filters.city) {
    clauses.push({ filter: { fieldName: "city", stringFilter: { matchType: "EXACT", value: filters.city } } });
  }
  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return { andGroup: { expressions: clauses } };
}

// Full country x region x city breakdown -- powers the filter dropdowns and
// answers "which regions do we actually get traffic from" on its own.
export async function getGa4GeoBreakdown(
  days: Ga4DateRangeDays = DEFAULT_GA4_DATE_RANGE_DAYS
): Promise<{ success: boolean; data?: Ga4GeoRow[]; error?: string }> {
  if (!isGa4ReportingConfigured()) {
    return { success: false, error: "Google Analytics reporting is not configured yet." };
  }
  try {
    const client = getClient();
    const property = `properties/${PROPERTY_ID}`;
    const [res] = await client.runReport({
      property,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "country" }, { name: "region" }, { name: "city" }],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "newUsers" },
        { name: "userEngagementDuration" },
        { name: "bounceRate" },
      ],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 500,
    });

    const data: Ga4GeoRow[] = (res.rows || []).map((row) => {
      const sessions = metricNum(row, 0);
      const engagementDuration = metricNum(row, 3);
      return {
        country: dimStr(row, 0) || "Unknown",
        region: dimStr(row, 1) || "(not set)",
        city: dimStr(row, 2) || "(not set)",
        sessions,
        activeUsers: metricNum(row, 1),
        newUsers: metricNum(row, 2),
        avgEngagementSec: sessions > 0 ? Math.round(engagementDuration / sessions) : 0,
        bounceRate: bounceRatePct(row, 4),
      };
    });

    return { success: true, data };
  } catch (err) {
    console.error("GA4 geo breakdown request failed:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// The full explorer: everything about one geographic slice (or the whole
// site, if no filter is passed) -- pages viewed + time spent, landing pages
// (entrances), CTA/event breakdown by page, and a day/week/month trend.
export async function getGa4RegionExplorer(
  days: Ga4DateRangeDays = DEFAULT_GA4_DATE_RANGE_DAYS,
  filters: Ga4RegionFilters = {},
  granularity: Ga4Granularity = "day"
): Promise<{ success: boolean; data?: Ga4RegionExplorer; error?: string }> {
  if (!isGa4ReportingConfigured()) {
    return { success: false, error: "Google Analytics reporting is not configured yet." };
  }

  try {
    const client = getClient();
    const property = `properties/${PROPERTY_ID}`;
    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
    const dimensionFilter = buildGeoFilter(filters);
    const granularityDimension = GRANULARITY_DIMENSION[granularity];

    const [[totalsRes], [pagesRes], [landingRes], [eventsRes], [trendRes]] = await Promise.all([
      client.runReport({
        property,
        dateRanges,
        dimensionFilter,
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "screenPageViews" },
          { name: "userEngagementDuration" },
          { name: "newUsers" },
          { name: "bounceRate" },
        ],
      }),
      client.runReport({
        property,
        dateRanges,
        dimensionFilter,
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "userEngagementDuration" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 30,
      }),
      client.runReport({
        property,
        dateRanges,
        dimensionFilter,
        dimensions: [{ name: "landingPage" }],
        metrics: [
          { name: "sessions" },
          { name: "bounceRate" },
          { name: "userEngagementDuration" },
          { name: "newUsers" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 20,
      }),
      client.runReport({
        property,
        dateRanges,
        dimensionFilter,
        dimensions: [{ name: "pagePath" }, { name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: 60,
      }),
      client.runReport({
        property,
        dateRanges,
        dimensionFilter,
        dimensions: [{ name: granularityDimension }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }],
        orderBys: [{ dimension: { dimensionName: granularityDimension } }],
        limit: 120,
      }),
    ]);

    // Exits is queried separately and allowed to fail without sinking the
    // whole explorer -- it's a less universally-documented GA4 Data API
    // metric than the others, so degrade gracefully (exitRatePct: null) if
    // this property/API version rejects it rather than erroring the page.
    let exitsByPath = new Map<string, number>();
    let exitsSupported = true;
    try {
      const [exitsRes] = await client.runReport({
        property,
        dateRanges,
        dimensionFilter,
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "exits" }],
        limit: 30,
      });
      exitsByPath = new Map((exitsRes.rows || []).map((row) => [dimStr(row, 0) || "/", metricNum(row, 0)]));
    } catch (exitErr) {
      exitsSupported = false;
      console.warn("GA4 'exits' metric unavailable, omitting exit rate:", exitErr);
    }

    const totalsRow = totalsRes.rows?.[0];
    const totalSessions = metricNum(totalsRow, 0);

    const pages = (pagesRes.rows || []).map((row) => {
      const path = dimStr(row, 0) || "/";
      const views = metricNum(row, 0);
      const sessions = metricNum(row, 1);
      const totalEngagementSec = Math.round(metricNum(row, 2));
      const exits = exitsSupported ? exitsByPath.get(path) ?? 0 : null;
      return {
        path,
        views,
        sessions,
        avgEngagementSec: sessions > 0 ? Math.round(totalEngagementSec / sessions) : 0,
        totalEngagementSec,
        exits,
        exitRatePct: exits !== null && views > 0 ? Math.round((exits / views) * 1000) / 10 : null,
      };
    });

    const landingPages = (landingRes.rows || []).map((row) => {
      const sessions = metricNum(row, 0);
      const engagementDuration = metricNum(row, 2);
      return {
        path: dimStr(row, 0) || "/",
        sessions,
        bounceRate: bounceRatePct(row, 1),
        avgEngagementSec: sessions > 0 ? Math.round(engagementDuration / sessions) : 0,
        newUsers: metricNum(row, 3),
      };
    });

    const eventsByPage = (eventsRes.rows || [])
      .map((row) => ({
        page: dimStr(row, 0) || "/",
        eventName: dimStr(row, 1),
        count: metricNum(row, 0),
      }))
      .filter((e) => e.eventName && !NOISE_EVENTS.has(e.eventName));

    const trend = (trendRes.rows || []).map((row) => ({
      period: formatGa4Period(granularity, dimStr(row, 0)),
      sessions: metricNum(row, 0),
      activeUsers: metricNum(row, 1),
      pageViews: metricNum(row, 2),
    }));

    const data: Ga4RegionExplorer = {
      filters,
      totals: {
        sessions: totalSessions,
        activeUsers: metricNum(totalsRow, 1),
        pageViews: metricNum(totalsRow, 2),
        avgEngagementSec: totalSessions > 0 ? Math.round(metricNum(totalsRow, 3) / totalSessions) : 0,
        newUsers: metricNum(totalsRow, 4),
        bounceRate: bounceRatePct(totalsRow, 5),
      },
      pages,
      landingPages,
      eventsByPage,
      trend,
      exitsSupported,
    };

    return { success: true, data };
  } catch (err) {
    console.error("GA4 region explorer request failed:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
