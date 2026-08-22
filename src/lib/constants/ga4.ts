// Client-safe GA4 constants -- kept out of src/lib/analytics/ga4Reporting.ts
// because that file has a top-level `import { BetaAnalyticsDataClient } from
// "@google-analytics/data"`, a server-only Node package. A Client Component
// importing a runtime value (not `import type`) from that file would pull
// the whole module -- and that Node-only import -- into the browser bundle.

// Ranges the admin UI's dropdown can request. GA4's relative-date syntax
// ("NdaysAgo") only accepts these specific strings, so this also doubles
// as the allowlist the API route validates query params against.
export const GA4_DATE_RANGES = [1, 3, 7, 14, 28, 30, 90] as const;
export type Ga4DateRangeDays = (typeof GA4_DATE_RANGES)[number];
export const DEFAULT_GA4_DATE_RANGE_DAYS: Ga4DateRangeDays = 30;

// Trend grouping for the Region & Funnel Explorer -- maps 1:1 to GA4's own
// date/yearWeek/yearMonth dimensions (see ga4Reporting.ts).
export const GA4_GRANULARITIES = ["day", "week", "month"] as const;
export type Ga4Granularity = (typeof GA4_GRANULARITIES)[number];
export const DEFAULT_GA4_GRANULARITY: Ga4Granularity = "day";
