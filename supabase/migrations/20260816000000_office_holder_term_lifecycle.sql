-- office_holders had no lifecycle: a row's mere existence meant "currently
-- holds this seat" (see enrichProfileWithContactFallback() in
-- src/lib/services/politicianWall.ts, which sets is_office_holder purely off
-- ohMatches.length > 0). There was no way to record that someone left office
-- without either hard-deleting their row (blocked anyway --
-- office_holder_wall_claims.office_holder_id is ON DELETE RESTRICT, so any
-- officeholder with claim history can't be deleted) or silently overwriting
-- their name/contact/photo with the successor's, destroying their term
-- history. Discovered via Maple Ridge, BC: the office_holders row for mayor
-- still held Mike Morden (lost the Oct 2022 election) instead of Dan Ruimy
-- (in office since Nov 1, 2022) -- traced upstream to the OpenNorth
-- Represent API / CivicInfo BC feed itself being stale for that seat, which
-- our ingestion pipeline mirrored as-is with no way to distinguish "still
-- true" from "was true at ingest time and never re-checked".
--
-- Fix: outgoing officeholders are retired (is_current = false,
-- term_ended_at set), never deleted or overwritten in place. Incoming
-- winners get a new row. This preserves term history, keeps
-- office_holder_wall_claims intact, and gives the badge logic
-- (politicianWall.ts, PoliticianWallClient.tsx, elections.ts) a real signal
-- to distinguish current / former / aspiring instead of inferring it from
-- row existence alone.
ALTER TABLE public.office_holders
  ADD COLUMN is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN term_ended_at date;

COMMENT ON COLUMN public.office_holders.is_current IS
  'False once this person''s term has ended. Never delete or overwrite an outgoing officeholder''s row in place -- retire it (is_current = false, term_ended_at set) and insert a new row for the successor, so term history and existing wall_claims survive.';
COMMENT ON COLUMN public.office_holders.term_ended_at IS
  'Date this person''s term ended. Set together with is_current = false.';

-- Public/service reads filter heavily on is_current (every boundary
-- directory / wall lookup in src/lib/services/elections.ts and
-- politicianWall.ts now scopes to current holders by default).
CREATE INDEX idx_office_holders_is_current ON public.office_holders(is_current);

-- No seat-cardinality constraint (e.g. "only one current Mayor per shape")
-- is added here: election_role_types has no single-seat vs multi-seat flag
-- (Mayor/MP/Governor are one-per-shape, Councillor is many-per-shape, all
-- using the same role_title shape with no discriminating column), so a
-- partial unique index on (map_shape_id, election_role_type_id) WHERE
-- is_current would incorrectly reject legitimate multi-councillor rows.
-- Enforced instead at the write path (see retireAndReplaceOfficeHolder in
-- src/lib/services/elections.ts) for single-seat roles.

-- Formalize the live unique constraint, which drifted from what
-- 20260806000001_office_holders.sql declared (UNIQUE (map_shape_id,
-- election_role_type_id)) to what's actually on the table today (UNIQUE
-- (map_shape_id, election_role_type_id, full_name), needed to allow
-- multiple councillors per shape+role) via an untracked direct psql ALTER.
-- This block is a no-op against the current DB; it exists so a fresh
-- `supabase db reset` from migrations alone reproduces live schema instead
-- of the narrower original constraint that was silently replaced.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'office_holders_map_shape_id_election_role_type_id_key'
      AND conrelid = 'public.office_holders'::regclass
  ) THEN
    ALTER TABLE public.office_holders
      DROP CONSTRAINT office_holders_map_shape_id_election_role_type_id_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'office_holders_map_shape_id_role_full_name_key'
      AND conrelid = 'public.office_holders'::regclass
  ) THEN
    ALTER TABLE public.office_holders
      ADD CONSTRAINT office_holders_map_shape_id_role_full_name_key
      UNIQUE (map_shape_id, election_role_type_id, full_name);
  END IF;
END $$;
