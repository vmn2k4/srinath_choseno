-- A claim that reaches 'pending_review' (via invite redemption or a
-- self-requested claim) had no way to be closed out if an admin decides not
-- to approve it: cancel_officeholder_wall_claim only covers pre-redemption
-- states (draft/invited/pending_confirmation), and
-- reverse_officeholder_wall_claim only covers already-'approved' (merged)
-- claims. This migration adds the missing reject path for 'pending_review'.
--
-- Rejecting needs to undo the redemption-time profile backfill (contact
-- info, bio, party, etc. gap-filled onto the claimant's own profile by
-- backfill_politician_profile_from_officeholder when they redeemed the
-- invite) -- otherwise "reject" would still leave the officeholder's contact
-- details sitting on an unrelated/rejected claimant's profile. But that
-- function previously only audit-logged its wall_slug assignment, not the
-- other 8 COALESCE'd fields, so there was no record of exactly what it
-- changed vs. what the profile already had. This migration fixes that first:
-- every field the backfill actually fills (i.e. was NULL before) now gets
-- its own office_holder_wall_claim_items row, exactly like wall_slug already
-- did -- which is what makes a precise, safe reject possible: it only ever
-- clears a field it can prove IT set, never a value the profile owner
-- entered themselves.

CREATE OR REPLACE FUNCTION public.backfill_politician_profile_from_officeholder(
  p_profile_id UUID,
  p_office_holder_id UUID,
  p_claim_id UUID DEFAULT NULL -- for audit logging; pass NULL to skip logging
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  oh public.office_holders%ROWTYPE;
  pp public.politician_profiles%ROWTYPE;
  v_profile_full_name TEXT;
  v_role_title TEXT;
  v_boundary_name TEXT;
  v_base_slug TEXT;
  v_candidate_slug TEXT;
BEGIN
  SELECT * INTO oh FROM public.office_holders WHERE id = p_office_holder_id;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.politician_profiles (id) VALUES (p_profile_id) ON CONFLICT (id) DO NOTHING;
  SELECT * INTO pp FROM public.politician_profiles WHERE id = p_profile_id;

  SELECT full_name INTO v_profile_full_name FROM public.profiles WHERE id = p_profile_id;
  SELECT ert.role_title INTO v_role_title FROM public.election_role_types ert WHERE ert.id = oh.election_role_type_id;
  SELECT ms.name INTO v_boundary_name FROM public.map_shapes ms WHERE ms.id = oh.map_shape_id;

  IF pp.wall_slug IS NULL THEN
    v_base_slug := lower(regexp_replace(
      trim(both '-' from regexp_replace(coalesce(v_profile_full_name, '') || '-' || coalesce(v_role_title, ''), '[^a-zA-Z0-9]+', '-', 'g')),
      '-{2,}', '-', 'g'
    ));
    IF v_base_slug IS NULL OR v_base_slug = '' THEN v_base_slug := 'politician'; END IF;
    v_candidate_slug := v_base_slug;
    -- wall_slug is unique where non-null — fall back to a short id suffix on
    -- collision rather than fail the caller over a name clash.
    IF EXISTS (SELECT 1 FROM public.politician_profiles WHERE wall_slug = v_candidate_slug) THEN
      v_candidate_slug := v_base_slug || '-' || substr(replace(p_profile_id::text, '-', ''), 1, 6);
    END IF;
    UPDATE public.politician_profiles SET wall_slug = v_candidate_slug, updated_at = now() WHERE id = p_profile_id;

    IF p_claim_id IS NOT NULL THEN
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
      VALUES (p_claim_id, 'politician_profile', p_profile_id::text,
        jsonb_build_object('wall_slug', NULL), jsonb_build_object('wall_slug', v_candidate_slug),
        jsonb_build_object('moved', false, 'field', 'wall_slug'));
    END IF;
  END IF;

  -- Gap-fill only — never overwrite a value the profile owner already set for
  -- themselves (e.g. if they'd started editing before the claim was
  -- reviewed) — and log every field this actually changes (source was NULL),
  -- so a later reject/reverse can undo precisely this and nothing else.
  IF p_claim_id IS NOT NULL THEN
    IF pp.political_target_role IS NULL AND v_role_title IS NOT NULL THEN
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
      VALUES (p_claim_id, 'politician_profile', p_profile_id::text, jsonb_build_object('political_target_role', NULL), jsonb_build_object('political_target_role', v_role_title), jsonb_build_object('moved', false, 'field', 'political_target_role'));
    END IF;
    IF pp.target_boundary_name IS NULL AND v_boundary_name IS NOT NULL THEN
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
      VALUES (p_claim_id, 'politician_profile', p_profile_id::text, jsonb_build_object('target_boundary_name', NULL), jsonb_build_object('target_boundary_name', v_boundary_name), jsonb_build_object('moved', false, 'field', 'target_boundary_name'));
    END IF;
    IF pp.bio IS NULL AND oh.bio IS NOT NULL THEN
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
      VALUES (p_claim_id, 'politician_profile', p_profile_id::text, jsonb_build_object('bio', NULL), jsonb_build_object('bio', oh.bio), jsonb_build_object('moved', false, 'field', 'bio'));
    END IF;
    IF pp.political_party_id IS NULL AND oh.political_party_id IS NOT NULL THEN
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
      VALUES (p_claim_id, 'politician_profile', p_profile_id::text, jsonb_build_object('political_party_id', NULL), jsonb_build_object('political_party_id', oh.political_party_id), jsonb_build_object('moved', false, 'field', 'political_party_id'));
    END IF;
    IF pp.contact_email IS NULL AND oh.contact_email IS NOT NULL THEN
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
      VALUES (p_claim_id, 'politician_profile', p_profile_id::text, jsonb_build_object('contact_email', NULL), jsonb_build_object('contact_email', oh.contact_email), jsonb_build_object('moved', false, 'field', 'contact_email'));
    END IF;
    IF pp.contact_phone IS NULL AND oh.contact_phone IS NOT NULL THEN
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
      VALUES (p_claim_id, 'politician_profile', p_profile_id::text, jsonb_build_object('contact_phone', NULL), jsonb_build_object('contact_phone', oh.contact_phone), jsonb_build_object('moved', false, 'field', 'contact_phone'));
    END IF;
    IF pp.source_url IS NULL AND oh.source_url IS NOT NULL THEN
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
      VALUES (p_claim_id, 'politician_profile', p_profile_id::text, jsonb_build_object('source_url', NULL), jsonb_build_object('source_url', oh.source_url), jsonb_build_object('moved', false, 'field', 'source_url'));
    END IF;
    IF pp.photo_url IS NULL AND oh.photo_url IS NOT NULL THEN
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
      VALUES (p_claim_id, 'politician_profile', p_profile_id::text, jsonb_build_object('photo_url', NULL), jsonb_build_object('photo_url', oh.photo_url), jsonb_build_object('moved', false, 'field', 'photo_url'));
    END IF;
    IF pp.holding_since IS NULL AND oh.holding_since IS NOT NULL THEN
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
      VALUES (p_claim_id, 'politician_profile', p_profile_id::text, jsonb_build_object('holding_since', NULL), jsonb_build_object('holding_since', oh.holding_since), jsonb_build_object('moved', false, 'field', 'holding_since'));
    END IF;
  END IF;

  UPDATE public.politician_profiles SET
    political_target_role = COALESCE(political_target_role, v_role_title),
    target_boundary_name = COALESCE(target_boundary_name, v_boundary_name),
    bio = COALESCE(bio, oh.bio),
    political_party_id = COALESCE(political_party_id, oh.political_party_id),
    contact_email = COALESCE(contact_email, oh.contact_email),
    contact_phone = COALESCE(contact_phone, oh.contact_phone),
    source_url = COALESCE(source_url, oh.source_url),
    photo_url = COALESCE(photo_url, oh.photo_url),
    holding_since = COALESCE(holding_since, oh.holding_since),
    updated_at = now()
  WHERE id = p_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_politician_profile_from_officeholder(UUID, UUID, UUID) FROM PUBLIC;

-- Rejects a claim stuck at 'pending_review'. Unlike reverse (which only
-- undoes MOVED content from an approved merge — a rejected claim never got
-- that far), this undoes the redemption-time profile backfill above: every
-- politician_profile field item logged for this claim gets nulled back out,
-- precisely, then the claim is closed as 'rejected'. The claimant keeps
-- their account and role — only the officeholder-sourced fields revert, same
-- "target keeps their own identity" principle reverse_officeholder_wall_claim
-- already follows for moved content.
CREATE OR REPLACE FUNCTION public.reject_officeholder_wall_claim(p_claim_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c public.office_holder_wall_claims%ROWTYPE;
  item RECORD;
  reverted_count INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'rejection reason is required' USING ERRCODE = '22023'; END IF;

  SELECT * INTO c FROM public.office_holder_wall_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'pending_review' THEN
    RAISE EXCEPTION 'only a claim pending review can be rejected' USING ERRCODE = '22023';
  END IF;

  IF c.target_profile_id IS NOT NULL THEN
    FOR item IN
      SELECT * FROM public.office_holder_wall_claim_items
      WHERE claim_id = p_claim_id AND entity_type = 'politician_profile' AND reversed_at IS NULL
        AND COALESCE((metadata->>'moved')::boolean, true) = false
    LOOP
      IF item.metadata->>'field' = 'wall_slug' THEN
        UPDATE public.politician_profiles SET wall_slug = NULL WHERE id = c.target_profile_id;
      ELSIF item.metadata->>'field' = 'political_target_role' THEN
        UPDATE public.politician_profiles SET political_target_role = NULL WHERE id = c.target_profile_id;
      ELSIF item.metadata->>'field' = 'target_boundary_name' THEN
        UPDATE public.politician_profiles SET target_boundary_name = NULL WHERE id = c.target_profile_id;
      ELSIF item.metadata->>'field' = 'bio' THEN
        UPDATE public.politician_profiles SET bio = NULL WHERE id = c.target_profile_id;
      ELSIF item.metadata->>'field' = 'political_party_id' THEN
        UPDATE public.politician_profiles SET political_party_id = NULL WHERE id = c.target_profile_id;
      ELSIF item.metadata->>'field' = 'contact_email' THEN
        UPDATE public.politician_profiles SET contact_email = NULL WHERE id = c.target_profile_id;
      ELSIF item.metadata->>'field' = 'contact_phone' THEN
        UPDATE public.politician_profiles SET contact_phone = NULL WHERE id = c.target_profile_id;
      ELSIF item.metadata->>'field' = 'source_url' THEN
        UPDATE public.politician_profiles SET source_url = NULL WHERE id = c.target_profile_id;
      ELSIF item.metadata->>'field' = 'photo_url' THEN
        UPDATE public.politician_profiles SET photo_url = NULL WHERE id = c.target_profile_id;
      ELSIF item.metadata->>'field' = 'holding_since' THEN
        UPDATE public.politician_profiles SET holding_since = NULL WHERE id = c.target_profile_id;
      END IF;
      UPDATE public.office_holder_wall_claim_items SET reversed_at = now() WHERE id = item.id;
      reverted_count := reverted_count + 1;
    END LOOP;
  END IF;

  UPDATE public.office_holder_wall_claims
  SET status = 'rejected',
      updated_at = now(),
      metadata = c.metadata || jsonb_build_object('rejected_at', now(), 'rejected_by', auth.uid(), 'rejection_reason', btrim(p_reason))
  WHERE id = p_claim_id;

  RETURN jsonb_build_object('claim_id', p_claim_id, 'status', 'rejected', 'reverted_field_count', reverted_count);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_officeholder_wall_claim(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_officeholder_wall_claim(UUID, TEXT) TO authenticated;
