-- Fix: profiles rows were never created at signup, and user_locations
-- accumulated duplicate rows. Run this once in the Supabase SQL editor.

-- 1. Auto-create a profile row whenever a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill: create profile rows for existing users that are missing one
INSERT INTO public.profiles (id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 3. Dedupe user_locations: keep only the newest row per profile
DELETE FROM public.user_locations
WHERE id NOT IN (
  SELECT DISTINCT ON (profile_id) id
  FROM public.user_locations
  ORDER BY profile_id, created_at DESC NULLS LAST
);

-- 4. Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS user_locations_profile_id_key
  ON public.user_locations (profile_id);
