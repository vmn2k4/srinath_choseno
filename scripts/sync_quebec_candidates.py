#!/usr/bin/env python3
"""
Quebec provincial candidate sync tool -- pulls from Elections Quebec's API
and dgeq.org's per-riding data files, loads into provincial_election_events
/ provincial_election_candidates (province='QC').

Found by digging through Wayback Machine snapshots from Quebec's Oct 3,
2022 general election, since (like Ontario) nothing here resolves live
outside an active campaign -- confirmed: every endpoint below currently
403s ("Missing Authentication Token" from api.electionsquebec.qc.ca, or a
plain 404 page from dgeq.org).

Two real APIs, found via their own frontend's embedded config
(`const electionsQC = {urlAPI: ..., urlData: ...}` on
electionsquebec.qc.ca/voter/personnes-candidates/):

  GET https://api.electionsquebec.qc.ca/provincial/recherche/circonscriptions
    Lists every riding as {code_circonscription, nom_circonscription,
    date_fin_eve_scrutin}. This is the discovery mechanism -- if it
    resolves (200, real JSON) an election is live; date_fin_eve_scrutin
    gives the election date.
  GET https://www.dgeq.org/{code_circonscription}.json
    Per-riding data -- candidates array (nom, prenom,
    abreviationPartiPolitique) plus live results once counting starts.
    Verified against archived 2018 data (real candidate names/parties).

**Important: riding codes are NOT stable across redistrictings** --
confirmed directly: archived 2022-era circonscriptions listed Bonaventure
as code 850; our current map_shapes (loaded from Quebec's new map that
took effect July 15, 2026 -- see docs/ELECTION_DATA_SOURCES.md) has
Bonaventure at code 837. **Never hardcode a code-based mapping for
Quebec** -- always re-fetch `circonscriptions` at sync time and match by
name (accent-insensitively, same reasoning as Manitoba), never assume a
previously-seen code is still correct.

Requires only the Python standard library plus `psql` on PATH.

Usage:
  python3 scripts/sync_quebec_candidates.py discover
  python3 scripts/sync_quebec_candidates.py sync --event-id <uuid>

Connection: reads DATABASE_URL from the environment by default, or pass
--db-url.
"""

import argparse
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.request
import urllib.error
import json

USER_AGENT = "Mozilla/5.0 (compatible; ChosenoCandidateSync/1.0)"
CIRCONSCRIPTIONS_URL = "https://api.electionsquebec.qc.ca/provincial/recherche/circonscriptions"
DATA_URL = "https://www.dgeq.org/{code}.json"
REQUEST_DELAY_SECONDS = 0.3


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip":
            import gzip
            data = gzip.decompress(data)
        return json.loads(data.decode("utf-8"))


def psql(db_url, sql, tuples_only=False):
    cmd = ["psql", db_url, "-v", "ON_ERROR_STOP=1"]
    if tuples_only:
        cmd += ["-t", "-A"]
    cmd += ["-c", sql]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"psql failed:\n{result.stderr.strip()}")
    return result.stdout


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def sql_str(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def fold_accents(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


def cmd_discover(args):
    db_url = args.db_url
    log(f"Checking {CIRCONSCRIPTIONS_URL}...")
    try:
        data = fetch_json(CIRCONSCRIPTIONS_URL)
    except urllib.error.HTTPError as e:
        log(f"Not available right now (HTTP {e.code}) -- no active provincial election. Re-run this periodically.")
        return

    ridings = data.get("circonscriptions", [])
    if not ridings:
        log("Endpoint resolved but returned no ridings -- unexpected, inspect manually.")
        return

    event_date = ridings[0].get("date_fin_eve_scrutin")
    existing = psql(
        db_url,
        f"SELECT id FROM public.provincial_election_events WHERE province='QC' AND source_url = {sql_str(CIRCONSCRIPTIONS_URL)} AND event_date = {sql_str(event_date)};",
        tuples_only=True,
    ).strip()
    if existing:
        log(f"Already registered -> {existing}")
        return

    name = f"Quebec provincial election ({event_date})" if event_date else "Quebec provincial election"
    event_id = psql(
        db_url,
        f"""
        INSERT INTO public.provincial_election_events (province, name, source_url, event_date)
        VALUES ('QC', {sql_str(name)}, {sql_str(CIRCONSCRIPTIONS_URL)}, {sql_str(event_date)})
        RETURNING id;
        """,
        tuples_only=True,
    ).strip()
    log(f"Registered: {name} ({len(ridings)} ridings) -> id={event_id}. Run `sync --event-id {event_id}` to load candidates.")


def cmd_sync(args):
    db_url = args.db_url
    row = psql(
        db_url,
        f"SELECT id FROM public.provincial_election_events WHERE id = {sql_str(args.event_id)};",
        tuples_only=True,
    ).strip()
    if not row:
        sys.exit(f"No provincial_election_events row with id {args.event_id}. Run `discover` first.")

    log("Re-fetching the current riding code list (codes change across redistrictings, never assume stale ones)...")
    data = fetch_json(CIRCONSCRIPTIONS_URL)
    ridings = data.get("circonscriptions", [])
    log(f"Got {len(ridings)} ridings.")

    shape_rows = psql(
        db_url,
        "SELECT id, name FROM public.map_shapes WHERE country='Canada' AND boundary_type='Provincial' AND properties ? 'nm_cep' AND retired_at IS NULL;",
        tuples_only=True,
    ).strip().splitlines()
    shapes_by_name = {}
    for line in shape_rows:
        shape_id, name = line.split("|", 1)
        shapes_by_name[fold_accents(name.strip()).lower()] = shape_id

    total, unmatched, missing_data = 0, set(), 0
    for riding in ridings:
        code = riding["code_circonscription"]
        riding_name = riding["nom_circonscription"]
        shape_id = shapes_by_name.get(fold_accents(riding_name).lower())
        if not shape_id:
            unmatched.add(riding_name)
            continue

        url = DATA_URL.format(code=code)
        time.sleep(REQUEST_DELAY_SECONDS)
        try:
            riding_data = fetch_json(url)
        except urllib.error.HTTPError:
            missing_data += 1
            continue

        candidates = riding_data.get("candidats", [])
        for c in candidates:
            first = (c.get("prenom") or "").strip().title()
            last = (c.get("nom") or "").strip().title()
            name = f"{first} {last}".strip()
            if not name:
                continue
            party = c.get("abreviationPartiPolitique")
            psql(
                db_url,
                f"""
                INSERT INTO public.provincial_election_candidates
                    (election_event_id, map_shape_id, candidate_name, party_name)
                VALUES ({sql_str(args.event_id)}, {shape_id}, {sql_str(name)}, {sql_str(party)})
                ON CONFLICT (election_event_id, map_shape_id, candidate_name)
                DO UPDATE SET party_name = EXCLUDED.party_name, scraped_at = now();
                """,
            )
            total += 1
        if candidates:
            log(f"  {riding_name} (code {code}): {len(candidates)} candidate(s)")

    log(f"Done. {total} candidate row(s) upserted.")
    if unmatched:
        log(f"WARNING: {len(unmatched)} riding name(s) had no matching map_shapes row: {', '.join(sorted(unmatched))}")
    if missing_data:
        log(f"{missing_data} riding(s) had no dgeq.org data file yet (nominations may not be finalized).")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    sub = p.add_subparsers(dest="command", required=True)

    d = sub.add_parser("discover", help="Check for an active election and register it")
    d.set_defaults(func=cmd_discover)

    s = sub.add_parser("sync", help="Pull every candidate for a registered event")
    s.add_argument("--event-id", required=True, help="provincial_election_events.id from `discover`")
    s.set_defaults(func=cmd_sync)

    args = p.parse_args()
    if not args.db_url:
        sys.exit("No database URL. Pass --db-url or set DATABASE_URL.")
    args.func(args)


if __name__ == "__main__":
    main()
