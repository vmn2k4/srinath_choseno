#!/usr/bin/env python3
"""Reusable, system-wide fix + standing check: every candidate must have a
real, stored `politician_profiles.wall_slug` -- not just rely on the
front-end's computed fallback -- or their "Politician Wall" link 404s.

## Root cause (found 2026-09-09, user caught it on Dee Reiter, SD36
Surrey School Trustee)

`wall_slug` is a real, unique column, and every "View Politician Wall"
link in the app (CandidacyWall.tsx, NavBar.tsx, GlobalPoliticianSearch,
etc.) renders an href using `wall_slug || buildPoliticianWallSlug(name,
role)` -- i.e. it ALWAYS renders a link, real slug or computed fallback,
so a broken wall is never visibly obvious from the link itself. But the
wall page (`src/app/wall/[ghostId]/page.tsx` ->
`getWallOwnerProfileBySlug`) resolves that URL with an `!inner` join on
`politician_profiles.wall_slug` -- if no row actually has that exact
slug stored, the page 404s. `buildPoliticianWallSlug`'s own doc comment
says as much: "The database stores this value so links remain stable" --
computing it live was only ever meant as a last-resort fallback for a
narrow window (e.g. right after a claim, before the real slug loads), not
a permanent substitute.

`wall_slug` only gets written by the officeholder-claim/signup RPCs
(`supabase/migrations/2026081116*_officeholder_claim_prefill_on_signup.sql`
and friends) -- i.e. only when a real person signs up and claims a
profile. **None of this session's bulk candidate-insert scripts
(bc_refresh_*.py, bc_official_pages_supplement.py, top50_batch2.py, the
US FEC import, etc.) ever set it**, so every administratively-inserted
stub candidate profile has always launched with a dead wall link. This
was invisible until a user actually clicked through to one.

Audit run 2026-09-09: **768 of 2,075 candidates system-wide** had no
`wall_slug` (BC Councillor 203/293, BC Mayor 35/88, School Trustee 56/75,
US Representative 442/1285, US Senator 3/302, Governor 29/32).

## The fix

Compute the exact same slug the front-end's `buildPoliticianWallSlug(name,
role)` fallback would compute (`src/lib/utils/slugs.ts`: lowercase,
NFD-normalize and strip diacritics, non-alphanumeric runs -> single
hyphen, trim leading/trailing hyphens) and **store it**, so the front-end
fallback and the stored value always agree and the wall resolves.

`wall_slug` is UNIQUE and a name+role collision across two different
people is real at this scale (e.g. two "John Smith, Councillor" in
different cities) -- confirmed happened during this run. Unlike the
`sync-*-election-results.py` officeholder scripts (which respond to a
collision by linking to whichever profile got there first -- fine for
literal duplicate-person detection, wrong here since these are
genuinely different people), this script appends the first 6 hex
characters of the candidate's own `election_candidates.id` -- the exact
same disambiguator already used in the candidate-page URL itself
(`buildSeatSlug`'s pattern) -- to every slug that collides, so no two
different people ever get merged onto one wall.

## Standing rule going forward

**Every script that inserts a `politician_profiles` row for a new
candidate must compute and set `wall_slug` in that same INSERT** -- do
not leave it for a later backfill pass. See the STUB insert block in
`bc_refresh_sept6.py` or any script in this directory for the pattern to
copy: add a `wall_slug` value (via this script's `compute_slug()`,
checked against existing slugs) to the `politician_profiles` INSERT
alongside `political_party_id`.
"""
import csv
import os
import re
import subprocess
import unicodedata

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres.qlzyfdwrkcxyqapewxwg:pa.8tX5%2BHh%2FGZn2@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
)

def slugify(text: str) -> str:
    """Mirrors src/lib/utils/slugs.ts slugifyText() exactly."""
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")  # strip combining marks
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return re.sub(r"(^-|-$)+", "", text)

def compute_slug(name: str, role: str) -> str:
    return slugify(f"{name}-{role}") if role else slugify(name)

def qstr(v):
    return "'" + v.replace("'", "''") + "'"

def fetch_missing():
    query = """
    select pp.id, p.full_name, es.role_title, ec.id
    from politician_profiles pp
    join election_candidates ec on ec.politician_id = pp.id
    join election_seats es on es.id = ec.seat_id
    join profiles p on p.id = pp.id
    where pp.wall_slug is null or pp.wall_slug = '';
    """
    out = subprocess.run(
        ["psql", DB_URL, "-t", "-A", "-F", "\t", "-c", query],
        capture_output=True, text=True, check=True,
    ).stdout
    rows = []
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) == 4:
            rows.append(parts)
    return rows

def fetch_existing_slugs():
    out = subprocess.run(
        ["psql", DB_URL, "-t", "-A", "-c", "select wall_slug from politician_profiles where wall_slug is not null;"],
        capture_output=True, text=True, check=True,
    ).stdout
    return set(line.strip() for line in out.splitlines() if line.strip())

def main():
    missing = fetch_missing()
    taken = fetch_existing_slugs()

    sql = ["BEGIN;"]
    collisions = 0
    for profile_id, full_name, role_title, candidate_id in missing:
        base = compute_slug(full_name, role_title)
        slug = base
        if slug in taken:
            collisions += 1
            slug = f"{base}-{candidate_id.replace('-', '')[:6]}"
            # Extremely unlikely second collision (candidate id suffix is
            # effectively unique) -- bail loudly rather than silently drop.
            if slug in taken:
                raise SystemExit(f"Unresolved slug collision for {profile_id} ({full_name}): {slug}")
        taken.add(slug)
        sql.append(
            f"UPDATE public.politician_profiles SET wall_slug = {qstr(slug)}, updated_at = now() "
            f"WHERE id = '{profile_id}';"
        )
    sql.append("COMMIT;")

    out_path = "ensure_wall_slugs.sql"
    with open(out_path, "w") as f:
        f.write("\n".join(sql) + "\n")
    print(f"Missing wall_slug: {len(missing)}  Collisions disambiguated: {collisions}")
    print(f"SQL written to {out_path}")

if __name__ == "__main__":
    main()
