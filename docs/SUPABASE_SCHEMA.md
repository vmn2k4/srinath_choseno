# Choseno — Supabase Schema Reference

This is the complete reference for the Choseno Supabase database schema. Every table, its columns, relationships, and the features it supports are documented here. **This document is auto-generated from the live database schema** — see ARCHITECTURE.md for the historical narrative of why things are designed this way.

---

## Table of Contents

- [Core Data](#core-data) — profiles, locations, ghost identities
- [Boundaries & Geography](#boundaries--geography) — map shapes, containers, memberships
- [Posts & Social](#posts--social) — posts, comments, votes, content reports
- [Elections](#elections) — elections, seats, candidates, questionnaires
- [Politicians & Profiles](#politicians--profiles) — politicians, supporters, party affiliation
- [News & Content](#news--content) — news articles, moderation
- [Admin & Settings](#admin--settings) — configuration, theme, platform rules
- [Audit & Analytics](#audit--analytics) — user actions, historical tracking

---

## Core Data

### `profiles`

Represents a user account in the system. One row per authenticated user.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | — | PK, linked to `auth.users.id` (no FK constraint, dropped for flexibility) |
| `role` | text | YES | `'normal'` | One of: `'normal'` (citizen), `'politician'`, `'admin'` |
| `full_name` | text | YES | — | Display name (required for politicians, optional for citizens) |
| `country` | text | YES | `'Canada'` | User's home country for boundary scoping |
| `current_ghost_id` | uuid | YES | `gen_random_uuid()` | Anonymous post identity; rotatable, unique across all profiles |
| `onboarding_completed` | boolean | YES | `false` | Has user completed onboarding flow? |
| `civic_score` | bigint | YES | `0` | Persistent banked civic score (10pts/post, 5pts/comment, ±1 per vote) |
| `avatar_url` | text | YES | — | Supabase Storage URL for politician avatar image |
| `is_test_profile` | boolean | YES | `false` | Debug flag for test personas (DO NOT DEPEND ON THIS — test data is ephemeral) |
| `updated_at` | timestamptz | YES | `now()` | When row was last modified |

**RLS**: Users can read/write only their own profile. Admins have full access.

**Triggers**:
- `on_auth_user_created`: Auto-creates a profile row when a new auth user signs up.
- `guard_politician_downgrade`: Blocks politician→citizen downgrades (one-way upgrade only).

**Used by**: Feed, Profile, Elections, Onboarding, any user-scoped operation.

---

### `user_locations`

Geo-coordinate tracking for boundary-membership lookups. One row per user (unique).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `profile_id` | uuid | NO | — | FK to `profiles(id)` ON DELETE CASCADE; unique index |
| `latitude` | double precision | NO | — | Decimal degrees (-90 to 90) |
| `longitude` | double precision | NO | — | Decimal degrees (-180 to 180) |
| `created_at` | timestamptz | YES | `now()` | First location recorded |
| `updated_at` | timestamptz | YES | — | Last update (implicit, no trigger) |

**RLS**: Users can read/write only their own location.

**Used by**: Onboarding location step, profile edit, `sync_user_boundary_memberships()` RPC.

---

### `user_boundary_memberships`

Many-to-many mapping of users to the electoral/administrative boundaries their location falls inside. Kept in sync automatically when shapes change.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `profile_id` | uuid | NO | — | FK to `profiles(id)` ON DELETE CASCADE; part of PK |
| `map_shape_id` | bigint | NO | — | FK to `map_shapes(id)` ON DELETE CASCADE; part of PK |
| `updated_at` | timestamptz | YES | `now()` | Sync timestamp |

**RLS**: Users can read only their own memberships. Writes only via RPCs, never direct client insert/update.

**Indexes**:
- PK: `(profile_id, map_shape_id)`
- `idx_ubm_shape`: `(map_shape_id)` for "find all users in shape X"

**Triggers**:
- `reconcile_shape_memberships`: Fires on INSERT/UPDATE of `map_shapes.geom`, recomputes user memberships for that shape.

**Used by**: Feed filtering, Elections seat availability, Post scoping.

---

## Boundaries & Geography

### `map_shapes`

The authoritative geographic boundary data — every electoral riding, municipality, province, etc.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | bigserial | NO | — | PK |
| `country` | text | NO | — | Country name (e.g., `'Canada'`, `'United States'`); part of FK to `country_boundary_types` |
| `boundary_type` | text | NO | — | Boundary classification (e.g., `'Federal'`, `'Provincial'`, `'Municipal'`); part of FK to `country_boundary_types` |
| `name` | text | NO | — | Display name (e.g., `'Toronto'`, `'Vancouver'`) |
| `code` | text | YES | — | Official jurisdiction code (e.g., postal code, CSDUID) |
| `properties` | jsonb | YES | `'{}'::jsonb` | Arbitrary metadata — typically contains `CSDTYPE` (entity subtype: City, Town, Village, etc.) |
| `geom` | geometry(MultiPolygon, 4326) | YES | — | PostGIS geometry (WGS84); indexed with GIST |
| `retired_at` | timestamptz | YES | — | Soft-delete timestamp (shape still exists but is no longer current) |
| `upload_id` | bigint | YES | — | FK to `boundary_uploads(id)` — which upload batch added this shape |
| `created_at` | timestamptz | YES | `now()` | When inserted |

**RLS**: Public read, admin write.

**Indexes**:
- PK: `(id)`
- GIST: `(geom)` for ST_Contains, ST_Intersects queries
- Compound: `(boundary_type, country)` for type+country lookups
- `(upload_id)` for tracing shapes to their source

**FK constraints**:
- `(country, boundary_type)` → `country_boundary_types(country, type_name)` — enforces only registered boundary types

**Triggers**:
- `reconcile_shape_memberships`: When geometry changes, recalculates `user_boundary_memberships` for all affected users.

**Used by**: Every boundary-scoped feature (Feed, Elections, Onboarding, Visualizer).

---

### `shape_containers`

Denormalized cache of "which shapes contain which other shapes" — used to quickly find "all municipalities inside BC" without spatial joins on every query.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `map_shape_id` | bigint | NO | — | The child shape; FK to `map_shapes(id)` ON DELETE CASCADE; part of PK |
| `container_shape_id` | bigint | NO | — | The parent/container shape; FK to `map_shapes(id)` ON DELETE CASCADE; part of PK |

**RLS**: Public read.

**Indexes**:
- PK: `(map_shape_id, container_shape_id)`
- `idx_shape_containers_container`: `(container_shape_id)` for "find all children of shape X"

**Maintenance**: Recomputed by `maintenance_shape_containers_cache()` RPC (admin-only). Fires on bulk geography changes; not auto-maintained per-shape.

**Used by**: Elections Admin "pick a container, get all shapes inside" UI, Visualizer container scoping.

---

### `boundary_uploads`

Track of every boundary file upload batch — who uploaded what, when, and progress toward completion.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `name` | text | NO | — | Admin-assigned name (e.g., `'Alberta Municipalities 2024'`) |
| `country` | text | NO | — | Target country |
| `boundary_type` | text | NO | — | Target boundary type |
| `uploaded_by` | uuid | YES | — | FK to `profiles(id)` — admin who initiated the upload |
| `source_data_type` | text | YES | — | Format hint (e.g., `'geojson'`, `'shapefile'`) |
| `expected_count` | integer | YES | — | How many shapes we expect to insert |
| `created_at` | timestamptz | YES | `now()` | Upload initiated |
| `completed_at` | timestamptz | YES | — | Batch fully inserted (NULL = in progress or failed) |
| `file_url` | text | YES | — | Supabase Storage path to the original upload |

**RLS**: Public read, admin write.

**Used by**: Boundary Admin panel (showing upload history + progress), tracing shapes to their source.

---

### `country_boundary_types`

Registry of all boundary types per country — defines what types of boundaries exist and their display order.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `country` | text | NO | — | Country name; part of FK to `countries(name)` |
| `type_name` | text | NO | — | Boundary type (e.g., `'Federal'`, `'Provincial'`, `'Municipal'`) |
| `rank` | integer | NO | — | Display/hierarchy order (1 = broadest/national, higher = more local) |
| `is_container` | boolean | YES | `true` | Can this type be used as a "container" (e.g., Province containing Municipalities)? |
| `admin_only` | boolean | YES | `false` | Is this type admin-only (not shown to regular users)? |
| `created_at` | timestamptz | YES | `now()` | When registered |

**RLS**: Public read, admin write.

**Indexes**:
- PK: `(id)`
- Unique compound: `(country, type_name)`
- Unique compound: `(country, rank)` — prevents duplicate rank per country

**FK constraints**:
- `(country)` → `countries(name)`

**Used by**: Admin boundary setup, Feed tab construction, Elections seat-creation boundary picker.

---

### `countries`

The canonical list of countries in the system — every boundary, user, party, etc. must reference one.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `name` | text | NO | — | PK; full name (e.g., `'Canada'`, `'United States'`) — matches free-text `country` values throughout the schema |
| `code` | text | YES | — | ISO 3166-1 alpha-2 code (e.g., `'CA'`, `'US'`) |
| `flag_emoji` | text | YES | — | Country flag emoji for UI display |

**RLS**: Public read, admin write.

**Indexes**:
- PK: `(name)`
- Unique: `(code)` — exactly one country per ISO code

**Used by**: Country dropdowns in onboarding, elections, admin panels.

---

### `entity_types`

Enumeration of entity-type subtypes per country/boundary-type combination (e.g., Alberta Municipalities can be City, Town, Village, Municipal District, Summer Village, Specialized Municipality).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `country` | text | NO | — | FK to `countries(name)` |
| `boundary_type` | text | YES | — | Boundary type within that country (e.g., `'Municipal'`) |
| `name` | text | NO | — | Entity type name (e.g., `'City'`, `'Town'`, `'Village'`) |
| `code` | text | YES | — | Short code for this type (e.g., `'CY'` for City, used in `map_shapes.properties.CSDTYPE`) |
| `description` | text | YES | — | Human-readable explanation |

**RLS**: Public read, admin write.

**Indexes**:
- PK: `(id)`
- Unique compound: `(country, boundary_type, name)` — one row per entity type per jurisdiction

**Used by**: Boundary Visualizer entity-type filter UI, Elections Admin seat-creation subtype filtering.

---

## Posts & Social

### `posts`

The core social content table — every post, politician video pitch, news article discussion, etc.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `ghost_id` | uuid | YES | — | Anonymous identity posting this; FK to current value of `profiles.current_ghost_id` (no enforced FK; ghost IDs rotate) |
| `content` | text | NO | — | Post body text (markdown on news articles, plain text elsewhere) |
| `image_url` | text | YES | — | Optional single image (Supabase Storage public URL) |
| `video_url` | text | YES | — | Optional video (Supabase Storage URL) |
| `link_metadata` | jsonb | YES | — | Cached rich preview (title, description, image) for pasted URLs |
| `country` | text | YES | — | Country of the poster (for country-feed scoping) |
| `is_country` | boolean | YES | `true` | Included in "Country" tab feed |
| `is_international` | boolean | YES | `true` | Included in "International" tab feed |
| `election_candidate_id` | uuid | YES | — | FK to `election_candidates(id)` — if this is a candidate campaign post, which candidate? |
| `news_article_id` | uuid | YES | — | FK to `news_articles(id)` — if this is a news comment, which article? |
| `wall_ghost_id` | uuid | YES | — | If this post is on a politician's wall, which politician's ghost ID? (allows owner-pinning) |
| `civic_score_snapshot` | bigint | YES | — | Poster's civic score at time of posting (immutable; changes don't affect old posts) |
| `likes_count` | integer | YES | `0` | Cached like count (updated by vote trigger) |
| `dislikes_count` | integer | YES | `0` | Cached dislike count (updated by vote trigger) |
| `removed_by` | uuid | YES | — | FK to `profiles(id)` — admin who removed this post (NULL = still live) |
| `removed_reason` | text | YES | — | Reason for removal (only populated if `removed_by` is set) |
| `is_test_content` | boolean | YES | `false` | Debug flag; not used by frontend but queryable for filtering |
| `created_at` | timestamptz | YES | `now()` | When posted |

**RLS**:
- Public read (including soft-deleted posts with `removed_by` set — frontend filters them)
- Authenticated users can insert
- Admins can remove (soft-delete via update `removed_by`)

**Indexes**:
- PK: `(id)`
- `(ghost_id)` for "posts by this ghost ID"
- `(election_candidate_id)` for candidate campaign walls
- `(news_article_id)` for article comment threads
- `(wall_ghost_id)` — added 2026-08-18; the other half of `getWallPosts()`'s `.or(ghost_id.eq, wall_ghost_id.eq)` filter, previously unindexed on this side
- `(country, created_at desc) WHERE is_country` — added 2026-08-18, partial; the Feed's Country tab (`getCountryScopedPosts`) had no index on either its filter or its sort column
- `(created_at desc) WHERE is_international` — added 2026-08-18, partial; same gap for the Feed's International tab

**Triggers**:
- `on_post_vote`: Updates `likes_count`/`dislikes_count` when votes are added/removed.

**Used by**: Feed, Politician walls, Candidate campaign pages, News article discussions.

---

### `comments`

Threaded replies to posts — used throughout the app (Feed comments, candidate questionnaire answers, news article discussions).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `post_id` | uuid | NO | — | FK to `posts(id)` ON DELETE CASCADE |
| `ghost_id` | uuid | YES | — | Anonymous identity (same pattern as `posts.ghost_id`) |
| `content` | text | NO | — | Comment body |
| `created_at` | timestamptz | YES | `now()` | When posted |
| `removed_by` | uuid | YES | — | FK to `profiles(id)` — admin who removed this comment |
| `removed_reason` | text | YES | — | Reason for removal |
| `is_test_content` | boolean | YES | `false` | Debug flag |

**RLS**: Public read (including removed), authenticated can insert, admins can remove.

**Indexes**:
- PK: `(id)`
- `(post_id)` for comments on a post
- `(ghost_id)` for comments by a ghost ID

**Used by**: Every post type (Feed, walls, candidate pages, news).

---

### `post_votes`

Anonymous voting on posts — one row per (post, ghost_id) with vote direction.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `post_id` | uuid | NO | — | FK to `posts(id)` ON DELETE CASCADE; part of PK |
| `ghost_id` | uuid | NO | — | Voter's anonymous identity; part of PK |
| `vote_type` | smallint | NO | — | `1` (like) or `-1` (dislike) |
| `created_at` | timestamptz | YES | `now()` | When voted |

**RLS**: Public read, no client insert (votes only via `vote_on_post()` RPC).

**Indexes**:
- PK: `(post_id, ghost_id)`

**Used by**: Feed post voting, Politician wall post voting (candidates' campaign posts not voteable).

---

### `post_boundaries`

Snapshot of which boundaries a post belongs to at creation time — enables local-feed scoping.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `post_id` | uuid | NO | — | FK to `posts(id)` ON DELETE CASCADE; part of PK |
| `map_shape_id` | bigint | NO | — | Boundary the post is tagged with; FK to `map_shapes(id)` ON DELETE CASCADE; part of PK |

**RLS**: Public read.

**Indexes**:
- PK: `(post_id, map_shape_id)`
- `(map_shape_id)` for "all posts in this boundary"

**Maintenance**: Populated by `create_post()` RPC (copies caller's current `user_boundary_memberships`). If a user's memberships change, their old posts' boundaries don't — the snapshot is immutable.

**Used by**: Feed tab filtering (show posts from "this boundary" / "all my boundaries"), Visualizer post counts.

---

### `content_reports`

Moderation queue — users can report posts/comments for violating community standards.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `target_type` | text | NO | — | `'post'` or `'comment'` |
| `target_id` | uuid | NO | — | PK of the post/comment being reported |
| `reporter_id` | uuid | YES | — | FK to `profiles(id)` — who reported it (NULL = anonymous) |
| `abuse_type` | text | NO | — | FK to `moderation_rules(abuse_type)` — category of violation |
| `details` | text | YES | — | Free-text explanation from reporter |
| `status` | text | YES | `'open'` | `'open'`, `'reviewing'`, `'action_taken'`, `'dismissed'` |
| `resolved_by` | uuid | YES | — | Admin who took action |
| `resolution` | text | YES | — | What happened (e.g., `'post_removed'`, `'user_warned'`) |
| `created_at` | timestamptz | YES | `now()` | When reported |

**RLS**: Authenticated can insert reports, admins can read/update.

**Indexes**:
- PK: `(id)`
- `(target_id, reporter_id, target_type)` — unique constraint (can't double-report same content)
- Composite: `(target_id, status, abuse_type, target_type)` for admin queue

**FK constraints**:
- `(abuse_type)` → `moderation_rules(abuse_type)`

**Used by**: Admin moderation dashboard (not yet implemented in UI, but infrastructure ready).

---

### `moderation_rules`

Enumeration of reportable abuse types — what categories can be reported.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `abuse_type` | text | NO | — | PK (e.g., `'misinformation'`, `'harassment'`, `'spam'`) |
| `description` | text | YES | — | Admin-facing definition |

**RLS**: Public read, admin write.

**Used by**: Report form dropdowns, moderation dashboards.

---

## Elections

### `elections`

Top-level election event — one row per election (e.g., "Municipal Election 2026").

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `name` | text | NO | — | Display name (e.g., `'Municipal Election 2026'`) |
| `election_date` | date | NO | — | When the real election occurs |
| `status` | text | NO | `'draft'` | One of: `'draft'` (admin only), `'nominations_open'` (candidates apply), `'active'` (ongoing), `'closed'` (results finalized) |
| `created_by` | uuid | YES | — | FK to `profiles(id)` — admin who created this election |
| `created_at` | timestamptz | YES | `now()` | When created |

**RLS**: Public read (non-draft only), admin read/write all.

**Used by**: Elections listings, Seat creation, Candidate applications.

---

### `election_seats`

One per (election, boundary, role) combination — e.g., "Toronto Mayor" in Municipal Election 2026.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `election_id` | uuid | NO | — | FK to `elections(id)` ON DELETE CASCADE |
| `map_shape_id` | bigint | NO | — | FK to `map_shapes(id)` ON DELETE CASCADE — which jurisdiction |
| `role_title` | text | NO | — | Role name (e.g., `'Mayor'`, `'MPP'`, `'Councillor'`) |
| `created_at` | timestamptz | YES | `now()` | When seat created |

**RLS**: Inherits from parent election (public non-draft, admin all).

**Indexes**:
- PK: `(id)`
- `(election_id)` for all seats in an election
- `(map_shape_id)` for all seats covering a shape
- Unique compound: `(election_id, map_shape_id, role_title)` — one seat per role per jurisdiction per election

**Used by**: Elections list, Seat detail page, Candidate applications, Election Admin seat creation.

---

### `election_candidates`

A politician's application for a seat in an election.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `seat_id` | uuid | NO | — | FK to `election_seats(id)` ON DELETE CASCADE |
| `politician_id` | uuid | NO | — | FK to `profiles(id)` ON DELETE CASCADE — the candidate |
| `status` | text | YES | `'draft'` | `'draft'` (in progress), `'submitted'` (awaiting review), `'approved'` (public), `'rejected'` (not running) |
| `statement` | text | YES | — | "Why I'm running" text (per-election) |
| `intro_video_url` | text | YES | — | Required intro video (Supabase Storage URL) |
| `reviewed_by` | uuid | YES | — | FK to `profiles(id)` — admin who approved/rejected |
| `review_notes` | text | YES | — | Admin notes on review |
| `is_unregistered_candidate` | boolean | YES | `false` | Was this candidate added by an election admin (not a real account)? |
| `added_by_election_admin_id` | uuid | YES | — | FK to `profiles(id)` — admin who added this unregistered candidate |
| `created_at` | timestamptz | YES | `now()` | When application submitted |

**RLS**: Inherits from parent election; candidates can update/delete own draft; admins manage.

**Indexes**:
- PK: `(id)`
- `(seat_id)` for all candidates in a seat
- `(politician_id)` for all candidacies by a politician
- Unique compound: `(seat_id, politician_id)` — max one application per politician per seat

**Used by**: Politician Elections page, Seat detail candidates, Candidate campaign pages.

---

### `election_questions`

Part of a questionnaire — admin can add questions for candidates to answer.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `election_id` | uuid | NO | — | FK to `elections(id)` ON DELETE CASCADE |
| `question_text` | text | NO | — | The question (e.g., `'What is your stance on climate change?'`) |
| `question_type` | text | NO | — | One of: `'single_select'`, `'multi_select'`, `'free_text'`, `'rating'`, `'ranking'` |
| `context` | text | YES | — | Optional additional info/background |
| `is_required` | boolean | YES | `true` | Must candidates answer this? |
| `is_public` | boolean | YES | `true` | Visible to voters (if false, admin-only) |
| `allow_video_answer` | boolean | YES | `false` | Can candidates attach a video to their answer? |
| `sort_order` | integer | YES | — | Display order within questionnaire |
| `created_at` | timestamptz | YES | `now()` | When added |

**RLS**: Inherits from parent election; public non-draft, admin all.

**Indexes**:
- PK: `(id)`
- `(election_id)` for all questions in an election

**Used by**: Candidate application form, Candidate campaign page (showing voter-visible answers).

---

### `election_question_options`

Answer choices for single/multi-select questions.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `question_id` | uuid | NO | — | FK to `election_questions(id)` ON DELETE CASCADE |
| `option_text` | text | NO | — | The choice (e.g., `'Strongly Agree'`, `'Agree'`, `'Disagree'`) |
| `sort_order` | integer | YES | — | Display order within this question's options |

**Indexes**:
- PK: `(id)`
- `(question_id)` for options within a question

**Used by**: Candidate application form option rendering.

---

### `election_candidate_answers`

A candidate's submitted answer to a questionnaire question.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `candidate_id` | uuid | NO | — | FK to `election_candidates(id)` ON DELETE CASCADE |
| `question_id` | uuid | NO | — | FK to `election_questions(id)` ON DELETE CASCADE |
| `selected_option_id` | uuid | YES | — | FK to `election_question_options(id)` (for single-select) |
| `answer_text` | text | YES | — | Free-text answer (for free-text questions) |
| `rating_value` | smallint | YES | — | 1–5 rating (for rating questions) |
| `video_url` | text | YES | — | Optional attached video (Supabase Storage URL) |
| `created_at` | timestamptz | YES | `now()` | When submitted |
| `updated_at` | timestamptz | YES | `now()` | Last update |

**RLS**: Inherits from parent election.

**Indexes**:
- PK: `(id)`
- `(candidate_id)` for all answers by a candidate
- Unique compound: `(candidate_id, question_id)` — one answer per candidate per question

**Used by**: Candidate application submission, Candidate campaign page answer rendering.

---

### `election_candidate_answer_options`

For multi-select questions, the selected options for a candidate's answer.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `answer_id` | uuid | NO | — | FK to `election_candidate_answers(id)` ON DELETE CASCADE |
| `option_id` | uuid | NO | — | FK to `election_question_options(id)` ON DELETE CASCADE |
| `rank` | integer | YES | — | If ranking question, the rank order (1 = first preference) |

**Indexes**:
- PK: `(id)`
- `(answer_id)` for options selected in this answer
- `(rank, answer_id)` for ranking question ordering

---

### `election_answer_comments`

Threaded voter discussion on a candidate's answer to a questionnaire question.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `answer_id` | uuid | NO | — | FK to `election_candidate_answers(id)` ON DELETE CASCADE — comment on which answer |
| `ghost_id` | uuid | YES | — | Anonymous commenter |
| `content` | text | NO | — | Comment body |
| `created_at` | timestamptz | YES | `now()` | When posted |
| `removed_by` | uuid | YES | — | Admin who removed (if any) |

**Indexes**:
- PK: `(id)`
- `(answer_id)` for comments on this answer

**Used by**: Candidate campaign page answer comment threads.

---

### `election_administrators`

Volunteer moderators for individual seats — one per (seat, admin) with approval status.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `seat_id` | uuid | NO | — | FK to `election_seats(id)` ON DELETE CASCADE |
| `profile_id` | uuid | NO | — | Volunteer's profile |
| `motivation` | text | YES | — | Why they want to volunteer |
| `social_media_info` | text | YES | — | Optional contact info (Twitter, etc.) |
| `email` | text | YES | — | Contact email |
| `status` | text | YES | `'pending'` | `'pending'` (awaiting review), `'approved'`, `'rejected'` |
| `reviewed_by` | uuid | YES | — | Site admin who approved/rejected |
| `review_notes` | text | YES | — | Notes |
| `auto_approved_at` | timestamptz | YES | — | If auto-approved after 48h, when? |
| `created_at` | timestamptz | YES | `now()` | When application submitted |

**Indexes**:
- PK: `(id)`
- Unique compound: `(seat_id, profile_id)` — one volunteer per seat
- `(seat_id)` for administrators of a seat
- `(profile_id)` — added 2026-08-18; "my own admin applications" (`getMyElectionAdminApplications`) had no supporting index, since the compound unique index above leads with `seat_id`
- `(submitted_at) WHERE status='pending'` — added 2026-08-18, partial; the admin review queue (`listPendingElectionAdminApplications`)

**RLS**: Candidates can insert own applications, admins manage.

**Used by**: Seat detail volunteer panel, Admin Elections review queue.

---

### `election_role_types`

Mapping of which roles are available for each (country, boundary_type) — e.g., Ontario Provincial ridings have MPP, Alberta ones have MLA, etc.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `country` | text | NO | — | Country; part of FK to `country_boundary_types` |
| `boundary_type` | text | NO | — | Boundary type; part of FK to `country_boundary_types` |
| `role_key` | text | NO | — | Internal identifier (e.g., `'mpp'`, `'mayor'`) |
| `role_title` | text | NO | — | Display name (e.g., `'Member of Provincial Parliament'`) |
| `region_override` | text | YES | — | If non-NULL, only use this role in shapes where `map_shapes.properties.region == region_override` (e.g., use "Senator" only in ridings with region="Federal") |
| `description` | text | YES | — | Explanation (e.g., provincial vs. federal scope) |

**Indexes**:
- PK: `(id)`
- Unique compound: `(country, boundary_type, role_key, region_override)`

**FK constraints**:
- `(country, boundary_type)` → `country_boundary_types(country, type_name)`

**Used by**: Elections Admin seat-creation role picker.

---

### `election_notification_dismissals`

Tracks which users dismissed the "active election in your area" banner.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `election_id` | uuid | NO | — | FK to `elections(id)` ON DELETE CASCADE; part of PK |
| `profile_id` | uuid | NO | — | FK to `profiles(id)` ON DELETE CASCADE; part of PK |
| `dismissed_at` | timestamptz | YES | `now()` | When dismissed |

**RLS**: Users can only see/set their own dismissals.

---

## Politicians & Profiles

### `politician_profiles`

Extended profile data for politician accounts — avatar, party, hometown, education, bio.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | — | PK, FK to `profiles(id)` ON DELETE CASCADE (one-to-one extension) |
| `political_party_id` | uuid | YES | — | FK to `political_parties(id)` — which party (NULL = independent) |
| `education` | text | YES | — | Free-text education background |
| `hometown` | text | YES | — | Free-text hometown |
| `bio` | text | YES | — | Free-text bio / platform |
| `avatar_url` | text | YES | — | Avatar image (Supabase Storage URL) |

**RLS**: Public read politician profiles, politicians can update own.

**Used by**: Politician public walls, candidate campaign pages, profile editing.

---

### `politician_supporters`

Tracks support/endorsements — who supports which politician.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `politician_id` | uuid | NO | — | FK to `profiles(id)` ON DELETE CASCADE; part of PK |
| `supporter_id` | uuid | NO | — | FK to `profiles(id)` ON DELETE CASCADE; part of PK |
| `created_at` | timestamptz | YES | `now()` | When support added |

**Indexes**:
- PK (composite): `(politician_id, supporter_id)` — serves any lookup led by `politician_id` (`getSupportStatus`, `getSupporterCount`) as a byproduct, but not one led by `supporter_id`
- `(supporter_id)` — added 2026-08-18; `getMySupportedPoliticianIds()` ("which of these candidates does the viewer already support", the election Results poll) filters by `supporter_id` first with a small `politician_id` IN-list, which the composite PK alone can't serve as an index-only scan

**RLS**: Public read, authenticated can insert.

**Used by**: Politician wall support button + count.

---

### `political_parties`

Registry of political parties per country.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `country` | text | NO | — | FK to `countries(name)` |
| `name` | text | NO | — | Party name (e.g., `'Liberal Party'`, `'Conservative Party'`) |
| `color_hex` | text | YES | — | Brand color (e.g., `'#E1242E'` for Liberal) |

**RLS**: Public read, admin write.

**Indexes**:
- PK: `(id)`
- Unique compound: `(country, name)` — one party per name per country

**Used by**: Politician profile party selector, Candidate application form.

---

### `politician_daily_post_limit_tracking`

(Implicit in RPC `create_post()` — no dedicated table, but mentioned for completeness.)

Candidates have a daily post limit to prevent spam. Tracking happens in `create_post()` RPC via query-time count, not persistent state.

---

## News & Content

### `news_articles`

Editorial articles written by admins — distinct from user posts in Feed.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `slug` | text | NO | — | URL slug (unique, e.g., `'breaking-election-date-announced'`) |
| `headline` | text | NO | — | Article title |
| `summary` | text | YES | — | Short teaser |
| `category` | text | NO | `'General'` | Category (e.g., `'Election Updates'`, `'Policy'`) |
| `country` | text | YES | — | Country scope (NULL = global) |
| `province` | text | YES | — | Province/state scope (NULL = country-wide) |
| `status` | text | NO | `'draft'` | One of: `'draft'`, `'scheduled'` (awaiting publish time), `'published'`, `'archived'` |
| `published_at` | timestamptz | YES | — | When it becomes visible (NULL = immediately on publish status change) |
| `hero_image_url` | text | YES | — | Hero image (free-text URL, can be external domain) |
| `content` | jsonb | NO | `'{}'::jsonb` | Article data — `{ seoTitle, metaDescription, body (markdown), author { name, photo_url, bio }, tags, sources }` |
| `created_by` | uuid | YES | — | FK to `auth.users(id)` — admin who wrote it |
| `created_at` | timestamptz | NO | `now()` | When created |
| `updated_at` | timestamptz | NO | `now()` | When last edited |

**RLS**: Public read (published + past publish date only), admin manage all.

**Indexes**:
- PK: `(id)`
- Unique: `(slug)`
- Composite: `(country, status, published_at DESC)` for public listing query
- `(status, published_at DESC)` — added 2026-08-18; the `country`-leading composite above doesn't help `getNewsArticlesByPolitician(s)`/`getPublishedNewsCountries`, which filter `status`+`published_at` without `country` as a predicate

**Triggers**:
- `news_articles_updated_at`: Auto-updates `updated_at` on each modification.

**Used by**: News list page, Article detail page, Article comment threads (via posts tagged with `news_article_id`).

---

## Admin & Settings

### `site_settings`

Platform-wide configuration flags and metadata.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `setting_key` | text | NO | — | Configuration key (e.g., `'active_theme'`, `'maintenance_mode'`) |
| `setting_value` | jsonb | YES | — | Value (can be string, number, boolean, object, etc.) |
| `updated_at` | timestamptz | YES | `now()` | When changed |

**RLS**: Public read, admin write.

**Used by**: Admin theme panel (reading/setting `active_theme`), moderation settings.

---

### `designations`

Registry of official job titles / office designations per country (e.g., "Mayor", "Councillor", "MP").

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `country` | text | NO | — | Country |
| `name` | text | NO | — | Designation name (e.g., `'Mayor'`) |

**Indexes**:
- PK: `(id)`
- Unique compound: `(country, name)`

---

## Office Holders & Real-World Incumbents

### `office_holders`

Registry of real-world elected officials and appointed appointees — e.g., current mayors, councillors, MPs.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `map_shape_id` | bigint | NO | — | FK to `map_shapes(id)` — which jurisdiction |
| `election_role_type_id` | uuid | NO | — | FK to `election_role_types(id)` — which role |
| `name` | text | NO | — | Official's full name |
| `political_party_id` | uuid | YES | — | FK to `political_parties(id)` — party affiliation (NULL = independent/unaffiliated) |
| `email` | text | YES | — | Contact email |
| `phone` | text | YES | — | Contact phone |
| `photo_url` | text | YES | — | Profile photo (Supabase Storage URL) |
| `website` | text | YES | — | Personal/office website |
| `social_media_handles` | jsonb | YES | — | `{ twitter, facebook, instagram, ... }` — social handles |
| `term_start` | date | YES | — | When term began |
| `term_end` | date | YES | — | When term ends |
| `linked_profile_id` | uuid | YES | — | FK to `profiles(id)` — if this person also has a Choseno account, link it (allow two-way navigation) |
| `updated_by` | uuid | YES | — | FK to `profiles(id)` — admin who last updated this record |
| `is_test_profile` | boolean | YES | `false` | Debug flag |
| `created_at` | timestamptz | YES | `now()` | When added |
| `updated_at` | timestamptz | YES | `now()` | When last updated |

**Indexes**:
- PK: `(id)`
- Unique compound: `(map_shape_id, election_role_type_id)` — one office holder per role per jurisdiction
- `(linked_profile_id)` for finding office holders by Choseno account
- `(election_role_type_id)` — added 2026-08-18; `getOfficeHoldersByRoleTypeIds()` ("select all MLAs"-style bulk queries for the news-import admin tool) filters on this alone, which the compound unique index above (leading with `map_shape_id`) can't serve

**RLS**: Public read, admin write.

**Used by**: Boundary directory pages ("Chain of Representation" — every current officeholder's tree, via `resolveRepresentationBranch()` in `elections.ts`), Feed sidebar's "Current Office Holders" card, news-import admin bulk tagging.

---

## Election Event Data

These tables store historical candidate lists from official government sources (Elections Canada, provincial election offices, etc.) — used for "fetch real candidates" admin feature.

### `federal_election_events`

Historical federal election records.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `country` | text | NO | — | Country (e.g., `'Canada'`) |
| `election_year` | integer | NO | — | Year (e.g., `2021`) |
| `source_url` | text | YES | — | Government source URL |
| `fetched_at` | timestamptz | YES | — | When data was scraped |

---

### `federal_election_candidates`

Candidates from official federal election records.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `election_event_id` | uuid | NO | — | FK to `federal_election_events(id)` |
| `map_shape_id` | bigint | NO | — | FK to `map_shapes(id)` — which riding |
| `candidate_name` | text | NO | — | Official name |
| `party_name` | text | YES | — | Party affiliation from official source |
| `source_data` | jsonb | YES | — | Raw data from government source |

**Indexes**:
- PK: `(id)`
- `(election_event_id)` for all candidates in an election
- `(map_shape_id)` for candidates in a riding
- Unique compound: `(election_event_id, candidate_name, map_shape_id)`

---

### `provincial_election_events` & `provincial_election_candidates`

Same structure as federal equivalents, scoped to provincial/state elections.

---

### `us_federal_election_candidates`

US federal election candidates (House, Senate) from FEC data.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `cycle` | integer | NO | — | Election cycle year (e.g., `2024`) |
| `office` | text | NO | — | `'House'` or `'Senate'` |
| `state` | text | YES | — | State abbreviation |
| `district` | text | YES | — | District number (NULL for Senate) |
| `map_shape_id` | bigint | YES | — | FK to `map_shapes(id)` — if matched to a shape |
| `fec_candidate_id` | text | NO | — | FEC official candidate ID |
| `candidate_name` | text | NO | — | Name from FEC |
| `party_affiliation` | text | YES | — | Party from FEC |
| `source_data` | jsonb | YES | — | Full FEC record |

**Indexes**:
- PK: `(id)`
- `(map_shape_id)` for candidates in a district/state
- `(office, cycle)` for querying all candidates in a cycle
- Unique compound: `(office, cycle, map_shape_id, fec_candidate_id)`

---

## Audit & Analytics

### `user_actions`

Audit log of user actions for analytics — tracks post/comment creation, votes, profile updates.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `politician_id` | uuid | NO | — | Which politician performed the action (part of PK) |
| `user_id` | uuid | NO | — | FK to `profiles(id)` — same as politician_id (part of PK) |
| `action_type` | text | NO | — | Type of action (e.g., `'post_created'`, `'comment_added'`, `'vote'`) (part of PK) |
| `action_date` | date | NO | — | When action occurred (part of PK) |
| `count` | integer | YES | `1` | How many times this action occurred that day |

**Indexes**:
- PK: `(politician_id, user_id, action_type, action_date)`

**RLS**: Admins only.

**Used by**: Admin Analytics dashboard (pending implementation).

---

### `candidacy_claim_invites`

Tokens for inviting unregistered candidates to claim their stub candidacy.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `candidate_id` | uuid | NO | — | FK to `election_candidates(id)` ON DELETE CASCADE |
| `token_hash` | text | NO | — | SHA256 hash of the secret token (unique, indexed for fast lookup) |
| `created_by` | uuid | NO | — | FK to `profiles(id)` — admin who issued the invite |
| `created_at` | timestamptz | YES | `now()` | When issued |
| `claimed_at` | timestamptz | YES | — | When claimed (NULL = not yet claimed) |

**Indexes**:
- PK: `(id)`
- Unique: `(token_hash)`
- `(candidate_id)` for all invites for a candidate

**Used by**: Seat Detail "send claim invite email" action, claim email link handler.

---

### `candidacy_claim_requests`

Self-service claim requests — "this is me, I'm the real person for this candidacy".

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `candidate_id` | uuid | NO | — | FK to `election_candidates(id)` ON DELETE CASCADE; part of unique compound |
| `requester_profile_id` | uuid | NO | — | FK to `profiles(id)` — who's claiming it; part of unique compound |
| `motivation` | text | YES | — | Why they're claiming it |
| `contact_email` | text | YES | — | Requester's email |
| `proof_link` | text | YES | — | URL to proof (social media, official bio, etc.) |
| `status` | text | YES | `'pending'` | `'pending'`, `'approved'`, `'rejected'` |
| `reviewed_by` | uuid | YES | — | FK to `profiles(id)` — admin who reviewed |
| `created_at` | timestamptz | YES | `now()` | When requested |

**Indexes**:
- PK: `(id)`
- Unique compound: `(candidate_id, requester_profile_id)` — can't double-claim same candidacy
- `(candidate_id)` for all claims on a candidacy

**Used by**: Seat Detail "claim this candidacy" form, election admin review queue.

---

## RPC Functions (Key Examples)

The database also includes several PostgreSQL functions (RPCs) that handle complex business logic. Key ones:

- **`create_post()`**: Insert post + tag with caller's current boundaries + update civic score
- **`vote_on_post()`**: Insert/update/delete vote, update post vote counts
- **`apply_for_seat()`**: Validate politician status + election status, upsert application
- **`sync_user_boundary_memberships()`**: Full recompute of user's memberships for a point
- **`add_user_boundary_membership()`**: Add one boundary without recomputing
- **`find_boundaries_by_point()`**: ST_Contains lookup (used by onboarding)
- **`find_shapes_within()`**: ST_Intersects lookup for "shapes inside container"
- **`find_shapes_in_containers()`**: Returns shapes inside a container with properties for entity-type filtering
- **`burn_ghost_identity()`**: Rotate the ghost ID (orphan old posts)
- **`submit_candidate_application()`**: Mark application as submitted + trigger admin review
- **`admin_add_unregistered_candidate()`**: Create a stub candidate for an official candidate

---

## Storage Buckets (Supabase Storage)

The app uses several Supabase Storage buckets:

- **`news-images`**: Public — hero images for news articles, author photos
- **`avatar-images`**: Public — politician profile avatars, office holder photos
- **`candidates`**: Public — unregistered candidate photos
- **`videos`**: Public — politician pitch videos, candidate videos, post videos

All buckets allow public read (via `publicUrl`) but restrict uploads to authenticated users or admins only.

---

## Row Level Security (RLS) Overview

Every table has RLS enabled. General patterns:

- **Public-readable tables** (`map_shapes`, `posts`, `comments`, `elections`, `political_parties`, etc.): `FOR SELECT USING (true)`
- **User-scoped tables** (`profiles`, `user_boundary_memberships`, `user_locations`): `FOR SELECT USING (auth.uid() = profile_id)`
- **Admin-write tables** (`map_shapes`, `countries`, `election_*`): `FOR ALL USING (admin check)` or `FOR ALL WITH CHECK (admin check)`
- **Moderation-safe deletes** (posts, comments): Soft-delete via `removed_by` column + RLS allows public read even if `removed_by IS NOT NULL` (frontend filters)

---

## Key Indexes

High-impact indexes (the ones powering performance-critical queries):

- **`map_shapes` GIST index on geometry**: `ST_Contains`, `ST_Intersects` queries for boundary lookups
- **`map_shapes.type_country` compound**: Fast "get all Municipalities in Canada" queries
- **`user_boundary_memberships.map_shape_id`**: "All users in this boundary" for analytics
- **`posts.ghost_id`**: "All posts by this ghost ID"
- **`election_candidates.seat_id`**: "All candidates in this seat"
- **`news_articles_public_idx` on `(status, published_at, country)`**: Public article listing query
- **`content_reports` composite on `(target_id, status, abuse_type, target_type)`**: Admin moderation queue

---

## Data Integrity Notes

- **Soft deletes**: Posts and comments use `removed_by` column (admin deletes set this, RLS allows reads regardless, frontend filters). Nothing is hard-deleted.
- **Ghost ID rotation**: When a user burns their ghost ID, old posts/comments keep their old ghost_id; the identity just becomes "orphaned" (no longer associated with any profile).
- **Boundary membership sync**: Automatic triggers (`reconcile_shape_memberships`) keep memberships in sync when shapes are edited/uploaded. Users don't need to re-onboard if boundaries change.
- **Post boundary snapshots**: `post_boundaries` is immutable — changing your own memberships later doesn't affect old posts' visibility.
- **FK constraints**: Mostly present except `profiles.id` → `auth.users.id` (dropped for flexibility) and `posts.ghost_id` (no FK, rotates independently).

---

## How It All Fits Together

1. **Onboarding**: User enters location → `sync_user_boundary_memberships()` finds all containing shapes → populates `user_boundary_memberships`
2. **Posting**: User creates post → `create_post()` snapshots their current memberships into `post_boundaries` → post appears in those boundaries' feeds
3. **Elections**: Admin creates election + seats (bounded by shapes) → politicians apply → candidates show up on seat pages and politician election list
4. **Candidates answer questions**: For each question, one row in `election_candidate_answers` (+ optional options in `election_candidate_answer_options` for multi-select)
5. **Voters discuss**: Comments on answers go in `election_answer_comments` (threaded, anonymous)
6. **Moderation**: Reports go in `content_reports`, admins review and soft-delete via `removed_by` column on posts/comments
7. **Analytics**: Admin dashboard would query `user_actions`, `posts` counts by boundary, engagement metrics (pending full implementation)
