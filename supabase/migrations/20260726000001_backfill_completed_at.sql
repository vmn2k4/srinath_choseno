-- completed_at is new — without a backfill, every upload batch created
-- before this feature existed (fully finished, verified during this
-- session) would incorrectly show as "incomplete" in the admin panel.
-- Any existing batch that already has shapes tied to it is done.
UPDATE public.boundary_uploads bu
SET completed_at = bu.created_at
WHERE bu.completed_at IS NULL
  AND EXISTS (SELECT 1 FROM public.map_shapes ms WHERE ms.upload_id = bu.id);
