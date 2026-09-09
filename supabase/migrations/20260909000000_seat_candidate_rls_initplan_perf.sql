-- Performance fix for the election-seat / candidate-select page
-- (/elections/seat/[seatId], selecting a candidate mounts CandidacyWall).
--
-- Root-caused via `supabase db advisors --linked --type performance`: every
-- table this page's read path touches (profiles, election_candidates,
-- election_candidate_answers/_answer_options, election_answer_comments,
-- election_questions/_options, election_seats, elections, map_shapes,
-- politician_profiles, politician_supporters, posts, comments,
-- user_boundary_memberships) had RLS policies calling `auth.uid()` /
-- `auth.role()` directly in USING/WITH CHECK. Postgres re-evaluates an
-- unwrapped call to these (STABLE, but not const-folded per statement)
-- functions on *every row* a policy is applied to, instead of once per
-- query -- the standard "Auth RLS Initialization Plan" advisor warning
-- (https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select).
-- Wrapping the call in `(select auth.uid())` lets Postgres evaluate it once
-- as an InitPlan and reuse the result for every row -- same access rules,
-- same query results, just evaluated once instead of N times.
--
-- This matters disproportionately for this page because CandidacyWall's
-- mount effect (on every candidate-tab click) fires ~8-10 queries against
-- exactly these tables, several joining `posts, comments(*)` or chaining
-- 2-3 table EXISTS subqueries (election_candidate_answers ->
-- election_candidates -> election_questions) -- unwrapped auth.uid() means
-- each of those subqueries alone re-resolves the JWT claim per row.
--
-- Scoped to the tables actually traced in this flow (same discipline as
-- 20260818000003/20260818000004 for indexes) rather than a blanket
-- sweep of all ~230 policies flagged app-wide -- see docs/API_CACHING_STRATEGY.md
-- for the follow-up note on the remaining tables.
--
-- ALTER POLICY only replaces USING/WITH CHECK -- policy name, command,
-- and role stay exactly as they were, so nothing referencing these by name
-- (there is nothing that does) or relying on grants breaks.

-- ── profiles ────────────────────────────────────────────────────────────
ALTER POLICY "Users can insert own profile" ON public.profiles
  WITH CHECK ((select auth.uid()) = id);

ALTER POLICY "Users can update own profile" ON public.profiles
  USING ((select auth.uid()) = id);

ALTER POLICY "Users can view own profile" ON public.profiles
  USING ((select auth.uid()) = id);

-- ── election_candidates ────────────────────────────────────────────────
ALTER POLICY "Admins manage candidates" ON public.election_candidates
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));

ALTER POLICY "Candidates read own application" ON public.election_candidates
  USING (politician_id = (select auth.uid()));

ALTER POLICY "Candidates update own application" ON public.election_candidates
  USING ((select auth.uid()) = politician_id)
  WITH CHECK ((select auth.uid()) = politician_id);

ALTER POLICY "Candidates withdraw own application" ON public.election_candidates
  USING ((select auth.uid()) = politician_id);

-- ── election_candidate_answers ─────────────────────────────────────────
ALTER POLICY "Admins manage all candidate answers" ON public.election_candidate_answers
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));

ALTER POLICY "Candidates manage own answers" ON public.election_candidate_answers
  USING (EXISTS (SELECT 1 FROM election_candidates ec WHERE ec.id = election_candidate_answers.candidate_id AND ec.politician_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM election_candidates ec WHERE ec.id = election_candidate_answers.candidate_id AND ec.politician_id = (select auth.uid())));

-- ── election_candidate_answer_options ──────────────────────────────────
ALTER POLICY "Admins manage all answer options" ON public.election_candidate_answer_options
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));

ALTER POLICY "Candidates manage own answer options" ON public.election_candidate_answer_options
  USING (EXISTS (
    SELECT 1 FROM election_candidate_answers a
    JOIN election_candidates ec ON ec.id = a.candidate_id
    WHERE a.id = election_candidate_answer_options.answer_id AND ec.politician_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM election_candidate_answers a
    JOIN election_candidates ec ON ec.id = a.candidate_id
    WHERE a.id = election_candidate_answer_options.answer_id AND ec.politician_id = (select auth.uid())
  ));

-- ── election_answer_comments ───────────────────────────────────────────
ALTER POLICY "Authenticated users can comment where the answer is visible" ON public.election_answer_comments
  WITH CHECK (
    (select auth.role()) = 'authenticated' AND EXISTS (
      SELECT 1 FROM election_candidate_answers a
      JOIN election_candidates ec ON ec.id = a.candidate_id
      JOIN election_questions q ON q.id = a.question_id
      WHERE a.id = election_answer_comments.answer_id
        AND (
          (ec.status = 'approved' AND q.visible_to_public = true)
          OR ec.politician_id = (select auth.uid())
          OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
        )
    )
  );

ALTER POLICY "Read answer comments where the answer is visible" ON public.election_answer_comments
  USING (
    EXISTS (
      SELECT 1 FROM election_candidate_answers a
      JOIN election_candidates ec ON ec.id = a.candidate_id
      JOIN election_questions q ON q.id = a.question_id
      WHERE a.id = election_answer_comments.answer_id
        AND ((ec.status = 'approved' AND q.visible_to_public = true) OR ec.politician_id = (select auth.uid()))
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
  );

-- ── election_questions / election_question_options ────────────────────
ALTER POLICY "Admins manage election questions" ON public.election_questions
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));

ALTER POLICY "Admins manage election question options" ON public.election_question_options
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));

-- ── election_seats / elections ─────────────────────────────────────────
ALTER POLICY "Admins manage seats" ON public.election_seats
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));

ALTER POLICY "Read seats via parent election visibility" ON public.election_seats
  USING (EXISTS (
    SELECT 1 FROM elections e
    WHERE e.id = election_seats.election_id
      AND (e.status <> 'draft' OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'))
  ));

ALTER POLICY "Admins manage elections" ON public.elections
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));

ALTER POLICY "Public reads non-draft elections, admins read all" ON public.elections
  USING (status <> 'draft' OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));

-- ── map_shapes ──────────────────────────────────────────────────────────
ALTER POLICY "Admins can write map shapes" ON public.map_shapes
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));

-- ── politician_profiles ─────────────────────────────────────────────────
ALTER POLICY "Users can delete own politician profile" ON public.politician_profiles
  USING ((select auth.uid()) = id);

ALTER POLICY "Users can insert own politician profile" ON public.politician_profiles
  WITH CHECK ((select auth.uid()) = id);

ALTER POLICY "Users can update own politician profile" ON public.politician_profiles
  USING ((select auth.uid()) = id);

-- ── politician_supporters ───────────────────────────────────────────────
ALTER POLICY "Auth Delete Own Support" ON public.politician_supporters
  USING ((select auth.uid()) = supporter_id);

ALTER POLICY "Auth Insert Own Support" ON public.politician_supporters
  WITH CHECK ((select auth.uid()) = supporter_id);

-- ── posts / comments ─────────────────────────────────────────────────────
ALTER POLICY "Anyone can read non-removed posts" ON public.posts
  USING (removed_at IS NULL OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));

ALTER POLICY "Authenticated users can insert posts" ON public.posts
  WITH CHECK ((select auth.role()) = 'authenticated');

ALTER POLICY "Anyone can read non-removed comments" ON public.comments
  USING (removed_at IS NULL OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'));

-- ── user_boundary_memberships ──────────────────────────────────────────
ALTER POLICY "Users can read own memberships" ON public.user_boundary_memberships
  USING ((select auth.uid()) = profile_id);
