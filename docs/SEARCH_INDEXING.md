# Search discovery & indexing

How new/updated Choseno pages get found by search engines, what's automatic
today, and what isn't. Covers the site-wide crawl/discovery pipeline —
for on-page metadata/schema.org work on a specific page, see
[SEO_IMPROVEMENTS.md](SEO_IMPROVEMENTS.md).

---

## The three discovery surfaces

| File | Purpose |
|---|---|
| [`src/app/sitemap.ts`](../src/app/sitemap.ts) | Full-archive sitemap — every article, seat, candidate, boundary, and politician wall page. Generated live on every request (no build-time snapshot, no cron). |
| [`src/app/news-sitemap.xml/route.ts`](../src/app/news-sitemap.xml/route.ts) | Google News-specific feed: rolling 48h window, `<news:news>` tags, capped at 1000 URLs. Self-prunes every request — no cleanup job needed. |
| [`src/app/robots.ts`](../src/app/robots.ts) | Crawl rules per bot (Googlebot, GPTBot, PerplexityBot, ClaudeBot, Google-Extended, FacebookBot, OAI-SearchBot, Applebot, Applebot-Extended) + declares both sitemaps so crawlers discover them without manual submission. |

Both sitemaps read live Supabase data, so they're always current — the gap
is entirely on the *crawl frequency* side (how often each engine revisits
them), not staleness of what's served.

---

## IndexNow — instant push, but not for Google

[`src/lib/services/indexnow.ts`](../src/lib/services/indexnow.ts) pings
`api.indexnow.org` with newly-published URLs. **Google does not consume
IndexNow** — this is a Bing/Yandex protocol. It matters anyway because
Bing results (and Bing-derived surfaces like Copilot and ChatGPT web
search) update within minutes instead of days.

Auth is a public key file at
[`public/2ed122ee7f2e2692b45f25ffbae0bb4d.txt`](../public/2ed122ee7f2e2692b45f25ffbae0bb4d.txt)
containing the key itself — that's IndexNow's entire auth model, nothing
secret to protect.

**Already auto-triggered on every publish path** — no manual step needed.
`notifyIndexNow()` in
[`AdminNewsPageClient.tsx`](../src/components/features/AdminNewsPageClient.tsx)
fires fire-and-forget (never blocks or surfaces an error to the publish
flow) from:
- Batch import, for every newly-published article
- `handleSave()`, when an edit's status becomes `"published"`
- `handleQuickPublish()`, the one-click publish button

The server-side route (`/api/admin/indexnow`,
[route.ts](../src/app/api/admin/indexnow/route.ts)) exists so the client
component doesn't call the third-party API directly, and so the admin-role
check happens server-side.

---

## Google specifically — no bulk "index this now" API

This is the one gap in the setup, and it's structural, not a missing
integration:

- **No real-time push API for regular content.** The [Google Indexing
  API](https://developers.google.com/search/apis/indexing-api/v3/using-api)
  exists, but is explicitly restricted: *"The Indexing API can only be
  used to crawl pages with either `JobPosting` or `BroadcastEvent`
  embedded in a `VideoObject`."* Using it for news articles or any other
  content type is against Google's terms — sites that do it risk the
  calls being rate-limited or silently ignored. **Do not build this** for
  the news/elections/candidate pages here.
- **The sitemap ping endpoint is gone.** Google deprecated
  `google.com/ping?sitemap=...` in June 2023. Submitting once via Search
  Console (or just having `robots.ts` declare the sitemap URL, which we
  already do) is the modern equivalent — there's no way to "re-ping" it.
- **What actually speeds up Google's crawl**, in order of leverage:
  1. **Internal linking** — Google prioritizes crawling pages it can
     reach through links from pages it already trusts (homepage, `/feed`,
     `/news`). A new article linked from the homepage gets crawled faster
     than an orphaned sitemap entry.
  2. **Sitemap freshness** — already correct (see above).
  3. **Manual "Request Indexing"** in the Search Console UI — one URL at
     a time, no API, human-only. Fine for a handful of high-priority
     pages, not something to automate.

---

## Search Console — read-only, for monitoring not submission

[`src/lib/analytics/searchConsole.ts`](../src/lib/analytics/searchConsole.ts)
wraps the Search Console **read** API (`webmasters.readonly` scope) —
impressions, clicks, CTR, position, by query/page/country/device. It has
nothing to do with submitting URLs; it's the same shape as the GA4
integration (see [GA4_DASHBOARD_SETUP.md](GA4_DASHBOARD_SETUP.md)), just a
different Google product.

Served via `/api/admin/search-console`
([route.ts](../src/app/api/admin/search-console/route.ts)), same
admin-role-check pattern as the GA4 route.

### Env vars

```
GOOGLE_SEARCH_CONSOLE_EMAIL=choseno-search-console@your-project.iam.gserviceaccount.com
GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SEARCH_CONSOLE_PROPERTY_URL=https://www.choseno.com/
```

Same service-account pattern as GA4: create/reuse a service account in
Google Cloud, then add its `client_email` in Search Console → **Settings →
Users and permissions** with **Restricted** (read-only) access. Until all
three vars are set, `isSearchConsoleConfigured()` returns `false` and the
admin dashboard shows a "not connected" state instead of erroring.

`GOOGLE_SEARCH_CONSOLE_PROPERTY_URL` must exactly match how the property
is registered in Search Console — a domain property (`sc-domain:choseno.com`)
uses a different format than a URL-prefix property
(`https://www.choseno.com/`).

---

## Not yet built — candidate improvements

None of these are started. Roughly in order of effort-to-impact:

- **Indexing-lag dashboard** — cross-reference recently-published articles
  against Search Console's per-page data to see how long Google actually
  takes to pick each one up. Would turn "is this working" into something
  observable instead of assumed.
- **RSS feed** — passive distribution channel, feeds/aggregators, low
  effort to add given the sitemap query logic already exists.
- **Auto-post to social on publish** — reuses the existing share-copy
  logic (see [SOCIAL_SHARING_AND_IMAGE_GENERATION.md](SOCIAL_SHARING_AND_IMAGE_GENERATION.md))
  instead of relying on the 1-click manual share buttons.
- **Email digest** — daily/weekly roundup; retention lever more than a
  discovery one, but reuses the existing email infra
  (`supabase/functions/send-email`).

---

## File map

- [`src/app/sitemap.ts`](../src/app/sitemap.ts) — main sitemap
- [`src/app/news-sitemap.xml/route.ts`](../src/app/news-sitemap.xml/route.ts) — Google News sitemap
- [`src/app/robots.ts`](../src/app/robots.ts) — crawl rules, sitemap declarations
- [`src/lib/services/indexnow.ts`](../src/lib/services/indexnow.ts) — `pingIndexNow()`
- [`src/app/api/admin/indexnow/route.ts`](../src/app/api/admin/indexnow/route.ts) — admin-gated IndexNow proxy
- [`src/components/features/AdminNewsPageClient.tsx`](../src/components/features/AdminNewsPageClient.tsx) — `notifyIndexNow()` call sites
- [`src/lib/analytics/searchConsole.ts`](../src/lib/analytics/searchConsole.ts) — Search Console read API
- [`src/app/api/admin/search-console/route.ts`](../src/app/api/admin/search-console/route.ts) — admin-gated Search Console proxy
- [`public/2ed122ee7f2e2692b45f25ffbae0bb4d.txt`](../public/2ed122ee7f2e2692b45f25ffbae0bb4d.txt) — IndexNow key file

---

*Last updated: 2026-08-19*
