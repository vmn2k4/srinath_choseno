# API Caching Strategy

In-memory and Supabase query caching to reduce database load and improve response times.

> **This doc covers client-side/in-memory caching only.** A second, separate caching layer was added 2026-08-18: Next.js server-side route caching (`export const revalidate` + `createPublicClient()`), which is what actually stops a repeat page view from hitting Supabase at all — see [CHOSENO_ARCHITECTURE_GUIDE.md §13.6](CHOSENO_ARCHITECTURE_GUIDE.md#136-publicanonymous-supabase-client-for-cacheable-routes). The two are complementary, not overlapping: the route cache serves the same rendered page to every visitor for a window; the in-memory cache below is per-browser-session and mostly useful for repeat interactions within one visit.
>
> A third, and usually larger, lever is **not caching but RLS query cost** — an unwrapped `auth.uid()` in a policy's `USING`/`WITH CHECK` gets re-evaluated per row instead of once per query, which no amount of client-side caching fixes (the *first* load of anything is still slow, cache or no cache). See [CHOSENO_ARCHITECTURE_GUIDE.md §13.9](CHOSENO_ARCHITECTURE_GUIDE.md#139-rls-policies-must-wrap-authuidauthrole-in-select-).

---

## Overview

Choseno uses **two-tier caching**:
1. **Client-side in-memory cache** — module-scoped `Map`s in `apiCache.ts`, not a React hook; persists across client-side navigations for the whole browser tab session, cleared on a full page reload
2. **Supabase row-level caching** (via RLS + materialized views)

`fetchWithCache`-wrapped queries return the same `{ data, error }` shape as an un-cached Supabase call — there's no `cache_hit`/`cache_age_ms` field on the result (an earlier draft of this doc claimed there was; it doesn't exist). A cache hit is only observable externally — no network request for that key — not from the return value itself.

---

## In-Memory Cache (`apiCache.ts`)

### Pattern

The actual implementation in [`src/lib/utils/apiCache.ts`](../src/lib/utils/apiCache.ts) — `fetchWithCache`/`invalidateCache`, not the `withCache` shown in earlier drafts of this doc. It also dedupes concurrent in-flight requests for the same key (two components mounting at once and both asking for the same data only fires one query), which the simple sketch below leaves out:

```ts
// src/lib/utils/apiCache.ts (real signature)
type FetchResult<T> = { data: T | null; error: unknown };

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => PromiseLike<FetchResult<T>>,
  ttlMs = 5 * 60 * 1000 // 5 minutes default
): Promise<FetchResult<T>> { /* ... */ }

export function invalidateCache(keyOrPrefix?: string): void { /* ... */ }
```

Module-scoped state (`Map`s at file scope, not React state) — safe for genuinely global/public data, per-server-process in Next.js. **Never** use it for per-user data from a Server Component or Route Handler (one user's response could leak into another's on the same server instance); it's Client-Component-only, same caveat the file's own header comment carries.

### Usage

```ts
// src/lib/services/elections.ts — candidate detail, cached per candidateId
export async function getPublicCandidateById(supabase: Client, candidateId: string) {
  return fetchWithCache(
    `candidate_public:${candidateId}`,
    () => fetchPublicCandidateById(supabase, candidateId),
    5 * 60 * 1000
  );
}

// invalidated wherever a candidate's public fields actually change
export async function updateCandidateStatement(supabase: Client, candidateId: string, statement: string) {
  invalidateCache(`candidate_public:${candidateId}`);
  return supabase.from("election_candidates").update({ statement }).eq("id", candidateId);
}
```

Cache keys use `domain:id` (colon-delimited), matching the existing `election_role_types:${country}:${boundaryType}`, `political_parties:${country}`, `site_settings:theme` keys already in the codebase — `invalidateCache("political_parties")` clears every key with that prefix (a plain `.startsWith()` check), so a broad invalidation call is a deliberate choice of a short, shared prefix, not a special API.

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

**Manual invalidation** (after mutations) — real implementation, `src/lib/utils/apiCache.ts`:
```ts
export function invalidateCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    cache.clear(); // Clear everything
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(keyOrPrefix)) cache.delete(key); // prefix match, not substring
  }
}
```
`startsWith`, not `includes` — a call like `invalidateCache("candidate_public")` clears every `candidate_public:<id>` key (the shared prefix), but wouldn't accidentally clear an unrelated key that merely *contains* `candidate_public` somewhere in the middle. Keep cache keys prefix-structured (`domain:id`, see Usage above) so this stays a meaningful guarantee.

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

**Queries actually cached today** (added 2026-09-09, scoped to the seat-page candidate-select flow — see [CHOSENO_ARCHITECTURE_GUIDE.md §13.9](CHOSENO_ARCHITECTURE_GUIDE.md#139-rls-policies-must-wrap-authuidauthrole-in-select-) for the RLS half of the same fix):
- `getPublicCandidateById(candidateId)` (`elections.ts`) — key `candidate_public:${candidateId}`, 5 min TTL. Fires on every candidate-tab click on `/elections/seat/[seatId]` (`CandidacyWall`'s mount effect); switching back to a candidate already viewed this visit is now a cache hit instead of re-running the id-resolution chain (direct uuid → short-hash RPC → full-table slug scan fallback).
- `getPublicCandidateAnswers(candidateId)` (`elections.ts`) — key `candidate_answers:${candidateId}`, 2 min TTL (shorter than the candidate record — this embeds `election_answer_comments`, which people can add at any time).
- `getPoliticianProfile(politicianId)` (`profile.ts`) — key `politician_profile:${politicianId}`, 10 min TTL (bio/education/hometown/contact — edited by the politician through `EditProfileFlow`, not something viewers churn).

**Invalidation**: every mutation on a cached candidate's fields clears its key directly — `updateCandidateStatement`, `updateCandidateIntroVideoUrl`, `reviewCandidateApplication`, `submitCandidateApplication`, `removeCandidate`, `updateUnregisteredCandidate`, `removeUnregisteredCandidate`, `updateNominationFiled`, `upsertCandidateAnswer` invalidate `candidate_public:`/`candidate_answers:` for that id; `setCandidateAnswerOptions`/`setCandidateAnswerRanking`/`createAnswerComment` take an optional trailing `candidateId` for the same purpose (their callers — `CandidateApplicationClient`, `CandidacyWall` — already have it in scope; omit it and the 2min TTL just expires naturally instead). `upsertPoliticianProfile` invalidates `politician_profile:${userId}` on save.

**Not cached, deliberately**: `getCandidacyWallPosts`/`getMentionedWallPosts` (the wall's post feed) — same "Feed Posts" reasoning as below (interactive, high update rate, stale posts are jarring), and `getCandidatesBySeatIds`/`getSeatById` (the seat's whole candidate roster) — already covered by the *separate* server-side route cache (`revalidate = 300` in `elections/seat/[seatId]/page.tsx`, see §13.6) for the initial page load; the client only re-fetches that list after an actual mutation (add/remove/approve a candidate), where serving a cached stale roster would be actively wrong.

**Claimed but unimplemented in the table below** (kept for future work, not yet built): `getActiveElectionsForUser(userId)`, `getElectionSeats(electionId)`.

**Invalidation trigger** (for the above, once built):
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

**Not implemented** — `NEXT_PUBLIC_CACHE_DEBUG` and the hit/miss `console.log` below don't exist in `src/lib/utils/apiCache.ts` today; this was always aspirational. The sketch below is a starting point if this gets built, not something to `grep` for and expect to find. In the meantime, `Array.from((await import('@/lib/utils/apiCache')).cache?.keys?.() ?? [])` won't work either — `cache`/`inFlight` are module-private, not exported; the only way to observe hits today is a `console.log` you add and remove yourself, or the network tab (a cache hit means no request for that key at all).

```ts
// illustrative only -- not the real file
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
- **Service functions actually using `fetchWithCache`/`invalidateCache`** (grep either name in a file to see its exact keys/TTLs — this list, not the per-feature TTL table above, is the source of truth for what's really cached today):
  - [`src/lib/services/elections.ts`](../src/lib/services/elections.ts) — `getPublicCandidateById`, `getPublicCandidateAnswers`, `getElectionRoleTypes`, `getAllElectionRoleTypesForCountry`, `getKeyLeadersForCountry`
  - [`src/lib/services/profile.ts`](../src/lib/services/profile.ts) — `getPoliticianProfile`
  - [`src/lib/services/boundaries.ts`](../src/lib/services/boundaries.ts) — countries/boundary-types/entity-types lookups
  - [`src/lib/services/politicalParties.ts`](../src/lib/services/politicalParties.ts) — party lists
  - [`src/lib/services/settings.ts`](../src/lib/services/settings.ts) — site theme/rules
  - [`src/lib/services/moderation.ts`](../src/lib/services/moderation.ts) — moderation rules
  - `feed.ts`/`politicianWall.ts` (posts, comments, support) deliberately do **not** use it — see "Not cached, deliberately" above

---

## Future Enhancements

- [ ] **Persistent cache**: LocalStorage backup for offline-first mobile (PWA)
- [ ] **Smart invalidation**: Track query dependencies to auto-invalidate related caches
- [ ] **Stale-while-revalidate**: Serve stale data while fetching fresh in background
- [ ] **Cache analytics**: Dashboard showing hit/miss rates per query
- [ ] **Distributed caching**: Redis cache layer for production scaling

---

*Last updated: 2026-09-09 — corrected this doc's code samples to match the real `fetchWithCache`/`invalidateCache` API (it had drifted to an aspirational `withCache` sketch), and documented the candidate-select caching + [companion RLS fix](CHOSENO_ARCHITECTURE_GUIDE.md#139-rls-policies-must-wrap-authuidauthrole-in-select-) added the same day for `/elections/seat/[seatId]`.*
