#!/usr/bin/env python3
"""New election type, 2026-09-09: user asked "is this election added...
I don't see it" about https://elections.bc.ca/2026-abbotsford-mission-by-election/
-- checked directly: it wasn't. This is a **BC provincial** by-election
(MLA seat), a genuinely different category from every existing election
in the system (all six current `elections` rows are municipal/school-
trustee/US-midterm) -- not an oversight in an existing pipeline, a
category that was never added at all.

Confirmed via elections.bc.ca:
- Sole active BC provincial by-election right now (checked the BC-wide
  by-elections listing -- no others called).
- map_shapes already has the Abbotsford-Mission provincial riding
  (id 22307, boundary_type 'Provincial') and a current officeholder
  (Reann Gasper, Conservative) -- the seat became vacant, prompting this
  by-election; her office_holders record is untouched here since she's
  not one of the 5 by-election candidates herself.
- Candidate nominations already closed Sept 5, 2026 -- final list of 5
  is stable, pulled directly from the by-election's own page:
  Pam Alexis (BC NDP), Kerry-Lynne Findlay (Conservative Party),
  Stephen Fowler (BC Green Party), Lakhwinder Jhaj (CentreBC),
  Jeff Monds (Libertarian). None matched an existing profile or
  office_holders row (name-checked all 5).
- No photos available -- elections.bc.ca's candidate table here is a
  plain financial-agent-contact listing (name/affiliation/agent), same
  shape as the LECFA municipal data, not a per-candidate profile page.

Party names matched to the exact strings already used for other BC MLA
officeholders in this DB (`New Democratic Party (NDP)`, `Conservative
Party`, `Green Party` -- confirmed via Reann Gasper's own record and
other sitting MLAs) rather than the page's shorthand ("BC NDP", "BC Green
Party") to stay consistent with the existing data. CentreBC and
Libertarian are new to this DB, added as-is.
"""
ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"
ABBOTSFORD_MISSION_SHAPE = 22307

NEW_PARTIES = ["CentreBC", "Libertarian"]

STUB = [
    # (name, party_name)
    ("Pam Alexis", "New Democratic Party (NDP)"),
    ("Kerry-Lynne Findlay", "Conservative Party"),
    ("Stephen Fowler", "Green Party"),
    ("Lakhwinder Jhaj", "CentreBC"),
    ("Jeff Monds", "Libertarian"),
]

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

sql = ["BEGIN;"]

# 1. The election itself -- a genuinely new one, not an insert into an
# existing pipeline's election.
sql.append(f"""
INSERT INTO public.elections (name, election_date, status, nomination_open_date, nomination_close_date)
VALUES ('2026 Abbotsford-Mission By-election', '2026-09-26', 'nominations_closed', '2026-08-29', '2026-09-05')
RETURNING id;
""")

# 2. Parties not yet in the DB
values = ",\n".join(f"('Canada',{qstr(n)})" for n in NEW_PARTIES)
sql.append(
    "INSERT INTO public.political_parties (country, name)\n"
    f"SELECT v.country, v.name FROM (VALUES {values}) AS v(country, name)\n"
    "WHERE NOT EXISTS (SELECT 1 FROM public.political_parties p WHERE p.country=v.country AND p.name=v.name);"
)

# 3. Seat + stub candidates, with wall_slug computed inline (mandatory per
# docs/CANDIDATE_DATA_PULL_LOG.md "Politician Wall backfill" section).
sql.append(f"""
DO $$
DECLARE
  v_election_id uuid;
  v_seat_id uuid;
BEGIN
  SELECT id INTO v_election_id FROM public.elections WHERE name = '2026 Abbotsford-Mission By-election';

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, {ABBOTSFORD_MISSION_SHAPE}, 'MLA')
  RETURNING id INTO v_seat_id;

  CREATE TEMP TABLE new_stub (name text, party_name text, stub_id uuid, wall_slug text) ON COMMIT DROP;
""")

vals = ",\n".join(f"({qstr(n)},{qstr(p)},gen_random_uuid())" for n, p in STUB)
sql.append(f"  INSERT INTO new_stub (name, party_name, stub_id) VALUES {vals};")

sql.append(f"""
  UPDATE new_stub ns SET wall_slug = base.slug FROM (
    SELECT ns2.stub_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.politician_profiles pp WHERE pp.wall_slug = regexp_replace(regexp_replace(lower(ns2.name || '-mla'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
      ) THEN regexp_replace(regexp_replace(lower(ns2.name || '-mla'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(ns2.stub_id::text, '-', ''), 6)
      ELSE regexp_replace(regexp_replace(lower(ns2.name || '-mla'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
      END AS slug
    FROM new_stub ns2
  ) base WHERE base.stub_id = ns.stub_id;

  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  SELECT stub_id, 'politician', name, true, 'Canada', gen_random_uuid() FROM new_stub;

  INSERT INTO public.politician_profiles (id, political_party_id, wall_slug)
  SELECT ns.stub_id, pp.id, ns.wall_slug FROM new_stub ns
  LEFT JOIN public.political_parties pp ON pp.country='Canada' AND pp.name = ns.party_name;

  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  SELECT v_seat_id, stub_id, 'approved', now(), '{ADMIN_ID}' FROM new_stub;

  RAISE NOTICE 'Abbotsford-Mission by-election: seat % created, % candidates added', v_seat_id, (SELECT count(*) FROM new_stub);
END $$;
""")

sql.append("COMMIT;")

out_path = "bc_sept9_abbotsford_mission_byelection.sql"
with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"1 election, 1 seat, {len(STUB)} candidates, {len(NEW_PARTIES)} new parties")
print(f"SQL written to {out_path}")
