-- Rendered OG cards for race pick shares (/p/<code>/opengraph-image). A share's
-- picks and notes never change, so each card is rendered once, stored here and
-- served from storage afterwards instead of being re-rendered per request.
-- Written only by the Next server with the service-role key (bypasses RLS), so
-- like election-og-images there is deliberately NO insert/update/delete policy
-- for anon/authenticated -- public read only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pick-share-og-images', 'pick-share-og-images', true, 2097152, ARRAY['image/png'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read pick share OG images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pick-share-og-images');
