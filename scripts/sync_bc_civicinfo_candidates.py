#!/usr/bin/env python3
"""BC municipal + school district candidates via CivicInfo BC (localelections.ca).

Found and validated 2026-09-10 (see docs/CANDIDATE_DATA_PULL_LOG.md,
"BC — a much better source found: CivicInfo BC / localelections.ca" section
for the full reliability writeup) — **this is now the recommended primary
source for BC municipal/school-trustee candidates**, ahead of the Elections
BC LECFA PDF (`sync_bc_candidates.py` is a *different* script, for BC's
*provincial* riding elections — don't confuse the two).

Why this source over LECFA:
- LECFA is a financial-agent *registration* list and lags real nomination
  filings, sometimes badly (a same-day comparison found CivicInfo BC
  reporting ~2x LECFA's candidate count for several cities).
- CivicInfo BC states its own methodology: "With assistance from local
  Chief Election Officers, CivicInfo BC assembles all-candidate lists" --
  sourced from the same officials each city's own page draws from, not a
  scrape or a guess. It's run by a BC not-for-profit founded by the Union
  of BC Municipalities, the Ministry of Municipal Affairs, and other core
  municipal-sector bodies -- not a hobbyist aggregator.
- It carries phone, email, address, and social links per candidate (LECFA
  has none of that) -- see "extract_candidates()" below for the extraction.
- Still no candidate photos (checked explicitly) -- Surrey and Burnaby's
  own city pages remain the only two BC sources with real headshots.

Labeled "Unofficial" on its own page -- same standing caveat as every
source in this pipeline (LECFA, individual city pages): nothing is the
*certified* legal record until each city closes nominations and certifies.
Also: occasional typos/omissions were found in cross-checking (a Vancouver
councillor listed as "Erid Redmond", almost certainly "Eric Redmond";
several existing DB candidates absent from a fresh pull that were NOT
treated as confirmed dropouts for exactly this reason) -- never delete a
candidate based on absence from this source alone; treat it as a lead for
manual confirmation, the same way this script's own diff step surfaces it.

USAGE
-----
1. Fetch + parse everything (stdlib + `requests`, no DB connection needed):

     python3 sync_bc_civicinfo_candidates.py fetch --out bc_civicinfo.json

   Writes one JSON file: a list of
     {jurisdiction, id, kind: "Municipal"|"School District", candidates: [
       {office, name, party, prevOffice, email, phone, address, links}
     ]}
   covering all ~146 municipalities + ~53 school districts CivicInfo BC
   tracks (a few dozen smaller municipalities report "Not Reported" and
   are skipped automatically -- they have no page to fetch yet).

2. Diff against the live DB and generate an insert/update SQL file. This
   step needs the project's real DB access pattern for this environment,
   which is **`supabase db query --linked`**, not a direct DATABASE_URL/
   psycopg2 connection (confirmed 2026-09-09/10: direct postgres DNS does
   not resolve in this sandbox; see [[election-seat-candidate-perf-fix]]
   memory / CANDIDATE_DATA_PULL_LOG.md). So step 2 is NOT automated in
   this script -- instead, run the four queries below via
   `supabase db query --linked --file <q>.sql`, save each result's `rows`
   array as its own JSON file, then pass all of them plus this script's
   `fetch` output to `diff` below.

   a) Current BC map_shapes (Municipal + School District, only the ones
      this pipeline already has election_seats for):
        select id, name, boundary_type from map_shapes
        where country='Canada' and boundary_type in ('Municipal','School District')
          and id in (
            select map_shape_id from election_seats es join elections e on e.id=es.election_id
            where e.name in ('2026 BC Councillor Mayor Elections',
                              'BC Municipal Mayor Elections',
                              '2026 School District Trustee Elections')
          );
   b) Current BC candidates:
        select ms.name as jurisdiction, es.role_title as office, p.full_name, es.id as seat_id
        from election_seats es
        join map_shapes ms on ms.id = es.map_shape_id
        join election_candidates ec on ec.seat_id = es.id
        join profiles p on p.id = ec.politician_id
        join elections e on e.id = es.election_id
        where e.name in ('2026 BC Councillor Mayor Elections',
                          'BC Municipal Mayor Elections',
                          '2026 School District Trustee Elections');
   c) election_seats (seat_id, map_shape_id, role_title) for the same 3
      elections (same WHERE clause as (b), just the bare seat rows).
   d) office_holders for every id from (a): map_shape_id, full_name,
      linked_profile_id, is_current, filtered to is_current = true.
   e) political_parties where country='Canada' (id, name).

     python3 sync_bc_civicinfo_candidates.py diff \\
       --candidates bc_civicinfo.json --shapes shapes.json --db-state db.json \\
       --seats seats.json --officeholders oh.json --parties parties.json \\
       --out-sql bc_civicinfo_sync.sql --out-missing missing.json --out-dropouts dropouts.json

   This reproduces the exact pipeline used 2026-09-10 (order-independent /
   middle-initial-stripped name matching to avoid false adds/removes from
   pure formatting differences; map_shape_id-scoped officeholder dedup;
   party-name consolidation onto existing LECFA-sourced rows rather than
   creating near-duplicates; bio built from social links; a hard-coded
   junk-party filter for the handful of small-village table layouts that
   put the municipality's own name in the party field). Review
   `missing.json` and `dropouts.json` by hand before running the generated
   SQL -- dropouts are a lead for manual confirmation, never an
   auto-delete.

Rate limiting: fetches all pages concurrently (thread pool, capped
concurrency) against a static file server with no observed bot protection
-- still capped at MAX_WORKERS below to stay polite to a small nonprofit's
infrastructure.
"""
import argparse
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser

import requests

BASE = "https://localelections.ca"
MAX_WORKERS = 8
YEAR = 2026


def fetch(url, retries=3):
    for attempt in range(retries):
        try:
            r = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code == 200:
                return r.text
            return None
        except requests.RequestException:
            time.sleep(1 + attempt)
    return None


def get_index(kind):
    """kind: 'm' for municipalities, 'sd' for school districts."""
    path = "/candidates/" if kind == "m" else "/candidates/index_sd.html"
    html = fetch(BASE + path)
    if not html:
        return []
    return [
        {"id": int(m.group(1)), "name": m.group(2).strip()}
        for m in re.finditer(r"<option value=(\d+)>([^<]+)</option>", html)
    ]


def decode_cf_email(encoded):
    r = int(encoded[0:2], 16)
    return "".join(
        chr(int(encoded[i : i + 2], 16) ^ r) for i in range(2, len(encoded), 2)
    )


class CandidateTableParser(HTMLParser):
    """Walks the single big candidates <table>, tracking real nesting depth
    so the "extra info" row's own inner mini-table (Address/Contact/Online)
    is never mistaken for another top-level candidate row -- the exact bug
    hit and fixed during the interactive session this script reproduces."""

    def __init__(self):
        super().__init__()
        self.table_depth = 0
        self.in_target_table = False
        self.target_table_depth = None
        self.tr_stack = []  # each entry: {"cells": [...], "is_extra": bool, "th_only": bool}
        self.cur_cell = None
        self.cur_cell_tag = None
        self.cur_cell_attrs = {}
        self.cur_cell_text = []
        self.cur_cell_links = []
        self.cur_cell_cfemails = []
        self.office = None
        self.pending = None
        self.results = []
        self._table_class_seen = False

    def handle_starttag(self, tag, attrs):
        attrs_d = dict(attrs)
        if tag == "table":
            self.table_depth += 1
            if not self.in_target_table and "table" in (attrs_d.get("class") or ""):
                self.in_target_table = True
                self.target_table_depth = self.table_depth
        if not self.in_target_table:
            return
        if tag == "tr" and self.table_depth == self.target_table_depth:
            classes = attrs_d.get("class") or ""
            self.tr_stack.append({"cells": [], "is_extra": "extraInfo" in classes})
        elif tag in ("td", "th") and self.table_depth == self.target_table_depth and self.tr_stack:
            self.cur_cell_tag = tag
            self.cur_cell_attrs = attrs_d
            self.cur_cell_text = []
            self.cur_cell_links = []
            self.cur_cell_cfemails = []
        elif tag == "a" and self.cur_cell_tag is not None:
            href = attrs_d.get("href")
            if href and "cdn-cgi" not in href:
                self.cur_cell_links.append(href)
        elif tag == "span" and attrs_d.get("data-cfemail") and self.cur_cell_tag is not None:
            self.cur_cell_cfemails.append(attrs_d["data-cfemail"])
        elif tag == "i" and self.cur_cell_tag is not None:
            cls = attrs_d.get("class") or ""
            if "fa-phone" in cls:
                self.cur_cell_text.append("\x00PHONE_ICON\x00")

    def handle_endtag(self, tag):
        if tag == "table":
            if self.in_target_table and self.table_depth == self.target_table_depth:
                self.in_target_table = False
                self.target_table_depth = None
            self.table_depth = max(0, self.table_depth - 1)
            return
        if not self.in_target_table:
            return
        if (tag in ("td", "th") and self.table_depth == self.target_table_depth
                and self.cur_cell_tag is not None and self.tr_stack):
            text = "".join(self.cur_cell_text)
            self.tr_stack[-1]["cells"].append({
                "tag": self.cur_cell_tag, "text": text,
                "attrs": self.cur_cell_attrs, "links": self.cur_cell_links,
                "cfemails": self.cur_cell_cfemails,
            })
            self.cur_cell_tag = None
        elif tag == "tr" and self.tr_stack and self.table_depth == self.target_table_depth:
            row = self.tr_stack.pop()
            self._process_row(row)

    def handle_data(self, data):
        if self.cur_cell_tag is not None:
            self.cur_cell_text.append(data)

    def _process_row(self, row):
        cells = row["cells"]
        ths = [c for c in cells if c["tag"] == "th"]
        tds = [c for c in cells if c["tag"] == "td"]
        if row["is_extra"]:
            if self.pending is None:
                return
            info_cell = next((c for c in tds if "colspan" in c["attrs"]), None)
            if not info_cell:
                return
            full_text = info_cell["text"]
            if info_cell["cfemails"]:
                self.pending["email"] = decode_cf_email(info_cell["cfemails"][0])
            m = re.search(r"Contact Info:[\s\S]*?\x00PHONE_ICON\x00\s*:?\s*([\d][\d\-\s()+.]{6,20})", full_text)
            self.pending["phone"] = m.group(1).strip() if m else None
            m = re.search(r"Address:([\s\S]*?)(?:Contact Info:|Online Info:|$)", full_text)
            self.pending["address"] = re.sub(r"\s+", " ", m.group(1)).strip() if m else None
            links = [l for c in tds for l in c["links"]]
            self.pending["links"] = links
            return
        if len(ths) == 1 and "colspan" in ths[0]["attrs"] and not tds:
            self.office = ths[0]["text"].strip()
            return
        if ths:
            return  # the repeated column-header row (Name / Electoral Organization / ...)
        if len(tds) >= 3 and self.office:
            name = re.sub(r"\s+", " ", tds[1]["text"]).strip()
            party = tds[2]["text"].strip()
            prev = tds[3]["text"].strip() if len(tds) > 3 else ""
            if not name:
                return
            self.pending = {
                "office": self.office, "name": name,
                "party": None if party in ("", "None") else party,
                "prevOffice": None if prev in ("", "None") else prev,
                "email": None, "phone": None, "address": None, "links": [],
            }
            self.results.append(self.pending)


def parse_candidates_page(html):
    p = CandidateTableParser()
    p.feed(html)
    return p.results


def cmd_fetch(args):
    muni = get_index("m")
    sd = get_index("sd")
    print(f"{len(muni)} municipalities, {len(sd)} school districts", file=sys.stderr)

    def one(entry, kind):
        url = f"{BASE}/election_candidates/{entry['id']}_{YEAR}_candidates.html"
        html = fetch(url)
        if not html:
            return {"jurisdiction": entry["name"], "id": entry["id"], "kind": kind, "error": "fetch_failed", "candidates": []}
        try:
            candidates = parse_candidates_page(html)
        except Exception as e:  # never let one bad page kill the whole run
            return {"jurisdiction": entry["name"], "id": entry["id"], "kind": kind, "error": str(e), "candidates": []}
        return {"jurisdiction": entry["name"], "id": entry["id"], "kind": kind, "candidates": candidates}

    jobs = [(e, "Municipal") for e in muni] + [(e, "School District") for e in sd]
    out = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(one, e, k): e for e, k in jobs}
        for i, fut in enumerate(as_completed(futures), 1):
            out.append(fut.result())
            if i % 25 == 0:
                print(f"  fetched {i}/{len(jobs)}", file=sys.stderr)

    total_candidates = sum(len(r["candidates"]) for r in out)
    errors = [r for r in out if r.get("error")]
    print(f"Done: {len(out)} pages, {total_candidates} candidates, {len(errors)} errors", file=sys.stderr)
    for r in errors:
        print(f"  ERROR {r['jurisdiction']} ({r['id']}): {r['error']}", file=sys.stderr)

    with open(args.out, "w") as f:
        json.dump(out, f, indent=1)
    print(f"Written to {args.out}")


# ---------------------------------------------------------------------------
# diff: reproduces the 2026-09-10 matching + insert-SQL-generation pipeline.
# Needs the DB-state JSON files described in the module docstring, step 2.
# ---------------------------------------------------------------------------

MUNI_OVERRIDES = {
    "Sun Peaks (Mountain Resort Municipality)": "Sun Peaks Mountain",
    "100 Mile House (District)": "One Hundred Mile House",
}
PARTY_JUNK = {"served different", "city of greenwood", "village of montrose"}
PARTY_OVERRIDES = {
    "a better city vancouver electors association": "ABC Vancouver",
    "affordable housing coalition of vancouver": "Affordable Housing",
    "coalition of progressive electors": "COPE",
    "new burnaby party": "NEW Burnaby",
    "new surrey+ party": "New Surrey+",
    "real nanaimo": "REAL",
    "restore burnaby alliance": "Restore Burnaby",
    "safe surrey coalition society": "Safe Surrey Coalition",
    "surrey connect public interest association": "Surrey Connect Public IA",
    "vancouver liberal electors association": "Vancouver Liberals",
}
OFFICE_MAP_MUNI = {"MAYOR": "Mayor", "COUNCILLOR": "Councillor"}
OFFICE_MAP_SD = {"TRUSTEE": "School Trustee"}
ADMIN_ID_DEFAULT = "5b66563e-2674-4fed-b733-3e19955a166a"


def norm_tokens(name):
    name = re.sub(r"\s*\([^)]*\)\s*$", "", name)
    tokens = re.findall(r"[a-zA-Z']+", name.lower())
    return frozenset(t for t in tokens if len(t) > 1)


def clean_name(raw):
    n = re.sub(r"\s*\([^)]*\)\s*$", "", raw).strip()
    return re.sub(r"\s+", " ", n)


def resolve_muni(name, muni_names):
    if name in muni_names:
        return name
    if name in MUNI_OVERRIDES and MUNI_OVERRIDES[name] in muni_names:
        return MUNI_OVERRIDES[name]
    base = re.sub(r"\s*\([^)]*\)\s*$", "", name).strip()
    return base if base in muni_names else None


def resolve_sd(name, sd_shapes):
    m = re.search(r"\(SD\s*(\d+)\)", name)
    if not m:
        return None
    num = m.group(1)
    for full_name in sd_shapes:
        if full_name.startswith(f"SD{num} -"):
            return full_name
    return None


def build_bio(links):
    if not links:
        return None
    parts = []
    for l in links:
        low = l.lower()
        label = ("Facebook" if "facebook.com" in low else
                 "Instagram" if "instagram.com" in low else
                 "X" if "x.com" in low or "twitter.com" in low else "Website")
        parts.append(f"{label}: {l}")
    return "Links: " + " | ".join(parts)


def qstr(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"


def cmd_diff(args):
    records = json.load(open(args.candidates))
    shapes = json.load(open(args.shapes))["rows"]
    db_rows = json.load(open(args.db_state))["rows"]
    seats = json.load(open(args.seats))["rows"]
    oh = json.load(open(args.officeholders))["rows"]
    parties = json.load(open(args.parties))["rows"]

    muni_names = {r["name"] for r in shapes if r["boundary_type"] == "Municipal"}
    sd_shapes = {r["name"] for r in shapes if r["boundary_type"] == "School District"}
    name_to_id = {r["name"]: r["id"] for r in shapes}
    seat_lookup = {(r["map_shape_id"], r["role_title"]): r["seat_id"] for r in seats}

    db_index, db_index_norm = {}, {}
    for r in db_rows:
        key = (r["jurisdiction"], r["office"])
        db_index.setdefault(key, set()).add(r["full_name"].strip().lower())
        db_index_norm.setdefault(key, {})[norm_tokens(r["full_name"])] = r["full_name"]

    oh_index = {}
    for r in oh:
        if r["linked_profile_id"]:
            oh_index.setdefault(r["map_shape_id"], {})[norm_tokens(r["full_name"])] = r["linked_profile_id"]

    party_by_lower = {}
    for p in sorted(parties, key=lambda p: p["id"]):
        party_by_lower.setdefault(p["name"].strip().lower(), p["id"])

    def resolve_party_id(raw):
        if not raw:
            return None
        raw = re.sub(r"^BCA\s*-\s*", "", raw.strip(), flags=re.I)
        if raw.lower() in PARTY_JUNK:
            return None
        lookup = PARTY_OVERRIDES.get(raw.lower(), raw)
        return party_by_lower.get(lookup.lower())

    missing, dropout_candidates, unresolved = [], [], set()
    le_seen_norm = {}

    for row in records:
        resolve_fn = (lambda n: resolve_muni(n, muni_names)) if row["kind"] == "Municipal" else (lambda n: resolve_sd(n, sd_shapes))
        office_map = OFFICE_MAP_MUNI if row["kind"] == "Municipal" else OFFICE_MAP_SD
        resolved = resolve_fn(row["jurisdiction"])
        if not resolved:
            unresolved.add(row["jurisdiction"])
            continue
        map_shape_id = name_to_id[resolved]
        for c in row["candidates"]:
            office = office_map.get(c["office"])
            if not office:
                continue
            name = clean_name(c["name"])
            key = (resolved, office)
            le_seen_norm.setdefault((map_shape_id, office), set()).add(norm_tokens(name))
            if name.lower() in db_index.get(key, set()):
                continue
            if norm_tokens(name) in db_index_norm.get(key, {}):
                continue  # same person, formatting differs only
            pid = oh_index.get(map_shape_id, {}).get(norm_tokens(name))
            entry = {
                "resolved_jurisdiction": resolved, "resolved_office": office, "name": name,
                "party": c.get("party"), "email": c.get("email"), "phone": c.get("phone"),
                "links": c.get("links") or [], "map_shape_id": map_shape_id,
                "seat_id": seat_lookup.get((map_shape_id, office)),
                "source_url": f"{BASE}/election_candidates/{row['id']}_{YEAR}_candidates.html",
            }
            if pid:
                entry["linked_profile_id"] = pid
            missing.append(entry)

    for (map_shape_id, office), seen in le_seen_norm.items():
        resolved_name = next((n for n, i in name_to_id.items() if i == map_shape_id), None)
        if not resolved_name:
            continue
        for nt, full_name in db_index_norm.get((resolved_name, office), {}).items():
            if nt not in seen:
                dropout_candidates.append({"jurisdiction": resolved_name, "office": office, "name": full_name})

    linked = [r for r in missing if "linked_profile_id" in r]
    stub = [r for r in missing if "linked_profile_id" not in r]
    new_parties = sorted({
        re.sub(r"^BCA\s*-\s*", "", r["party"].strip(), flags=re.I)
        for r in stub if r.get("party") and r["party"].strip().lower() not in PARTY_JUNK
        and re.sub(r"^BCA\s*-\s*", "", r["party"].strip(), flags=re.I).lower() not in party_by_lower
        and re.sub(r"^BCA\s*-\s*", "", r["party"].strip(), flags=re.I).lower() not in PARTY_OVERRIDES
    })

    print(f"Unresolved jurisdictions: {len(unresolved)}")
    for u in sorted(unresolved):
        print("  -", u)
    print(f"Linked (officeholder dedup): {len(linked)}")
    print(f"Fresh stubs: {len(stub)}")
    print(f"New parties needed (review before running SQL): {len(new_parties)}")
    for p in new_parties:
        print("  -", p)
    print(f"Possible dropouts (in DB, absent from this pull -- REVIEW, DO NOT AUTO-DELETE): {len(dropout_candidates)}")

    json.dump(stub, open(args.out_missing, "w"), indent=1)
    json.dump(dropout_candidates, open(args.out_dropouts, "w"), indent=1)

    if new_parties:
        print("\nAdd these to political_parties before generating final SQL, e.g.:")
        vals = ",\n".join(f"('Canada', {qstr(p)})" for p in new_parties)
        print(f"INSERT INTO public.political_parties (country, name) VALUES\n{vals}\nON CONFLICT DO NOTHING;")
        print("Then re-fetch parties.json and re-run diff before generating the insert SQL below.\n")

    sql = ["BEGIN;"]
    sql.append("CREATE TEMP TABLE new_stub (seat_id uuid, name text, party_id bigint, role_title text, "
               "bio text, contact_email text, contact_phone text, source_url text, "
               "stub_id uuid, wall_slug text) ON COMMIT DROP;")
    vals = []
    for r in stub:
        if not r.get("seat_id"):
            continue
        pid = resolve_party_id(r.get("party"))
        bio = build_bio(r.get("links"))
        vals.append(
            f"({qstr(r['seat_id'])},{qstr(r['name'])},{pid if pid else 'NULL'},{qstr(r['resolved_office'])},"
            f"{qstr(bio)},{qstr(r.get('email'))},{qstr(r.get('phone'))},{qstr(r['source_url'])},gen_random_uuid())"
        )
    if vals:
        sql.append("INSERT INTO new_stub (seat_id, name, party_id, role_title, bio, contact_email, contact_phone, source_url, stub_id) VALUES\n"
                   + ",\n".join(vals) + ";")
        sql.append("""
UPDATE new_stub ns SET wall_slug = base.slug FROM (
  SELECT ns2.stub_id,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.politician_profiles pp WHERE pp.wall_slug = regexp_replace(regexp_replace(lower(ns2.name || '-' || ns2.role_title), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
    ) THEN regexp_replace(regexp_replace(lower(ns2.name || '-' || ns2.role_title), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(ns2.stub_id::text, '-', ''), 6)
    ELSE regexp_replace(regexp_replace(lower(ns2.name || '-' || ns2.role_title), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
    END AS slug
  FROM new_stub ns2
) base WHERE base.stub_id = ns.stub_id;
""")
        sql.append("INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) "
                   "SELECT stub_id, 'politician', name, true, 'Canada', gen_random_uuid() FROM new_stub;")
        sql.append("INSERT INTO public.politician_profiles (id, political_party_id, wall_slug, bio, contact_email, contact_phone, source_url) "
                   "SELECT stub_id, party_id, wall_slug, bio, contact_email, contact_phone, source_url FROM new_stub;")
        sql.append(f"INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) "
                   f"SELECT seat_id, stub_id, 'approved', now(), {qstr(args.admin_id)} FROM new_stub;")
    if linked:
        link_values = ",\n".join(f"({qstr(r['seat_id'])},{qstr(r['linked_profile_id'])},'approved',now(),{qstr(args.admin_id)})"
                                  for r in linked if r.get("seat_id"))
        if link_values:
            sql.append("INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)\n"
                       f"VALUES {link_values};")
    sql.append("COMMIT;")

    with open(args.out_sql, "w") as f:
        f.write("\n".join(sql) + "\n")
    print(f"\nSQL written to {args.out_sql} -- review missing.json/dropouts.json first, "
          f"and make sure any new parties above are already inserted before running it.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_fetch = sub.add_parser("fetch", help="Fetch + parse every municipality/school-district page")
    p_fetch.add_argument("--out", default="bc_civicinfo_candidates.json")
    p_fetch.set_defaults(func=cmd_fetch)

    p_diff = sub.add_parser("diff", help="Diff parsed candidates against DB-state JSON dumps, emit insert SQL")
    p_diff.add_argument("--candidates", required=True)
    p_diff.add_argument("--shapes", required=True)
    p_diff.add_argument("--db-state", required=True)
    p_diff.add_argument("--seats", required=True)
    p_diff.add_argument("--officeholders", required=True)
    p_diff.add_argument("--parties", required=True)
    p_diff.add_argument("--out-sql", default="bc_civicinfo_sync.sql")
    p_diff.add_argument("--out-missing", default="bc_civicinfo_missing.json")
    p_diff.add_argument("--out-dropouts", default="bc_civicinfo_dropouts.json")
    p_diff.add_argument("--admin-id", default=ADMIN_ID_DEFAULT)
    p_diff.set_defaults(func=cmd_diff)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
