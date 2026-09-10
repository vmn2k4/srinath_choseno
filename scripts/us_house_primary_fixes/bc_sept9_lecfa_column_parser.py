#!/usr/bin/env python3
"""BC LECFA full-sweep pass, 2026-09-09 (second same-day pass, after the
earlier bc_sept9_lecfa_recheck.py). LECFA had grown 25 -> 35 pages in a few
hours (nomination close is Sept 11) -- big enough growth that the usual
manual page-by-page Read-and-diff was going to be slow and error-prone, so
this pass replaces that with a real column-position PDF parser instead of
pdfplumber's plain extract_text().

**Why a plain text/word-count approach (like bc_sept9_lecfa_recheck.py used)
wasn't enough this time**: LECFA's PDF has no table lines, but it DOES have
consistent x0 column boundaries per field (confirmed via extract_words()):
  jurisdiction < 132.5, office < 222.5, candidate name < 362.5,
  affiliation < 466, financial agent name/address >= 466 (ignored).
Any of jurisdiction/office/affiliation/name can wrap onto a second physical
line when long -- e.g. "Abbotsford School" + next line "District" (jurisdiction
wrap), "Board of Education" + "Trustee" (office wrap), "Surrey Connect Public"
+ "IA" (affiliation wrap), or "Mary Blanca Villa y" + "Battenberg" (surname
wrap). **The key rule that makes parsing reliable: a genuine new candidate
row always has BOTH office and candidate-name text on it -- a continuation
line never has both.** (An earlier version of this parser used "name present"
alone as the new-row signal, which silently split wrapped surnames into a
bogus second candidate under the same jurisdiction -- e.g. "Battenberg" almost
became its own fake stub for a nonexistent "Burnaby Councillor Battenberg".
Fixed before anything was inserted -- verified against a name we already knew
was correct, Burnaby's own "Michael Angelo A_BC Robin Hood" Mayor entry,
which really is the LECFA-filed name, not a parsing artifact -- checked at
the raw PDF character level, letter by letter, before trusting it.)

**Pipeline**: parse full PDF -> resolve each row's jurisdiction to a real
map_shapes name (exact match, a small override table for "X, City of" /
"X, Township of" style names, or "<Name> School District" -> "SDxx - <Name>"
substring matching) -> diff against the live DB's (jurisdiction, office,
name) set, case-insensitive -> for anything missing, check office_holders
(scoped to the exact map_shape_id, never name-only) for a re-filing incumbent
to link instead of stub -> insert.

Known, standing gap, unchanged by this pass: Regional District Electoral
Area Director races, the Conseil Scolaire Francophone school district, and
Okanagan Falls' "District of" jurisdiction all still have no matching
map_shapes row at all -- same 3 categories flagged in every earlier BC pass.

**Result**: 148 new candidates (71 officeholder-links + 77 fresh stubs)
across ~85 municipalities/school districts, 1 new party (Pivot Kamloops,
a Kamloops council/mayor slate). Verified after: 0 orphaned
politician_profiles rows for this batch, and the full-roster duplicate-
profile audit query (see CANDIDATE_DATA_PULL_LOG.md) found 8 dup pairs --
all pre-existing from the same day's earlier Ontario multi-ward-city pass
(Toronto/Ottawa/Mississauga/Brampton mayors), none introduced by this BC
pass. BC total after this pass: 631 (was 483).

No photo/bio/contact enrichment was possible for any of these 148 --
confirmed none of them are Surrey or Burnaby (the only two BC cities found
so far whose own site publishes an individual-profile accordion with
headshots; every other city's page is a plain name list, and this batch's
jurisdictions were checked against that "photos exist?" table in
CANDIDATE_DATA_PULL_LOG.md before concluding there's nothing to fetch).

This is still a one-off, hand-run pass, not the standing
`scripts/sync_bc_municipal_candidates.py` the doc has been flagging as the
right next investment -- but the column-position parsing approach in this
file is the reusable part: point PDF_PATH at a freshly-curled copy of the
LECFA PDF and re-run to get a clean `missing.json` for the next pass, rather
than re-deriving the column boundaries from scratch.

Usage:
  curl -sL -o lecfa_latest.pdf https://elections.bc.ca/docs/lecfa/Registered-Candidates-LEGE-2026-10-17.pdf
  python3 bc_sept9_lecfa_column_parser.py --pdf lecfa_latest.pdf --db-json db_bc.json --shapes-json map_shapes_bc.json --office-holders-json officeholders.json
  # db_bc.json / map_shapes_bc.json / officeholders.json are `supabase db query --linked` dumps --
  # see the SQL in CANDIDATE_DATA_PULL_LOG.md's "How to check for new BC nominations" section.
"""
import argparse
import json
import re
from collections import Counter

JUR_MAX = 132.5
OFFICE_MAX = 222.5
NAME_MAX = 362.5
AFFIL_MAX = 466

OVERRIDES = {
    "Langley, Township of": "Langley (Township)",
    "Langley, City of": "Langley (City)",
    "North Vancouver, City of": "North Vancouver (City)",
    "North Vancouver, District of": "North Vancouver (District)",
    "Esquimalt": "Esquimalt (Township)",
    "100 Mile House": "One Hundred Mile House",
    "Alert Bay": "Alert Bay (Village)",
}

UNRESOLVABLE_EXACT = {
    "Islands Trust", "Cultus Lake Park Board",
    "Conseil Scolaire Francophone School District",
    "Okanagan Falls, District of",
}

OFFICE_MAP = {
    "Councillor": "Councillor",
    "Mayor": "Mayor",
    "Board of Education Trustee": "School Trustee",
    "Electoral Area Director": None,   # Regional Districts: no map_shapes boundary type exists
    "Regional District Director": None,
}


def col_text(words):
    return " ".join(w["text"] for w in sorted(words, key=lambda w: w["x0"]))


def bucket(words):
    jur, office, name, affil = [], [], [], []
    for w in words:
        x = w["x0"]
        if x < JUR_MAX:
            jur.append(w)
        elif x < OFFICE_MAX:
            office.append(w)
        elif x < NAME_MAX:
            name.append(w)
        elif x < AFFIL_MAX:
            affil.append(w)
    return col_text(jur), col_text(office), col_text(name), col_text(affil)


def parse_pdf(pdf_path):
    import pdfplumber
    records = []
    with pdfplumber.open(pdf_path) as pdf:
        for pi, page in enumerate(pdf.pages):
            words = page.extract_words()
            words.sort(key=lambda w: (w["top"], w["x0"]))
            lines, cur, cur_top = [], [], None
            for w in words:
                if cur_top is None or abs(w["top"] - cur_top) <= 3:
                    cur.append(w)
                    cur_top = w["top"] if cur_top is None else cur_top
                else:
                    lines.append(cur)
                    cur, cur_top = [w], w["top"]
            if cur:
                lines.append(cur)

            pending = None
            for line in lines:
                jur, office, name, affil = bucket(line)
                is_header = office.strip() == "OFFICE" or name.strip() in ("CANDIDATE NAME", "NAME")
                # A genuine new row always repeats BOTH office and name; a
                # continuation line has at most one of the two.
                if office.strip() and name.strip() and not is_header:
                    pending = {"jurisdiction": jur.strip(), "office": office.strip(),
                               "name": name.strip(), "affiliation": affil.strip(), "page": pi}
                    records.append(pending)
                elif pending is not None:
                    if jur.strip() and jur.strip() != "JURISDICTION":
                        pending["jurisdiction"] = (pending["jurisdiction"] + " " + jur.strip()).strip()
                    if office.strip() and office.strip() != "OFFICE":
                        pending["office"] = (pending["office"] + " " + office.strip()).strip()
                    if name.strip() and name.strip() not in ("CANDIDATE NAME", "NAME"):
                        pending["name"] = (pending["name"] + " " + name.strip()).strip()
                    if affil.strip() and affil.strip() != "AFFILIATION":
                        pending["affiliation"] = (pending["affiliation"] + " " + affil.strip()).strip()

    last_jur = None
    for r in records:
        if r["jurisdiction"]:
            last_jur = r["jurisdiction"]
        else:
            r["jurisdiction"] = last_jur

    return [r for r in records if r["name"] and r["name"] != "CANDIDATE NAME"
            and not re.search(r"Freedom of Information|Privacy Officer|Elections BC|toll-free|Act\.", r["name"])]


def norm_sd_key(s):
    s = re.sub(r"[\s/\-]+", " ", s.lower())
    return re.sub(r"[^a-z0-9 ]", "", s).strip()


def build_sd_index(sd_shapes):
    index = {}
    for r in sd_shapes:
        label = r["name"].split(" - ", 1)[1] if " - " in r["name"] else r["name"]
        index[norm_sd_key(label)] = r["name"]
        index[norm_sd_key(re.sub(r"\(.*?\)", "", label))] = r["name"]
    return index


def resolve_jurisdiction(j, muni_names, sd_index):
    if j in muni_names:
        return ("Municipal", j)
    if j in OVERRIDES and OVERRIDES[j] in muni_names:
        return ("Municipal", OVERRIDES[j])
    if "Regional District" in j or j in UNRESOLVABLE_EXACT or j.endswith(", District of"):
        return ("UNRESOLVABLE", j)
    if j.endswith("School District"):
        key = norm_sd_key(j[: -len("School District")])
        if key in sd_index:
            return ("School District", sd_index[key])
    return ("UNRESOLVABLE", j)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", default="lecfa_latest.pdf")
    ap.add_argument("--db-json", required=True, help="supabase db query dump of current BC candidates (jurisdiction, office, full_name)")
    ap.add_argument("--shapes-json", required=True, help="supabase db query dump of BC Municipal + School District map_shapes (id, name, boundary_type)")
    ap.add_argument("--office-holders-json", required=True, help="supabase db query dump of office_holders for the shapes above (map_shape_id, full_name, linked_profile_id, is_current)")
    ap.add_argument("--out", default="missing.json")
    args = ap.parse_args()

    pdf_rows = parse_pdf(args.pdf)
    db_rows = json.load(open(args.db_json))["rows"]
    shapes = json.load(open(args.shapes_json))["rows"]
    oh_rows = json.load(open(args.office_holders_json))["rows"]

    muni_names = {r["name"] for r in shapes if r["boundary_type"] == "Municipal"}
    sd_shapes = [r for r in shapes if r["boundary_type"] == "School District"]
    sd_index = build_sd_index(sd_shapes)
    name_to_id = {r["name"]: r["id"] for r in shapes}

    db_index = {}
    for r in db_rows:
        db_index.setdefault((r["jurisdiction"], r["office"]), set()).add(r["full_name"].strip().lower())

    oh_index = {}
    for r in oh_rows:
        if r["linked_profile_id"]:
            oh_index.setdefault(r["map_shape_id"], {})[r["full_name"].strip().lower()] = r["linked_profile_id"]

    missing, unresolved = [], set()
    for row in pdf_rows:
        kind, resolved = resolve_jurisdiction(row["jurisdiction"], muni_names, sd_index)
        office = OFFICE_MAP.get(row["office"])
        if kind == "UNRESOLVABLE" or office is None:
            unresolved.add(row["jurisdiction"])
            continue
        key = (resolved, office)
        if row["name"].strip().lower() not in db_index.get(key, set()):
            r = dict(row, resolved_jurisdiction=resolved, resolved_office=office,
                     map_shape_id=name_to_id[resolved])
            nm = row["name"].strip().lower()
            pid = oh_index.get(r["map_shape_id"], {}).get(nm)
            if pid:
                r["linked_profile_id"] = pid
            missing.append(r)

    print(f"Total PDF rows: {len(pdf_rows)}")
    print(f"Unresolvable jurisdictions (expected: regional districts, CSF, Okanagan Falls): {len(unresolved)}")
    print(f"Missing (in PDF, not in DB): {len(missing)}  "
          f"({sum(1 for r in missing if 'linked_profile_id' in r)} officeholder-links, "
          f"{sum(1 for r in missing if 'linked_profile_id' not in r)} fresh stubs)")
    json.dump(missing, open(args.out, "w"), indent=1)


if __name__ == "__main__":
    main()
