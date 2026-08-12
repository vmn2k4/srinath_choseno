# Choseno Architecture & Data Structure Guide

**Project**: Choseno Political Engagement Platform  
**Database**: Supabase PostgreSQL with PostGIS  
**Data Effective Date**: 2026-08-11  
**Total Tables**: 44 | **Migrations**: 105 | **Total LOC**: ~7,545

---

## 1. High-Level Architecture

### Layered Frontend Architecture (Top to Bottom)

```
┌─────────────────────────────────────────┐
│  Routing & Shell (src/App.jsx)          │
│  Routes, auth gating, persistent nav    │
└──────────────────┬──────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  Pages (src/pages/**)                   │
│  One file per screen, local UI state    │
└──────────────────┬──────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  Components (src/components/**)         │
│  Reusable UI pieces                     │
└──────────┬──────────────────┬───────────┘
           ↓                  ↓
   ┌──────────────┐   ┌─────────────────────┐
   │  Context     │   │  Services Layer     │
   │  (global     │   │  (Supabase access)  │
   │   state)     │   │  src/lib/services/* │
   └──────────────┘   └────────────┬────────┘
                                   ↓
                      ┌──────────────────────┐
                      │  Utils               │
                      │  (pure helpers)      │
                      └────────────┬─────────┘
                                   ↓
                      ┌──────────────────────┐
                      │  Supabase Backend    │
                      │  (migrations, RLS,   │
                      │   RPCs)              │
                      └──────────────────────┘
```

**Key Rule**: Dependency flows downward only. Pages/components never call `supabase` directly—they call services.

---

## 2. Core Tables (Frequently Queried)

### 2.1 User Data

| Table | Purpose | Key Columns | Notes |
|-------|---------|------------|-------|
| **profiles** | User accounts | `id` (PK, UUID), `role`, `full_name`, `country`, `current_ghost_id`, `civic_score`, `avatar_url` | 1:1 with `auth.users`; ghost ID for anonymity |
| **user_locations** | User geo-coordinates | `id`, `profile_id`, `latitude`, `longitude` | Unique per user; used for boundary detection |
| **user_boundary_memberships** | Which electoral boundaries belong to user | `profile_id`, `map_shape_id`, `updated_at` | Synced when user provides location |
| **politician_profiles** | Extended data for politician role | `id` (FK to profiles), `political_party_id`, `education`, `hometown`, `bio`, `avatar_url` | 1:1 extension of `profiles` for role='politician' |
| **politician_supporters** | Support/endorsement tracking | `politician_id`, `supporter_id` | M:M relationship |

### 2.2 Electoral Boundaries & Geography

| Table | Purpose | Key Columns | Notes |
|-------|---------|------------|-------|
| **map_shapes** | Electoral boundaries (ridings, municipalities, provinces) | `id` (PK, BIGSERIAL), `country`, `boundary_type`, `name`, `code`, `geom` (PostGIS), `properties` (JSONB) | 100k–500k rows; GIST index on `geom` for spatial queries |
| **map_shapes.properties** | Entity-type subtypes (City, Town, Village) | Stored as JSONB `{ CSDTYPE, region, ... }` | Query via `properties->>'CSDTYPE'` |
| **shape_containers** | Denormalized hierarchy: "which shapes contain which" | `map_shape_id`, `container_shape_id` | Built by `maintenance_shape_containers_cache()` RPC |
| **countries** | Country registry | `name` (PK), `code`, `flag_emoji` | ~10 countries seeded |
| **country_boundary_types** | Registry of types per country | `id`, `country`, `type_name`, `rank`, `is_container`, `admin_only` | Defines what types exist (Provincial, Municipal, etc.) |
| **entity_types** | Entity-type metadata | `id`, `country`, `boundary_type`, `name`, `code` | Subtypes per boundary type (City/Town/Village per province) |
| **boundary_uploads** | Track upload batches | `id`, `name`, `country`, `boundary_type`, `uploaded_by`, `expected_count`, `completed_at` | Admin-only; audit trail for shape imports |

### 2.3 Posts & Social

| Table | Purpose | Key Columns | Notes |
|-------|---------|------------|-------|
| **posts** | User-generated content (feed + wall posts) | `id`, `ghost_id`, `content`, `image_url`, `video_url`, `country`, `is_country`, `is_international`, `election_candidate_id`, `wall_ghost_id`, `civic_score_snapshot`, `removed_by` | Soft-deleted via `removed_by` admin ID |
| **post_boundaries** | Snapshot of poster's boundaries at post time | `post_id`, `map_shape_id` | M:M; immutable; determines visibility in feed |
| **comments** | Threaded discussion replies | `id`, `post_id`, `ghost_id`, `content`, `removed_by` | Soft-deleted via `removed_by` admin ID |
| **post_votes** | Upvote/downvote on posts | `post_id`, `ghost_id`, `vote_type` (1 or -1) | Unique per (post, ghost_id) |
| **content_reports** | Moderation reports | `id`, `target_type`, `target_id`, `reporter_id`, `abuse_type`, `status` | Links to `moderation_rules` |
| **moderation_rules** | Reportable abuse types | `abuse_type` (PK), `description` | Singleton rows for each report category |

### 2.4 Elections & Candidates

| Table | Purpose | Key Columns | Notes |
|-------|---------|------------|-------|
| **elections** | Top-level election event | `id`, `name`, `election_date`, `status` (draft/nominations_open/active/closed), `created_by` | Admin-created; status gates access |
| **election_seats** | Seat in an election (1 per election × boundary × role) | `id`, `election_id`, `map_shape_id`, `role_title` | Candidates apply for seats |
| **election_candidates** | Politician's application for a seat | `id`, `seat_id`, `politician_id`, `status` (submitted/approved/rejected), `statement`, `intro_video_url` | Self-service apply or admin-added (unregistered) |
| **election_questions** | Questionnaire questions for candidates | `id`, `election_id`, `question_text`, `question_type` (text/single_select/multi_select/rating/ranking), `is_required`, `is_public` | Flexible Q&A system |
| **election_question_options** | Answer choices | `id`, `question_id`, `option_text`, `sort_order` | For single/multi-select questions |
| **election_candidate_answers** | Candidate's answer to a question | `id`, `candidate_id`, `question_id`, `selected_option_id`, `answer_text`, `rating_value`, `video_url` | Supports text, video, rating, or option selection |
| **election_answer_comments** | Voter discussion on candidate answers | `id`, `answer_id`, `ghost_id`, `content`, `removed_by` | Anonymous discussion per answer |
| **election_administrators** | Volunteer moderators for seats | `id`, `seat_id`, `profile_id`, `status`, `reviewed_by` | Apply to moderate a seat's discussion |
| **election_notification_dismissals** | Tracks dismissed "active election" banners | `election_id`, `profile_id`, `dismissed_at` | Per-user election notification state |
| **candidacy_claim_invites** | Email invite tokens for stub candidates | `id`, `candidate_id`, `token_hash`, `created_by`, `claimed_at` | Sent to officeholders to claim candidacy |
| **candidacy_claim_requests** | Self-service candidacy claims | `id`, `candidate_id`, `requester_profile_id`, `status`, `reviewed_by` | Requester must verify identity (e.g., email domain) |
| **election_role_types** | Which roles available per (country, boundary_type) | `id`, `country`, `boundary_type`, `role_key`, `role_title`, `description` | Links country/type to available roles (MP, Mayor, etc.) |

### 2.5 Politicians & Office Holders

| Table | Purpose | Key Columns | Notes |
|-------|---------|------------|-------|
| **political_parties** | Party registry | `id`, `country`, `name`, `color_hex` | ~50 total; ~5 per country |
| **office_holders** | Real-world elected officials | `id`, `map_shape_id`, `election_role_type_id`, `name`, `political_party_id`, `email`, `phone`, `term_start`, `term_end`, `linked_profile_id` | Infrastructure ready; data partially loaded |
| **politician_ratings** | 1-5 star ratings + comments on politicians | `id`, `politician_id`, `rater_profile_id`, `rating`, `comment_text`, `created_at` | One rating per (politician, rater) per 6-month cooldown |
| **politician_engagement_summaries** | Aggregate engagement stats for politicians | `politician_id`, `total_posts`, `total_comments`, `avg_comment_sentiment`, `updated_at` | Denormalized from posts/comments |
| **office_holder_wall_claims** | Claim records for a real officeholder to take over their auto-imported wall | `id`, `office_holder_id`, `source_profile_id`, `target_profile_id`, `status`, `contact_email` | Status: `invited → pending_review → approved` (or `reversed`); admin-only RLS |
| **office_holder_wall_claim_items** | Per-entity audit trail of what a merge moved | `id`, `claim_id`, `entity_type`, `entity_id`, `source_value`, `target_value` | One row per moved post/comment/supporter/rating/etc.; reversal replays these |
| **office_holder_wall_claim_invites** | Hashed, expiring, single-use claim tokens | `id`, `claim_id`, `email`, `token_hash`, `expires_at`, `used_at`, `cancelled_at` | Raw token is emailed once and never stored |
| **office_holder_wall_redirects** | Old wall slug → surviving profile, after a merge | `claim_id`, `old_wall_slug`, `old_ghost_id`, `target_profile_id`, `active` | Public-read (active only); deactivated on reversal |

**Officeholder wall claim system**: full design + implementation status in [OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md](OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md) and [OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md](OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md). In short: an admin invites the real officeholder by email → they sign up/sign in and redeem a one-time token (`redeem_officeholder_wall_claim()`, which also immediately prefills their `politician_profiles` from the officeholder record via `backfill_politician_profile_from_officeholder()`) → an admin reviews a merge preview and confirms (`merge_officeholder_wall_claim()`) → all wall content (posts, comments, supporters, ratings, news tags, candidacies) transactionally moves to the claimant's profile, with every moved row audited so an admin can `reverse_officeholder_wall_claim()` later if the claim was fraudulent.

### 2.6 News Platform

| Table | Purpose | Key Columns | Notes |
|-------|---------|------------|-------|
| **news_articles** | Editorial articles | `id`, `slug`, `headline`, `category`, `country`, `province`, `status` (draft/scheduled/published/archived), `published_at`, `hero_image_url`, `content` (JSONB) | Content: `{ seoTitle, metaDescription, body (markdown), author {name, photo, bio}, tags, sources }` |

### 2.7 Historical Election Data (Scraped)

| Table | Purpose | Key Columns | Notes |
|-------|---------|------------|-------|
| **federal_election_events** | Historical federal election records | `id`, `country`, `election_year`, `source_url`, `fetched_at` | Audit trail for imports |
| **federal_election_candidates** | Candidates from Elections Canada, FEC | `id`, `election_event_id`, `map_shape_id`, `candidate_name`, `party_name` | Data source; matched to shapes where possible |
| **provincial_election_events** | Historical provincial elections | `id`, `country`, `province`, `election_year`, `source_url`, `fetched_at` | Canada-specific |
| **provincial_election_candidates** | Provincial candidates | `id`, `election_event_id`, `map_shape_id`, `candidate_name`, `party_name` | Matched to ridings |
| **us_federal_election_candidates** | US FEC candidates (House, Senate) | `id`, `cycle`, `office`, `state`, `district`, `map_shape_id`, `fec_candidate_id`, `candidate_name`, `party_affiliation` | FEC data; state/district → shape matching |

### 2.8 Admin & Config

| Table | Purpose | Key Columns | Notes |
|-------|---------|------------|-------|
| **site_settings** | Platform-wide configuration | `id`, `setting_key`, `setting_value`, `updated_at` | Singleton lookups (e.g., `active_theme`) |
| **designations** | Office title registry | `id`, `country`, `name` | ~20 per country; used for dropdowns |
| **user_actions** | Audit log for analytics | `politician_id`, `user_id`, `action_type`, `action_date`, `count` | Aggregated actions; privacy-preserving |

---

## 3. Service Layer (`src/lib/services/`)

> Performance conventions for this layer (request-scoped caching, slug lookups, parallel fetching) are in [§13](#13-performance-architecture--conventions) — read it before adding a new page or a new slugged entity.

The service layer is the **single point of access** for all Supabase operations. Every file follows the same pattern:

```typescript
// src/lib/services/domain.ts
export async function getX(params) {
  const { data, error } = await supabase
    .from('table_name')
    .select('columns')
    .eq('filter', value);
  return { data, error };  // Pass through unchanged
}

export async function createX(params) {
  return supabase
    .from('table_name')
    .insert([{ ...params }])
    .select();
}
```

**Key Files**:

| File | Domain | Main Operations |
|------|--------|-----------------|
| `elections.ts` | Elections, candidates, questionnaires | `getCandidatesForSeat`, `submitCandidateApplication`, `getElectionQuestionnaire`, `submitAnswer`, `claimCandidacy` |
| `boundaries.ts` | Map shapes, countries, types, uploads | `getCountries`, `getCountryBoundaryTypes`, `getMapShapesInContainer`, `insertBoundaryUpload` |
| `feed.ts` | Posts, comments, voting | `getFeedPosts`, `createFeedPost`, `createComment`, `voteOnPost`, `burnGhostIdentity` |
| `politicianWall.ts` | Politician walls, supporters | `getPoliticianWall`, `createWallPost`, `subscribeToSupportChanges` |
| `profile.ts` | User profiles, locations, memberships | `getProfile`, `updateProfile`, `syncUserBoundaryMemberships`, `getUserBoundaryMemberships` |
| `auth.ts` | Authentication | `signUp`, `signInWithPassword`, `signOut`, `getSession` |
| `news.ts` | News articles | `getPublishedArticles`, `getArticleBySlug` |
| `ratings.ts` | Politician ratings | `rateOrReviewPolitician`, `getPoliticianRatingSummary` |

---

## 4. Key Data Flow Patterns

### 4.1 User Onboarding → Boundary Membership

```
User signs up
  → auth.users entry created
  → Trigger: handle_new_user() runs
    → profiles row auto-created
    → new random current_ghost_id assigned

User clicks "Detect My Location"
  → Browser geolocation → lat/lng
  → Client calls profile.syncUserBoundaryMemberships(lat, lng)
  → RPC query: ST_Contains(map_shapes.geom, point)
    → finds all shapes containing point
  → Inserts rows into user_boundary_memberships
  → Now user appears in feeds for those boundaries
```

### 4.2 Post Creation & Feed Visibility

```
User creates post in FeedPage
  → Calls feed.createFeedPost(content, image, video, etc.)
  → RPC: create_post()
    → Inserts posts row with civic_score snapshot
    → Queries user's current user_boundary_memberships
    → Inserts N rows into post_boundaries (one per membership)
  → Post visible in:
    • User's own boundary tabs (join post_boundaries)
    • Country tab (if country matches)
    • International tab (if is_international=true)
```

### 4.3 Election Candidate Application

```
Politician navigates to /elections/[seatId]/apply
  → Form: statement, intro video, questionnaire answers
  → Submits: elections.submitCandidateApplication()
  → RPC: submit_candidate_application()
    → Validates election.status = 'nominations_open'
    → Inserts election_candidates row (status='submitted')
    → Auto-approves if politician has claimed candidacy, else pending
  → Admin reviews (if auto-pending)
    → Approves or rejects
  → On approval:
    • Candidate wall goes live
    • Other politicians can comment on answers
    • Post count increments for civic scoring
```

### 4.4 Boundary Filtering (Admin Visualizer)

```
Admin: "Show me all Municipalities in BC"
  → Selects: Country=Canada, Container=British Columbia, Type=Municipal
  → Frontend calls boundaries.findShapesInContainers(container_id, 'Municipal', 'Canada')
  → RPC: find_shapes_in_containers()
    → Query: map_shapes WHERE boundary_type='Municipal'
      AND ST_Contains(container.geom, shape.geom)
  → Returns ~160 BC municipalities
  → Renders on map or shows in seat-creation checklist
```

---

## 5. Row-Level Security (RLS)

**Every table has `ENABLE ROW LEVEL SECURITY`.** No table is unprotected.

### RLS Patterns

| Pattern | Example | Policy |
|---------|---------|--------|
| **Public read** | posts, comments, map_shapes | `FOR SELECT USING (true)` |
| **User-scoped** | user_locations, user_boundary_memberships | `FOR SELECT USING (auth.uid() = profile_id)` |
| **Admin-only write** | map_shapes, elections | `FOR INSERT/UPDATE/DELETE USING (admin_check(...))` |
| **Soft-delete safe** | posts.removed_by | Posts readable even if `removed_by IS NOT NULL`; frontend filters |

**Key enforcement**: Ownership checks, invariants, and permission gates live in **Postgres**, not client-side JS. Client checks can always be bypassed.

---

## 6. Important Design Decisions

### 6.1 Ghost Identity (Anonymity)

- Every user has `profiles.current_ghost_id` (UUID, rotates on burns)
- Posts/comments tagged with `ghost_id`, NOT user ID
- `burn_ghost_identity()` RPC: generates new UUID, rotates `current_ghost_id`
- Old posts keep old `ghost_id`, orphan from user lookup
- **No FK** `posts.ghost_id` → `profiles.current_ghost_id` (ID rotates, old posts would orphan)
- Find posts by ghost ID: yes. Find by user: join `profiles.current_ghost_id`

### 6.2 Boundary Membership Snapshots

- `post_boundaries` captures poster's boundaries **at post time**
- Changing memberships later doesn't retroactively affect old posts
- User moves to new city → old posts stay in old city's feed, don't appear in new city's feed
- Immutable design; rebuilds on profile-location changes via trigger

### 6.3 Soft Deletes

- Posts/comments never hard-deleted: set `removed_by = admin_id`, keep row
- Preserves referential integrity (comments on deleted posts still exist)
- RLS allows public reads even if `removed_by IS NOT NULL` → frontend filters
- Preserves vote counts, civic score history

### 6.4 Civic Score

- **Banked**: `profiles.civic_score` (persistent across ghost ID burns)
- **Live**: (posts × 10) + (comments × 5) + (vote sum)
- **Snapshot**: `posts.civic_score_snapshot` (immutable, poster's score at post time)
- Burned ghost identity → still credited to same `profiles.civic_score`

### 6.5 Shape Containers Cache

- `shape_containers` denormalized from spatial queries (not auto-maintained)
- Built by admin RPC `maintenance_shape_containers_cache()` after bulk shape uploads
- Enables fast "all X inside Y" without live spatial joins
- Must rebuild when shape geometry changes significantly

### 6.6 Entity Types & Properties

- `entity_types` enumerates subtypes (City, Town, Village per province)
- Stored in `map_shapes.properties` JSONB as `{ CSDTYPE, region, ... }`
- Query via `WHERE properties->>'CSDTYPE' IN ('City', 'Town')`
- Used by Visualizer and Elections Admin for subtype filtering

---

## 7. Common Query Patterns

### Fetch posts in user's boundaries
```sql
SELECT p.* FROM posts p
JOIN post_boundaries pb ON p.id = pb.post_id
WHERE pb.map_shape_id IN (
  SELECT map_shape_id FROM user_boundary_memberships 
  WHERE profile_id = $1
)
ORDER BY p.created_at DESC;
```

### Find all candidates for a seat
```sql
SELECT ec.*, p.full_name, pp.avatar_url
FROM election_candidates ec
JOIN profiles p ON ec.politician_id = p.id
LEFT JOIN politician_profiles pp ON pp.id = p.id
WHERE ec.seat_id = $1 AND ec.status = 'approved'
ORDER BY ec.created_at;
```

### Find all municipalities in a province
```sql
SELECT ms.* FROM map_shapes ms
WHERE ms.boundary_type = 'Municipal' 
  AND ms.country = 'Canada'
  AND ST_Contains(
    (SELECT geom FROM map_shapes WHERE id = $container_id),
    ms.geom
  );
```

### Analytics: Posts per boundary type
```sql
SELECT ms.country, ms.boundary_type, COUNT(DISTINCT pb.post_id)
FROM map_shapes ms
LEFT JOIN post_boundaries pb ON ms.id = pb.map_shape_id
GROUP BY ms.country, ms.boundary_type
ORDER BY count DESC;
```

---

## 8. Storage Buckets

Four public-read, authenticated-write buckets:

| Bucket | Purpose | Access |
|--------|---------|--------|
| `avatar-images` | Politician profile avatars | Public read, upload via RLS-checked RPC |
| `candidates` | Unregistered candidate photos | Public read, upload via RLS-checked RPC |
| `news-images` | Hero images, author photos | Public read, upload via admin RPC |
| `videos` | All videos (pitches, candidate clips, posts) | Public read, upload via RLS-checked RPC |

---

## 9. Maintenance & Admin Tasks

### After Bulk Boundary Upload
```sql
SELECT maintenance_shape_containers_cache();
```
Recomputes shape_containers denormalized cache.

### Monitoring Queries

```sql
-- In-progress or failed uploads
SELECT * FROM boundary_uploads WHERE completed_at IS NULL;

-- Pending candidate applications
SELECT * FROM election_candidates WHERE status = 'submitted';

-- Unreviewed content reports
SELECT * FROM content_reports WHERE status = 'open';
```

---

## 10. Common Debugging

| Symptom | Check | Solution |
|---------|-------|----------|
| User can't see post | `posts.removed_by IS NOT NULL` (soft-deleted) OR `post_boundaries` is empty (no boundaries tagged) OR user not in `user_boundary_memberships` | Restore post or add boundary membership |
| User in wrong boundaries | Check `user_locations` lat/lng are recent; run `sync_user_boundary_memberships()` manually | Update location or run RPC |
| Boundary query slow | WHERE clause doesn't filter `boundary_type` and `country` first | Add filtering before spatial join |
| Post voting not working | Check `current_ghost_id` on profile is non-null | Regenerate ghost ID or burn + restore |
| Candidate application fails | `election.status != 'nominations_open'` OR politician not in politician_profiles | Open nominations or create politician role |

---

## 11. Database Stats

| Metric | Value |
|--------|-------|
| **Total Tables** | 44 (excluding PostGIS internals) |
| **Total Migrations** | 105 applied |
| **Foreign Keys** | ~68 relationships |
| **Indexes** | ~99 (PKs, FKs, compound, spatial GIST) |
| **RLS Policies** | Every table enabled |
| **PostGIS GIST Indexes** | On `map_shapes.geom` |
| **JSONB Columns** | 4 (`map_shapes.properties`, `news_articles.content`, `office_holders.social_media_handles`, etc.) |

**Estimated Row Counts**:
- `map_shapes`: 100k–500k (all electoral boundaries ever uploaded)
- `posts`: 10k–100k (user-generated content)
- `comments`: 50k–500k (discussion threads)
- `user_boundary_memberships`: ~10× active users (avg 5–20 boundaries per user)
- Everything else: <10k (config, metadata, audit)

---

## 12. File Locations Quick Reference

| What | Where |
|------|-------|
| Architecture docs | `/docs/CODE_LAYERS.md`, `/docs/ARCHITECTURE.md` |
| Schema docs | `/docs/SCHEMA_QUICK_START.md`, `/docs/SUPABASE_SCHEMA.md`, `/docs/SCHEMA_RELATIONSHIPS.md` |
| Service layer | `/src/lib/services/` (TypeScript) |
| Pages | `/src/app/` (Next.js app router) |
| Components | `/src/components/` |
| Migrations | `/supabase/migrations/` (numbered SQL files) |
| RPCs | Defined in migrations via `CREATE OR REPLACE FUNCTION` |
| Generated types | `/src/lib/supabase/types.ts` (auto-generated from schema) |

---

## 13. Performance Architecture & Conventions

This project uses the Next.js App Router **without** `cacheComponents` (`next.config.ts` doesn't set it — see the "Previous Model" caching guide, not the Cache Components one, when consulting Next.js docs). The reason: `src/lib/supabase/server.ts`'s `createClient()` calls `cookies()` to read the session, and any route that reads `cookies()`/`headers()`/`searchParams` is forced into per-request dynamic rendering regardless of `revalidate` config — so route-level ISR wouldn't actually cache anything here. Getting real ISR would require splitting an anonymous/public data client from the session-reading one; that's a real architecture change, not attempted in the pass below. Follow the four conventions this codebase actually uses instead:

### 13.1 Request-scoped Supabase client + fetch dedup

`createClient()` in `src/lib/supabase/server.ts` is wrapped in React's `cache()`, so every call *within one request* (a page's `generateMetadata` and its default export are separate function invocations) returns the **same client instance** instead of constructing a new one each time. This is a prerequisite, not a fix by itself — plain service functions like `getSeatById` aren't automatically deduped just because the client is shared.

When a page's `generateMetadata` and its component body need the same data (true for almost every dynamic route with SEO metadata), wrap the shared fetch in a page-local `cache()` helper so both call sites hit one DB round trip:

```tsx
// app/some-route/[id]/page.tsx
import { cache } from "react";

const getThing = cache(async (id: string) => {
  const supabase = await createServerClient(); // same cached instance both times
  return (await getThingById(supabase, id)).data;
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  const thing = await getThing(id); // fetch #1
  // ...
}

export default async function Page({ params }) {
  const { id } = await params;
  const thing = await getThing(id); // cache hit, no second fetch
  // ...
}
```

`cache()` is request-scoped (resets every request) — safe by construction, never leaks between users. Don't wrap exported `src/lib/services/**` functions directly in `cache()`: several are imported by both server pages and `"use client"` components, and `cache()` is a Server-Components-only API. Keep the wrapper local to the page module.

### 13.2 Slugs that carry a short hash need an indexed lookup, not a full table fetch

`buildSeatSlug`/`buildCandidateSlug` (and any future slug builder that follows the same pattern in `src/lib/utils/slugs.ts`) embed a short 6–8 char hex hash (`id.replace(/-/g, "").slice(0, 6)`), **never the full UUID**. A lookup function that only special-cases the full-UUID case and falls back to `select("*")`-the-whole-table-then-`.find()`-in-JS for everything else will hit that fallback on nearly every request — and it gets slower as the table grows. This was the actual root cause of a systemwide slowdown (fixed 2026-08-11): `getSeatById`/`getCandidatesBySeatIds`/`getCandidateById`/`getPublicCandidateById` in `elections.ts` were fetching all of `election_seats`/`election_candidates` on every seat/candidate page view.

The fix, and the pattern to reuse for any new short-hash-slugged entity:
1. Migration: an expression index — `CREATE INDEX ... ON table (left(replace(id::text, '-', ''), 6))` — plus a `STABLE LANGUAGE sql` function that resolves a hash straight to a row id (see `supabase/migrations/20260811190000_seat_candidate_short_hash_lookup.sql`, RPCs `find_seat_id_by_short_hash` / `find_candidate_id_by_short_hash`).
2. Service function: full-UUID fast path first (`.eq("id", ...)`), then the RPC as the *actual* common-case fast path, then the full-scan `.find()` only as a last resort for slug shapes neither path covers.

### 13.3 Parallelize independent fetches

Default to `Promise.all` for any two `await` calls in a page that don't depend on each other's result — don't let independent DB round trips become an accidental waterfall. Only chain sequentially when there's a genuine data dependency (e.g. resolving a seat's real id before fetching its candidates) or a control-flow reason (e.g. a `redirect()`/`notFound()` gate that must run before a later fetch is worth doing). `src/app/elections/[boundarySlug]/page.tsx` is the densest example: its seats/candidates chain, primary-branch office-holder resolution, and session check run concurrently via `Promise.all`, and a signed-in user's *other* boundary branches resolve concurrently too (dedup the branch keys synchronously first, then `Promise.all` the resolution — never `await` inside a `for` loop over independent work).

### 13.4 `loading.tsx` for instant navigation feedback

Every route segment that does real server-side data fetching in `page.tsx` (not just a thin shell that hands off to a `"use client"` component's own `useEffect` fetch) should have a `loading.tsx` sibling:

```tsx
import { Spinner } from "@/components/primitives";

export default function Loading() {
  return <Spinner fullPage />;
}
```

Next.js wraps the segment in a `<Suspense>` boundary keyed to this file, so navigation shows the spinner immediately (streamed) instead of leaving the browser on the previous page until the whole SSR response — including every `await` in the page — finishes. `loading.tsx` cascades to nested segments that don't define their own (e.g. `elections/seat/[seatId]/loading.tsx` also covers `.../candidate/[candidateId]`), so place one at the shallowest segment that needs it rather than one per leaf route. A page with zero server-side `await`s (data fetched client-side after hydration) won't benefit — there's no async boundary for `loading.tsx` to cover; that page's own `<Spinner fullPage />` inside its `"use client"` component already handles it.

### 13.5 Code-split rarely-used heavy client components

A component that only renders behind a rare, explicit user action (opening a QR modal, starting a video recording) shouldn't ship in the page's initial JS bundle. Use `next/dynamic` with `ssr: false` (no SEO value in these cases) and the same `Spinner` fallback:

```tsx
import dynamic from "next/dynamic";
import { Spinner } from "@/components/primitives";

const VideoRecorder = dynamic(() => import("./VideoRecorder"), {
  ssr: false,
  loading: () => <Spinner />,
});
```

Applied to `qrcode.react` and `VideoRecorder` in `PoliticianWallClient`, `FeedPageClient`, and `CandidateApplicationClient` — all three are among the highest-traffic client bundles in the app. Don't apply this to content that's needed immediately/above-the-fold or that matters for SEO (e.g. `react-markdown` rendering an article body stays a static import).

---

## 14. Next Steps for New Contributors

1. **Read the architecture**: Start with `/docs/CODE_LAYERS.md` to understand layering
2. **Know the schema**: Skim `/docs/SCHEMA_QUICK_START.md` and reference `/docs/SCHEMA_TABLE_INDEX.md` as you work
3. **Use services, not raw Supabase**: When adding a feature, add a function to `/src/lib/services/domain.ts`, don't call `supabase` from components
4. **Check migrations for complex logic**: Business logic lives in Postgres (`SECURITY DEFINER` RPCs), not client JS
5. **Test RLS**: Every table change should include RLS policy updates; test that unprivileged users can't bypass checks
6. **Document as you go**: Service layer is self-documenting; migrations are versioned; update schema docs if you add tables
7. **New page with SEO metadata?** Read [§13.1](#131-request-scoped-supabase-client--fetch-dedup) before writing `generateMetadata` — dedupe its fetch against the page body from the start rather than fixing it later
8. **New slugged entity?** Read [§13.2](#132-slugs-that-carry-a-short-hash-need-an-indexed-lookup-not-a-full-table-fetch) — a short-hash slug needs its indexed RPC lookup from day one, not after the table grows large enough to notice

---

**Generated**: 2026-08-11  
**Status**: Active Development (Office Holders + News Platform + Ratings system maturing; Elections infrastructure stable)
**Last performance pass**: 2026-08-11 — see [§13](#13-performance-architecture--conventions)
