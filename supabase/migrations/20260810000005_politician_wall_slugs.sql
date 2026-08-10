alter table public.politician_profiles
  add column if not exists wall_slug text;

update public.politician_profiles pp
set wall_slug = trim(both '-' from regexp_replace(
  lower(coalesce(p.full_name, 'politician') || '-' || coalesce(pp.political_target_role, '')),
  '[^a-z0-9]+', '-', 'g'
))
from public.profiles p
where p.id = pp.id
  and pp.wall_slug is null;

-- Keep duplicate display names routable without exposing the ghost id.
with duplicates as (
  select pp.id, pp.wall_slug, row_number() over (partition by pp.wall_slug order by pp.id) as occurrence
  from public.politician_profiles pp
  where pp.wall_slug is not null
)
update public.politician_profiles pp
set wall_slug = d.wall_slug || '-' || left(replace(d.id::text, '-', ''), 6)
from duplicates d
where pp.id = d.id
  and d.occurrence > 1;

create unique index if not exists politician_profiles_wall_slug_key
  on public.politician_profiles (wall_slug)
  where wall_slug is not null;
