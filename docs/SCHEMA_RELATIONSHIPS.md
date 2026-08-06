# Choseno — Schema Entity Relationships

Visual guide to how the main tables relate to each other. For complete column details, see [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md).

---

## Core User & Location Flow

```
auth.users
    ↓ (trigger: on_auth_user_created)
profiles
    ├─→ user_locations (1:1 via profile_id, unique index)
    │       └─→ [Geo coordinates used by sync_user_boundary_memberships()]
    │
    ├─→ user_boundary_memberships (1:M)
    │       └─→ map_shapes (FK: map_shape_id)
    │
    ├─→ posts (1:M via ghost_id or direct posts)
    │   └─→ post_boundaries (posts → map_shapes)
    │   └─→ comments (1:M)
    │   └─→ post_votes (1:M via ghost_id)
    │
    └─→ politician_profiles (1:1 extension for politician role)
            └─→ political_parties (FK: political_party_id)
```

---

## Boundaries & Geography

```
countries
    ├─→ country_boundary_types (1:M)
    │       ├─→ map_shapes (FK: country, boundary_type)
    │       │   ├─→ boundary_uploads (FK: upload_id)
    │       │   ├─→ user_boundary_memberships (1:M)
    │       │   ├─→ post_boundaries (1:M)
    │       │   └─→ shape_containers (map_shape_id as child)
    │       │       └─→ shape_containers (container_shape_id as parent)
    │       │           └─→ map_shapes [hierarchical: children inside parents]
    │       │
    │       └─→ election_role_types (FK: country, boundary_type)
    │
    ├─→ political_parties (1:M)
    │       └─→ politician_profiles
    │
    └─→ entity_types (1:M)
            └─→ [Metadata about entity-type subtypes, e.g., City/Town/Village within Municipal]
```

---

## Elections Workflow

```
elections (status: draft → nominations_open → active → closed)
    ├─→ election_seats (1:M)
    │   ├─→ map_shapes (FK: map_shape_id, jurisdiction)
    │   │
    │   ├─→ election_candidates (1:M)
    │   │   ├─→ profiles (politician_id)
    │   │   │   └─→ politician_profiles
    │   │   │
    │   │   ├─→ election_candidate_answers (1:M per question)
    │   │   │   ├─→ election_questions (FK: question_id)
    │   │   │   ├─→ election_candidate_answer_options (1:M for multi-select)
    │   │   │   │   └─→ election_question_options
    │   │   │   │       └─→ election_questions
    │   │   │   │
    │   │   │   └─→ election_answer_comments (1:M)
    │   │   │       └─→ [Anonymous discussion per answer]
    │   │   │
    │   │   ├─→ posts (1:M, election_candidate_id)
    │   │   │   └─→ comments (1:M)
    │   │   │   └─→ post_votes (1:M)
    │   │   │
    │   │   └─→ candidacy_claim_invites (1:M)
    │   │       └─→ [Email invite tokens for stub candidates]
    │   │
    │   │   candidacy_claim_requests (1:M)
    │   │       └─→ [Self-service claim requests]
    │   │
    │   └─→ election_administrators (1:M)
    │       └─→ profiles (volunteer)
    │
    └─→ election_questions (1:M)
        ├─→ election_question_options (1:M for single/multi-select)
        │
        └─→ election_notification_dismissals (1:M)
            └─→ profiles (who dismissed banner)
```

---

## Posts & Social Feeds

```
posts
├─→ post_boundaries (M:M with map_shapes)
│   └─→ [Snapshot: which boundaries were the poster in at post time]
│
├─→ comments (1:M)
│   ├─→ [Anonymous, via ghost_id]
│   └─→ [Soft-deleted: removed_by admin timestamp]
│
├─→ post_votes (1:M)
│   └─→ [Anonymous votes: 1 (like) or -1 (dislike)]
│
├─→ election_candidate_id (optional FK)
│   └─→ election_candidates [Campaign post]
│
├─→ news_article_id (optional FK)
│   └─→ news_articles [Comment on article]
│
└─→ wall_ghost_id (optional)
    └─→ [Politician's wall post, owner-pinned in discussions]
```

---

## News Platform

```
news_articles (status: draft → scheduled → published → archived)
├─→ posts (M:1, news_article_id)
│   ├─→ comments (1:M, anonymous)
│   └─→ post_votes (1:M)
│
└─→ [Content JSONB: seoTitle, metaDescription, body (markdown), author { name, photo, bio }, tags, sources]
```

---

## Office Holders & Real-World Incumbents

```
office_holders
├─→ map_shapes (FK: jurisdiction)
├─→ election_role_types (FK: which role)
├─→ political_parties (FK: party affiliation, optional)
└─→ profiles (FK: linked_profile_id, optional)
    └─→ [Link real world official to Choseno account if they join]
```

---

## Historical Election Data (Scraping)

```
federal_election_events
├─→ federal_election_candidates (1:M)
│   ├─→ map_shapes (FK: riding)
│   └─→ [Source: Elections Canada, FEC data, etc.]
│
provincial_election_events
├─→ provincial_election_candidates (1:M)
│
us_federal_election_candidates
├─→ map_shapes (FK: optional, may not be matched)
└─→ [Source: FEC API]
```

---

## Moderation & Reporting

```
content_reports
├─→ moderation_rules (FK: abuse_type)
├─→ profiles (reporter_id, optional)
└─→ [Target: { target_type: 'post' | 'comment', target_id }]
    ├─→ posts [if post]
    └─→ comments [if comment]
```

---

## Admin & Configuration

```
site_settings
└─→ [Platform-wide config: active_theme, etc.]

countries
├─→ country_boundary_types
├─→ political_parties
└─→ entity_types

designations
└─→ [Office title registry per country]
```

---

## Key Data Flow Patterns

### 1. Boundary Membership Sync

```
User signs up
    ↓
Onboarding: "Detect My Location" button
    ↓
Client calls sync_user_boundary_memberships(lat, lng)
    ↓
RPC: ST_Contains query → finds all map_shapes containing point
    ↓
Inserts into user_boundary_memberships (replaces prior)
    ↓
User can now post (posts tagged with all their boundaries)
    ↓
On map_shapes geometry edit: trigger reconciles all users' memberships
```

### 2. Post Creation & Scoping

```
User creates post via create_post(content, image, video, etc.)
    ↓
RPC: Fetch user's current ghost_id, country, civic_score
    ↓
Insert into posts (with civic_score snapshot)
    ↓
Query user's current user_boundary_memberships
    ↓
Insert N rows into post_boundaries (one per membership)
    ↓
Post now appears in:
  - User's own boundary tabs (Feed)
  - Country tab (scoped by country)
  - International tab (if is_international=true)
```

### 3. Election Candidate Application

```
Politician navigates to seat
    ↓
Clicks "Nominate Yourself"
    ↓
Routes to /apply/:seatId
    ↓
Fills in statement + answers questionnaire + records intro video
    ↓
Submits: calls submit_candidate_application()
    ↓
RPC: Validates election.status = 'nominations_open'
    ↓
Insert into election_candidates (status='submitted')
    ↓
Admin reviews, approves/rejects
    ↓
On approval: candidate wall goes live, other politicians can comment
```

### 4. Boundary Filtering (Visualizer & Elections)

```
Admin: "Show me all Municipalities in BC"
    ↓
Selects: Country=Canada, Container=British Columbia, Type=Municipal
    ↓
Frontend calls findShapesInContainers(container_id, 'Municipal', 'Canada')
    ↓
RPC: Query map_shapes WHERE boundary_type = 'Municipal' 
       AND ST_Contains(container.geom, shape.geom)
       AND properties.CSDTYPE in [selected entity types]
    ↓
Returns 160 shapes (BC municipalities)
    ↓
Renders on map OR shows in seat-creation checkbox list
```

---

## Table Dependencies (Deletion Cascade)

All FKs use ON DELETE CASCADE except where noted:

```
profiles ← [ON DELETE CASCADE from auth.users]
├─→ user_boundary_memberships
├─→ user_locations
├─→ posts
├─→ politician_profiles
├─→ elections
└─→ [50+ tables referencing profile IDs]

map_shapes ← [ON DELETE CASCADE from boundary_uploads & country_boundary_types]
├─→ election_seats
├─→ user_boundary_memberships
├─→ post_boundaries
├─→ shape_containers
└─→ [10+ tables]

elections ← [ON DELETE CASCADE]
├─→ election_seats
├─→ election_questions
├─→ election_notification_dismissals
└─→ [candidates, etc. cascade from seats]
```

**Important**: Deleting a country cascades to its boundary types, all shapes, all seats, all candidates — entire jurisdiction wiped. Admins use soft-deletes (`retired_at` on shapes) for safe cleanup instead.

---

## Access Control (RLS) Quick Reference

| Table | Public Read | User Scoped | Admin Only |
|-------|-------------|-------------|-----------|
| `profiles` | — | Self | ✓ (see own, manage own) |
| `posts` | ✓ | — | Soft-delete |
| `comments` | ✓ | — | Soft-delete |
| `post_votes` | ✓ | — | — |
| `map_shapes` | ✓ | — | ✓ (write) |
| `elections` | ✓ (non-draft) | — | ✓ |
| `election_candidates` | ✓ (non-draft) | Own draft/update | ✓ |
| `news_articles` | ✓ (published) | — | ✓ |
| `content_reports` | — | Insert own | ✓ |
| `user_boundary_memberships` | — | Self only | — |
| `user_locations` | — | Self only | — |
| `site_settings` | ✓ (read) | — | ✓ (write) |

---

## Query Patterns

### Find posts by a user's boundaries

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
SELECT ec.*, profiles.full_name, profiles.avatar_url
FROM election_candidates ec
JOIN profiles ON ec.politician_id = profiles.id
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

### Analytics: Posts per boundary type per country

```sql
SELECT 
  ms.country,
  ms.boundary_type,
  COUNT(DISTINCT pb.post_id) as post_count
FROM map_shapes ms
LEFT JOIN post_boundaries pb ON ms.id = pb.map_shape_id
GROUP BY ms.country, ms.boundary_type
ORDER BY post_count DESC;
```

---

## Notes for Future Schema Changes

- **FK to auth.users**: Deliberately avoided (dropped in migration) to allow flexibility in auth system. Use `profiles.id` as the canonical user PK.
- **Ghost ID rotation**: No hard FK on `posts.ghost_id` → `profiles.current_ghost_id` because the ID rotates (identity orphans). If you need to find posts by current user, join `profiles.current_ghost_id`.
- **Soft deletes**: `posts.removed_by` and `comments.removed_by` — use these instead of hard deletes to preserve referential integrity (e.g., posts with old comments can still exist).
- **Properties JSONB**: `map_shapes.properties` is free-form; typically contains `{ CSDTYPE, region, ... }` from source data. Query via `properties->>'CSDTYPE'` for type-specific filters.
- **Boundary coverage gaps**: If a user's location falls outside all uploaded shapes, they have zero memberships (valid, not an error — admin just hasn't uploaded shapes for their area yet).
