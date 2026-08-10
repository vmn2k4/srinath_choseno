-- Add office-holder-specific fields to politician_profiles
-- This allows office holders to display contact info and official website on their wall

ALTER TABLE public.politician_profiles
  ADD COLUMN contact_email text,
  ADD COLUMN contact_phone text,
  ADD COLUMN photo_url text,
  ADD COLUMN source_url text,
  ADD COLUMN holding_since date;

-- Migrate data from office_holders to politician_profiles for all linked politicians
-- This is a one-time migration that syncs office holder data to the politician profile
DO $$
DECLARE
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT DISTINCT
      oh.linked_profile_id,
      oh.contact_email,
      oh.contact_phone,
      oh.photo_url,
      oh.source_url,
      oh.holding_since
    FROM public.office_holders oh
    WHERE oh.linked_profile_id IS NOT NULL
  LOOP
    UPDATE public.politician_profiles
    SET
      contact_email = v_row.contact_email,
      contact_phone = v_row.contact_phone,
      photo_url = COALESCE(v_row.photo_url, photo_url),  -- preserve existing if set
      source_url = v_row.source_url,
      holding_since = v_row.holding_since,
      updated_at = now()
    WHERE id = v_row.linked_profile_id;
  END LOOP;
END $$;

-- Add comment explaining these fields are office-holder-specific
COMMENT ON COLUMN public.politician_profiles.contact_email IS 'Office contact email (from office_holders data)';
COMMENT ON COLUMN public.politician_profiles.contact_phone IS 'Office contact phone (from office_holders data)';
COMMENT ON COLUMN public.politician_profiles.photo_url IS 'Official photo URL (from office_holders data)';
COMMENT ON COLUMN public.politician_profiles.source_url IS 'Official website or government profile URL';
COMMENT ON COLUMN public.politician_profiles.holding_since IS 'Date when started holding this office';
