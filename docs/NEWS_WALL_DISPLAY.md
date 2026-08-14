# How News Articles Display on Politician's Wall

## The End Result: What Users See

When you generate and publish a news article about a politician using this system, it appears on their wall **exactly like this**:

### View: `/politician/brenda-locke/wall`

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        Brenda Locke - Mayor of Surrey                       ║
║                                  WALL                                        ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  📰 RECENT NEWS                                                              ║
║  ──────────────────────────────────────────────────────────────────────────  ║
║                                                                              ║
║  ┌──────────────────────────────────────────────────────────────────────┐   ║
║  │                                                                      │   ║
║  │ 🔗 Mayor Brenda Locke announces $50M municipal budget               │   ║
║  │                                                                      │   ║
║  │ Surrey's mayor unveils largest budget increase in 5 years for       │   ║
║  │ transit and community services                                      │   ║
║  │                                                                      │   ║
║  │ Published 2 hours ago • Local • August 14, 2026                      │   ║
║  │                                                                      │   ║
║  │ Sources: Surrey City Council Press Release, CBC News                │   ║
║  │                                                                      │   ║
║  │ [Read Full Article]  [💬 Comment]  [↗️  Share]                      │   ║
║  │                                                                      │   ║
║  └──────────────────────────────────────────────────────────────────────┘   ║
║                                                                              ║
║  ┌──────────────────────────────────────────────────────────────────────┐   ║
║  │                                                                      │   ║
║  │ 🔗 Budget Vote Set for August 21                                    │   ║
║  │                                                                      │   ║
║  │ City council to decide on $50 million allocation across transit,    │   ║
║  │ community programs, and parks                                       │   ║
║  │                                                                      │   ║
║  │ Published 2 hours ago • Local • August 14, 2026                      │   ║
║  │                                                                      │   ║
║  │ Sources: Surrey City Council, Surrey Gazette                        │   ║
║  │                                                                      │   ║
║  │ [Read Full Article]  [💬 Comment]  [↗️  Share]                      │   ║
║  │                                                                      │   ║
║  └──────────────────────────────────────────────────────────────────────┘   ║
║                                                                              ║
║  ┌──────────────────────────────────────────────────────────────────────┐   ║
║  │  💬 Jane Resident                                                    │   ║
║  │  "This is great news for our community!"                             │   ║
║  │  1 hour ago                                                          │   ║
║  │                                                                      │   ║
║  └──────────────────────────────────────────────────────────────────────┘   ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Data Flow: From JSON to Wall

### Step-by-Step Process

```
1. GENERATE (Your Script)
   ├─ Grok fetches news about "Brenda Locke"
   └─ Generates JSON with article content

2. VALIDATE (Strict)
   ├─ Check: taggedPoliticianIds = ["550e8400-..."]
   ├─ Check: taggedPoliticians = ["Brenda Locke"]
   ├─ Check: All required fields present
   └─ ✅ PASS or ❌ FAIL (no partial inserts)

3. INSERT (Database)
   ├─ createNewsArticle() → inserts to news_articles table
   │  ├─ id: "550e8400-..." (auto UUID)
   │  ├─ headline: "Mayor Brenda Locke announces $50M..."
   │  ├─ body: "SURREY, B.C. — Mayor announced..."
   │  ├─ status: "draft" or "published"
   │  └─ published_at: "2026-08-14T14:00:00Z"
   │
   └─ syncNewsArticlePoliticianTags() → calls RPC

4. SYNC (RPC - admin_sync_news_article_tags)
   ├─ Input: article_id, politician_ids = ["550e8400-..."]
   ├─ Creates row in news_article_politicians
   │  ├─ news_article_id: "550e8400-..."
   │  └─ politician_id: "550e8400-..."
   │
   ├─ Creates mirror row in posts table (if published)
   │  ├─ id: "550e8500-..." (auto)
   │  ├─ wall_ghost_id: "550e8400-..." (Brenda's ghost_id)
   │  ├─ ghost_id: "00000000-0000-0000-0000-000000000001" (sentinel)
   │  ├─ content: News article headline + summary
   │  ├─ status: "published"
   │  └─ news_article_id: "550e8400-..."
   │
   └─ ✅ Post created and visible

5. DISPLAY (Frontend)
   ├─ getWallPosts() query fetches posts where:
   │  └─ wall_ghost_id = "550e8400-..." (Brenda's ID)
   │
   ├─ Renders PostCard component
   │  ├─ Shows headline
   │  ├─ Shows summary
   │  ├─ Shows "Published X hours ago"
   │  ├─ Shows impact area badge ("Local")
   │  └─ Allows comments
   │
   └─ ✅ Visible on politician's wall
```

---

## Database Schema: The Connections

### Tables Involved

```
┌─────────────────────────────────────────┐
│ profiles                                │
├─────────────────────────────────────────┤
│ id (UUID) ← "550e8400-..."              │
│ full_name: "Brenda Locke"               │
│ role: "politician"                      │
│ current_ghost_id: (for wall posts)      │
└─────────────────────────────────────────┘
         ↑
         │ politician_id
         │
┌─────────────────────────────────────────┐
│ news_article_politicians                │  ← Links article to politician
├─────────────────────────────────────────┤
│ news_article_id: "550e8600-..."         │
│ politician_id: "550e8400-..."           │
│ created_at: "2026-08-14T..."            │
└─────────────────────────────────────────┘
         ↑
         │ news_article_id
         │
┌─────────────────────────────────────────┐
│ news_articles                           │  ← The article content
├─────────────────────────────────────────┤
│ id: "550e8600-..."                      │
│ headline: "Mayor announces $50M..."     │
│ body: "SURREY, B.C. — ..."              │
│ summary: "Surrey's mayor unveils..."    │
│ status: "published"                     │
│ published_at: "2026-08-14T14:00:00Z"    │
│ event_date: "2026-08-14T10:30:00Z"      │
│ impact_area: "local"                    │
│ latitude: 49.0504                       │
│ longitude: -122.3045                    │
│ country: "CA"                           │
│ province: "BC"                          │
│ category: "Local"                       │
└─────────────────────────────────────────┘
         ↑
         │ news_article_id (mirrored post)
         │
┌─────────────────────────────────────────┐
│ posts                                   │  ← Wall post (auto-created by RPC)
├─────────────────────────────────────────┤
│ id: "550e8700-..."                      │
│ wall_ghost_id: "550e8400-..." ← Points │
│                                   to     │
│ ghost_id: "00000000-0000-0000-0000-..." │  Brenda's wall
│ content: "Mayor announces $50M..."      │
│ news_article_id: "550e8600-..."         │
│ status: "published"                     │
│ created_at: "2026-08-14T14:00:00Z"      │
└─────────────────────────────────────────┘
         ↓
   Rendered by getWallPosts()
         ↓
   Appears on Brenda's wall
```

---

## Status States and Visibility

### Draft Articles

```
Database:
├─ news_articles.status = "draft"
├─ posts row created BUT status = "draft" (hidden)
└─ news_article_politicians = tagged

Display:
├─ NOT visible on politician's wall
├─ NOT visible to public
├─ Admin can see in /admin/news
└─ Admin can edit or publish

Use case: Review before publishing
```

### Published Articles

```
Database:
├─ news_articles.status = "published"
├─ posts row created AND status = "published" (visible)
└─ news_article_politicians = tagged

Display:
├─ ✅ VISIBLE on politician's wall
├─ ✅ VISIBLE in their wall feed
├─ ✅ Users can comment
├─ ✅ Users can share
└─ Admin can still edit in /admin/news

Use case: Live content on politician's wall
```

### Scheduled Articles

```
Database:
├─ news_articles.status = "scheduled"
├─ news_articles.published_at = "2026-08-21T10:00:00Z"
├─ posts row in DB but hidden (status != "published")
└─ news_article_politicians = tagged

Display:
├─ NOT visible until published_at time arrives
├─ Frontend check: if (now >= published_at) then show
├─ On-time auto-publishing via cron/scheduled jobs
└─ Admin can see countdown in /admin/news

Use case: Schedule announcements for specific time
```

### Archived Articles

```
Database:
├─ news_articles.status = "archived"
├─ posts row status = archived (hidden)
└─ news_article_politicians = tagged

Display:
├─ NOT visible on wall
├─ Kept in database for history
├─ Can be republished by changing status
└─ Admin can search historical articles

Use case: Hide old/outdated articles without deleting
```

---

## What Admins See vs. What Users See

### Admin View: `/admin/news`

```
📋 All News Articles (Draft, Scheduled, Published, Archived)

Article                                 Status      Impact   Created
────────────────────────────────────────────────────────────────────
Mayor announces $50M budget             published   local    2 hrs ago
Budget Vote Set for August 21           published   local    2 hrs ago
Brenda Locke's New Initiative            draft      state    1 hr ago
Future Announcement                      scheduled  country  2 hrs ago
Old press release                        archived   -        1 week ago

Actions available:
├─ Edit all fields
├─ Change status (draft → published)
├─ View wall sync status
├─ Delete
└─ View full article
```

### Politician's Wall: `/politician/brenda-locke/wall`

```
📰 RECENT NEWS (Published only)

✓ Mayor announces $50M budget              2 hrs ago
✓ Budget Vote Set for August 21            2 hrs ago
✗ Brenda Locke's New Initiative (hidden — draft)
✗ Future Announcement (hidden — scheduled)
✗ Old press release (hidden — archived)

Users can:
├─ Read full article
├─ Comment
├─ Share
└─ Reply to comments
```

### Public Wall View (Non-Logged-In)

```
Same as politician's wall, but:
├─ Cannot comment (must be logged in)
├─ Can view article and sources
├─ Can share
└─ Read-only
```

---

## Common Questions

### Q: I published an article but it's not showing on the wall

**Check:**
1. `/admin/news` → Find article → Is `status = "published"`?
2. If status is draft → go to article → click "Publish"
3. If status is published:
   ```sql
   SELECT n.id, n.headline, nap.politician_id
   FROM news_articles n
   LEFT JOIN news_article_politicians nap ON n.id = nap.news_article_id
   WHERE n.headline LIKE '%your headline%';
   ```
   - If `politician_id` is NULL → article not tagged (sync failed)
   - Re-tag manually in admin UI or re-run script

### Q: Can the politician edit the news article?

**No.** News articles are:
- Created by admin/system only
- Read-only for the politician
- Mirrored to their wall as a post (which they also can't delete)

The wall post is tied to the news article, not a regular post they authored.

### Q: If I delete a news article, does it disappear from the wall?

**Yes.** When you delete a news_articles row:
1. ON DELETE CASCADE removes the news_article_politicians link
2. ON DELETE CASCADE removes the mirrored posts row
3. Wall post disappears immediately

### Q: Can I publish an article without a politician tag?

**Yes, but it won't show on any wall:**
```json
{
  "headline": "General news about Surrey",
  "taggedPoliticians": [],
  "taggedPoliticianIds": []
}
```
- Article is visible in public feed (if impactArea="country")
- But doesn't appear on any specific politician's wall

### Q: How do multiple politicians get tagged to one article?

```json
{
  "headline": "Surrey Council approves new bylaw",
  "taggedPoliticianIds": [
    "550e8400-e29b-41d4-a716-446655440000",  // Brenda Locke
    "550e8400-e29b-41d4-a716-446655440001"   // John Smith
  ],
  "taggedPoliticians": ["Brenda Locke", "John Smith"]
}
```

**Result:**
- Article appears on Brenda's wall
- Article appears on John's wall
- One news article, multiple wall appearances

---

## Testing the Flow

### 1. Generate with Dry-Run (See what would happen)

```bash
npx ts-node scripts/generate-news-for-politician.ts \
  --politician-id "550e8400-e29b-41d4-a716-446655440000" \
  --politician-name "Brenda Locke" \
  --dry-run
```

### 2. Generate as Draft (Review first)

```bash
npx ts-node scripts/generate-news-for-politician.ts \
  --politician-id "550e8400-e29b-41d4-a716-446655440000" \
  --politician-name "Brenda Locke" \
  --status draft
```

### 3. Go to Admin and Verify

- Open `/admin/news`
- Find "Brenda Locke" articles
- Check `status = "draft"`
- Verify headline, body, politician tags

### 4. Publish One Article

- Click article
- Click "Publish" button
- Confirm

### 5. Check the Wall

- Visit `/politician/brenda-locke/wall`
- Article should appear at top
- Try clicking it, commenting, sharing

### 6. Verify in Database

```sql
SELECT 
  n.headline, 
  n.status, 
  p.full_name,
  (SELECT COUNT(*) FROM posts WHERE wall_ghost_id = p.id AND news_article_id = n.id) as posts_count
FROM news_articles n
LEFT JOIN news_article_politicians nap ON n.id = nap.news_article_id
LEFT JOIN profiles p ON nap.politician_id = p.id
WHERE p.full_name = 'Brenda Locke'
ORDER BY n.created_at DESC
LIMIT 5;
```

Expected output:
```
headline                                 | status    | full_name     | posts_count
────────────────────────────────────────────────────────────────────────────────
Mayor announces $50M budget              | published | Brenda Locke  | 1
Budget Vote Set for August 21            | published | Brenda Locke  | 1
Brenda Locke's New Initiative            | draft     | Brenda Locke  | 0
```

---

## Summary

```
YOU GENERATE ARTICLE
     ↓
VALIDATES STRICTLY
     ↓
INSERTS TO DB
     ↓
RPC TAGS POLITICIAN
     ↓
POSTS ROW CREATED
     ↓
APPEARS ON POLITICIAN'S WALL
     ↓
USERS CAN COMMENT & SHARE
```

Done! 🎉
