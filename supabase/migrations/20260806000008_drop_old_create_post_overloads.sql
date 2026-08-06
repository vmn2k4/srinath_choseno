-- 20260806000007 added p_is_test as a new trailing parameter, which changed
-- each function's signature -- CREATE OR REPLACE FUNCTION only replaces a
-- function when the argument list is identical, so it silently created a
-- second overload instead of replacing the original. Two overloads of the
-- same RPC name confuses PostgREST's function resolution (it can't tell
-- which one the client meant), so the old (pre-is_test) signatures must be
-- dropped explicitly -- same fix pattern as
-- 20260804000003_drop_old_create_post_overload.sql.
DROP FUNCTION IF EXISTS public.create_post(TEXT, TEXT, TEXT, JSONB, UUID, UUID);
DROP FUNCTION IF EXISTS public.create_wall_post(TEXT, TEXT, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.create_comment(UUID, TEXT);
