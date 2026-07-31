-- Politicians can optionally upload a profile photo. Follows the exact same
-- bucket/policy shape as post-images/politician_videos in
-- 20260729000000_storage_buckets.sql. The column lives on politician_profiles
-- (not profiles) since it's a politician-only, optional field -- citizens
-- have no equivalent and stay on the initial-letter placeholder everywhere.
ALTER TABLE public.politician_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('politician-avatars', 'politician-avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/gif','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload politician avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'politician-avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Public can read politician avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'politician-avatars');
