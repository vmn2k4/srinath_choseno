#!/usr/bin/env python3
"""
Creates the "2026 BC Provincial Election" (the snap election called by Premier
Eby on 2026-09-22, election day 2026-10-24) and its 93 MLA seats -- one per
BC Provincial map_shape, scoped via shape_containers to the "British Columbia"
Province shape (NOT a blanket boundary_type='Provincial' filter, which
includes all provinces/territories -- 761 rows nationally vs 93 for BC alone).

Follows the exact pattern in scripts/start_us_2026_midterms.py:
  - Election row: existence-checked by name (no UNIQUE constraint on
    elections.name), so re-running this script is safe.
  - Seats: upserted against the real UNIQUE (election_id, map_shape_id,
    role_title) constraint.
  - No candidates minted here -- seats only. Candidate sourcing (Elections
    BC nomination list) is a separate follow-up once nominations close
    2026-10-03.

Usage: DATABASE_URL=... python3 scripts/create_bc_provincial_election.py
"""
import os
import subprocess
import sys

DB_URL = os.environ.get("DATABASE_URL") or (
    "postgresql://postgres.qlzyfdwrkcxyqapewxwg:pa.8tX5%2BHh%2FGZn2"
    "@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
)
ADMIN_PROFILE_ID = "5b66563e-2674-4fed-b733-3e19955a166a"
ELECTION_NAME = "2026 BC Provincial Election"
ELECTION_DATE = "2026-10-24"
NOMINATION_OPEN = "2026-09-22"
NOMINATION_CLOSE = "2026-10-03"
ROLE_TITLE = "MLA"


def psql_run(sql):
    r = subprocess.run(["psql", DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql],
                        capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"psql failed:\n{r.stderr}\n--- sql ---\n{sql}")
    return r.stdout


def psql_scalar(sql):
    r = subprocess.run(["psql", DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-q", "-c", sql],
                        capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"psql failed:\n{r.stderr}\n--- sql ---\n{sql}")
    return r.stdout.strip()


def main():
    print(f"Creating/finding election: {ELECTION_NAME}")
    psql_run(f"""
        INSERT INTO public.elections
            (name, election_date, nomination_open_date, nomination_close_date, status, created_by)
        SELECT '{ELECTION_NAME}', '{ELECTION_DATE}', '{NOMINATION_OPEN}', '{NOMINATION_CLOSE}',
               'nominations_open', '{ADMIN_PROFILE_ID}'
        WHERE NOT EXISTS (SELECT 1 FROM public.elections WHERE name = '{ELECTION_NAME}');
    """)
    election_id = psql_scalar(f"SELECT id FROM public.elections WHERE name = '{ELECTION_NAME}';")
    if not election_id:
        sys.exit("Could not create or find the election row.")
    print(f"  election_id = {election_id}")

    print("Re-syncing status from dates...")
    psql_run(f"SELECT sync_election_status('{election_id}');")

    print("Creating 93 MLA seats scoped to British Columbia via shape_containers...")
    psql_run(f"""
        INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
        SELECT '{election_id}', ms.id, '{ROLE_TITLE}'
        FROM public.map_shapes ms
        JOIN public.shape_containers sc ON sc.map_shape_id = ms.id
        JOIN public.map_shapes p ON p.id = sc.container_shape_id AND p.boundary_type = 'Province'
        WHERE ms.boundary_type = 'Provincial'
          AND p.name = 'British Columbia'
          AND ms.retired_at IS NULL
        ON CONFLICT (election_id, map_shape_id, role_title) DO UPDATE SET role_title = EXCLUDED.role_title;
    """)

    seat_count = psql_scalar(f"SELECT count(*) FROM public.election_seats WHERE election_id = '{election_id}';")
    print(f"  seats now on this election: {seat_count}")

    print("\nFinal state:")
    print(psql_run(f"""
        SELECT id, name, election_date, nomination_open_date, nomination_close_date, status
        FROM public.elections WHERE id = '{election_id}';
    """))


if __name__ == "__main__":
    main()
