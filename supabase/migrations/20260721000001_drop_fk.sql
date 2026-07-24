-- Drop the foreign key constraint to auth.users so we can migrate profiles data without copying auth users.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
