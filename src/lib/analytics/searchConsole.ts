import { JWT } from "google-auth-library";
import type { Ga4DateRangeDays } from "@/lib/constants/ga4";

export interface SearchConsoleData {
  totals: {
    impressions: number;
    clicks: number;
    ctr: number;
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

interface SearchConsoleApiRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface SearchConsoleApiResponse {
  rows?: SearchConsoleApiRow[];
}

export function isSearchConsoleConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SEARCH_CONSOLE_EMAIL &&
    process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY &&
    process.env.GOOGLE_SEARCH_CONSOLE_PROPERTY_URL
  );
}

function getJwtClient(): JWT {
  const email = process.env.GOOGLE_SEARCH_CONSOLE_EMAIL;
  const privateKey = process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error("Missing Search Console credentials");
  }

  return new JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

async function querySearchAnalytics(
  token: string,
  siteUrl: string,
  body: Record<string, unknown>
): Promise<SearchConsoleApiRow[]> {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Search Console API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as SearchConsoleApiResponse;
  return data.rows || [];
}

export async function getSearchConsoleData(
  days: Ga4DateRangeDays
): Promise<{ success: boolean; data?: SearchConsoleData; error?: string }> {
  try {
    if (!isSearchConsoleConfigured()) {
      return { success: false, error: "Search Console not configured" };
    }

    const jwt = getJwtClient();
    const tokenResponse = await jwt.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      throw new Error("Failed to retrieve Google OAuth access token");
    }

    const propertyUrl = process.env.GOOGLE_SEARCH_CONSOLE_PROPERTY_URL!;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    const [totalsRows, dailyRows, queriesRows, pagesRows, countryRows, deviceRows] = await Promise.all([
      querySearchAnalytics(accessToken, propertyUrl, {
        startDate: startDateStr,
        endDate: endDateStr,
        rowLimit: 1,
      }),
      querySearchAnalytics(accessToken, propertyUrl, {
        startDate: startDateStr,
        endDate: endDateStr,
        dimensions: ["date"],
        rowLimit: 100,
      }),
      querySearchAnalytics(accessToken, propertyUrl, {
        startDate: startDateStr,
        endDate: endDateStr,
        dimensions: ["query"],
        rowLimit: 25,
      }),
      querySearchAnalytics(accessToken, propertyUrl, {
        startDate: startDateStr,
        endDate: endDateStr,
        dimensions: ["page"],
        rowLimit: 25,
      }),
      querySearchAnalytics(accessToken, propertyUrl, {
        startDate: startDateStr,
        endDate: endDateStr,
        dimensions: ["country"],
        rowLimit: 25,
      }),
      querySearchAnalytics(accessToken, propertyUrl, {
        startDate: startDateStr,
        endDate: endDateStr,
        dimensions: ["device"],
        rowLimit: 10,
      }),
    ]);

    const totalsRow = totalsRows[0];
    const totals = {
      impressions: totalsRow?.impressions || 0,
      clicks: totalsRow?.clicks || 0,
      ctr: (totalsRow?.ctr || 0) * 100,
      avgPosition: totalsRow?.position || 0,
    };

    const dailyTrend = dailyRows
      .sort((a: SearchConsoleApiRow, b: SearchConsoleApiRow) => (a.keys?.[0] || "").localeCompare(b.keys?.[0] || ""))
      .map((row: SearchConsoleApiRow) => ({
        date: row.keys?.[0] || "",
        impressions: row.impressions || 0,
        clicks: row.clicks || 0,
        ctr: (row.ctr || 0) * 100,
        avgPosition: row.position || 0,
      }));

    const topQueries = queriesRows.slice(0, 10).map((row: SearchConsoleApiRow) => ({
      query: row.keys?.[0] || "",
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      ctr: (row.ctr || 0) * 100,
      avgPosition: row.position || 0,
    }));

    const topPages = pagesRows.slice(0, 10).map((row: SearchConsoleApiRow) => ({
      page: row.keys?.[0] || "",
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      ctr: (row.ctr || 0) * 100,
      avgPosition: row.position || 0,
    }));

    const countryData = countryRows.slice(0, 10).map((row: SearchConsoleApiRow) => ({
      country: row.keys?.[0] || "Unknown",
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      ctr: (row.ctr || 0) * 100,
      avgPosition: row.position || 0,
    }));

    const deviceData = deviceRows.map((row: SearchConsoleApiRow) => ({
      device: row.keys?.[0] || "Unknown",
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      ctr: (row.ctr || 0) * 100,
      avgPosition: row.position || 0,
    }));

    const data: SearchConsoleData = {
      totals,
      dailyTrend,
      topQueries,
      topPages,
      countryData,
      deviceData,
    };

    return { success: true, data };
  } catch (error) {
    console.error("Search Console error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch Search Console data",
    };
  }
}
