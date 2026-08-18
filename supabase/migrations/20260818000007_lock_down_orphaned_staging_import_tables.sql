-- Security Advisor: "RLS Disabled in Public" (13 of the 14 reported critical errors).
--
-- 12 tables named staging_<uuid> exist in the public (API-exposed) schema. They are
-- leftover scratch tables from manual ogr2ogr/shapefile boundary imports (see
-- boundary_uploads / map_shapes) — nothing in the app or supabase/functions references
-- them by name, and their naming pattern (a raw uuid) matches an ogr2ogr -nln default
-- rather than anything created intentionally through a migration.
--
-- They currently have RLS disabled AND full INSERT/SELECT/UPDATE/DELETE/TRUNCATE grants
-- to anon and authenticated (the default privileges new tables inherit), which means any
-- unauthenticated visitor can read, modify, or wipe them via the PostgREST API today.
--
-- Website intent is that only boundary_uploads -> map_shapes (governed by the existing
-- "Admins manage boundary uploads" policy) is reachable by clients; raw import scratch
-- tables were never meant to be part of the public API surface. We lock them out
-- entirely rather than dropping them, since they may still hold not-yet-merged import
-- data an admin needs to inspect.
do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname like 'staging\_%'
  loop
    execute format('revoke all on table public.%I from anon, authenticated;', t);
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;
