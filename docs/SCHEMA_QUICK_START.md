# Supabase Schema — Quick Start Guide

**Start here** to understand the Choseno database. This doc points to the right reference for different tasks.

---

## I want to...

### Understand the database structure
→ Read **[SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md)** — complete reference of every table, column, type, FK, and index.

### Visualize how tables relate to each other
→ Read **[SCHEMA_RELATIONSHIPS.md](SCHEMA_RELATIONSHIPS.md)** — ERD-style diagrams, data flow patterns, access control.

### Understand the historical decisions
→ Read **[ARCHITECTURE.md](../ARCHITECTURE.md)** §23–33 — why tables were designed this way, migrations applied, bugs fixed.

---

## Quick Facts

- **44 tables** (excluding PostGIS internals)
- **~68 foreign key relationships**
- **~99 indexes** (PKs, FKs, compound, spatial)
- **All tables RLS-protected** — every table has explicit access control policies
- **PostGIS enabled** — spatial geometry queries for boundaries
- **UUID primary keys** (profiles, elections) + BIGSERIAL for map_shapes (id, ~100k+ rows)

---

## Table Categories

| Category | Tables | What it's for |
|----------|--------|---------------|
| **Core Users** | `profiles`, `user_locations`, `user_boundary_memberships`, `politician_profiles` | Who users are, where they are, what boundaries they belong to |
| **Boundaries & Geography** | `map_shapes`, `shape_containers`, `boundary_uploads`, `country_boundary_types`, `countries`, `entity_types` | Electoral boundaries, geometry, shape hierarchy, country/type registry |
| **Posts & Social** | `posts`, `comments`, `post_votes`, `post_boundaries`, `content_reports`, `moderation_rules` | User-generated content, voting, discussions, moderation |
| **Elections** | `elections`, `election_seats`, `election_candidates`, `election_questions`, `election_question_options`, `election_candidate_answers`, `election_answer_comments`, `election_administrators`, `election_notification_dismissals` | Candidate nominations, questionnaires, applications, volunteer admins |
| **Politicians** | `politician_profiles`, `politician_supporters`, `political_parties` | Politician accounts, party affiliation, supporters |
| **News** | `news_articles` | Editorial articles (distinct from user posts) |
| **Office Holders** | `office_holders`, `election_role_types` | Real-world elected officials, roles |
| **Historical Data** | `federal_election_events`, `federal_election_candidates`, `provincial_election_events`, `provincial_election_candidates`, `us_federal_election_candidates` | Scraped candidate lists from government sources |
| **Admin & Config** | `site_settings`, `designations`, `boundary_uploads` | Platform settings, office titles, upload tracking |
| **Audit** | `user_actions`, `candidacy_claim_invites`, `candidacy_claim_requests` | User analytics, claim invites, claim requests |

---

## Most Important Tables (by query frequency)

1. **`profiles`** — Every user lookup, role check, civic score update
2. **`map_shapes`** — Boundary lookups, geometry queries, every feed filter
3. **`user_boundary_memberships`** — Feed scoping, membership queries
4. **`posts`** + **`post_boundaries`** — Feed rendering (2-table join per post)
5. **`election_candidates`** + **`election_seats`** — Elections list, seat details, candidate profile
6. **`election_questions`** + **`election_candidate_answers`** — Questionnaire rendering
7. **`countries`** + **`country_boundary_types`** — Admin dropdowns, type registry

---

## Common Query Patterns

### "Show me posts in my boundaries" (Feed)

```sql
-- Fast path: join post_boundaries to user's stored memberships
SELECT p.* FROM posts p
JOIN post_boundaries pb ON p.id = pb.post_id
WHERE pb.map_shape_id IN (
  SELECT map_shape_id FROM user_boundary_memberships 
  WHERE profile_id = $user_id
)
ORDER BY p.created_at DESC
LIMIT 50;
```

### "Find all boundaries containing this point" (Onboarding)

```sql
-- Uses PostGIS ST_Contains; should have GIST index
SELECT id, name, boundary_type, country 
FROM map_shapes
WHERE ST_Contains(geom, ST_Point($lng, $lat))
ORDER BY boundary_type = 'Federal' DESC; -- Broadest first
```

### "Get all municipalities in this province" (Elections Admin)

```sql
-- Container-based; uses shape_containers cache
SELECT ms.id, ms.name, ms.code
FROM map_shapes ms
WHERE ms.boundary_type = 'Municipal'
  AND ms.country = 'Canada'
  AND ST_Contains(
    (SELECT geom FROM map_shapes WHERE id = $container_id),
    ms.geom
  );
```

### "Show all candidates for a seat"

```sql
SELECT ec.*, p.full_name, pp.avatar_url, pp.political_party_id
FROM election_candidates ec
JOIN profiles p ON ec.politician_id = p.id
LEFT JOIN politician_profiles pp ON pp.id = p.id
WHERE ec.seat_id = $seat_id 
  AND ec.status = 'approved'
ORDER BY ec.created_at;
```

---

## Key Design Decisions

### Soft Deletes (posts, comments)
- Don't hard-delete: set `removed_by = admin_id`, keep row for referential integrity
- RLS allows public reads even if `removed_by IS NOT NULL` — frontend filters
- Preserves post history, comment threads, vote integrity

### Ghost ID Rotation
- No FK `posts.ghost_id` → `profiles.current_ghost_id` (identity rotates, old posts orphan)
- `burn_ghost_identity()` RPC generates new UUID, old posts keep old ghost_id
- Found by ghost ID: yes. Found by user: join current_ghost_id

### Boundary Membership Snapshots
- `post_boundaries` captures which boundaries the poster was in *at post time*
- Changing your own memberships later doesn't affect old posts' visibility
- Immutable: if you move to a new city, old posts don't suddenly appear in new city's feed

### Shape Containers Cache
- `shape_containers` denormalized from spatial queries (built per-update)
- Not auto-maintained; rebuilt by admin RPC when shapes bulk-change
- Fast "all X inside Y" queries without live spatial join

### Entity Types
- `entity_types` table enumerates subtypes (City, Town, Village per province)
- Stored in `map_shapes.properties.CSDTYPE` (JSON key in jsonb column)
- Filter via WHERE clause; used by Visualizer and Elections Admin for subtype checkboxes

---

## RLS Access Control

Every table has `ENABLE ROW LEVEL SECURITY`. No bypasses in production:

- **Public read**: `FOR SELECT USING (true)` — posts, comments, map_shapes, public elections
- **User-scoped**: `FOR SELECT USING (auth.uid() = profile_id)` — user's own profile, locations, memberships
- **Admin write**: `FOR ALL USING (admin_check)` — only admins can insert/update boundaries, elections, settings
- **Soft-delete safe**: RLS allows `removed_by` posts to be read (admin can flag, public sees filtered view)

No table has `SECURITY DEFINER` functions that bypass RLS except intentional ones (e.g., `sync_user_boundary_memberships()` to recompute on signup).

---

## Storage Buckets

Four Supabase Storage buckets (all public read, authenticated write):

- **`news-images`** — Hero images, author photos
- **`avatar-images`** — Politician profile avatars
- **`candidates`** — Unregistered candidate photos
- **`videos`** — All videos (politician pitches, candidate videos, post videos)

Access: `publicUrl()` for read (embedded in posts/articles), upload via RLS-checked RPCs.

---

## Maintenance Tasks

### Regular (after data loads)
- Recompute `shape_containers` cache after bulk shape uploads
  ```sql
  SELECT maintenance_shape_containers_cache();
  ```

### One-time (after adding new jurisdiction)
- Seed `countries` row (if new country)
- Seed `country_boundary_types` rows (standard set per country)
- Upload boundary shapes via `boundary_uploads` flow
- Seed `election_role_types` for that country's elections

### Monitoring
- `boundary_uploads.completed_at IS NULL` = in-progress or failed uploads
- `election_candidates.status = 'submitted'` = awaiting admin review
- `content_reports.status = 'open'` = unreviewed moderation queue

---

## Querying Tips

### Use indexes
- `(boundary_type, country)` for "all Municipalities in Canada"
- `(map_shape_id)` on post_boundaries for "posts in this boundary"
- `(ghost_id)` on posts/comments for "content by this ghost ID"
- PostGIS GIST on `map_shapes.geom` for ST_Contains, ST_Intersects

### Avoid expensive queries
- ❌ `ST_Contains()` without WHERE on boundary_type/country first
- ❌ Selecting all map_shapes without filtering by country
- ❌ Computing post counts without grouping by boundary first

### Civic Score Calculation
- Banked: `profiles.civic_score` (persistent, survives ghost ID burns)
- Live: (posts × 10) + (comments × 5) + (votes sum)
- Snapshot: `posts.civic_score_snapshot` (immutable, poster's score at post time)

---

## Common Debugging

### "Why can't I see this post?"
1. Check `posts.removed_by IS NOT NULL` (soft-deleted by admin)
2. Check `post_boundaries` — does it have any rows? (if empty, no boundaries tagged)
3. Check `user_boundary_memberships` — is the viewer in any of the post's tagged boundaries?

### "Why is this user in the wrong boundaries?"
1. Check `user_locations` — is their coordinate updated?
2. Run `sync_user_boundary_memberships()` with their lat/lng
3. Check if map_shapes exist that would contain that point

### "Why is this shape query slow?"
1. Check if WHERE clause filters `boundary_type` and `country` first
2. Check if PostGIS GIST index exists: `SELECT 1 FROM map_shapes WHERE ST_DWithin(geom, ..., 1) LIMIT 1;`
3. Profile with `EXPLAIN ANALYZE` if still slow

---

## For the Next Session

- **Update this Quick Start** when new tables are added
- **Regenerate SUPABASE_SCHEMA.md** when major schema changes land (use psql query from ARCHITECTURE.md §33 as template)
- **Backfill office_holders** — infrastructure ready, data not yet loaded
- **Implement admin Analytics** — `user_actions` table exists, dashboard pending
