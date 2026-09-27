-- News article polls: a reader-facing "which option do you support?" widget
-- an admin attaches to any news article (a story can carry more than one --
-- e.g. "which party?" and "which promise?" on the same election piece).
-- Modeled on politician_ratings (20260808000000_politician_ratings.sql):
-- public read on the definition tables, all vote writes funneled through a
-- SECURITY DEFINER RPC so the one-vote-per-person rule can't be bypassed by
-- a direct client insert, and aggregate counts served by a second SECURITY
-- DEFINER function so nobody needs raw SELECT on the votes table to see the
-- tally.

-- ── 1. Poll + options ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.news_article_polls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_article_polls_article_idx
  ON public.news_article_polls (news_article_id, sort_order);

CREATE TABLE IF NOT EXISTS public.news_article_poll_options (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID NOT NULL REFERENCES public.news_article_polls(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS news_article_poll_options_poll_idx
  ON public.news_article_poll_options (poll_id, sort_order);

-- ── 2. Votes ─────────────────────────────────────────────────────────────
-- One row per (poll, voter) -- re-voting updates option_id in place rather
-- than accumulating history, same "current answer, not a log" shape as
-- politician_ratings. No ghost_id here: unlike a rating/comment, a poll
-- tally never displays who voted for what, so there's nothing to anonymize
-- for display -- voter_id exists purely to enforce one-vote-per-person and
-- to answer "what did I pick" back to that same person.
CREATE TABLE IF NOT EXISTS public.news_article_poll_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID NOT NULL REFERENCES public.news_article_polls(id) ON DELETE CASCADE,
  option_id  UUID NOT NULL REFERENCES public.news_article_poll_options(id) ON DELETE CASCADE,
  voter_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, voter_id)
);

CREATE INDEX IF NOT EXISTS news_article_poll_votes_option_idx
  ON public.news_article_poll_votes (option_id);

-- keep updated_at current automatically (same helper pattern as news_articles)
CREATE OR REPLACE FUNCTION public._news_article_polls_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER news_article_polls_updated_at
  BEFORE UPDATE ON public.news_article_polls
  FOR EACH ROW EXECUTE FUNCTION public._news_article_polls_set_updated_at();
CREATE TRIGGER news_article_poll_votes_updated_at
  BEFORE UPDATE ON public.news_article_poll_votes
  FOR EACH ROW EXECUTE FUNCTION public._news_article_polls_set_updated_at();

-- ── 3. RLS ───────────────────────────────────────────────────────────────

ALTER TABLE public.news_article_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_article_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_article_poll_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read a poll/its options once the article it belongs to is
-- actually public -- same visibility rule as the article itself
-- ("Public can read published news articles"), so a poll never leaks a
-- still-draft story's question before the story goes live.
CREATE POLICY "Public can read polls on published articles"
  ON public.news_article_polls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.news_articles a
      WHERE a.id = news_article_id
        AND a.status = 'published'
        AND (a.published_at IS NULL OR a.published_at <= now())
    )
  );

CREATE POLICY "Public can read options on published-article polls"
  ON public.news_article_poll_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.news_article_polls p
      JOIN public.news_articles a ON a.id = p.news_article_id
      WHERE p.id = poll_id
        AND a.status = 'published'
        AND (a.published_at IS NULL OR a.published_at <= now())
    )
  );

-- Admins manage everything directly (create/edit/reorder/delete polls +
-- options), same as "Admins can manage news articles" -- no RPC needed for
-- authoring since there's no per-person integrity rule to protect here,
-- unlike voting.
CREATE POLICY "Admins can manage news article polls"
  ON public.news_article_polls FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage news article poll options"
  ON public.news_article_poll_options FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Votes: a signed-in reader can see their OWN vote (to render "you picked
-- X" instead of the ballot form), never anyone else's raw row -- aggregate
-- tallies are served by get_news_article_poll_results() below instead.
-- Admins can see every row too, for moderation/analytics. No INSERT/UPDATE
-- policy at all: every write goes through cast_news_article_poll_vote(),
-- which runs SECURITY DEFINER as the table owner and so isn't itself
-- gated by these policies -- a direct client insert has no policy to
-- satisfy and is rejected.
CREATE POLICY "Users can read their own poll vote"
  ON public.news_article_poll_votes FOR SELECT
  USING (voter_id = auth.uid());

CREATE POLICY "Admins can read all poll votes"
  ON public.news_article_poll_votes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete poll votes"
  ON public.news_article_poll_votes FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── 4. Vote-casting RPC ──────────────────────────────────────────────────
-- Mirrors upsert_politician_rating's shape: SECURITY DEFINER so it can
-- write past the no-insert-policy above, resolves the poll_id from the
-- option itself (so the client can't hand a mismatched poll_id/option_id
-- pair), and upserts on (poll_id, voter_id) so casting a second vote
-- changes the reader's answer instead of creating a duplicate ballot.
CREATE OR REPLACE FUNCTION public.cast_news_article_poll_vote(p_option_id UUID)
RETURNS public.news_article_poll_votes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poll_id UUID;
  v_row     public.news_article_poll_votes;
BEGIN
  SELECT poll_id INTO v_poll_id FROM public.news_article_poll_options WHERE id = p_option_id;
  IF v_poll_id IS NULL THEN
    RAISE EXCEPTION 'Unknown poll option';
  END IF;

  INSERT INTO public.news_article_poll_votes (poll_id, option_id, voter_id)
  VALUES (v_poll_id, p_option_id, auth.uid())
  ON CONFLICT (poll_id, voter_id) DO UPDATE
    SET option_id = EXCLUDED.option_id,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_news_article_poll_vote(UUID) TO authenticated;

-- ── 5. Results RPC ───────────────────────────────────────────────────────
-- Per-option vote counts for however many polls a page needs at once (an
-- article can carry several). SECURITY DEFINER + STABLE: bypasses the
-- votes table's own-row-only SELECT policy on purpose, but returns nothing
-- except an option_id and a count -- never a voter_id -- so the ballot
-- stays anonymous the same way a rating's ghost_id already is. Callable by
-- anon so a signed-out visitor can see standings without voting.
CREATE OR REPLACE FUNCTION public.get_news_article_poll_results(p_poll_ids UUID[])
RETURNS TABLE(poll_id UUID, option_id UUID, vote_count INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT poll_id, option_id, COUNT(*)::int AS vote_count
  FROM public.news_article_poll_votes
  WHERE poll_id = ANY(p_poll_ids)
  GROUP BY poll_id, option_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_news_article_poll_results(UUID[]) TO authenticated, anon;
