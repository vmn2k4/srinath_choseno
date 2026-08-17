#!/usr/bin/env python3
"""
Manitoba Municipal Sync — Mayors/Reeves & Councillors

Source of truth for Manitoba: Manitoba Municipal Relations' own official
"Municipal Officials Directory" PDF (gov.mb.ca), updated monthly (last
updated within the past month as of this writing) -- covers all ~137
incorporated Manitoba municipalities with a 3-column-per-row layout: left
= name/address, middle = role labels (Mayor/Reeve/Head of Council, Chief
Administrative Officer, Councillors), right = person names, one label +
one name per PDF row, with the "Councillors" label appearing once and
every subsequent same-row name (regardless of what's in the middle column
on that row -- often "Council Meets..."/"Office Hours..." filler text) is
another councillor until the next municipality's header row.

Not the OpenNorth Represent API, which populate-canadian-municipal.py uses
for the rest of Canada -- Manitoba only had 22 current officeholders out
of 240 map_shapes rows from that source before this (240 also includes
unincorporated areas this directory doesn't cover, so ~137 is the real
ceiling here, not 240).

Matching is scoped to Manitoba via shape_containers throughout -- see
OFFICE_HOLDERS_DATA_GUIDE.md for why an unscoped name match is not safe.

Usage: python3 scripts/sync-mb-election-results.py [--apply]
"""

import argparse
import re
import subprocess
import pdfplumber
from curl_cffi import requests

DB_URI = "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres"

MAYOR_ROLE_ID = "3855aeb9-c840-4d81-bb83-66cad128ea8c"
COUNCILLOR_ROLE_ID = "6d2e3815-05d9-4784-b220-1d73140b5bf3"

PDF_URL = "https://www.gov.mb.ca/mr/contactus/pubs/mod.pdf"
SOURCE_URL = "https://www.gov.mb.ca/mr/municipal-officials-directory.html"

LEFT_X = 267
RIGHT_X = 480
HEAD_LABELS = {"mayor", "reeve", "head"}  # "Head of Council"


def normalize_municipal_name(s):
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r",?\s*(rm|city|town|municipality|village|lgd)\.?\s*$", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return s.strip()


def run_sql(sql, capture=True):
    cmd = ["psql", DB_URI]
    if capture:
        cmd += ["-t", "-A", "-F", "\t"]
    cmd += ["-c", sql]
    res = subprocess.run(cmd, capture_output=capture, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"psql error: {res.stderr}")
    if capture:
        return [l.split("\t") for l in res.stdout.strip().split("\n") if l.strip()]
    return None


def row_text(words):
    return " ".join(w["text"] for w in sorted(words, key=lambda w: w["x0"])).strip()


def parse_pdf(path):
    munis = {}  # name -> {'head': name_or_None, 'councillors': [names]}
    with pdfplumber.open(path) as pdf:
        # Content pages found by locating the "MANITOBA MUNICIPALITIES"
        # section header and stopping at "THE CITY OF WINNIPEG" (which
        # lists Winnipeg's ward councillors in a different format entirely
        # -- out of scope for this pass, handled by hand if needed).
        start, end = None, None
        for i, page in enumerate(pdf.pages):
            txt = page.extract_text() or ""
            if start is None and "MANITOBA MUNICIPALITIES" in txt:
                start = i + 1
            if start is not None and i > start and "THE CITY OF WINNIPEG" in txt:
                end = i
                break
        if start is None:
            raise RuntimeError("Could not find MANITOBA MUNICIPALITIES section")
        end = end or len(pdf.pages)
        print(f"Parsing pages {start}-{end - 1} (0-indexed)...")

        current_muni = None
        current_section = None  # 'head' | 'cao' | 'councillors' | None

        # Municipality header pattern -- e.g. "WOODLANDS, RM",
        # "TACHÉ, RM", "PEMBINA, MUNICIPALITY". This is checked
        # independently of the middle column's role labels, and is the
        # authoritative block-boundary signal: relying on Mayor/Reeve/Head
        # alone to start a new block was the actual bug behind a real
        # incident -- Winnipeg's entry has no listed mayor at all (it
        # refers readers to a different page), and the very next entry,
        # Winnipeg Beach, starts with "Administrator" (no elected head
        # listed either), so with role-label-only boundary detection
        # neither triggered a new block and both entries' text -- CAO/
        # Administrator names belonging to OTHER municipalities entirely --
        # got silently absorbed into Winnipeg's councillor list, which was
        # then written to the database as if real. Header-pattern detection
        # closes every block on sight regardless of what role labels (or
        # lack thereof) follow.
        header_re = re.compile(r"^[A-ZÀ-Ü0-9][A-ZÀ-Ü0-9\s\-\.\']*,\s*(RM|CITY|TOWN|MUNICIPALITY|VILLAGE|L\.?G\.?D\.?)\.?$")

        for pageno in range(start, end):
            page = pdf.pages[pageno]
            words = sorted(page.extract_words(), key=lambda w: w["top"])
            # Cluster by proximity, not round(top) as an exact dict key --
            # sub-pixel rendering differences between words on the same
            # visual line (e.g. two names 0.4-0.6px apart in `top`) landed
            # in different integer bins under naive rounding and silently
            # split first name from last name into two separate "rows"
            # (confirmed: "Delbert Pederson" -> a dropped "Delbert" plus a
            # standalone "Pederson" masquerading as its own person).
            row_groups = []
            for w in words:
                if row_groups and abs(w["top"] - row_groups[-1][0]) <= 2.5:
                    row_groups[-1][1].append(w)
                    row_groups[-1] = (row_groups[-1][0], row_groups[-1][1])
                else:
                    row_groups.append((w["top"], [w]))

            parsed_rows = []
            for _, row in row_groups:
                left = [w for w in row if w["x0"] < LEFT_X]
                mid = [w for w in row if LEFT_X <= w["x0"] < RIGHT_X]
                right = [w for w in row if w["x0"] >= RIGHT_X]
                parsed_rows.append((row[0]["top"], row_text(left), row_text(mid), row_text(right)))

            for i, (top, left_text, mid_text, right_text) in enumerate(parsed_rows):
                mid_first_word = mid_text.split(" ")[0].lower() if mid_text else ""
                is_header = bool(header_re.match(left_text))
                # A long name can wrap onto the row directly below its type
                # ("BOISSEVAIN-MORTON," / "MUNICIPALITY") -- the wrapped
                # continuation row also matches header_re on its own
                # (bare type word after a trailing comma from the row
                # above), so merge it into the same block instead of
                # treating it as a second, separate municipality.
                if is_header and re.match(r"^(RM|CITY|TOWN|MUNICIPALITY|VILLAGE|L\.?G\.?D\.?)\.?$", left_text, re.I) and i > 0:
                    prev_left = parsed_rows[i - 1][1]
                    if prev_left.endswith(","):
                        continue  # already folded into the previous header row below

                if is_header:
                    name = left_text
                    # Fold a wrapped continuation from the next row, if any.
                    if i + 1 < len(parsed_rows):
                        nxt_left = parsed_rows[i + 1][1]
                        if left_text.endswith(",") and re.match(r"^(RM|CITY|TOWN|MUNICIPALITY|VILLAGE|L\.?G\.?D\.?)\.?$", nxt_left, re.I):
                            name = f"{left_text} {nxt_left}"
                    current_muni = re.sub(r",\s*(RM|CITY|TOWN|MUNICIPALITY|VILLAGE|L\.?G\.?D\.?)\.?$", "", name, flags=re.I).strip()
                    head = right_text if mid_first_word in HEAD_LABELS else None
                    munis[current_muni] = {"head": head, "councillors": []}
                    current_section = "head" if head else None
                    continue

                if not current_muni:
                    continue
                if mid_first_word in HEAD_LABELS:
                    munis[current_muni]["head"] = right_text or None
                    current_section = "head"
                elif mid_first_word == "chief":
                    current_section = "cao"
                elif mid_first_word == "councillors":
                    current_section = "councillors"
                    if right_text:
                        munis[current_muni]["councillors"].append(right_text)
                elif current_section == "councillors" and right_text:
                    munis[current_muni]["councillors"].append(right_text)

    return munis


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    print("Fetching Manitoba's Municipal Officials Directory PDF...")
    r = requests.get(PDF_URL, impersonate="chrome")
    pdf_path = "/tmp/mb_directory.pdf"
    with open(pdf_path, "wb") as f:
        f.write(r.content)

    munis = parse_pdf(pdf_path)
    print(f"Parsed {len(munis)} municipalities.")

    print("Loading map_shapes (Municipal, Manitoba only, active)...")
    shapes = run_sql("""
        SELECT ms.id, ms.name FROM map_shapes ms
        JOIN shape_containers sc ON sc.map_shape_id = ms.id
        JOIN map_shapes p ON p.id = sc.container_shape_id AND p.name = 'Manitoba'
        WHERE ms.boundary_type = 'Municipal' AND ms.retired_at IS NULL;
    """)
    norm_to_ids = {}
    for sid, name in shapes:
        norm_to_ids.setdefault(normalize_municipal_name(name), []).append((sid, name))
    shape_by_norm = {}
    dupes = set()
    for norm, sids in norm_to_ids.items():
        if len(sids) == 1:
            shape_by_norm[norm] = sids[0][0]
        else:
            dupes.add(sids[0][1])

    winners_by_shape = {}
    unmatched_munis = []
    for muni, data in munis.items():
        shape_id = shape_by_norm.get(normalize_municipal_name(muni))
        if not shape_id:
            unmatched_munis.append(muni)
            continue
        winners = []
        if data["head"]:
            winners.append((MAYOR_ROLE_ID, data["head"]))
        for c in data["councillors"]:
            winners.append((COUNCILLOR_ROLE_ID, c))
        if winners:
            winners_by_shape[shape_id] = winners

    total_winners = sum(len(v) for v in winners_by_shape.values())
    print(f"Matched {total_winners} officeholders across {len(winners_by_shape)} Manitoba municipalities.")
    if unmatched_munis:
        print(f"{len(unmatched_munis)} municipalities had no matching map_shapes row -- not silently dropped:")
        for m in sorted(unmatched_munis):
            print(f"  {m}")
    if dupes:
        print(f"map_shapes has duplicate names for {len(dupes)} Manitoba municipalities -- excluded entirely rather than guessed at: {sorted(dupes)}")

    sql = ["BEGIN;"]
    sql.append("""
CREATE TEMP TABLE staging_mb_winners (
  map_shape_id bigint,
  election_role_type_id uuid,
  full_name text,
  source_url text
) ON COMMIT DROP;
""")
    value_rows = []
    for shape_id, winners in winners_by_shape.items():
        for role_id, name in winners:
            safe_name = name.replace("'", "''")
            value_rows.append(f"({shape_id}, '{role_id}', '{safe_name}', '{SOURCE_URL}')")
    sql.append("INSERT INTO staging_mb_winners VALUES\n" + ",\n".join(value_rows) + ";")

    sql.append("""
UPDATE office_holders oh
SET is_current = false, term_ended_at = CURRENT_DATE, updated_at = NOW()
WHERE oh.is_current = true
  AND EXISTS (SELECT 1 FROM staging_mb_winners s WHERE s.map_shape_id = oh.map_shape_id)
  AND NOT EXISTS (
    SELECT 1 FROM staging_mb_winners s
    WHERE s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
      AND s.election_role_type_id = oh.election_role_type_id
  );
""")

    sql.append("""
INSERT INTO office_holders (
  map_shape_id, election_role_type_id, full_name, bio, source_url,
  is_current, term_ended_at, updated_at
)
SELECT DISTINCT ON (s.map_shape_id, s.election_role_type_id, s.full_name)
  s.map_shape_id, s.election_role_type_id, s.full_name,
  (SELECT ert.role_title FROM election_role_types ert WHERE ert.id = s.election_role_type_id) || ' for ' ||
  (SELECT ms.name FROM map_shapes ms WHERE ms.id = s.map_shape_id),
  s.source_url, true, NULL, NOW()
FROM staging_mb_winners s
ORDER BY s.map_shape_id, s.election_role_type_id, s.full_name
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
  source_url = EXCLUDED.source_url,
  is_current = true,
  term_ended_at = NULL,
  updated_at = NOW();
""")

    sql.append("""
DO $$
DECLARE
  r RECORD;
  new_profile_id UUID;
  new_ghost_id UUID;
  existing_profile_id UUID;
  computed_slug TEXT;
  created_count INT := 0;
  linked_count INT := 0;
BEGIN
  FOR r IN
    SELECT oh.id as office_holder_id, oh.full_name, oh.bio,
           ms.country, ms.name as boundary_name, ms.boundary_type, ert.role_title
    FROM office_holders oh
    JOIN map_shapes ms ON oh.map_shape_id = ms.id
    JOIN election_role_types ert ON oh.election_role_type_id = ert.id
    JOIN staging_mb_winners s ON s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
    WHERE oh.linked_profile_id IS NULL
  LOOP
    computed_slug := lower(regexp_replace(regexp_replace(r.full_name || '-' || r.role_title, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
    SELECT pp.id INTO existing_profile_id FROM politician_profiles pp WHERE pp.wall_slug = computed_slug LIMIT 1;
    IF existing_profile_id IS NULL THEN
      SELECT p.id INTO existing_profile_id FROM profiles p
      WHERE p.role = 'politician' AND lower(p.full_name) = lower(r.full_name) AND p.constituency = r.boundary_name
      LIMIT 1;
    END IF;
    IF existing_profile_id IS NOT NULL THEN
      UPDATE office_holders SET linked_profile_id = existing_profile_id WHERE id = r.office_holder_id;
      linked_count := linked_count + 1;
    ELSE
      new_profile_id := gen_random_uuid();
      new_ghost_id := gen_random_uuid();
      INSERT INTO profiles (id, role, full_name, country, constituency, designation, current_ghost_id, updated_at)
      VALUES (new_profile_id, 'politician', r.full_name, r.country, r.boundary_name, r.role_title, new_ghost_id, NOW());
      INSERT INTO politician_profiles (id, political_target_role, target_boundary_type, target_boundary_name, bio, wall_slug, created_at, updated_at)
      VALUES (new_profile_id, r.role_title, r.boundary_type, r.boundary_name, r.bio, computed_slug, NOW(), NOW());
      UPDATE office_holders SET linked_profile_id = new_profile_id WHERE id = r.office_holder_id;
      created_count := created_count + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'MB sync: created % new ghost profile walls, linked % to existing profiles.', created_count, linked_count;
END $$;
""")
    sql.append("COMMIT;")
    full_sql = "\n".join(sql)

    out_path = "/Users/vmn2k4/Coding/Choseno/scripts/mb-election-results-sync.sql"
    with open(out_path, "w") as f:
        f.write(full_sql)
    print(f"Wrote generated SQL to {out_path}")

    if args.apply:
        print("Applying to database...")
        subprocess.run(["psql", DB_URI, "-f", out_path], check=True)
        print("Done.")
    else:
        print("Dry run only (no --apply passed) -- review the SQL file, then re-run with --apply.")


if __name__ == "__main__":
    main()
