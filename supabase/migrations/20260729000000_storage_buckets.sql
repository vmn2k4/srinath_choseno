-- storage.buckets was completely empty in this project -- post-images,
-- politician_videos (and user_exports, deliberately not created per
-- ARCHITECTURE.md's flagged-for-removal note) are referenced throughout the
-- app but never existed, so every image/video upload has been silently
-- failing. Creating these now is a hard prerequisite for the candidate
-- application video feature, and incidentally fixes the pre-existing broken
-- image attachment feature on posts too.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('post-images', 'post-images', true, 5242880, ARRAY['image/jpeg','image/png','image/gif','image/webp']),
  ('politician_videos', 'politician_videos', true, 52428800, ARRAY['video/webm','video/mp4'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload post images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload politician videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'politician_videos' AND auth.role() = 'authenticated');

CREATE POLICY "Public can read post images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images');

CREATE POLICY "Public can read politician videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'politician_videos');
