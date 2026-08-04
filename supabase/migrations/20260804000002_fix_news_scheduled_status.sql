-- Fix: articles saved with status='scheduled' never became publicly visible,
-- even after their published_at date passed -- the public-read policy only
-- ever checked status='published'. 'scheduled' is meant to describe a
-- published-in-the-future article, so it should become visible the same
-- way: once published_at <= now().

DROP POLICY IF EXISTS "Public can read published news articles" ON public.news_articles;

CREATE POLICY "Public can read published news articles"
  ON public.news_articles FOR SELECT
  USING (
    (status = 'published' AND (published_at IS NULL OR published_at <= now()))
    OR (status = 'scheduled' AND published_at IS NOT NULL AND published_at <= now())
  );
