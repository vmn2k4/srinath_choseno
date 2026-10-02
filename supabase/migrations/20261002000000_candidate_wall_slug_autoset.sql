-- Candidates added via add_unregistered_candidate (and any other path that
-- creates a politician_profiles row without a wall_slug) had wall_slug NULL.
-- The candidate page links to /wall/<name>-<role> via a computed fallback,
-- but /wall/[slug] only resolves *stored* slugs, so those links 404
-- (e.g. /wall/jinny-sims-mla). This sets the slug (same name-role rule the
-- claim/prefill migrations use, short-id suffix on collision) whenever a
-- candidacy is created, and backfills existing candidates.
CREATE OR REPLACE FUNCTION public.ensure_candidate_wall_slug(p_profile_id uuid, p_role_title text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_name text;
  v_base text;
  v_slug text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.politician_profiles WHERE id = p_profile_id AND wall_slug IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.politician_profiles WHERE id = p_profile_id) THEN
    RETURN;
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = p_profile_id;
  v_base := lower(regexp_replace(
    trim(both '-' from regexp_replace(coalesce(v_name, '') || '-' || coalesce(p_role_title, ''), '[^a-zA-Z0-9]+', '-', 'g')),
    '-{2,}', '-', 'g'
  ));
  IF v_base IS NULL OR v_base = '' THEN v_base := 'politician'; END IF;

  v_slug := v_base;
  IF EXISTS (SELECT 1 FROM public.politician_profiles WHERE wall_slug = v_slug) THEN
    v_slug := v_base || '-' || substr(replace(p_profile_id::text, '-', ''), 1, 6);
  END IF;

  UPDATE public.politician_profiles SET wall_slug = v_slug WHERE id = p_profile_id AND wall_slug IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.election_candidates_set_wall_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.ensure_candidate_wall_slug(
    NEW.politician_id,
    (SELECT role_title FROM public.election_seats WHERE id = NEW.seat_id)
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER election_candidates_set_wall_slug
  AFTER INSERT ON public.election_candidates
  FOR EACH ROW EXECUTE FUNCTION public.election_candidates_set_wall_slug();

-- Backfill existing candidates with no stored slug.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (ec.politician_id) ec.politician_id, es.role_title
    FROM public.election_candidates ec
    JOIN public.election_seats es ON es.id = ec.seat_id
    JOIN public.politician_profiles pp ON pp.id = ec.politician_id
    WHERE pp.wall_slug IS NULL
    ORDER BY ec.politician_id, ec.created_at NULLS LAST
  LOOP
    PERFORM public.ensure_candidate_wall_slug(r.politician_id, r.role_title);
  END LOOP;
END $$;
