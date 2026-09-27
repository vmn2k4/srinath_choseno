#!/usr/bin/env python3
"""
BC provincial candidate sync via BCPoliTracker (bcpoli.gremble.io) -- a
third-party aggregator that itself pulls from party sites + Wikipedia's
candidate tables + Elections BC, pre-merged and deduplicated across all 93
BC ridings in one page. See docs/ELECTION_DATA_SOURCES.md's "BC Provincial
snap election 2026" section for how this source was found and verified
(10/10 spot-checked names confirmed against independent sources before this
script was written).

Why this over scraping Elections BC directly (sync_bc_candidates.py):
Elections BC only lists nominations it has FORMALLY ACCEPTED, which lags
real declared candidacies by days -- same lesson as CivicInfo BC vs. LECFA
for BC municipal elections (see docs/ELECTION_DATA_SOURCES.md). This script
is a *supplement*, not a replacement -- re-run sync_bc_candidates.py's
`sync` once nominations close 2026-10-03 to cross-check/upgrade to the
authoritative source.

Data mechanism: BCPoliTracker is a static site with candidate data baked
directly into an inline <script> tag as JSON at build time (confirmed live
-- no JSON API, no XHR). This script fetches the raw HTML and regex-extracts
every `{"t":<timestamp>,"k":"candidate","s":"<Name>, <Party>, <Riding>","h":
"/riding/<slug>"}` entry.

KNOWN DATA QUALITY ISSUE in the source (confirmed live 2026-09-27): the same
person can appear twice under reversed name order (e.g. "Adrian Dix" AND
"Dix Adrian" both logged for BC NDP / Vancouver-Renfrew) -- a manual data-
entry slip on the tracker's end, not a real second candidate. Since a party
cannot run two candidates for the same seat, this script dedupes by
(riding, party) and keeps the LATEST-timestamped entry when more than one
name maps to the same (riding, party) pair, logging every case it collapses
so a human can sanity-check the choice.

Sitting-MLA safeguard: before minting a stub profile for any candidate, this
checks office_holders for a CURRENT MLA on that exact map_shape_id with a
matching name and links to their existing profile instead -- same fix
applied in scripts/start_us_2026_midterms.py after ~180 duplicate profiles
slipped through an earlier run without this check (see
20260818000005_merge_officeholder_candidate_duplicate_profiles.sql).

Usage:
  # 1. Pull the latest feed, cache it locally, print what changed since last fetch.
  python3 scripts/sync_bc_provincial_bcpolitracker.py fetch

  # 2. Dry run -- shows exact add/skip/link counts against the live DB. Writes nothing.
  python3 scripts/sync_bc_provincial_bcpolitracker.py diff

  # 3. Actually write. Idempotent -- safe to re-run after nominations close Oct 3
  #    or any time the tracker updates (rolling nominations).
  python3 scripts/sync_bc_provincial_bcpolitracker.py apply

Requires DATABASE_URL (or --db-url) and only the Python standard library +
`psql` on PATH, matching every other sync_*.py script's convention.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.request

USER_AGENT = "Mozilla/5.0 (compatible; ChosenoCandidateSync/1.0)"
TRACKER_URL = "https://bcpoli.gremble.io/"
ELECTION_NAME = "2026 BC Provincial Election"
ADMIN_PROFILE_ID = "5b66563e-2674-4fed-b733-3e19955a166a"
CACHE_PATH = os.path.join(os.path.dirname(__file__), "bc_provincial_bcpolitracker_cache.json")

CANDIDATE_RE = re.compile(r'\{"t":"([^"]+)","k":"candidate","s":"([^"]+)","h":"([^"]+)"\}')

# BCPoliTracker's raw party labels -> our political_parties.name (confirmed
# live against `select name from political_parties where country='Canada'`).
# Anything not in this map is treated as no-party (Independent-style) UNLESS
# it's clearly a real registered party we haven't seeded yet (OneBC) -- see
# UNSEEDED_PARTIES below.
PARTY_MAP = {
    "BC NDP": "New Democratic Party (NDP)",
    "Conservative": "Conservative Party",
    "BC Green": "Green Party",
    "CentreBC": "CentreBC",
    "Libertarian Party of BC": "Libertarian",
}
# Real parties BCPoliTracker names that don't exist in political_parties yet
# -- created on first use rather than silently dropped to Independent.
UNSEEDED_PARTIES = {"OneBC"}
NO_PARTY_LABELS = {"Independent", "No affiliation", ""}


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def fetch_html(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8")


def extract_raw_candidates(html):
    """Returns list of (timestamp, name, party, riding, path)."""
    out = []
    for m in CANDIDATE_RE.finditer(html):
        ts, s, path = m.group(1), m.group(2), m.group(3)
        parts = s.rsplit(", ", 2)
        if len(parts) != 3:
            log(f"  WARNING: could not parse candidate string {s!r}, skipping")
            continue
        name, party, riding = parts
        out.append((ts, name.strip(), party.strip(), riding.strip(), path))
    return out


def dedupe_by_riding_party(raw):
    """
    A party cannot run two candidates in the same riding, so (riding, party)
    is the real dedup key -- NOT name, since the source has at least one
    confirmed case of the same person logged twice under reversed name
    order (see module docstring). Keeps the latest-timestamped entry per
    (riding, party) and logs every collapse for manual sanity-checking.
    """
    best = {}
    for ts, name, party, riding, path in raw:
        key = (riding, party)
        if key not in best or ts > best[key][0]:
            if key in best and best[key][1].lower() != name.lower():
                log(f"  NOTE: {riding} / {party}: keeping {name!r} (newer) over {best[key][1]!r} (older) -- verify this wasn't a real correction")
            best[key] = (ts, name)
    return [{"riding": riding, "party": party, "name": v[1], "ts": v[0]} for (riding, party), v in best.items()]


def do_fetch(args):
    log(f"Fetching {TRACKER_URL} ...")
    html = fetch_html(TRACKER_URL)
    raw = extract_raw_candidates(html)
    log(f"  {len(raw)} raw candidate entries found in page")
    candidates = dedupe_by_riding_party(raw)
    log(f"  {len(candidates)} unique (riding, party) candidacies after dedup")

    prev = []
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH) as f:
            prev = json.load(f).get("candidates", [])
    prev_keys = {(c["riding"], c["party"], c["name"]) for c in prev}
    new_keys = {(c["riding"], c["party"], c["name"]) for c in candidates}
    added = new_keys - prev_keys
    removed = prev_keys - new_keys
    if prev:
        log(f"  Since last fetch: {len(added)} new, {len(removed)} no longer listed")
        for r, p, n in sorted(added):
            log(f"    + {n} ({p}), {r}")
        for r, p, n in sorted(removed):
            log(f"    - {n} ({p}), {r}")
    else:
        log("  No previous cache found -- this is the first fetch.")

    with open(CACHE_PATH, "w") as f:
        json.dump({"fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "candidates": candidates}, f, indent=1)
    log(f"Cached to {CACHE_PATH}")


def normalize_riding(name):
    n = unicodedata.normalize("NFKC", name).lower().strip()
    n = n.replace("–", "-").replace("—", "-")
    n = re.sub(r"\s+", " ", n)
    return n


def psql_run(db_url, sql):
    r = subprocess.run(["psql", db_url, "-v", "ON_ERROR_STOP=1", "-q"], input=sql, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"psql failed:\n{r.stderr.strip()}\n--- sql ---\n{sql}")
    return r.stdout


def psql_csv(db_url, sql):
    r = subprocess.run(["psql", db_url, "--csv", "-t", "-v", "ON_ERROR_STOP=1"], input=sql, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"psql failed:\n{r.stderr.strip()}\n--- sql ---\n{sql}")
    import csv, io
    return [row for row in csv.reader(io.StringIO(r.stdout)) if row]


def sql_str(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def load_bc_ridings(db_url):
    """Returns {normalized_riding_name: map_shape_id} for all 93 BC Provincial shapes."""
    rows = psql_csv(db_url, """
        SELECT ms.id, ms.name
        FROM map_shapes ms
        JOIN shape_containers sc ON sc.map_shape_id = ms.id
        JOIN map_shapes p ON p.id = sc.container_shape_id AND p.boundary_type = 'Province'
        WHERE ms.boundary_type = 'Provincial' AND p.name = 'British Columbia' AND ms.retired_at IS NULL;
    """)
    return {normalize_riding(name): int(shape_id) for shape_id, name in rows}


def load_election_id(db_url):
    out = psql_csv(db_url, f"SELECT id FROM elections WHERE name = {sql_str(ELECTION_NAME)};")
    if not out:
        sys.exit(f"Election {ELECTION_NAME!r} not found -- run scripts/create_bc_provincial_election.py first.")
    return out[0][0]


def load_seats(db_url, election_id):
    """Returns {map_shape_id: seat_id}."""
    rows = psql_csv(db_url, f"SELECT map_shape_id, id FROM election_seats WHERE election_id = {sql_str(election_id)};")
    return {int(shape_id): seat_id for shape_id, seat_id in rows}


def load_existing_candidates(db_url, seat_ids):
    """Returns {seat_id: set(lowercased full_name)} for candidates already on these seats."""
    if not seat_ids:
        return {}
    ids = ",".join(sql_str(s) for s in seat_ids)
    rows = psql_csv(db_url, f"""
        SELECT ec.seat_id, lower(p.full_name)
        FROM election_candidates ec JOIN profiles p ON p.id = ec.politician_id
        WHERE ec.seat_id IN ({ids});
    """)
    out = {}
    for seat_id, name in rows:
        out.setdefault(seat_id, set()).add(name)
    return out


def find_officeholder_profile(db_url, map_shape_id, name):
    out = psql_csv(db_url, f"""
        SELECT p.id FROM office_holders oh JOIN profiles p ON p.id = oh.linked_profile_id
        WHERE oh.map_shape_id = {map_shape_id} AND oh.is_current AND lower(p.full_name) = lower({sql_str(name)})
        LIMIT 1;
    """)
    return out[0][0] if out else None


def build_plan(db_url):
    if not os.path.exists(CACHE_PATH):
        sys.exit("No cached data -- run `fetch` first.")
    with open(CACHE_PATH) as f:
        candidates = json.load(f)["candidates"]

    ridings = load_bc_ridings(db_url)
    election_id = load_election_id(db_url)
    seats = load_seats(db_url, election_id)
    existing = load_existing_candidates(db_url, list(seats.values()))

    plan = {"to_add": [], "already_present": [], "unmatched_riding": [], "new_parties_needed": set(), "link_to_incumbent": []}
    for c in candidates:
        shape_id = ridings.get(normalize_riding(c["riding"]))
        if shape_id is None:
            plan["unmatched_riding"].append(c)
            continue
        seat_id = seats.get(shape_id)
        if seat_id is None:
            plan["unmatched_riding"].append(c)
            continue
        if c["name"].lower() in existing.get(seat_id, set()):
            plan["already_present"].append(c)
            continue
        officeholder_profile = find_officeholder_profile(db_url, shape_id, c["name"])
        entry = {**c, "shape_id": shape_id, "seat_id": seat_id, "officeholder_profile": officeholder_profile}
        if officeholder_profile:
            plan["link_to_incumbent"].append(entry)
        else:
            plan["to_add"].append(entry)
            if c["party"] not in PARTY_MAP and c["party"] not in NO_PARTY_LABELS and c["party"] not in UNSEEDED_PARTIES:
                pass  # unknown party, will just skip party assignment -- flagged below
    return election_id, plan


def print_plan(plan):
    print(f"\n{'='*70}\nDRY RUN -- nothing written yet\n{'='*70}")
    print(f"New candidates to add (fresh stub profile): {len(plan['to_add'])}")
    print(f"New candidacies linking to an EXISTING sitting-MLA profile:  {len(plan['link_to_incumbent'])}")
    print(f"Already in the database (no-op):                            {len(plan['already_present'])}")
    print(f"Could not match to a riding/seat:                           {len(plan['unmatched_riding'])}")
    print("Removals: 0 -- this script only ever adds, never deletes a candidate.\n")

    if plan["to_add"]:
        print("-- New stub candidates --")
        for c in sorted(plan["to_add"], key=lambda c: c["riding"]):
            print(f"  + {c['name']} ({c['party']}), {c['riding']}")
    if plan["link_to_incumbent"]:
        print("\n-- Linking to existing sitting-MLA profile (no duplicate) --")
        for c in sorted(plan["link_to_incumbent"], key=lambda c: c["riding"]):
            print(f"  ~ {c['name']} ({c['party']}), {c['riding']}")
    if plan["unmatched_riding"]:
        print("\n-- Could not match (needs manual look) --")
        for c in plan["unmatched_riding"]:
            print(f"  ? {c['name']} ({c['party']}), {c['riding']!r}")

    unknown_parties = {c["party"] for c in plan["to_add"] + plan["link_to_incumbent"]
                        if c["party"] not in PARTY_MAP and c["party"] not in NO_PARTY_LABELS and c["party"] not in UNSEEDED_PARTIES}
    if unknown_parties:
        print(f"\n-- Unrecognized party labels (will be added with NO party set unless mapped): {unknown_parties}")


def do_diff(args):
    _, plan = build_plan(args.db_url)
    print_plan(plan)


def canonical_party_id_sql(raw_party):
    """Returns a fragment that resolves to a political_parties.id (or NULL)."""
    if raw_party in NO_PARTY_LABELS:
        return None
    name = PARTY_MAP.get(raw_party, raw_party if raw_party in UNSEEDED_PARTIES else None)
    return name


def do_apply(args):
    db_url = args.db_url
    election_id, plan = build_plan(db_url)
    print_plan(plan)
    if not plan["to_add"] and not plan["link_to_incumbent"]:
        log("Nothing to do.")
        return
    if not args.yes:
        resp = input(f"\nProceed with {len(plan['to_add']) + len(plan['link_to_incumbent'])} writes? [y/N] ")
        if resp.strip().lower() != "y":
            log("Aborted, nothing written.")
            return

    import uuid
    parts = []
    for c in plan["link_to_incumbent"]:
        parts.append(f"""
            INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
            SELECT {sql_str(c['seat_id'])}, {sql_str(c['officeholder_profile'])}, 'approved', now(), {sql_str(ADMIN_PROFILE_ID)}
            WHERE NOT EXISTS (
                SELECT 1 FROM public.election_candidates WHERE seat_id = {sql_str(c['seat_id'])} AND politician_id = {sql_str(c['officeholder_profile'])}
            );
        """)

    for i, c in enumerate(plan["to_add"]):
        party_name = canonical_party_id_sql(c["party"])
        party_ref = "NULL"
        if party_name:
            gset = f"party_id_{i}"
            parts.append(f"""
                INSERT INTO public.political_parties (country, name) VALUES ('Canada', {sql_str(party_name)})
                ON CONFLICT (country, name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id AS {gset} \\gset
            """)
            party_ref = f":{gset}"
        stub_id = str(uuid.uuid4())
        bio = f"Candidate (BCPoliTracker, {c['party']}) for {c['riding']}" if not party_name and c["party"] not in NO_PARTY_LABELS else None
        parts.append(f"""
            INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
            VALUES ({sql_str(stub_id)}, 'politician', {sql_str(c['name'])}, true, 'Canada', gen_random_uuid());

            INSERT INTO public.politician_profiles (id, political_party_id, bio, source_url)
            VALUES ({sql_str(stub_id)}, {party_ref}, {sql_str(bio)}, {sql_str(TRACKER_URL + c.get('path', '').lstrip('/'))});

            INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
            VALUES ({sql_str(c['seat_id'])}, {sql_str(stub_id)}, 'approved', now(), {sql_str(ADMIN_PROFILE_ID)});
        """)

    sql = "BEGIN;\n" + "\n".join(parts) + "\nCOMMIT;\n"
    psql_run(db_url, sql)
    log(f"Done. Added {len(plan['to_add'])} new candidates, linked {len(plan['link_to_incumbent'])} to existing MLA profiles.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("fetch", help="Pull the latest feed from BCPoliTracker, cache it, show what changed")

    p_diff = sub.add_parser("diff", help="Dry run: show exact add/skip/link counts against the live DB. Writes nothing.")

    p_apply = sub.add_parser("apply", help="Write the diffed candidates to the DB. Idempotent, re-runnable.")
    p_apply.add_argument("--yes", action="store_true", help="Skip the interactive confirmation prompt")

    args = ap.parse_args()
    if args.cmd != "fetch" and not args.db_url:
        sys.exit("DATABASE_URL required (env var or --db-url) for this command.")

    {"fetch": do_fetch, "diff": do_diff, "apply": do_apply}[args.cmd](args)


if __name__ == "__main__":
    main()
