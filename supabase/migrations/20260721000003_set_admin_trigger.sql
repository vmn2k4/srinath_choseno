-- Update handle_new_user to make vmn2k4@gmail.com an admin automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_role TEXT := 'normal';
BEGIN
  IF lower(new.email) = 'vmn2k4@gmail.com' THEN
    default_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'User'), default_role)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing user profile for vmn2k4@gmail.com if present
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'vmn2k4@gmail.com'
);
