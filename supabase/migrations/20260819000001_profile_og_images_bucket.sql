-- Storage bucket for the auto-generated share cards for politician wall
-- pages and candidacy pages (see supabase/functions/generate-profile-og-image).
-- Cards are written by that Edge Function using its service-role client,
-- which bypasses RLS entirely -- so, mirroring election-og-images, this
-- bucket gets no INSERT/UPDATE policy for anon/authenticated at all. Nobody
-- but the Edge Function can ever write here; the only thing the app needs
-- is public read so the cached PNG can be hotlinked as an og:image src.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-og-images', 'profile-og-images', true, 2097152, ARRAY['image/png'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read profile OG images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-og-images');
