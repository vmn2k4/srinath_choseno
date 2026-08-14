# Adding and Tagging News Articles Guide

This document explains how to add new news articles to Choseno, format them properly, link them to office holders/politicians, deduplicate incoming content, and have articles automatically mirror to public walls and the main news feed with accurate historical dates.

---

## 1. Overview of the Pipeline

```
┌──────────────────────────────────────────────────────────┐
│ Article JSON (Manual or Scripted)                        │
│ - Headline, Markdown Body, Summary, Dateline             │
│ - Category, Impact Area, Coordinates                     │
│ - Historical Event Date (event_date)                     │
│ - Tagged Politician Profile UUIDs (taggedPoliticianIds)  │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│ Deduplication Engine (Slug, URL & Similarity Checks)     │
│ - Verifies slug uniqueness & canonical source URLs       │
│ - Detects duplicate stories within same event window     │
│ - Merges sources & politician tags if story exists       │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│ Validation & DB Insert (`news_articles`)                 │
│ - Enforces enum constraints (Category, Impact Area)      │
│ - Stores article content and SEO metadata                │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│ RPC: `admin_sync_news_article_tags`                      │
│ - Links article in `news_article_politicians`            │
│ - Creates mirrored post in `posts` table for wall/feed   │
│ - Sets post `created_at` to historical `event_date`      │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│ Live Display                                             │
│ - Appears on Politician Wall (`/wall/[slug]`)            │
│ - Appears in Main Feed (`/feed`) & News (`/news`)        │
│ - Filterable by "My Representatives" for logged-in users │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Deduplication Strategy & Rules (De-duping)

As the platform scales to thousands of news articles, automated and editorial deduplication prevents feed clutter, split discussion threads, and redundant politician wall entries.

### 2.1 The 3-Tier Deduplication Check

1. **Source URL Deduplication (Exact Match)**
   - Check if any source link in `sources[].url` already exists in `news_articles.content->'sources'`.
   - If an article with the same source link exists, do **not** create a duplicate. Instead, update the existing record with any newly tagged politicians or quotes.

2. **Slug & Canonical Key Deduplication**
   - The `slug` field is indexed uniquely in the database.
   - Format: `[politician-or-subject]-[key-topic]-[year-month-day]`.
   - If an incoming article has a matching slug, the batch importer executes a `PATCH` update rather than creating a duplicate row.

3. **Semantic & Headline Similarity Deduplication (Time-Window Match)**
   - Articles mentioning the **same public official** on the **same policy/event** within a **±3 day window** must be merged into a single comprehensive article.
   - **Similarity Rule**: If headline word overlap exceeds 75% for the same tagged politician within 72 hours, treat it as the same story.

### 2.2 Deduplication Code Logic Example

```javascript
function isDuplicateStory(incoming, existingArticles) {
  const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const incomingTokens = new Set(normalize(incoming.headline).split(/\s+/).filter(w => w.length > 3));

  for (const existing of existingArticles) {
    // Check 1: Direct source URL match
    const existingUrls = (existing.content?.sources || []).map(s => s.url);
    const hasSharedSource = (incoming.sources || []).some(s => existingUrls.includes(s.url));
    if (hasSharedSource) return { isDup: true, match: existing, reason: 'Source URL matched' };

    // Check 2: Same politician + high headline overlap within 3 days
    const incomingDate = new Date(incoming.eventDate || incoming.published_at).getTime();
    const existingDate = new Date(existing.event_date || existing.published_at).getTime();
    const diffDays = Math.abs(incomingDate - existingDate) / (1000 * 60 * 60 * 24);

    if (diffDays <= 3) {
      const existingTokens = new Set(normalize(existing.headline).split(/\s+/).filter(w => w.length > 3));
      const intersection = [...incomingTokens].filter(t => existingTokens.has(t));
      const similarity = intersection.length / Math.max(incomingTokens.size, 1);

      if (similarity >= 0.7) {
        return { isDup: true, match: existing, reason: `Headline similarity ${Math.round(similarity * 100)}%` };
      }
    }
  }

  return { isDup: false };
}
```

### 2.3 What to Do When a Duplicate is Detected
- **Merge Politician Tags**: Combine `taggedPoliticianIds` from both records so all involved leaders are tagged to the authoritative post.
- **Append Citations**: Add the new outlet/URL to the existing `sources` array.
- **Do Not Create New Feed Posts**: Prevent multiple mirror cards appearing on the same politician's wall for a single news event.

---

## 3. Article JSON Schema Specification

Every article object must follow this structure:

```json
{
  "slug": "unique-hyphenated-slug-for-url",
  "headline": "Clear, Journalistic Headline (60-80 chars)",
  "summary": "Short 1-2 sentence card excerpt for feed display.",
  "category": "Policy",
  "country": "CA",
  "province": "BC",
  "status": "published",
  "eventDate": "2026-08-14T15:00:00Z",
  "published_at": "2026-08-14T15:00:00Z",
  "impactArea": "state",
  "latitude": 49.1762,
  "longitude": -122.8436,
  "body": "CITY, Prov. — Standard journalistic opening dateline...\n\n## Action-Oriented Subhead\n\nCore details, verified facts, and bullet points...\n\n## Outlook\n\nForward-looking context grounded strictly in facts.",
  "seoTitle": "Optimized SEO Title under 60 characters",
  "metaDescription": "Concise meta description under 160 characters summarizing the article",
  "tags": ["Surrey", "Healthcare", "David Eby"],
  "breakingNews": false,
  "author": {
    "name": "Choseno Civic News Desk",
    "bio": "Provincial and municipal political affairs reporting"
  },
  "sources": [
    { "label": "BC Gov News", "url": "https://news.gov.bc.ca/releases/..." },
    { "label": "CBC News", "url": "https://www.cbc.ca/news/..." }
  ],
  "taggedPoliticianIds": [
    "b49511ad-b330-46e1-ae8f-3916b40cf8a2",
    "a730729a-0a3b-4231-b93d-9b5524f9db5e"
  ]
}
```

### Allowed Enum Values

| Field | Allowed Values | Notes |
|---|---|---|
| **`category`** | `"General"`, `"Policy"`, `"Local"`, `"National"`, `"International"`, `"Economy"`, `"Healthcare"`, `"Education"`, `"Environment"`, `"Technology"`, `"Infrastructure"`, `"Public Safety"`, `"Culture"`, `"Elections"`, `"Opinion"` | Required. Case-sensitive in DB. |
| **`status`** | `"published"`, `"draft"`, `"archived"` | Use `"published"` for live articles. |
| **`impactArea`** | `"local"`, `"state"`, `"country"`, `"international"` | `"local"` pairs with latitude/longitude for boundary tagging. |

---

## 4. How to Find Politician Profile UUIDs

To tag an office holder, you need their `profiles.id` UUID (the `linked_profile_id` on their `office_holders` record).

You can run a quick lookup in the terminal using:

```bash
node -e '
const fs = require("fs");
const envFile = fs.readFileSync(".env.local", "utf8");
const env = {};
envFile.split("\n").forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["\x27]|["\x27]$/g, "");
});

async function lookup(name) {
  const authRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.admin_un, password: env.admin_pwd })
  });
  const auth = await authRes.json();

  const res = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/office_holders?select=id,full_name,linked_profile_id,election_role_types(role_title),map_shapes(name)&full_name=ilike.*" + encodeURIComponent(name) + "*", {
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: "Bearer " + auth.access_token }
  });
  const data = await res.json();
  console.log(data);
}
lookup("Eby"); // Replace with search name
'
```

---

## 5. Adding Articles via Reusable Script (With Built-in De-duping)

The batch script is located at [`scripts/insert-news-batch.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/insert-news-batch.js).

### Step 1: Open the script
Edit [`scripts/insert-news-batch.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/insert-news-batch.js) and paste your articles into the `articles` list.

### Step 2: Run the script
```bash
node scripts/insert-news-batch.js
```

### Automated Steps Performed:
1. **Deduplication Check**: Queries existing articles to prevent duplicate stories by slug, URL, or headline similarity.
2. **Schema Validation**: Ensures all required fields, valid category enums, and coordinates are correct.
3. **Database Upsert**: Updates existing records or inserts new articles into `news_articles`.
4. **Tag & Wall Synchronization**: Calls `admin_sync_news_article_tags(p_article_id, p_politician_ids)` to mirror posts to official profiles.
5. **Backdates Post Timestamps**: Ensures `created_at` in the feed reflects when the real-world event occurred (`event_date`).

---

## 6. Adding Articles via Admin Web UI

1. Log into Choseno as an Admin and navigate to **Admin > News** (`/admin/news`).
2. Click **New Article** or **Paste JSON**.
3. Paste the single article or batch JSON array into the JSON importer.
4. The system validates the schema, checks for duplicate slugs/headlines, and previews the content.
5. In the **Tagged Politicians** section, select the office holders you want to tag.
6. Click **Save & Publish**. The article will go live immediately on `/news` and mirror to the selected politicians' walls.
