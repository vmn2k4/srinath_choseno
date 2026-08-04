-- News Platform: news_articles table, news_article_id on posts,
-- updated create_post() RPC, and news-images storage bucket.

-- ── 1. news_articles table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_articles (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug            text NOT NULL UNIQUE,
  headline        text NOT NULL,
  summary         text,
  category        text NOT NULL DEFAULT 'General',
  country         text,                -- ISO-2 country code; NULL = global
  province        text,                -- province / state slug; NULL = country-wide
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published','archived')),
  published_at    timestamptz,         -- when it becomes publicly readable
  hero_image_url  text,
  content         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- seoTitle, metaDescription, body (md), author, tags, sources …
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- keep updated_at current automatically
CREATE OR REPLACE FUNCTION public._news_articles_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER news_articles_updated_at
  BEFORE UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public._news_articles_set_updated_at();

-- index for the public listing query (country + status + published_at)
CREATE INDEX IF NOT EXISTS news_articles_public_idx
  ON public.news_articles (country, status, published_at DESC);

-- ── 2. RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Anyone can read articles that are published and past their publish date
CREATE POLICY "Public can read published news articles"
  ON public.news_articles FOR SELECT
  USING (
    status = 'published'
    AND (published_at IS NULL OR published_at <= now())
  );

-- Admins can do everything
CREATE POLICY "Admins can manage news articles"
  ON public.news_articles FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 3. news_article_id foreign key on posts ──────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS news_article_id uuid REFERENCES public.news_articles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS posts_news_article_id_idx ON public.posts (news_article_id);

-- ── 4. Update create_post() to accept an optional news_article_id ────────
-- Matches the existing function signature from 20260731000000 but adds
-- p_election_candidate_id (already present in DB from earlier migrations)
-- and p_news_article_id (new in this migration).
CREATE OR REPLACE FUNCTION public.create_post(
  p_content               TEXT,
  p_image_url             TEXT    DEFAULT NULL,
  p_video_url             TEXT    DEFAULT NULL,
  p_link_metadata         JSONB   DEFAULT NULL,
  p_election_candidate_id UUID    DEFAULT NULL,
  p_news_article_id       UUID    DEFAULT NULL
) RETURNS public.posts AS $$
DECLARE
  v_ghost_id UUID;
  v_country  TEXT;
  v_banked   BIGINT;
  v_live     BIGINT;
  v_post     public.posts;
BEGIN
  SELECT current_ghost_id, country, civic_score
    INTO v_ghost_id, v_country, v_banked
    FROM public.profiles
   WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT
    (SELECT count(*) FROM public.posts WHERE ghost_id = v_ghost_id) * 10
    + (SELECT count(*) FROM public.comments WHERE ghost_id = v_ghost_id) * 5
    + COALESCE((SELECT sum(likes_count) - sum(dislikes_count) FROM public.posts WHERE ghost_id = v_ghost_id), 0)
  INTO v_live;

  INSERT INTO public.posts (
    ghost_id, content, image_url, video_url, link_metadata,
    country, is_country, is_international,
    election_candidate_id, news_article_id,
    civic_score_snapshot
  )
  VALUES (
    v_ghost_id, p_content, p_image_url, p_video_url, p_link_metadata,
    v_country, true, true,
    p_election_candidate_id, p_news_article_id,
    COALESCE(v_banked, 0) + COALESCE(v_live, 0)
  )
  RETURNING * INTO v_post;

  INSERT INTO public.post_boundaries (post_id, map_shape_id)
  SELECT v_post.id, map_shape_id
    FROM public.user_boundary_memberships
   WHERE profile_id = auth.uid();

  RETURN v_post;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_post(TEXT, TEXT, TEXT, JSONB, UUID, UUID) TO authenticated;
-- Also re-grant the old 4-param signature so existing callers still work
GRANT EXECUTE ON FUNCTION public.create_post(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- ── 5. news-images storage bucket ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'news-images', 'news-images', true, 10485760,
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload news images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'news-images'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Public can read news images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'news-images');

CREATE POLICY "Admins can delete news images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'news-images'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
