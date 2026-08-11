alter table public.profiles
  add column if not exists wall_slug text;

update public.profiles p
set wall_slug = pp.wall_slug
from public.politician_profiles pp
where pp.id = p.id
  and pp.wall_slug is not null
  and p.wall_slug is null;

create unique index if not exists profiles_wall_slug_key
  on public.profiles (wall_slug)
  where wall_slug is not null;
