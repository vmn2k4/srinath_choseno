-- Performance fix for the admin News Distribution page
-- (/admin/news-distribution, listNewsArticlesForDistribution + get_news_batch_summary).
--
-- Root-caused via `supabase db advisors --linked --type performance`, same
-- "Auth RLS Initialization Plan" pattern already fixed for the election-seat
-- page in 20260909000000_seat_candidate_rls_initplan_perf.sql: the "Admins
-- can manage ..." ALL policies on news_articles, news_article_politicians,
-- and news_article_boundaries called `auth.uid()` directly inside an EXISTS
-- subquery instead of `(select auth.uid())`. Postgres re-evaluates an
-- unwrapped call to this (STABLE, but not const-folded per statement)
-- function on *every row* the policy applies to, instead of once per query.
--
-- This page's list query joins news_articles -> news_article_politicians ->
-- profiles -> politician_profiles and also runs an exact COUNT(*) over every
-- matching row for pagination, so the per-row admin-role subquery was
-- re-run for the full published set (thousands of rows) on every page load,
-- not just the 50-100 rows actually rendered.
--
-- ALTER POLICY only replaces USING/WITH CHECK -- policy name, command, and
-- role stay exactly as they were.

ALTER POLICY "Admins can manage news articles" ON public.news_articles
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));

ALTER POLICY "Admins can manage news article politician tags" ON public.news_article_politicians
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));

ALTER POLICY "Admins can manage news article boundary tags" ON public.news_article_boundaries
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));
