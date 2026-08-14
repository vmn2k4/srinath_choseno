# Adding and Tagging News Articles Guide

This document explains how to add new news articles to Choseno, format them properly, link them to office holders/politicians, and have them automatically mirror to their public walls and the main news feed with accurate historical dates.

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
└──────────────────────────────────────────────────────────┘
```

---

## 2. Article JSON Schema Specification

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
  "eventDate": "2024-02-15T15:00:00Z",
  "published_at": "2024-02-15T15:00:00Z",
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

## 3. How to Find Politician Profile UUIDs

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

## 4. Method A: Adding Articles via Reusable Script (Fastest for Batches)

A reusable script is provided at [`scripts/insert-news-batch.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/insert-news-batch.js).

### Step 1: Open the script
Edit [`scripts/insert-news-batch.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/insert-news-batch.js) and add your articles array into the `articles` list.

### Step 2: Run the script
```bash
node scripts/insert-news-batch.js
```

### What the script automatically does:
1. Authenticates using your admin credentials in `.env.local`.
2. Checks for existing articles by slug (updates if already existing, inserts if new).
3. Executes `admin_sync_news_article_tags(p_article_id, p_politician_ids)` to link tags and mirror the post to the politician's wall.
4. Backdates the post's `created_at` in the feed to the historical `event_date`.

---

## 5. Method B: Adding Articles via Admin Web UI

1. Log into Choseno as an Admin and navigate to **Admin > News** (`/admin/news`).
2. Click **New Article** or **Paste JSON**.
3. Paste the single article or batch JSON array into the JSON importer.
4. The system validates the schema and fields in real-time.
5. In the **Tagged Politicians** section, select the office holders you want to tag.
6. Click **Save & Publish**. The article will go live immediately on `/news` and mirror to the selected politicians' walls.

---

## 6. How Wall Mirroring and Feed Dates Work

1. **Tag Syncing**: When an article is saved, the Postgres RPC `admin_sync_news_article_tags` creates a record in `posts` with `news_article_id = <article_id>` and `wall_ghost_id = <politician_ghost_id>`.
2. **Historical Date Matching**: The mirrored post's `created_at` timestamp is set to `COALESCE(article.event_date, article.published_at, now())`.
3. **Feed & PostCard Rendering**: The [`PostCard`](file:///Users/vmn2k4/Coding/Choseno/src/components/features/PostCard.tsx) component uses `post.news_articles.event_date` to ensure that when an article covers a past event, the date badge shows when it actually happened rather than when the article was entered into the database.
