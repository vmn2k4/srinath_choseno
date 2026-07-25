-- Bug found during verification: guard_candidate_status_change() (from
-- 20260729000009) compared current_setting('app.bypass_candidate_status_guard', true)
-- directly to 'true'. When that setting has never been set in the current
-- session (the overwhelmingly common case -- only submit_candidate_application
-- ever sets it, and only for its own transaction), current_setting(..., true)
-- returns NULL, and `NULL = 'true'` is NULL, not false. `NULL OR EXISTS(...)`
-- is then NULL whenever the EXISTS check is also false, and PL/pgSQL's
-- `IF NOT (NULL) THEN` treats a NULL condition as false -- so the RAISE
-- EXCEPTION branch was silently never entered, making the guard a no-op for
-- every ordinary client update. Verified directly: a raw
-- `UPDATE election_candidates SET status = 'rejected'` with no admin role and
-- no bypass flag set succeeded when it should have been blocked. Fixed by
-- coalescing the missing-setting NULL to 'false' before comparing.
CREATE OR REPLACE FUNCTION public.guard_candidate_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN
    IF NOT (
      COALESCE(current_setting('app.bypass_candidate_status_guard', true), 'false') = 'true'
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    ) THEN
      RAISE EXCEPTION 'Cannot modify candidate status directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
