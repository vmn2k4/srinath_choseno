-- Create the bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('user_exports', 'user_exports', false) 
ON CONFLICT (id) DO NOTHING;

-- Set up RLS for storage.objects
-- Note: storage.objects already has RLS enabled by default in Supabase, but we add policies here.

CREATE POLICY "Users can upload their own export files" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'user_exports' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view their own export files" 
ON storage.objects FOR SELECT 
USING (
    bucket_id = 'user_exports' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own export files" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'user_exports' 
    AND auth.role() = 'authenticated'
);
