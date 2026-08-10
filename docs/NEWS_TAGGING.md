# News Article Tagging System

Editorial content can be tagged with politicians and parties to link news to elected officials, enable targeted feeds, and surface relevant articles on politician walls.

---

## Overview

News articles in `/news` can be associated with:
- **Specific politicians** (e.g., "Doug Ford announces housing plan" → tagged to Doug Ford + Ontario articles)
- **Political parties** (e.g., "Liberal leadership race heats up")
- **Jurisdictions** (country/province/municipality, already exists)

These tags populate:
- The article's own **related politicians/parties** sidebar
- A politician's wall feed (tagged articles surface alongside user posts)
- Admin news editor (tag picker)

---

## Schema

### `news_articles` Changes
New optional fields (all nullable):
- `featured_politician_id` (uuid, FK → `politician_profiles`) — primary politician if one is most relevant
- `featured_party_id` (uuid, FK → `political_parties`)

### Junction Table: `news_article_politicians`
- `article_id` (uuid, FK → `news_articles`)
- `politician_id` (uuid, FK → `politician_profiles`)
- `tagged_at` (timestamp)
- **PK**: `(article_id, politician_id)`

### Junction Table: `news_article_parties`
- `article_id` (uuid, FK → `news_articles`)
- `party_id` (uuid, FK → `political_parties`)
- `tagged_at` (timestamp)
- **PK**: `(article_id, party_id)`

---

## Admin Workflow

### News Editor (`/admin/news`)

When creating/editing an article:

1. **After slug/headline**: New **"Link to Politicians"** panel
   - Search box: "Find a politician..." → type-ahead filtered by country/boundary
   - Shows: `[Portrait] Full Name | Boundary (Role)` per match
   - Click to add; tagged politician appears as a chip
   - Hover chip → ✕ to remove

2. **"Link to Party"** dropdown (optional)
   - Pre-filtered to parties in the article's country scoping
   - Single-select (not multi)

3. **"Featured Politician"** radio (if any politicians tagged)
   - Picks which one appears first/most prominent on article view
   - Defaults to first tagged

Tagging is immediate (no separate "save" button beyond article publish).

---

## Display

### Article View (`/news/[slug]`)

**Below article body, before comments:**

```
Related to:
[Portrait] Doug Ford | Premier of Ontario    [Portrait] David Eby | Premier of BC
Liberal Party
```

- Clicking a politician name → that politician's wall
- Party name is plain text (or faded link to a future "party page" if one exists)
- If no tags, section is omitted entirely

### Politician Wall (`/wall/:ghostId/[slug]`)

**In the politician's feed**, articles tagged to them appear as:
```
[News badge] Headline
Category | Published date | Source (Choseno Editorial)
Summary excerpt (first 100 chars)
```

Clicking opens `/news/[slug]` like any article link.

---

## Queries

### Service Function: `getNewsForPolitician()`

```ts
// src/lib/services/news.ts
export async function getNewsForPolitician(
  supabase: Client,
  politicianProfileId: string,
  options?: { limit?: number; offset?: number }
) {
  return supabase
    .from('news_articles')
    .select(`
      id, headline, slug, published_at, category, hero_image_url,
      news_article_politicians!inner(politician_id)
    `)
    .eq('news_article_politicians.politician_id', politicianProfileId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(offset || 0, (offset || 0) + (limit || 10));
}
```

### Article With All Tags

```ts
export async function getArticleWithTags(supabase: Client, slug: string) {
  const { data } = await supabase
    .from('news_articles')
    .select(`
      *,
      featured_politician:politician_profiles(id, full_name, avatar_url),
      featured_party:political_parties(id, name, color),
      politicians:news_article_politicians(
        politician:politician_profiles(id, full_name, avatar_url, boundary_name)
      ),
      parties:news_article_parties(
        party:political_parties(id, name, color)
      )
    `)
    .eq('slug', slug)
    .single();
  
  return data;
}
```

---

## Admin Search & Filter

### Find Politicians to Tag

Uses **fuzzy search + boundary scoping**:
- Search text: `"doug"` → matches "Doug Ford", "Doug Schweitzer" (by first/last name)
- Country filter (auto-set from article's country): filters candidates
- Boundary type filter: optional (e.g., "Provincial only" to exclude mayors)

Implemented in `AdminNewsPageClient.tsx` via:
```ts
const matches = await supabase
  .rpc('search_profiles', {
    search_term: query,
    profile_country: articleCountry,
    profile_role: 'politician',
    limit: 20
  });
```

---

## Backward Compatibility

Existing articles have no tags:
- `featured_politician_id`, `featured_party_id` = NULL
- Junction tables have no rows for that article
- Article pages render without the "Related to" section
- Politician walls don't show untagged articles

**Gradual tagging**: Admins can go back and tag existing articles anytime (e.g., "tag all articles mentioning this politician" as a future feature).

---

## Related Files

- **Migration**: [`supabase/migrations/20260809000002_news_politician_party_tagging.sql`](../supabase/migrations/20260809000002_news_politician_party_tagging.sql)
- **Admin Component**: [`src/components/features/AdminNewsPageClient.tsx`](../src/components/features/AdminNewsPageClient.tsx)
- **News Service**: [`src/lib/services/news.ts`](../src/lib/services/news.ts)
- **Politician Wall**: [`src/components/features/PoliticianWallClient.tsx`](../src/components/features/PoliticianWallClient.tsx)

---

## Future Features

- [ ] Auto-tag articles based on named-entity recognition (NER) of politician names
- [ ] Bulk tag: select multiple articles, add tags in one action
- [ ] Tag trending: "Most-tagged politicians this month" dashboard
- [ ] Politician feeds show tagged articles in a separate tab ("News Mentioning Me")
- [ ] Search news by politician/party (e.g., `/news?politician=doug-ford`)
