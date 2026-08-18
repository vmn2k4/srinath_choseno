# API Caching Strategy

In-memory and Supabase query caching to reduce database load and improve response times.

> **This doc covers client-side/in-memory caching only.** A second, separate caching layer was added 2026-08-18: Next.js server-side route caching (`export const revalidate` + `createPublicClient()`), which is what actually stops a repeat page view from hitting Supabase at all — see [CHOSENO_ARCHITECTURE_GUIDE.md §13.6](CHOSENO_ARCHITECTURE_GUIDE.md#136-publicanonymous-supabase-client-for-cacheable-routes). The two are complementary, not overlapping: the route cache serves the same rendered page to every visitor for a window; the in-memory cache below is per-browser-session and mostly useful for repeat interactions within one visit.

---

## Overview

Choseno uses **two-tier caching**:
1. **Client-side in-memory cache** (React hook, page lifetime)
2. **Supabase row-level caching** (via RLS + materialized views)

Most queries that benefit from caching return: `{ data, cache_hit, cache_age_ms }`.

---

## In-Memory Cache (`apiCache.ts`)

### Pattern

```ts
// src/lib/utils/apiCache.ts
const cache = new Map<string, CacheEntry>();

export function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 60000 // 1 minute default
): Promise<T> {
  if (cache.has(key)) {
    const entry = cache.get(key);
    if (Date.now() - entry.timestamp < ttl) {
      return Promise.resolve(entry.value);
    }
  }

  return fetcher().then(value => {
    cache.set(key, { value, timestamp: Date.now() });
    return value;
  });
}
```

### Usage

```ts
// Fetch elections for a boundary; cache for 5 minutes
const getElectionsForBoundary = (boundaryId: string) =>
  withCache(
    `elections_${boundaryId}`,
    () => supabase.from('elections').select('*').eq('boundary_id', boundaryId),
    5 * 60 * 1000
  );
```

### TTL Guidelines

| Query | Data Volatility | TTL |
|---|---|---|
| Elections (open seats, candidates) | Changes daily at most | 5–30 min |
| Boundaries (map shapes, names) | Static until redistricting | 1 hour |
| Politician info (ratings, bio) | Updated hourly by scripts/admins | 5–10 min |
| News articles | Updated on publish (rare) | 30 min |
| User profile (own account) | Changed by user action | 0 (no cache) |
| Civic Impact Score | Recalculated on demand | 1 min |

### Cache Invalidation

**Manual invalidation** (after mutations):
```ts
export function invalidateCache(pattern?: string) {
  if (!pattern) {
    cache.clear(); // Clear everything
  } else {
    // Clear all keys matching pattern
    Array.from(cache.keys()).forEach(key => {
      if (key.includes(pattern)) cache.delete(key);
    });
  }
}
```

**Usage after creating a post**:
```ts
await createPost(...);
invalidateCache('feed_');  // Clear all feed caches
```

---

## Database-Level Caching (Materialized Views)

### Current Materialized Views

1. **`politician_engagement_summaries`**
   - **Refresh trigger**: On insert/update to `politician_ratings`
   - **TTL**: Immediate (refreshed per mutation)
   - **Fields**: avg_rating, support_count, disapprove_count, rating_change_week
   - **Use case**: Politician wall engagement stats dashboard

2. **`shape_containers`** (admin-only)
   - **Refresh trigger**: On insert/update/delete to `map_shapes`
   - **Cache**: Lists which boundary type can be a "container" for seat-building
   - **Use case**: Election admin UI (pre-computed container eligibility)

### Adding a Materialized View

When a query is slow or runs frequently:

```sql
-- Create the view
CREATE MATERIALIZED VIEW expensive_query_mv AS
SELECT politician_id, AVG(rating) as avg_rating, COUNT(*) as rating_count
FROM politician_ratings
GROUP BY politician_id;

-- Create an index for fast lookups
CREATE UNIQUE INDEX mv_idx_politician ON expensive_query_mv(politician_id);

-- Create a trigger to refresh on data changes
CREATE TRIGGER refresh_expensive_query_mv
AFTER INSERT OR UPDATE OR DELETE ON politician_ratings
EXECUTE FUNCTION refresh_materialized_view('expensive_query_mv');

-- PL/pgSQL function to refresh
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name text)
RETURNS void AS $$
BEGIN
  EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY ' || quote_ident(view_name);
END;
$$ LANGUAGE plpgsql;
```

---

## Cache Scenarios by Feature

### Elections & Candidacies

**Queries cached**:
- `getActiveElectionsForUser(userId)` — 10 min TTL
- `getElectionSeats(electionId)` — 30 min TTL
- `getCandidates(seatId)` — 5 min TTL (candidates join/withdraw frequently)

**Invalidation trigger**:
- Create election: clear `elections_` cache
- Nominate candidate: clear `seat_candidates_` cache for that seat

### Feed Posts

**Queries cached**:
- `getPostsForBoundary(boundaryId)` — 2 min TTL (high update rate)
- `getCommentsForPost(postId)` — 1 min TTL (users reply constantly)

**Invalidation**:
- Create post: clear `feed_` cache
- Post comment: clear `post_comments_<postId>` cache

**Why low TTL?**: Feed is the most interactive feature; stale posts are jarring.

### Politician Info

**Queries cached**:
- `getPoliticianProfile(id)` — 10 min TTL
- `getEngagementSummary(politicianId)` — 5 min TTL (ratings update)

**Why separate TTL?**: Profile changes rarely; ratings update frequently.

### News

**Queries cached**:
- `getNewsArticles(filters)` — 30 min TTL
- `getArticleBySlug(slug)` — 1 hour TTL

**Why high TTL?**: News is editorial; changes are deliberate, not frequent.

---

## Polling & Real-Time Updates

### Polling (Periodic refresh)

For slow-changing data, use polling instead of subscriptions:

```tsx
const [data, setData] = useState(null);

useEffect(() => {
  const poll = setInterval(async () => {
    const fresh = await getElectionsForBoundary(boundaryId);
    setData(fresh);
  }, 30000); // Poll every 30 seconds

  return () => clearInterval(poll);
}, [boundaryId]);
```

### Subscriptions (Real-time)

For fast-changing data (posts, comments), use Postgres `LISTEN`:

```ts
const subscription = supabase
  .from('posts')
  .on('*', (payload) => {
    // Handle insert/update/delete
    invalidateCache('feed_');
    refetch();
  })
  .subscribe();

return () => subscription.unsubscribe();
```

---

## Performance Monitoring

### Metrics to Track

| Metric | Target | Why |
|---|---|---|
| Cache hit rate | > 80% | Indicates good cache sizing |
| Average query time (cached) | < 50ms | Acceptable for UI updates |
| Average query time (uncached) | < 500ms | Database latency + Supabase auth |
| Cache memory usage | < 50MB | Prevent OOM on client |

### Debug Output

Enable cache logging:

```ts
const CACHE_DEBUG = process.env.NEXT_PUBLIC_CACHE_DEBUG === 'true';

export function withCache<T>(key: string, fetcher, ttl) {
  if (cache.has(key)) {
    const entry = cache.get(key);
    if (Date.now() - entry.timestamp < ttl) {
      if (CACHE_DEBUG) console.log(`✓ Cache hit: ${key}`);
      return Promise.resolve(entry.value);
    }
  }

  if (CACHE_DEBUG) console.log(`✗ Cache miss: ${key}`);
  return fetcher().then(...);
}
```

Set `NEXT_PUBLIC_CACHE_DEBUG=true` in `.env.local` to see cache activity.

---

## Related Files

- **Cache utility**: [`src/lib/utils/apiCache.ts`](../src/lib/utils/apiCache.ts)
- **Service functions** (see each service file for `withCache` usage):
  - [`src/lib/services/elections.ts`](../src/lib/services/elections.ts)
  - [`src/lib/services/feed.ts`](../src/lib/services/feed.ts)
  - [`src/lib/services/politicianWall.ts`](../src/lib/services/politicianWall.ts)

---

## Future Enhancements

- [ ] **Persistent cache**: LocalStorage backup for offline-first mobile (PWA)
- [ ] **Smart invalidation**: Track query dependencies to auto-invalidate related caches
- [ ] **Stale-while-revalidate**: Serve stale data while fetching fresh in background
- [ ] **Cache analytics**: Dashboard showing hit/miss rates per query
- [ ] **Distributed caching**: Redis cache layer for production scaling
