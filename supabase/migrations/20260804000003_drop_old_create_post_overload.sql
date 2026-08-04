-- Drop old 4-parameter create_post overload to resolve function ambiguity error
DROP FUNCTION IF EXISTS public.create_post(TEXT, TEXT, TEXT, JSONB);
