import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { DEFAULT_GA4_DATE_RANGE_DAYS, type Ga4DateRangeDays } from "@/lib/constants/ga4";

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
        bounceRate: Math.round(metricNum(totalsRow, 4) * 100) / 100,
        conversions: metricNum(totalsRow, 5),
        newUsers: metricNum(totalsRow, 6),
      },
      dailyTrend: (trendRes.rows || []).map((row) => ({
        date: formatGa4Date(dimStr(row, 0)),
        sessions: metricNum(row, 0),
        activeUsers: metricNum(row, 1),
        pageViews: metricNum(row, 2),
        bounceRate: Math.round(metricNum(row, 3) * 100) / 100,
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
        bounceRate: Math.round(metricNum(row, 1) * 100) / 100,
      })),
      topCountries: (countryRes.rows || []).map((row) => ({
        country: dimStr(row, 0) || "Unknown",
        sessions: metricNum(row, 0),
        activeUsers: metricNum(row, 1),
        bounceRate: Math.round(metricNum(row, 2) * 100) / 100,
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
