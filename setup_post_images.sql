-- Add image_url to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create Storage Bucket for post images if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up Storage Policies for the post-images bucket
-- Allow public read
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'post-images' );

-- Allow authenticated users to upload
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'post-images' AND auth.role() = 'authenticated' );

-- Allow users to update/delete their own uploads (optional, but good practice)
CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'post-images' AND auth.role() = 'authenticated' );

CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'post-images' AND auth.role() = 'authenticated' );
