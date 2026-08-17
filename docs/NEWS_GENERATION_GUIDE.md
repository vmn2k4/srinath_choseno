# News Ingestion & Generation Architecture Guide

## Overview

Choseno operates a high-integrity, automated and editorial news ingestion system. Every published article undergoes strict structural validation, deduplication screening against existing database records, and canonical source verification before insertion into the `news_articles` table.

Articles are automatically linked to politician profiles (`news_article_politicians`) to populate politician wall feeds (`/wall/[slug]`), and resolved against PostGIS electoral boundary polygons (`news_article_boundaries`) to power localized riding and state feeds.

---

## News Prompts Directive Suite (`NewsPrompts/`)

For AI-assisted news discovery and editorial synthesis, three standardized directives in the [`NewsPrompts/`](../NewsPrompts/README.md) directory govern different ingestion operations:

1. **[`NewsPrompts/NewsCollectionPrompt.md`](../NewsPrompts/NewsCollectionPrompt.md)** — General high-impact civic & political news ingestion from wire services, executive councils, and provincial/state portals (up to 100 stories/batch).
2. **[`NewsPrompts/KeyLeadersNewsCollectionPrompt.md`](../NewsPrompts/KeyLeadersNewsCollectionPrompt.md)** — Targeted news collection for the 30 Key Political Leaders in Canada and the U.S. with pre-mapped UUIDs for instant wall mirroring.
3. **[`NewsPrompts/UniversalWebNewsCollectionPrompt.md`](../NewsPrompts/UniversalWebNewsCollectionPrompt.md)** — Broad-spectrum Google and deep web search across all 50 states, 10 provinces, 100+ cities, and court dockets with dynamic politician profile lookup and tagging.

---

### The Complete Ingestion Flow

```
┌──────────────────────────────────────────────────┐
│ Discovery & Synthesis (NewsPrompts/ Directives)  │
│ - Wires (AP, Reuters, CP), Google Trends, Feeds  │
│ - 4-part structure, hard metrics, deep links     │
└─────────────────────────┬────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────┐
│ Ingestion Engine (`scripts/insert-news-batch.js`)│
│ - Deduplication against 1000 recent stories      │
│ - Match via slug, source URL, or ≥70% tokens     │
└─────────────────────────┬────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────┐
│ Dual Supabase Synchronization RPCs               │
│ - admin_sync_news_article_tags()                 │
│ - admin_sync_news_article_boundaries()           │
└─────────────────────────┬────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────┐
│ Multi-Surface Live Display & Social CSV          │
│ - Politician Walls, Main News & Local Feeds      │
│ - batch-ranked-news.csv (Top 100 virality rank)  │
│ - scripts/overflow-news-batch.json (Archives)    │
└──────────────────────────────────────────────────┘
```

---

## Setup

### 1. Environment Variables

Add these to your `.env.local`:

```bash
# Grok API (get from X developer platform: https://developer.x.com/)
GROK_API_KEY=xai-your-actual-key-here

# Supabase (already in your .env.local)
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**How to get Grok API key:**
1. Go to https://developer.x.com/
2. Create/select a project
3. Get API key from Settings → API Keys & Tokens
4. Select "Grok" access tier

### 2. Verify TypeScript Support

The script is written in TypeScript. Make sure your project can run it:

```bash
npx ts-node --version
# Should output: v... (TypeScript ... )
```

If missing, install:
```bash
npm install --save-dev ts-node typescript
```

### 3. Get Politician's UUID

You'll need the Choseno `profiles.id` UUID. Get it from the database:

```sql
SELECT id, full_name, role FROM profiles 
WHERE role = 'politician' 
ORDER BY full_name;
```

Example output:
```
id                                   | full_name        | role
550e8400-e29b-41d4-a716-446655440000 | Brenda Locke     | politician
```

---

## Usage

### Basic Usage — Dry Run (Recommended First!)

```bash
npx ts-node scripts/generate-news-for-politician.ts \
  --politician-id "550e8400-e29b-41d4-a716-446655440000" \
  --politician-name "Brenda Locke" \
  --dry-run
```

**What happens:**
- Fetches news from Grok about "Brenda Locke"
- Generates JSON batch
- Validates all articles
- Shows what WOULD be inserted
- **No database changes**

**Output example:**
```
======================================================================
📰 NEWS GENERATION FOR: Brenda Locke
======================================================================
Politician ID: 550e8400-e29b-41d4-a716-446655440000
Status: draft
Dry Run: YES (no DB changes)
Article Limit: 10

🔍 Fetching news about Brenda Locke...
✅ Grok returned 4567 characters

📋 Parsing JSON...
✅ Parsed 7 articles from JSON

🔐 Validating batch (STRICT mode)...
✅ All 7 articles valid

💾 DRY RUN — Inserting articles...
  ✓ [DRY] Would insert: brenda-locke-surrey-council-2026
  ✓ [DRY] Would insert: mayor-brenda-locke-budget-2026
  ...

======================================================================
📊 SUMMARY
======================================================================
✅ Created: 7
✅ Dry run complete (no changes)

👉 Review the output above, then run WITHOUT --dry-run to insert
```

### Live Insertion — Create Draft Articles

Once you're satisfied with the dry run, insert as **drafts** (for review):

```bash
npx ts-node scripts/generate-news-for-politician.ts \
  --politician-id "550e8400-e29b-41d4-a716-446655440000" \
  --politician-name "Brenda Locke" \
  --status draft
```

**What happens:**
- Same as dry run, but **actually inserts** into DB
- Articles created with `status: "draft"`
- Politician tags added automatically
- RPC syncs to politician's wall (but as drafts, not visible to public yet)

**Next step:** Review articles in `/admin/news`, edit if needed, then publish

### Live Insertion — Publish Immediately

⚠️ **Caution:** Articles go live immediately to the politician's wall.

```bash
npx ts-node scripts/generate-news-for-politician.ts \
  --politician-id "550e8400-e29b-41d4-a716-446655440000" \
  --politician-name "Brenda Locke" \
  --status published
```

### Limit Number of Articles

By default, generates up to 10. To generate fewer:

```bash
npx ts-node scripts/generate-news-for-politician.ts \
  --politician-id "550e8400-e29b-41d4-a716-446655440000" \
  --politician-name "Brenda Locke" \
  --limit 3
```

---

## Validation Pipeline — How It Works

### 1. JSON Parsing (Strict)

**File:** `src/lib/utils/grokNewsGeneration.ts` → `parseGrokJsonResponse()`

✅ Accepts:
```json
{
  "batch": [
    { "slug": "...", "headline": "...", ... }
  ]
}
```

❌ Rejects:
- Markdown code blocks (`\`\`\`json ... \`\`\``)
- Multiple root objects
- Invalid JSON syntax
- Empty arrays (`[]`)

### 2. Article-Level Validation

**File:** `src/lib/utils/newsValidation.ts` → `validateNewsArticleJson()`

Checks per article:

| Field | Rule |
|-------|------|
| `slug` | Required, lowercase, hyphens only |
| `headline` | Required, 60-80 characters |
| `summary` | Required, 100-150 characters |
| `category` | Must be exactly one of: General, Engineering, Policy, etc. |
| `status` | Must be one of: draft, scheduled, published, archived |
| `impactArea` | Must be one of: local, state, country, international |
| `published_at` | ISO 8601 format with timezone |
| `event_date` | ISO 8601 format with timezone |
| `taggedPoliticianIds` | Array of valid UUIDs |
| `taggedPoliticians` | Array of full names |
| `body` | Required, Markdown formatted |
| `sources` | Array of `{ label, url }` objects |
| `tweet` | Highly recommended, 140-200 chars plain text (no emojis, URLs, or hashtags) |
| `latitude/longitude` | Both required if impactArea="local", valid range |

### 3. Grok-Specific Validation

**File:** `src/lib/utils/grokNewsGeneration.ts` → `validateGrokBatchOutput()`

**Additional checks:**
- ✅ `taggedPoliticianIds` **MUST** include politician's UUID
- ✅ `taggedPoliticians` **MUST** include politician's name
- ✅ All required fields present
- ⚠️ Warnings for missing optional fields (but doesn't fail)

### 4. Report

```
❌ FAILED ARTICLES:
──────────────────────────────────────────────────
Article 3 ("Mayor Budget Cuts"):
  • "category" is "Finance" — must be one of: General, Engineering, ...
  • taggedPoliticianIds must include "550e8400-..." (got: [])

⚠️  WARNINGS (non-blocking):
──────────────────────────────────────────────────
  • Article 1: "impactArea" is "local" but no latitude/longitude given
  • Article 5: "hero_image_url" is set but "heroImageAlt" is missing
```

---

## How Articles Appear on Politician's Wall

### The Database Flow

```
┌─────────────────────────────────────────────────────┐
│ You call: createNewsArticle()                       │
│ Inserts row in: news_articles table                 │
│   - id (UUID, auto)                                │
│   - headline, body, etc.                           │
│   - taggedPoliticianIds NOT stored (it's JSON in)  │
│   - BUT passed to next step                        │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│ You call: syncNewsArticlePoliticianTags()           │
│ Calls RPC: admin_sync_news_article_tags()           │
│ Params:                                             │
│   - p_article_id = article's UUID                  │
│   - p_politician_ids = ["550e8400-..."]            │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│ RPC in Postgres:                                    │
│ 1. Inserts into news_article_politicians table:    │
│    (news_article_id, politician_id)                │
│ 2. Creates mirror row in posts table:              │
│    - wall_ghost_id = politician's current ghost_id │
│    - ghost_id = sentinel news-author ID            │
│ 3. If article is "published", post is visible      │
│ 4. If article is "draft", post is NOT visible      │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│ Frontend (getWallPosts query):                      │
│ Fetches posts where:                               │
│   wall_ghost_id = politician's ghost_id            │
│ Returns PostCard components (same as politician's  │
│ own posts, comments, etc.)                         │
└─────────────────────────────────────────────────────┘
```

### Key Points

- **The RPC is automatic** — you don't need to manually create posts
- **Draft articles are invisible** until you publish them
- **Published articles are live immediately** on their wall
- **Wall posts are read-only** — generated by system, not editable by politician

---

## Troubleshooting

### "Missing GROK_API_KEY"

**Problem:** Environment variable not set.

**Fix:**
```bash
# Add to .env.local
GROK_API_KEY=xai-your-key

# Then restart your script
```

### "Grok API error 401"

**Problem:** Invalid or expired API key.

**Fix:**
1. Go to https://developer.x.com/
2. Re-verify your API key
3. Copy fresh key to `.env.local`
4. Try again

### "JSON parsing failed"

**Problem:** Grok didn't return valid JSON (returned markdown or text instead).

**Fix:**
1. Check the raw response printed in error
2. Your prompt might be unclear — try a simpler query
3. Try again (Grok may be flaky sometimes)

### "Validation failed: taggedPoliticianIds must include..."

**Problem:** Grok didn't include the politician's UUID in the articles.

**Analysis:**
- This means the prompt wasn't clear enough to Grok
- Or Grok generated articles about a different person

**Fix:**
1. Verify the UUID is correct
2. Try a simpler politician name (unique, unambiguous)
3. Run with `--dry-run` to see the validation report

### "Validation failed: category is 'Finance' — must be one of..."

**Problem:** Grok used a category not in the allowed enum.

**Allowed categories:**
```
General, Engineering, Privacy, Product Update, Policy,
Elections, Local, National, International, Opinion
```

**Fix:**
- Grok needs stricter instructions (check the prompt in `grokNewsGeneration.ts`)
- Or manually edit articles in `/admin/news` after review

### Articles inserted but not showing on wall

**Problem:** Articles are draft/not published, or tagging didn't sync.

**Check:**
1. Go to `/admin/news`
2. Find the article by headline
3. Check: Is `status = "draft"` or `"published"`?
4. If draft, the wall post exists but is invisible until published
5. If published, check the politician's wall: `/politician/[slug]/wall`

**If still missing:**
```sql
SELECT * FROM news_article_politicians 
WHERE news_article_id = 'article-uuid';
```

If empty, the sync failed. You can manually tag in `/admin/news` UI.

---

## For Multiple Politicians

To run for several politicians at once, create a simple bash script:

**`scripts/generate-news-batch.sh`:**
```bash
#!/bin/bash

POLITICIANS=(
  "550e8400-e29b-41d4-a716-446655440000:Brenda Locke"
  "550e8400-e29b-41d4-a716-446655440001:John Smith"
  "550e8400-e29b-41d4-a716-446655440002:Jane Doe"
)

for ENTRY in "${POLITICIANS[@]}"; do
  ID="${ENTRY%:*}"
  NAME="${ENTRY#*:}"
  
  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "Processing: $NAME"
  echo "═══════════════════════════════════════════════════"
  
  npx ts-node scripts/generate-news-for-politician.ts \
    --politician-id "$ID" \
    --politician-name "$NAME" \
    --status draft \
    --limit 5
  
  # Rate limit to avoid API throttling
  sleep 5
done

echo ""
echo "✅ All politicians processed!"
echo "📋 Review articles at: /admin/news"
```

Run it:
```bash
chmod +x scripts/generate-news-batch.sh
./scripts/generate-news-batch.sh
```

---

## Advanced Options

### Customize Grok Model

Edit `scripts/generate-news-for-politician.ts`, line ~120:

```typescript
// Change this:
model: "grok-2",

// To newer model when available:
model: "grok-3", // or whatever the latest is
```

### Adjust Validation Strictness

Edit `src/lib/utils/grokNewsGeneration.ts` → `validateGrokBatchOutput()` to:
- Skip certain validations (not recommended)
- Add new checks (recommended for your use case)
- Change error messages

### Modify the Prompt

Edit `src/lib/utils/grokNewsGeneration.ts` → `getGrokBatchNewsPrompt()` to:
- Add specific geography/context
- Request different article styles
- Enforce different field constraints

---

## Best Practices

### ✅ DO

- [ ] Always run `--dry-run` first
- [ ] Review articles in `/admin/news` before publishing
- [ ] Start with `--limit 3` to test
- [ ] Use `--status draft` initially
- [ ] Check validation report for warnings
- [ ] Verify articles appear on politician's wall
- [ ] Run batches during off-peak hours (avoid API rate limits)

### ❌ DON'T

- [ ] Skip dry-run and go straight to `--status published`
- [ ] Ignore validation warnings
- [ ] Run multiple scripts simultaneously (Grok rate limits)
- [ ] Manually edit `taggedPoliticianIds` after insertion (RPC owns this)
- [ ] Delete news_article_politicians rows manually (breaks wall syncing)

---

## Support

If articles don't appear on the wall:

1. Check `/admin/news` → Find article → Verify status
2. Check `/politician/[slug]/wall` → Scroll to news section
3. Run this SQL:
   ```sql
   SELECT n.id, n.headline, n.status, nap.politician_id, p.full_name
   FROM news_articles n
   LEFT JOIN news_article_politicians nap ON n.id = nap.news_article_id
   LEFT JOIN profiles p ON nap.politician_id = p.id
   WHERE n.headline LIKE '%keyword%'
   ORDER BY n.created_at DESC;
   ```
4. If politician_id is NULL, tags didn't sync — manually add in admin UI

---

## Next Steps

1. **Set up GROK_API_KEY** in `.env.local`
2. **Get a politician's UUID** from the database
3. **Run a dry run** to test the flow
4. **Review the validation output**
5. **Run live** (with `--status draft`) to insert
6. **Publish articles** via `/admin/news`
7. **Verify** they appear on politician's wall

You're ready to go! 🚀
