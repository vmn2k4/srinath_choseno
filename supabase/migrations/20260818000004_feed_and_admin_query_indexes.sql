-- Second pass of index additions, found by cross-referencing every
-- .eq()/.in()/.order() in src/lib/services/** against what's already
-- indexed (see 20260818000003 for the first three: politician_supporters
-- .supporter_id, profiles.current_ghost_id, posts.wall_ghost_id).
--
-- Same discipline as that migration: only columns a real, traced query
-- filters or sorts on without existing index support earned one here.
-- `posts` in particular is the highest-write-volume table in the app (every
-- user post/comment inserts into it), so its two new indexes are partial —
-- WHERE is_country / WHERE is_international — so a post that is neither
-- (most posts, which are boundary-scoped feed posts) never touches either
-- index's maintenance cost on insert.

-- getCountryScopedPosts() in src/lib/services/feed.ts filters
-- `.eq("is_country", true).eq("country", country)` and orders by
-- created_at desc -- fired on every visit to the feed's Country tab, one of
-- the three sections loaded on every /feed page view. No column in this
-- filter+sort had any index; this composite serves the filter and the sort
-- together.
CREATE INDEX IF NOT EXISTS idx_posts_country_scoped
  ON public.posts(country, created_at DESC)
  WHERE is_country = true;

-- getInternationalScopedPosts(), same file — same problem, the feed's
-- International tab.
CREATE INDEX IF NOT EXISTS idx_posts_international_scoped
  ON public.posts(created_at DESC)
  WHERE is_international = true;

-- news_articles_public_idx is (country, status, published_at) -- leads with
-- country, so it can't serve queries that filter status+published_at
-- without a country predicate. getNewsArticlesByPolitician,
-- getNewsArticlesByPoliticians, and getPublishedNewsCountries (the /news
-- feed's politician-tag filter and country-tab list) all do exactly that.
CREATE INDEX IF NOT EXISTS idx_news_articles_status_published
  ON public.news_articles(status, published_at DESC);

-- election_administrators has an index on seat_id and a UNIQUE(seat_id,
-- profile_id) -- both leading with seat_id, so getMyElectionAdminApplications'
-- `.eq("profile_id", profileId)` (a profile's own applications, shown on
-- their own profile page) had no supporting index.
CREATE INDEX IF NOT EXISTS idx_election_administrators_profile
  ON public.election_administrators(profile_id);

-- listPendingElectionAdminApplications() filters `.eq("status", "pending")`
-- for the admin review queue. Table is small and admin-only today, but the
-- partial index costs nothing on non-pending rows (the vast majority once
-- applications are reviewed) and keeps the queue lookup O(pending rows)
-- forever instead of O(all applications ever submitted).
CREATE INDEX IF NOT EXISTS idx_election_administrators_pending
  ON public.election_administrators(submitted_at)
  WHERE status = 'pending';

-- getOfficeHoldersByRoleTypeIds() filters `.in("election_role_type_id",
-- roleTypeIds)` -- office_holders only had map_shape_id/linked_profile_id/
-- is_current indexed, plus a live UNIQUE(map_shape_id, election_role_type_id,
-- full_name) that leads with map_shape_id, not usable for a bare
-- role-type lookup. Used by the admin bulk news-import tool and boundary
-- directory pages.
CREATE INDEX IF NOT EXISTS idx_office_holders_role_type
  ON public.office_holders(election_role_type_id);
