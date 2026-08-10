# Politician Ratings System

A constituent-to-politician feedback mechanism allowing users to rate politicians on a 1-5 scale with support/approval tracking.

---

## Overview

The ratings system lets voters express approval/disapproval of politicians with time-based constraints to prevent spam and enable periodic re-evaluation.

### Key Facts

- **1-5 star scale** backed by `politician_ratings` table
- **Rate once per politician per 6-month window** (rolling, not calendar-based)
- **Linked to Ghost ID** (anonymous, like wall posts/comments)
- **Vote types**: Support (+1), Neutral (0), Disapprove (-1)
- **Aggregated into `politician_engagement_summaries`** for dashboard display

---

## Schema

### `politician_ratings`
- `id` (uuid, PK)
- `politician_profile_id` (uuid, FK → `politician_profiles`)
- `rating` (int, 1-5)
- `vote_type` (text: 'support', 'neutral', 'disapprove')
- `ghost_id` (text) - Anonymous voter identity
- `created_at` (timestamp)
- **Constraints**:
  - One rating per `(politician_profile_id, ghost_id)` per 6 months
  - Auto-updated on re-rate (same `ghost_id` within 6 months = update)

### `politician_engagement_summaries`
- Cached aggregate: avg rating, support/disapprove counts, rating change week-over-week
- Triggers regenerate on `politician_ratings` insert/update
- Used for politician wall dashboard ("How constituents view you")

---

## How to Use

### Rate a Politician (Frontend)

In `PoliticianRatingModal.tsx`:
```tsx
import { ratePolitician } from '@/lib/services/ratings';

// User clicks star, sees options (support/neutral/disapprove)
await ratePolitician(supabase, politicianProfileId, rating, voteType);
```

### Query Ratings (Backend)

From `src/lib/services/ratings.ts`:
```ts
// Get a politician's average rating
const { data: summary } = await supabase
  .from('politician_engagement_summaries')
  .select('*')
  .eq('politician_profile_id', id)
  .single();

// Check if user can rate (6-month cooldown)
const { data: lastRating } = await supabase
  .from('politician_ratings')
  .select('created_at')
  .eq('politician_profile_id', id)
  .eq('ghost_id', ghostId)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (lastRating && isWithin6Months(lastRating.created_at)) {
  // Show "You can rate again on [date]"
}
```

---

## 6-Month Rolling Window

The cooldown is **not** calendar-based (Jan 1—Jun 30, etc.); it's rolling from the date of your last rating:

| Your last rating | You can rate again on |
|---|---|
| Jan 15, 2026 | Jul 15, 2026 |
| Feb 3, 2026 | Aug 3, 2026 |

Enforced by RLS policy:
```sql
CREATE POLICY "one_rating_per_6_months" ON politician_ratings
AS RESTRICTIVE FOR INSERT TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM politician_ratings pr
    WHERE pr.politician_profile_id = NEW.politician_profile_id
      AND pr.ghost_id = NEW.ghost_id
      AND pr.created_at > NOW() - INTERVAL '6 months'
  )
);
```

On re-rate (same user, within 6 months), the insert becomes an update via trigger.

---

## Display & Analytics

### Politician Wall Dashboard (`PoliticianEngagementStats`)

Shows:
- **Average rating** (1.0—5.0 stars with decimals)
- **Support vs. Disapprove** split (stacked bar or side-by-side)
- **Rating trend** (↑↓ icon + % change from last week)
- **"N people rated you"** count

Backed by `politician_engagement_summaries` (refreshed on each new rating).

### Admin Analytics

If admin analytics covers politician engagement:
- Visible in `/admin/analytics` if a politician-ratings dashboard exists there
- Real-time from `politician_engagement_summaries`

---

## RLS & Access Control

- **Anonymous**: Ghost ID, never requires auth (any signed-in user can rate)
- **No owner-visibility of voters**: Admins can't see which Ghost IDs voted what
- **No vote manipulation**: RLS enforces once-per-6-months on insert; PostgreSQL trigger prevents duplicates

---

## Related Files

- **Service**: [`src/lib/services/ratings.ts`](../src/lib/services/ratings.ts)
- **Component**: [`src/components/features/PoliticianRatingModal.tsx`](../src/components/features/PoliticianRatingModal.tsx)
- **Stats Display**: [`src/components/features/PoliticianEngagementStats.tsx`](../src/components/features/PoliticianEngagementStats.tsx)
- **Migrations**:
  - [`supabase/migrations/20260808000000_politician_ratings.sql`](../supabase/migrations/20260808000000_politician_ratings.sql)
  - [`supabase/migrations/20260808000001_politician_rating_once_only.sql`](../supabase/migrations/20260808000001_politician_rating_once_only.sql)
  - [`supabase/migrations/20260808000002_politician_rating_six_month_cooldown.sql`](../supabase/migrations/20260808000002_politician_rating_six_month_cooldown.sql)
  - [`supabase/migrations/20260808000003_politician_engagement_summaries.sql`](../supabase/migrations/20260808000003_politician_engagement_summaries.sql)

---

## Future Enhancements

- [ ] Breakdown by rating scale (% 1-star, % 2-star, etc.) in admin panel
- [ ] Politician ability to see aggregate feedback ("67% support" but not vote details)
- [ ] Spam detection: flag sudden rating floods (10+ in 1 minute)
- [ ] A/B testing: different engagement messages for high vs. low-rated politicians
