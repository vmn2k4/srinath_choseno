-- Run this in your Supabase SQL editor to add the 'admin' role

-- 1. We need to drop the existing check constraint on the role column.
-- Supabase automatically names check constraints if not explicitly named.
-- Usually, it's something like profiles_role_check. We can drop it:
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Add the new constraint that includes 'admin'
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('normal', 'politician', 'admin'));

-- Note: To make someone an admin, you should manually update their role in the Supabase Table Editor:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
