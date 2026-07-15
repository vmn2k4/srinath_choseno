ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS wall_ghost_id TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS link_metadata JSONB;
