# Politician Wall Feature

A dedicated social profile page for elected officials, separate from campaign pages, showing engagement metrics, support tracking, and constituent interaction.

---

## Overview

Every politician gets a persistent **Politician Wall** at `/wall/:ghostId/:slug`:
- **Distinct from candidacy pages**: A wall is the politician's *own* profile; a candidacy is per-election campaign
- **Engagement hub**: Show supporters, ratings, constituent posts/comments, endorsements
- **Linked to news**: Relevant articles surface here
- **Visitor experience**: Support button, QR share, public posts/comments

---

## Key Screens & Features

### Wall Header (`/wall/:ghostId/:slug`)

**Sticky top section**:
- **Cover photo** (hero image, currently a gradient fallback)
- **Politician info**:
  - Avatar + full name
  - Role(s) & jurisdiction (e.g., "MPP for York South-Weston")
  - Party badge (colored per party)
- **Stats row**: 
  - 💚 **Support count** (from `politician_ratings` where vote_type='support')
  - ⭐ **Avg rating** (from `politician_engagement_summaries`)
  - 💬 **Posts/comments** count
- **CTA buttons**:
  - 💚 **"Show Support"** toggle (adds a support vote if not already rated; removes if already support)
  - **"View Supporters"** (owner-only modal showing Ghost IDs of all supporters)
  - **Share QR** popover (scan to visit this URL)

### Wall Composer (Owner-Only)

Full text/image/video/link posting (same as Feed):
- `PostCard` component reuse
- Posts tagged to all politician's constituencies
- Videos surface in "Stories" strip above feed

### Wall Feed

**Tab split** (owner sees both tabs; visitors see "All"):
1. **All** — every post from the politician + visitor comments
2. **My Posts** (owner) — filter to owner's posts only
3. **Reviews & Comments** (owner) — filter to visitor posts only

**Sorting**: By engagement (top first), or newest first (viewer preference).

### Related News

**Section below feed** or in sidebar:
- Articles tagged to this politician (`news_article_politicians`)
- Shows headline, published date, excerpt
- Links to `/news/[slug]`

### Engagement Stats Dashboard

**Owner-only collapsible panel** ("How constituents view you"):
- Average rating + breakdown (% 5-star, % 4-star, etc.)
- Support vs. disapprove split
- Rating trend (↑↓ week-over-week)
- Geographic heat map of supporters (if we have region-tagged Ghost IDs in future)

---

## Schema

### `politician_profiles`

**New fields** (migration 20260809000001):
- `avatar_url` (text) — Politician's headshot for wall display
- `banner_url` (text) — Cover photo for wall header
- `bio` (text) — Expanded bio beyond the short version from office_holders
- `public_links` (jsonb, optional) — Twitter, website, etc. (`{ "twitter": "...", "website": "..." }`)

### `profiles` (Politician Role)

Links a `politician_profiles` row to an account:
- `current_ghost_id` (text) — One Ghost ID per politician (reuses system, doesn't rotate)
- `constituency` (text) — e.g., "York South-Weston" (denormalized for display)
- `role` (text) — `'politician'`

**Why Ghost ID?** Politicians *could* use their real name, but Ghost ID provides:
- Anonymity option (post as "Politician E7C3D" if preferred)
- Unified identity across all walls/posts (one Ghost ID per politician, never rotates)
- Consistency with the app's comment/post threading (all users use Ghost IDs)

### `politician_ratings` (See RATINGS_SYSTEM.md)

Tracked per politician, linked via `politician_profiles.id`.

### `politician_engagement_summaries` (See RATINGS_SYSTEM.md)

Cached aggregates: avg rating, support/disapprove counts, trend.

---

## URL Structure

| Route | Params | Example | Access |
|---|---|---|---|
| `/wall/:ghostId/:slug` | ghostId, slug | `/wall/e7c3d/doug-ford` | Public |
| `/wall/:ghostId` | ghostId | `/wall/e7c3d` | Public (redirects to first slug) |

**Slug generation** (from SLUG_UTILS):
```ts
// "Doug Ford" → "doug-ford"
// "R.J. Simpson" → "rj-simpson"
const slug = makePoliticianSlug(fullName);
```

**Ghost ID assignment**:
- Auto-assigned on first politician setup (from onboarding step 4 or profile edit)
- Static per politician (same ID across all walls/posts)
- Visible to owner in settings ("Your Public Identity")

---

## Admin Creation Flow

**When office_holders auto-creates a politician profile** (from `populate-*.py` scripts):

```sql
-- Create profile + politician_profiles in one transaction
INSERT INTO profiles (
  id, role, full_name, country, constituency, current_ghost_id, ...
) VALUES (...);

INSERT INTO politician_profiles (
  id, avatar_url, bio, ...
) VALUES (...);
```

**When a politician signs up manually** (becomes politician via onboarding):
- Same process, but driven from the onboarding step, not a script
- Ghost ID generated fresh
- Wall is auto-live as soon as the profile is saved

---

## Components

| File | Purpose |
|---|---|
| [`PoliticianWallClient.tsx`](../src/components/features/PoliticianWallClient.tsx) | Main wall page (feed + header) |
| [`PoliticianSidebar.tsx`](../src/components/features/PoliticianSidebar.tsx) | Profile info card (sticky left) |
| [`PoliticianEngagementStats.tsx`](../src/components/features/PoliticianEngagementStats.tsx) | Rating/support dashboard |
| [`PoliticianRatingModal.tsx`](../src/components/features/PoliticianRatingModal.tsx) | Star rating UI |
| [`PostCard.tsx`](../src/components/features/PostCard.tsx) | Post/comment rendering (shared) |

---

## Services

| Function | Purpose |
|---|---|
| `getPoliticianWall()` | Fetch politician + wall posts |
| `getEngagementSummary()` | Rating stats + trends |
| `ratePolitician()` | Submit 1-5 rating |
| `supportPolitician()` | Toggle support vote |
| `getSupporters()` | Owner-only list of Ghost IDs |

All in [`src/lib/services/politicianWall.ts`](../src/lib/services/politicianWall.ts).

---

## Related Features

- **Office Holders Admin**: Bulk-create politician walls via [`populate-national-and-province-heads.py`](../scripts/populate-national-and-province-heads.py)
- **News Tagging**: Articles linked via `news_article_politicians` (see NEWS_TAGGING.md)
- **Ratings**: 1-5 stars + 6-month cooldown (see RATINGS_SYSTEM.md)
- **Posts/Comments**: Reuse Feed infrastructure (PostCard, Ghost ID threading)

---

## Future Enhancements

- [ ] Photo gallery: upload multiple images to politician profile
- [ ] Policy stands: structured Q&A linked to constituencies
- [ ] Event calendar: announced town halls, office hours
- [ ] Donation/volunteer links: redirect to external fundraising/organizing
- [ ] Messaging: constituents send DMs (moderated by politician)
- [ ] Badge system: "Endorsed by [Org]" or "Verified Official" badges
