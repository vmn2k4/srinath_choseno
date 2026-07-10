-- Run this in the Supabase SQL Editor to seed an admin user

-- Create a temporary variable to hold the new user UUID
DO $$
DECLARE
  new_admin_id uuid := gen_random_uuid();
BEGIN
  -- 1. Insert into the auth.users table (This bypasses email confirmation)
  INSERT INTO auth.users (
    id, 
    instance_id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    raw_app_meta_data, 
    raw_user_meta_data, 
    created_at, 
    updated_at,
    role,
    aud
  )
  VALUES (
    new_admin_id, 
    '00000000-0000-0000-0000-000000000000', 
    'admin@example.com', 
    crypt('admin123', gen_salt('bf')), -- Default password is 'admin123'
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{}', 
    now(), 
    now(),
    'authenticated',
    'authenticated'
  );

  -- 2. Insert the corresponding profile into public.profiles
  INSERT INTO public.profiles (
    id, 
    role, 
    full_name, 
    updated_at
  )
  VALUES (
    new_admin_id,
    'admin',
    'System Administrator',
    now()
  );
  
END $$;
