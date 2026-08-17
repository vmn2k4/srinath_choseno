# Office Holders Data & Pipeline Documentation

This document explains where Choseno's active office holder data comes from, how the database pipeline works, and how to update or refresh representative data in the future.

---

## 1. Overview & Data Scope

Choseno maintains **11,208 currently-serving elected officials** (`is_current = true`) across Canada and the United States, fully mapped to PostGIS electoral boundary shapes (`map_shapes`) and linked to dedicated **Politician Wall Profiles** (`/wall/[ghostId]/[slug]`). Anyone who has left office is retired, not deleted — see the term-lifecycle note in section 3. Counts below refreshed 2026-08-17 after the BC re-sync described in section 2.

### Breakdown by Geography & Tier

| Country | Jurisdiction / Chamber | Role Title | Active Holders |
| :--- | :--- | :--- | :---: |
| **Canada** | **Federal** (House of Commons) | Member of Parliament (MP) | **342** |
| **Canada** | **Provincial** (BC, AB, SK, MB, ON, QC, NB, NS, PEI, NL, YK, NWT) | MLA / MPP / MHA | **591** |
| **Canada** | **Municipal** (Cities / Towns / Municipalities) | Mayor / Maire | **372** |
| **Canada** | **Municipal** (City & Regional Councils across Canada) | Councillor / Conseiller | **2,379** |
| **Canada** | **School District** (BC — 60 districts) | School Trustee | **352** |
| **Canada** | **School District** (BC — 60 districts) | Board Chair | **52** |
| **USA** | **Federal** (House of Representatives) | U.S. Representative | **431** |
| **USA** | **State Executive** | Governor | **50** |
| **USA** | **State Federal** | U.S. Senator | **50** |
| **USA** | **State Senate** (Upper Chamber) | State Senator | **1,814** |
| **USA** | **State House** (Lower Chamber) | State Representative | **4,169** |
| **USA** | **Municipal** (571 Cities / Towns / Municipalities) | Mayor | **598** |
| **USA** | **Municipal** (City Councils & Boards of Aldermen) | Council Member | **8** |
| **TOTAL** | | | **11,208** |

---

## 2. Data Sources & Repositories

### Canadian Federal & Provincial Office Holders
- **Primary Data Provider**: [OpenNorth Represent API](https://represent.opennorth.ca/) (`https://represent.opennorth.ca/representatives/`)
- **Coverage**: Canadian Members of Parliament (MPs) and Provincial Legislators (MLAs, MPPs, MHAs).
- **Extracted Fields**: Full Name, Riding/District Name, Role Title, Party Affiliation, Official Email, Phone, Government Source URL, Official Headshot Photo URL.
- **Known limitation**: OpenNorth's data for non-BC municipal seats is sourced the same way and is used for the rest of Canada's municipal officials (below), but has not been independently verified province-by-province the way BC has (see below) — treat non-BC municipal rows with the same skepticism until an equivalent authoritative per-province source is found and validated.

### British Columbia Municipal & School Trustee Office Holders
- **Primary Data Provider**: [CivicInfo BC's official general local election results](https://www.civicinfo.bc.ca/electionreports/candidates-and-results.php) (`candidates-and-results.php?year=<YEAR>`, filtered to `is_winner == 'YES'`) — **not** the OpenNorth Represent API, and **not** CivicInfo's own "current representatives" listing that OpenNorth mirrors.
- **Why**: verified directly against Maple Ridge on 2026-08-17 — OpenNorth's API (and the CivicInfo feed it mirrors) still returned Mike Morden as mayor and the outgoing 2018–2022 council long after the Oct 2022 election. The election-results feed, by contrast, matched Maple Ridge's own "Meet Your Council" page and SD42's own "Board of Education" page exactly, for every mayor, councillor, and school trustee. See [20260816000000_office_holder_term_lifecycle.sql](supabase/migrations/20260816000000_office_holder_term_lifecycle.sql) for the full trace.
- **Coverage**: BC municipal mayors & councillors (City/District/Town/Village/Township/Regional Municipality/Island Municipality/Resort Municipality), **plus BC school district trustees & board chairs** — a category the OpenNorth pipeline never covered anywhere in Canada.
- **Chair caveat**: school board chair is not itself an elected position — trustees elect their own chair after being sworn in, so it can't be read off the ballot. `CHAIR_OVERRIDES` in the sync script is a small, manually-curated map that still needs periodic reverification per district (e.g. against that district's own "Board of Education" page); the script only guards against assigning chair to someone who isn't even a winning trustee that cycle.
- **Refresh cadence**: tied to BC's fixed general local election schedule (every 4 years — next is Oct 2026). Re-run with `--year 2026` once CivicInfo publishes certified results; there's no reason to run it more often than that for this feed.
- **Pipeline**: [`scripts/sync-bc-election-results.py`](scripts/sync-bc-election-results.py) `--year <YEAR> --apply`. Supersedes `fast-populate-bc-qc.py`, `populate-bc-qc-parties.py` (literal duplicates of each other, both from commit 807261d, never deduplicated — used this same CivicInfo feed but only to patch `political_party_id` on rows a different, unreliable pipeline had already created), and `populate-bc-school-trustees.py` (a hardcoded, frozen snapshot with no `source_url` and no freshness tracking at all).
- **Known gaps**: 41 winners (out of ~1,436 parsed) could not be matched to a `map_shapes` row — mostly renamed/regional entities (e.g. "Daajing Giids", formerly Queen Charlotte) or provice-wide bodies without a single geographic boundary (Conseil Scolaire Francophone) — printed by the script, not silently dropped. Separately, `map_shapes` has duplicate `code` values for at least 25 BC school districts (e.g. id 132034 is correctly "SD42 - Maple Ridge-Pitt Meadows", but a second row, id 132257, is named "Border Land" yet also carries `code = '42'`) — a pre-existing boundary-data bug, unrelated to officeholder freshness; the sync script matches by name specifically to avoid tripping over it, but the duplicate rows themselves are still there.

### Quebec Municipal Party Affiliation & Other Canadian Municipal Officials
- **Municipal Party Source**: Élections Québec / Wikipedia MediaWiki API (for Quebec municipalities like Montreal, Quebec City, Laval, Gatineau, Longueuil).
- **Coverage (outside BC)**: Canadian Municipal Officials (Mayors, City Councillors, Regional Councillors, Reeves) via the OpenNorth Represent API — see the known limitation above.
- **Extracted Fields**: Full Name, Municipality / District Name, Role Title (Mayor vs Councillor), Civic Party Affiliation (*Surrey Connect*, *Surrey First*, *Safe Surrey Coalition*, *ABC Vancouver*, *Projet Montréal*, etc.), Official Email, Phone, Government Source URL, Official Headshot Photo URL.

### US Federal Congress, State Governors & US Municipal Officials
- **Data Provider**: [unitedstates / congress-legislators](https://github.com/unitedstates/congress-legislators), [OpenStates Open-Data Repository](https://github.com/openstates/people) & Civil Services Executive Governors Dataset.
- **Coverage**: Active 119th Congress U.S. Senators, U.S. Representatives, State Governors, and US Municipal Officials (Mayors & City Council Members across 571 US cities).
- **Extracted Fields**: Full Name, State Code, District Number / City Name, Role Title (Mayor vs Council Member), Party Affiliation, Official Email, Phone, Office Address, Official Capitol / Municipal Photo URL.

### US State Senate & State House (All 50 States)
- **Data Provider**: [OpenStates Open-Data Repository](https://github.com/openstates/people)
- **Coverage**: 50 State Senates (Upper Chambers) and 50 State Houses (Lower Chambers).
- **Extracted Fields**: Official Name, Chamber Title, District Name/Number, Photo URL, Contact Email, Capitol Phone, Party Affiliation.

---

## 3. How the Pipeline & Current Office Holder Detection Work

The end-to-end data pipelines are located at:
- National / State / Federal Pipeline: [`scripts/populate-all-office-holders.py`](file:///Users/vmn2k4/Coding/Choseno/scripts/populate-all-office-holders.py)
- **BC Municipal & School Trustee Pipeline (primary source of truth for BC)**: [`scripts/sync-bc-election-results.py`](file:///Users/vmn2k4/Coding/Choseno/scripts/sync-bc-election-results.py)
- Canadian Municipal Pipeline (rest of Canada, via OpenNorth — see the known limitation in section 2): [`scripts/populate-canadian-municipal.py`](file:///Users/vmn2k4/Coding/Choseno/scripts/populate-canadian-municipal.py)
- US Municipal Pipeline: [`scripts/populate-us-municipal.py`](file:///Users/vmn2k4/Coding/Choseno/scripts/populate-us-municipal.py)

### Current / Former / Aspiring Office Holder Detection (Politician Wall & UI)
`public.office_holders` rows are never deleted or overwritten when someone leaves office — they're retired in place (`is_current = false`, `term_ended_at` set) so term history and any wall claim survive; see [20260816000000_office_holder_term_lifecycle.sql](file:///Users/vmn2k4/Coding/Choseno/supabase/migrations/20260816000000_office_holder_term_lifecycle.sql). Detected dynamically via `enrichProfileWithContactFallback()` in [`src/lib/services/politicianWall.ts`](file:///Users/vmn2k4/Coding/Choseno/src/lib/services/politicianWall.ts):
- Checks for corresponding entries in `public.office_holders` (via `linked_profile_id` or matching full name), filtered to `is_current`.
- Current office holders display their official role badge directly (e.g. **`[MAYOR]`**, **`[COUNCILLOR]`**, **`[GOVERNOR]`**, **`[MP]`**).
- A retired officeholder (`is_current = false`) displays **`[FORMER MAYOR]`**, etc., instead — never silently reverts to looking like an active/aspiring candidate.
- Non-office holder candidates aspiring for office display **`[ASPIRING MAYOR]`**, **`[ASPIRING COUNCILLOR]`**, etc.

### Pipeline Execution Flow

```mermaid
flowchart TD
    A[1. Fetch Map Shapes from Supabase DB] --> B[2. Query OpenNorth API for CA MPs, MLAs & Municipal Mayors/Councillors]
    A --> C[3. Fetch US Congress, Governors & OpenStates US Municipal Data]
    A --> D[4. Parse OpenStates 50-State Legislators Dataset]
    B --> E[5. Perform Fuzzy & FIPS Name Matching to map_shapes]
    C --> E
    D --> E
    E --> F[6. Export Compiled CSV to scripts/office-holders-data.csv]
    F --> G[7. Execute Batched SQL Upsert into office_holders Table]
    G --> H[8. Auto-Generate & Link Ghost Profiles + Politician Walls]
```

1. **Boundary Matching**: Queries `map_shapes` in PostgreSQL to build high-performance lookup dictionaries matching shape names, FIPS codes, and riding/city titles.
2. **Data Aggregation**: Merges data from OpenNorth, Congress-Legislators, and OpenStates into a unified schema.
3. **CSV Export**: Writes a clean, standardized 10,661-row export file:
   [`scripts/office-holders-data.csv`](file:///Users/vmn2k4/Coding/Choseno/scripts/office-holders-data.csv)
4. **Database Upsert**: Executes batched SQL statements into the `office_holders` Supabase table.
5. **Politician Wall Sync**: Auto-generates a `profiles` record (`role: 'politician'`, `current_ghost_id`) and `politician_profiles` entry for every office holder so that clicking any representative opens their official **Politician Wall** (`/wall/[ghostId]/[slug]`).

---

## 4. How to Update Data in the Future

### Option A: Re-Run Automated Ingestion Pipelines (Recommended)

When municipal, state, or federal elections occur, re-run the python pipeline scripts:

```bash
# Update Federal, Provincial, US Congress, Governors, State Legislatures
python3 scripts/populate-all-office-holders.py

# Update BC Municipal Mayors/Councillors + School Trustees (after a BC
# general local election, e.g. Oct 2026 -- once CivicInfo publishes
# certified results, pass that year)
python3 scripts/sync-bc-election-results.py --year 2026 --apply

# Update Canadian Municipal Mayors & Councillors outside BC
python3 scripts/populate-canadian-municipal.py

# Update US Municipal Mayors & Council Members across all US cities
python3 scripts/populate-us-municipal.py
```

These scripts automatically:
1. Re-fetch the latest official data.
2. Retire anyone no longer returned as a current winner (`is_current = false`, `term_ended_at` set) instead of leaving them looking current, or overwriting their row.
3. Update the `office_holders` table in Supabase.
4. Ensure all Politician Wall profiles remain in sync.

`sync-bc-election-results.py` defaults to a dry run — it fetches, parses, and writes the generated SQL to `scripts/bc-election-results-sync.sql` for review, but only executes it against the database when `--apply` is passed.

---

### Option B: Manual CSV Edit & Import

To manually update specific office holders, contact emails, photo URLs, or party affiliations:

1. Open [`scripts/office-holders-data.csv`](file:///Users/vmn2k4/Coding/Choseno/scripts/office-holders-data.csv) in a text editor or spreadsheet app.
2. Edit or add rows using the CSV columns:
   `map_shape_id, role_title, full_name, political_party, bio, contact_email, contact_phone, holding_since, source_url, photo_url`
3. Run the CSV import script to push your changes to Supabase:
   ```bash
   node scripts/import-to-db.js
   ```

---

### Option C: Admin Web UI Dashboard

Admins can also add, edit, or delete individual office holders interactively without running terminal scripts:

1. Log in as an Admin on Choseno.
2. Navigate to `/admin/office-holders`.
3. Select any Country, Boundary Type, and District Shape to update or reassign office holders on the fly.

---

## 5. Related Files & Artifacts

- **Data File**: [`scripts/office-holders-data.csv`](file:///Users/vmn2k4/Coding/Choseno/scripts/office-holders-data.csv) (national/state/US-municipal pipelines only; the BC pipeline writes directly to Supabase, see below)
- **BC Municipal & School Trustee Pipeline**: [`scripts/sync-bc-election-results.py`](file:///Users/vmn2k4/Coding/Choseno/scripts/sync-bc-election-results.py) (generates [`scripts/bc-election-results-sync.sql`](file:///Users/vmn2k4/Coding/Choseno/scripts/bc-election-results-sync.sql) for review before `--apply`)
- **US Municipal Ingestion Pipeline**: [`scripts/populate-us-municipal.py`](file:///Users/vmn2k4/Coding/Choseno/scripts/populate-us-municipal.py)
- **Canadian Municipal Ingestion Pipeline (outside BC)**: [`scripts/populate-canadian-municipal.py`](file:///Users/vmn2k4/Coding/Choseno/scripts/populate-canadian-municipal.py)
- **National / State Ingestion Pipeline**: [`scripts/populate-all-office-holders.py`](file:///Users/vmn2k4/Coding/Choseno/scripts/populate-all-office-holders.py)
- **Node CSV Importer**: [`scripts/import-to-db.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/import-to-db.js)
- **Term Lifecycle Migration**: [`supabase/migrations/20260816000000_office_holder_term_lifecycle.sql`](file:///Users/vmn2k4/Coding/Choseno/supabase/migrations/20260816000000_office_holder_term_lifecycle.sql)
- **Elections & Office Holders Service**: [`src/lib/services/elections.ts`](file:///Users/vmn2k4/Coding/Choseno/src/lib/services/elections.ts)
- **Politician Sidebar Component**: [`src/components/features/PoliticianSidebar.tsx`](file:///Users/vmn2k4/Coding/Choseno/src/components/features/PoliticianSidebar.tsx)
- **Boundary Directory Page**: [`src/app/elections/[boundarySlug]/page.tsx`](file:///Users/vmn2k4/Coding/Choseno/src/app/elections/[boundarySlug]/page.tsx)
