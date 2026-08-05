-- find_boundaries_by_point() is used by the new public, no-login
-- /find-my-district page (it already has no auth.uid() dependency and only
-- reads already-public map_shapes data -- same tier as find_boundaries_by_point's
-- existing authenticated callers in onboarding). Explicit grant rather than
-- relying on default PUBLIC execute privileges, since Supabase projects
-- commonly revoke those by default at the platform level outside of tracked
-- migrations.
GRANT EXECUTE ON FUNCTION public.find_boundaries_by_point(DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
