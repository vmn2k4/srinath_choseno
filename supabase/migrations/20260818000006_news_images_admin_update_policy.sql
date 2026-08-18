-- Admins already have INSERT/SELECT/DELETE on the news-images storage
-- bucket (20260804000001_news_platform.sql), but not UPDATE. Storage's
-- upload(..., { upsert: true }) does an UPDATE when the object path already
-- exists (e.g. regenerating a share card after a retry, or an admin
-- re-publishing), which RLS was rejecting with "new row violates row-level
-- security policy" -- reproduced while testing the OG-image generation
-- fix in scripts/insert-news-batch.js / ogCardBrowser.ts.

CREATE POLICY "Admins can update news images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'news-images'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    bucket_id = 'news-images'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
