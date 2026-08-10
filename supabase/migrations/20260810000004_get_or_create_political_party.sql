-- addFetchedCandidate() (src/lib/services/candidateSync.ts) matches an
-- official source's free-text party name against existing political_parties
-- rows for the seat's country, but "falls back to no party rather than
-- guessing wrong" when nothing matches -- so a genuinely new party showing
-- up in official data (e.g. a minor US party not yet in our 5-row USA set)
-- never gets added; the candidate just carries the raw name as bio text
-- instead of a real, filterable party. This RPC closes that gap: same
-- admin-only guard as the existing "Admins manage political parties" RLS
-- policy, upserts on (country, name) so re-calling with the same name is a
-- no-op, and is reusable by the admin UI's "Fetch candidates" flow, any
-- future jurisdiction sync, or an external bulk-import script running as an
-- authenticated admin.
CREATE OR REPLACE FUNCTION public.get_or_create_political_party(p_country text, p_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can add political parties';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'A party name is required';
  END IF;

  INSERT INTO public.political_parties (country, name)
  VALUES (p_country, p_name)
  ON CONFLICT (country, name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
