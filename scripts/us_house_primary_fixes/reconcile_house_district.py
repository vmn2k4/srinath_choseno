#!/usr/bin/env python3
"""
Reconciles one or more US House districts' `election_candidates` against a
hand-verified "truth" list of real general-election nominees (typically the
top-N vote-getters from a state's official primary results / statement of
vote — see docs/CANDIDATE_DATA_PULL_LOG.md's "US House/Senate primary
contamination" section for why this exists: FEC's `candidate_status` has no
concept of state primary elimination, so `start_us_2026_midterms.py`'s
`candidate_status=='C'` filter leaves primary losers in and sometimes misses
the real winner entirely).

This is NOT a fetcher -- it takes truth data you already have (by hand, from
reading an official state PDF/HTML page yourself, the way ca_2026_primary_
winners.py's TRUTH dict was built) and does the DB-side reconciliation:
- Matches each DB candidate to a truth entry by normalized last name
  (accent-stripped, case-insensitive, substring-tolerant).
- Deletes any DB candidate that doesn't match anything in that district's
  truth list (a primary loser, or someone who dropped out).
- Reports which truth entries have NO matching DB candidate (the real
  winner is missing entirely -- usually because FEC never marked them
  `candidate_status='C'`) so you can add them with add_missing_candidates().

Usage as a library (see reconcile_ca_house.py for a worked example):

    from reconcile_house_district import load_db_export, find_deletes, find_missing

    TRUTH = {1: ["gallagher", "mcguire"], 2: [...], ...}
    rows = load_db_export("ca_db_current.txt")  # code|seat_id|name|candidate_id per line
    deletes = find_deletes(rows, TRUTH, district_from_code=lambda c: int(c[2:]))
    missing = find_missing(rows, TRUTH, district_from_code=lambda c: int(c[2:]))
    # -> write deletes to SQL DELETE, missing to SQL INSERT (see docs for the
    #    exact stub-profile insert shape -- add_unregistered_candidate's
    #    equivalent, not reproduced here since party id / country vary).

DB export format expected (one line per candidate, pipe-delimited), e.g. via:
    psql "$DATABASE_URL" -t -A -F'|' -c "
      select ms.code, es.id, p.full_name, ec.id
      from public.election_candidates ec
      join public.election_seats es on es.id=ec.seat_id
      join public.map_shapes ms on ms.id=es.map_shape_id
      join public.elections e on e.id=es.election_id
      join public.profiles p on p.id=ec.politician_id
      where e.name='2026 US Midterm Elections' and es.role_title='U.S. Representative'
        and ms.properties->>'statefp'='<FIPS>'
      order by ms.code, p.full_name;
    " > state_db_current.txt
"""

import unicodedata


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def norm_last(full_name):
    """Best-effort last name: last whitespace-separated token, accent/punct-stripped."""
    parts = full_name.replace(",", " ").replace(".", " ").split()
    return strip_accents(parts[-1].lower()) if parts else ""


def load_db_export(path):
    """Returns list of (code, seat_id, name, candidate_id)."""
    rows = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(tuple(line.split("|")))
    return rows


def _matches(last, truth_list):
    last_n = strip_accents(last.lower())
    for t in truth_list:
        t_n = strip_accents(t.lower())
        if last_n == t_n or last_n in t_n or t_n in last_n:
            return True
    return False


def find_deletes(rows, truth, district_from_code, force_delete_names=None):
    """
    force_delete_names: optional {district: {full_name, ...}} for cases where
    a truth alias over-matches more than one real DB row (see CA district 45
    in ca_2026_primary_winners.py's usage for a worked example -- two people
    named "Vo" needed disambiguating by vote total, not name alone).
    Returns list of (candidate_id, district, name) to delete.
    """
    force_delete_names = force_delete_names or {}
    out = []
    for code, seat_id, name, cand_id in rows:
        dist = district_from_code(code)
        t = truth.get(dist)
        if t is None:
            continue  # no truth data for this district yet -- leave alone
        forced = name in force_delete_names.get(dist, set())
        if forced or not _matches(norm_last(name), t):
            out.append((cand_id, dist, name))
    return out


def find_missing(rows, truth, district_from_code):
    """Returns {district: seat_id} -> list of truth tokens with zero DB match
    (the real nominee FEC never surfaced -- add these as new stub candidates
    via the same profiles/politician_profiles/election_candidates insert
    add_unregistered_candidate() does; see CANDIDATE_DATA_PULL_LOG.md)."""
    seat_id_by_district = {}
    matched = {}
    for code, seat_id, name, cand_id in rows:
        dist = district_from_code(code)
        seat_id_by_district[dist] = seat_id
        t = truth.get(dist)
        if t is None:
            continue
        matched.setdefault(dist, set())
        for token in t:
            if _matches(norm_last(name), [token]):
                matched[dist].add(token)

    missing = {}
    for dist, t in truth.items():
        seat_id = seat_id_by_district.get(dist)
        if not seat_id:
            continue  # district doesn't exist in our DB at all yet
        unmatched_tokens = [tok for tok in t if tok not in matched.get(dist, set())]
        if unmatched_tokens:
            missing[dist] = (seat_id, unmatched_tokens)
    return missing
