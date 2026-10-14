# Pulling Choseno analytics (handoff for a new agent)

How to get live traffic, SEO and growth numbers without going through the admin UI. All credentials already live in `.env.local`; never print, log or commit their values.

## Which source answers which question

| Question | Source | How |
|---|---|---|
| Sessions, bounce, engagement, channels, landing pages, countries | GA4 Data API | `src/lib/analytics/ga4Reporting.ts` or a raw `BetaAnalyticsDataClient` call |
| "Right now" / last few hours | GA4 Realtime API | `runRealtimeReport` (not delayed) |
| Google impressions, clicks, position, indexing status | Search Console API | `src/lib/analytics/searchConsole.ts` or raw REST + URL Inspection API |
| Signups, users, posts, supports, ratings | Supabase (Postgres) | `psql` (see below). **Never use GA4 `sign_up`** for user counts: it under-reports |
| Client errors ("what broke") | `client_error_logs` table | Supabase, admin-only table |
| Outages, 5xx, firewall | Vercel | `vercel logs`, `vercel api` |

The admin pages (`/admin/traffic`, `/admin/search-console`, `/admin/region-explorer`) call the same library functions, so numbers match.

## Environment variables (names only)

- GA4: `GA4_SERVICE_ACCOUNT_EMAIL`, `GA4_SERVICE_ACCOUNT_PRIVATE_KEY` (replace `\\n` with real newlines), `GA4_PROPERTY_ID`
- Search Console: `GOOGLE_SEARCH_CONSOLE_EMAIL`, `GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY`, `GOOGLE_SEARCH_CONSOLE_PROPERTY_URL` (`sc-domain:choseno.com`; scope `webmasters.readonly`; the same account can call the URL Inspection API)
- Supabase: the database password is the `# Database Password:` comment in `.env.local`

## How to run a pull

Write a throwaway script **inside the repo** (e.g. `.tmp-query.ts` at the repo root; a script outside the repo can't resolve `node_modules`), run it, then delete it. Never commit it.

```bash
npx tsx --env-file=.env.local .tmp-query.ts; rm -f .tmp-query.ts
```

GA4 skeleton:

```ts
import { BetaAnalyticsDataClient } from "@google-analytics/data";
const ga = new BetaAnalyticsDataClient({ credentials: {
  client_email: process.env.GA4_SERVICE_ACCOUNT_EMAIL,
  private_key: process.env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n") } });
const property = `properties/${process.env.GA4_PROPERTY_ID}`;
const [r] = await ga.runReport({ property,
  dateRanges: [{ startDate: "9daysAgo", endDate: "today" }],
  dimensions: [{ name: "date" }],
  metrics: [{ name: "sessions" }, { name: "engagedSessions" }, { name: "bounceRate" },
            { name: "averageSessionDuration" }, { name: "screenPageViewsPerSession" }] });
```

Useful dimensions: `date`, `hour`, `sessionDefaultChannelGroup`, `sessionSource`, `country`, `landingPage`, `deviceCategory`. Realtime: `runRealtimeReport` with `minutesAgo`.

Search Console REST (JWT from `google-auth-library`, scope above): POST
`https://www.googleapis.com/webmasters/v3/sites/<encoded property>/searchAnalytics/query` with `{startDate, endDate, dimensions, dataState: "all", rowLimit}`. Index status: POST `https://searchconsole.googleapis.com/v1/urlInspection/index:inspect` with `{inspectionUrl, siteUrl}` and read `inspectionResult.indexStatusResult.coverageState`.

Supabase:

```bash
export PGPASSWORD='<password from the .env.local comment>'
psql "postgresql://postgres.qlzyfdwrkcxyqapewxwg@aws-1-us-east-2.pooler.supabase.com:5432/postgres" -c "select ..."
```

The old `db.<ref>.supabase.co` host no longer resolves; use the session pooler above. Apply migrations one file at a time with `psql -f`; do not run `supabase db push`.

## Rules that stop you reporting wrong numbers

1. **The newest ~2 days of GA4 are unprocessed.** You'll see engaged sessions near 0, bounce near 99%, source "(not set)", and landing page blank. That is GA4 lag, not bots and not a crash. Judge bounce, engagement and channels only on days at least 3 days old. Session counts are usable sooner but still rise as the day is processed (Oct 7 went from 3,355 to 3,700).
2. **A "dip" on the current day is usually partial data.** Compare like-for-like on complete days, or use the Realtime API for what is happening now.
3. **Search Console lags 2–3 days.** Use the `date` dimension for totals. The `query` dimension hides anonymized queries and undercounts roughly 6×, so use it for examples, not totals.
4. **GA4 has a low concurrent-request quota.** Run reports sequentially (add a few seconds between them). `getGa4Overview()` alone fires 10 queries; never run extra GA4 calls in parallel with it. If you get `RESOURCE_EXHAUSTED`, wait and retry.
5. **`days: 1` in the library is two days** (yesterday + today). For one strict day use `dateRanges: [{ startDate: "today", endDate: "today" }]`.
6. **Sanity-check Supabase counts for imports.** `profiles` has 31,694 imported politician rows on 2026-08-21 and `posts` has batch-publish spikes. Real signups are a few a day. Look for one-day outliers before calling something growth.
7. **Don't heavy-query production while it's throttled** (the DB is a burstable instance; anon queries time out at 3 s).
8. **Never speculate about bots from GA4 alone.** Check `vercel logs`/firewall events first. Challenged requests don't appear in the logs.
9. **`vercel logs --json` repeats rows**; de-dupe by `id`. `vercel firewall rules list` shows only custom rules; read managed rules with `vercel api "/v1/security/firewall/config/active?projectId=prj_fWU5sakrxe38zGxQnuJpbTd4tbnN"`.

## Standard checks

- **Traffic trend:** GA4 daily sessions, engaged%, bounce for the last 10 days. Flag the last 2 days as unreliable.
- **Where visibility changed:** group GA4 `landingPage` sessions, and Search Console `page` impressions, by page type and compare complete days. Page types: `/candidacy` and `/wall` (candidates), `/elections/seat/...` (races), `/elections/e/...` (election hubs and parties), `/elections/<place>` (area pages), `/news`, `/blog`.
- **Is Google indexing a page?** URL Inspection (`coverageState`). "Discovered, currently not indexed" = Google knows it but hasn't crawled it; "Crawled, currently not indexed" = crawled but not added. Requesting indexing must be done by a person in Search Console (the API here is read-only).
- **Intent split (candidate vs election topic vs area):** classify by landing page type first (complete), then by query text for examples.
- **Growth:** Supabase `profiles`, `posts`, supports and ratings, with outlier checks.

## Where to read more

- `docs/GA4_DASHBOARD_SETUP.md`, `ARCHITECTURE.md`, `docs/CODE_LAYERS.md`
- The `/admin/traffic` pickers: `GA4_TREND_RANGES` in `src/lib/constants/ga4.ts`; endpoint `/api/admin/ga4/trends?kind=hourly|daily&days=N`
