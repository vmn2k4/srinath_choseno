# Supabase Tables — Complete Index

Quick lookup table for all 44 tables in the Choseno database. For details, see [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md).

---

## All Tables (Alphabetical)

| Table | Purpose | Key Columns | Relationships |
|-------|---------|------------|---|
| `boundary_uploads` | Track boundary file upload batches | `id`, `name`, `country`, `boundary_type`, `uploaded_by`, `expected_count`, `completed_at` | ← `profiles(uploaded_by)`; → `map_shapes(upload_id)` |
| `candidacy_claim_invites` | Email invite tokens for stub candidates to claim | `id`, `candidate_id`, `token_hash`, `created_by`, `claimed_at` | ← `profiles(created_by)`; → `election_candidates(candidate_id)` |
| `candidacy_claim_requests` | Self-service claim requests | `id`, `candidate_id`, `requester_profile_id`, `status`, `reviewed_by` | ← `profiles(requester_profile_id, reviewed_by)`; → `election_candidates(candidate_id)` |
| `comments` | Threaded discussion replies | `id`, `post_id`, `ghost_id`, `content`, `removed_by` | → `posts(post_id)`; ← `profiles(removed_by)` |
| `content_reports` | Moderation reports (spam, abuse, etc.) | `id`, `target_type`, `target_id`, `reporter_id`, `abuse_type`, `status` | → `profiles(reporter_id)`; → `moderation_rules(abuse_type)` |
| `countries` | Canonical country list | `name` (PK), `code`, `flag_emoji` | Referenced by 6+ tables |
| `country_boundary_types` | Registry of boundary types per country | `id`, `country`, `type_name`, `rank`, `is_container`, `admin_only` | → `countries(country)`; ← `map_shapes`, `election_role_types` |
| `designations` | Office title registry | `id`, `country`, `name` | Just a lookup table |
| `election_administrators` | Volunteer moderators for seats | `id`, `seat_id`, `profile_id`, `status`, `reviewed_by` | → `election_seats(seat_id)`; → `profiles(profile_id, reviewed_by)` |
| `election_answer_comments` | Voter discussion on candidate answers | `id`, `answer_id`, `ghost_id`, `content`, `removed_by` | → `election_candidate_answers(answer_id)`; ← `profiles(removed_by)` |
| `election_candidate_answer_options` | Selected options for multi-select answers | `id`, `answer_id`, `option_id`, `rank` | → `election_candidate_answers(answer_id)`; → `election_question_options(option_id)` |
| `election_candidate_answers` | Candidate's answer to a questionnaire question | `id`, `candidate_id`, `question_id`, `selected_option_id`, `answer_text`, `rating_value`, `video_url` | → `election_candidates(candidate_id)`; → `election_questions(question_id)`; → `election_question_options(selected_option_id)` |
| `election_candidates` | Politician's application for a seat | `id`, `seat_id`, `politician_id`, `status`, `statement`, `intro_video_url`, `reviewed_by`, `added_by_election_admin_id` | → `election_seats(seat_id)`; → `profiles(politician_id, reviewed_by, added_by_election_admin_id)`; ← `posts(election_candidate_id)` |
| `election_notification_dismissals` | Tracks dismissed "active election" banners | `election_id`, `profile_id`, `dismissed_at` | → `elections(election_id)`; → `profiles(profile_id)` |
| `election_question_options` | Answer choices for single/multi-select questions | `id`, `question_id`, `option_text`, `sort_order` | → `election_questions(question_id)` |
| `election_questions` | Questionnaire questions for candidates to answer | `id`, `election_id`, `question_text`, `question_type`, `is_required`, `is_public`, `allow_video_answer` | → `elections(election_id)`; ← `election_question_options`, `election_candidate_answers` |
| `election_role_types` | Which roles available per (country, boundary_type) | `id`, `country`, `boundary_type`, `role_key`, `role_title`, `region_override`, `description` | → `country_boundary_types(country, type_name)`; ← `office_holders` |
| `election_seats` | One per (election, boundary, role) | `id`, `election_id`, `map_shape_id`, `role_title` | → `elections(election_id)`; → `map_shapes(map_shape_id)`; ← `election_candidates`, `election_administrators` |
| `elections` | Top-level election event | `id`, `name`, `election_date`, `status`, `created_by` | → `profiles(created_by)`; ← `election_seats`, `election_questions`, `election_notification_dismissals` |
| `entity_types` | Entity-type subtypes (City, Town, Village, etc.) | `id`, `country`, `boundary_type`, `name`, `code`, `description` | → `countries(country)` |
| `federal_election_events` | Historical federal election records | `id`, `country`, `election_year`, `source_url`, `fetched_at` | Just data; ← `federal_election_candidates` |
| `federal_election_candidates` | Candidates from Elections Canada | `id`, `election_event_id`, `map_shape_id`, `candidate_name`, `party_name` | → `federal_election_events(election_event_id)`; → `map_shapes(map_shape_id)` |
| `map_shapes` | Electoral boundaries (ridings, municipalities, provinces, etc.) | `id`, `country`, `boundary_type`, `name`, `code`, `properties`, `geom`, `retired_at`, `upload_id` | → `country_boundary_types(country, type_name)`; → `boundary_uploads(upload_id)`; ← Many tables |
| `moderation_rules` | Reportable abuse types | `abuse_type` (PK), `description` | ← `content_reports` |
| `news_articles` | Editorial articles | `id`, `slug`, `headline`, `category`, `country`, `province`, `status`, `published_at`, `hero_image_url`, `content` | ← `posts(news_article_id)` |
| `office_holders` | Real-world elected officials | `id`, `map_shape_id`, `election_role_type_id`, `name`, `political_party_id`, `email`, `phone`, `term_start`, `term_end`, `linked_profile_id` | → `map_shapes(map_shape_id)`; → `election_role_types(election_role_type_id)`; → `political_parties(political_party_id)`; → `profiles(linked_profile_id, updated_by)` |
| `political_parties` | Party registry | `id`, `country`, `name`, `color_hex` | → `countries(country)`; ← `politician_profiles`, `office_holders` |
| `politician_profiles` | Extended profile for politicians | `id` (FK), `political_party_id`, `education`, `hometown`, `bio`, `avatar_url` | ← `profiles(id)` (1:1 extension); → `political_parties(political_party_id)` |
| `politician_supporters` | Support/endorsement tracking | `politician_id`, `supporter_id` | → `profiles(politician_id, supporter_id)` |
| `post_boundaries` | Snapshot of which boundaries a post belongs to | `post_id`, `map_shape_id` | → `posts(post_id)`; → `map_shapes(map_shape_id)` |
| `post_votes` | Upvote/downvote on posts | `post_id`, `ghost_id`, `vote_type`, `created_at` | → `posts(post_id)` |
| `posts` | User-generated content (Feed posts, wall posts, etc.) | `id`, `ghost_id`, `content`, `image_url`, `video_url`, `country`, `is_country`, `is_international`, `election_candidate_id`, `news_article_id`, `wall_ghost_id`, `civic_score_snapshot`, `removed_by` | → `election_candidates(election_candidate_id)`; → `news_articles(news_article_id)`; → `profiles(removed_by)`; ← `comments`, `post_votes`, `post_boundaries` |
| `profiles` | User accounts | `id` (PK), `role`, `full_name`, `country`, `current_ghost_id`, `onboarding_completed`, `civic_score`, `avatar_url`, `is_test_profile` | Linked to `auth.users(id)` (no FK); ← Many tables |
| `provincial_election_events` | Historical provincial election records | `id`, `country`, `province`, `election_year`, `source_url`, `fetched_at` | Just data; ← `provincial_election_candidates` |
| `provincial_election_candidates` | Candidates from provincial elections | `id`, `election_event_id`, `map_shape_id`, `candidate_name`, `party_name` | → `provincial_election_events(election_event_id)`; → `map_shapes(map_shape_id)` |
| `shape_containers` | Denormalized cache: which shapes contain which | `map_shape_id`, `container_shape_id` | Both FK → `map_shapes(id)` |
| `site_settings` | Platform-wide configuration | `id`, `setting_key`, `setting_value`, `updated_at` | Singleton lookup table |
| `us_federal_election_candidates` | US FEC candidates (House, Senate) | `id`, `cycle`, `office`, `state`, `district`, `map_shape_id`, `fec_candidate_id`, `candidate_name`, `party_affiliation` | → `map_shapes(map_shape_id)` |
| `user_actions` | Audit log for analytics | `politician_id`, `user_id`, `action_type`, `action_date`, `count` | → `profiles(user_id)` |
| `user_boundary_memberships` | Which boundaries a user belongs to | `profile_id`, `map_shape_id`, `updated_at` | → `profiles(profile_id)`; → `map_shapes(map_shape_id)` |
| `user_locations` | User's geo-coordinates | `id`, `profile_id`, `latitude`, `longitude` | → `profiles(profile_id)` |

---

## By Category

### Core User Data (5)
`profiles`, `user_locations`, `user_boundary_memberships`, `politician_profiles`, `politician_supporters`

### Boundaries & Geography (6)
`map_shapes`, `shape_containers`, `boundary_uploads`, `country_boundary_types`, `countries`, `entity_types`

### Posts & Social (6)
`posts`, `comments`, `post_votes`, `post_boundaries`, `content_reports`, `moderation_rules`

### Elections (11)
`elections`, `election_seats`, `election_candidates`, `election_questions`, `election_question_options`, `election_candidate_answers`, `election_candidate_answer_options`, `election_answer_comments`, `election_administrators`, `election_role_types`, `election_notification_dismissals`

### Politicians (3)
`politician_profiles`, `political_parties`, `politician_supporters`

### News (1)
`news_articles`

### Office Holders (2)
`office_holders`, `election_role_types`

### Historical Election Data (5)
`federal_election_events`, `federal_election_candidates`, `provincial_election_events`, `provincial_election_candidates`, `us_federal_election_candidates`

### Admin & Config (3)
`site_settings`, `designations`, `boundary_uploads`

### Audit & Claims (3)
`user_actions`, `candidacy_claim_invites`, `candidacy_claim_requests`

---

## Statistics

| Metric | Value |
|--------|-------|
| **Total Tables** | 44 (excluding PostGIS internals) |
| **Primary Keys** | 44 (UUID or compound) |
| **Foreign Keys** | ~68 relationships |
| **Indexes** | ~99 (PKs, FKs, compound, spatial GIST) |
| **RLS Policies** | Every table enabled |
| **Tables with soft deletes** | 2 (`posts`, `comments` via `removed_by`) |
| **Tables with JSONB columns** | 4 (`map_shapes.properties`, `news_articles.content`, `office_holders.social_media_handles`, `user_actions.count` type) |
| **PostGIS spatial tables** | 1 (`map_shapes.geom`) |

---

## Rows of Interest (Estimated)

| Table | ~Rows | Why |
|-------|-------|-----|
| `map_shapes` | 100k–500k | Every electoral boundary ever uploaded (ridings, MDs, municipalities, etc.) |
| `posts` | 10k–100k | User-generated content accumulates over time |
| `comments` | 50k–500k | Discussion threads on posts |
| `user_boundary_memberships` | 10x accounts | Every user × their boundary count (~5–20 per user avg) |
| `federal_election_candidates` | ~2k | One per (election, riding) in each federal election |
| `election_candidates` | 100s–1000s | Varies by election size |
| `political_parties` | ~50 | ~5 per country × ~10 countries |
| Everything else | <10k | Config, metadata, audit trails |

---

## Schema Maturity

✅ **Stable** — Core tables (`profiles`, `map_shapes`, `posts`, `comments`) unlikely to change.

🟡 **Maturing** — `elections` + related still getting minor tweaks (questionnaire flexibility added mid-project).

🟢 **New** — `office_holders`, `entity_types` infrastructure ready but not yet fully populated.

🔴 **Unused** — `user_actions` table exists; admin Analytics dashboard that would query it not yet implemented.

---

## Next Steps

1. **Understand the current state**: Read [SCHEMA_QUICK_START.md](SCHEMA_QUICK_START.md)
2. **Dive deep on a feature**: Start with the relevant section in [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md)
3. **See the data relationships**: Refer to [SCHEMA_RELATIONSHIPS.md](SCHEMA_RELATIONSHIPS.md) for flow diagrams
4. **Check ARCHITECTURE.md** (§23–33) for historical context on why tables exist
