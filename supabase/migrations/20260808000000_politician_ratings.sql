-- Politician ratings: 1-5 stars + optional written comment, one per
-- constituent per politician (Google-review style — a single row holds both
-- the score and the text, editable via upsert). Writes only go through
-- upsert_politician_rating/delete_politician_rating (SECURITY DEFINER, like
-- create_comment) so the backend enforces the trust boundary: no self-rating,
-- target must actually be a politician, and the row is attributed to the
-- rater's current_ghost_id (not their real profile) for public display,
-- mirroring how comments are anonymized. rater_id stays on the row (never
-- selected by the public read policy's consumers in the client) purely to
-- enforce "one rating per real person" via the unique constraint.
CREATE TABLE IF NOT EXISTS public.politician_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rater_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ghost_id UUID NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (politician_id, rater_id)
);

CREATE INDEX IF NOT EXISTS politician_ratings_politician_id_idx ON public.politician_ratings (politician_id);

ALTER TABLE public.politician_ratings ENABLE ROW LEVEL SECURITY;

-- Public read only — all writes are funneled through the RPCs below so the
-- validation (self-rating, target-is-a-politician, ghost resolution) can't
-- be bypassed by a direct client insert.
CREATE POLICY "Public Read Politician Ratings" ON public.politician_ratings FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.upsert_politician_rating(
  p_politician_id UUID,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL,
  p_is_test BOOLEAN DEFAULT false
)
RETURNS public.politician_ratings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_is_politician BOOLEAN;
  v_row public.politician_ratings;
BEGIN
  IF p_politician_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot rate yourself';
  END IF;

  SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();
  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.politician_profiles WHERE id = p_politician_id
  ) INTO v_is_politician;
  IF NOT v_is_politician THEN
    RAISE EXCEPTION 'Target is not a politician profile';
  END IF;

  INSERT INTO public.politician_ratings (politician_id, rater_id, ghost_id, rating, comment, is_test)
  VALUES (p_politician_id, auth.uid(), v_ghost_id, p_rating, NULLIF(TRIM(p_comment), ''), p_is_test)
  ON CONFLICT (politician_id, rater_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        ghost_id = EXCLUDED.ghost_id,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_politician_rating(UUID, SMALLINT, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_politician_rating(p_politician_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.politician_ratings
  WHERE politician_id = p_politician_id AND rater_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_politician_rating(UUID) TO authenticated;

-- Batch summary (avg + count) for however many politicians a widget needs to
-- show at once (candidate rosters, office-holder lists, sidebars) — one
-- round trip instead of N. Runs as the caller (no SECURITY DEFINER) so it
-- stays governed by the same public-read RLS policy above, not a bypass of it.
CREATE OR REPLACE FUNCTION public.get_politician_rating_summaries(
  p_politician_ids UUID[],
  p_include_test BOOLEAN DEFAULT false
)
RETURNS TABLE(politician_id UUID, avg_rating NUMERIC, rating_count INT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT politician_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*)::int AS rating_count
  FROM public.politician_ratings
  WHERE politician_id = ANY(p_politician_ids)
    AND (p_include_test OR is_test = false)
  GROUP BY politician_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_politician_rating_summaries(UUID[], BOOLEAN) TO authenticated, anon;
