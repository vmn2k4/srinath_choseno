> **⚠️ BLOCKED as of this update: the Supabase database is in read-only mode.**
> `SHOW transaction_read_only` returns `on` at the database level (not a replica —
> `pg_is_in_recovery()` is `false`), meaning **no writes can succeed right now**, from this
> script or from the live app. This almost certainly means the Supabase project has hit a
> plan/storage/compute quota and needs the user to check the Supabase dashboard directly
> (billing/usage page) — not something fixable via `psql` as the app's `postgres` role
> (confirmed `is_superuser = off`, no role- or database-level config override found).
> **Hit mid-way through the Ward upload** (~35,000/63,676 rows in before the first write
> failed) — safe to `--resume 4b4fe530-38f1-4179-ac19-4c83c234a2c3` once writes work again.

# Adding India boundary data (Lok Sabha / Vidhan Sabha / State / Ward) — progress log

**Status: Lok Sabha (543/543), State (36/36), and Vidhan Sabha (4,122/4,122) all done,
uploaded, and verified live — 0 invalid geometries across all three. Vidhan Sabha
per-state counts match the real official seat count exactly for 30 of 31 states/UTs with
an assembly (only Sikkim is off by one: 31 loaded vs. 32 real — minor, not yet
root-caused). Ward boundaries (municipal-level): research done, build in progress — see
the dedicated section near the end of this doc.**

This is a live progress log for loading India's electoral boundaries, following the
general method in [adding-boundary-data.md](adding-boundary-data.md). Kept up to date as
work happens so a session can be picked up mid-way if interrupted.

## Scope

Three boundary types, mirroring the Canada/USA pattern:

| Choseno `type_name` | Real-world meaning | `admin_only` | `is_container` | Analogous to |
|---|---|---|---|---|
| `Lok Sabha` | Parliamentary (MP) constituencies — 543 seats | `false` | `false` | Canada `Federal` / USA `Federal` |
| `Vidhan Sabha` | State Legislative Assembly (MLA) constituencies — ~4,123 seats across 28 states + UTs | `false` | `false` | Canada `Provincial` / USA `State House` |
| `State` | State/UT outlines (28 states + 8 UTs) | `true` (proposed) | `true` | Canada `Province` — pure container, no directly-elected statewide office in India (Governor is appointed, CM is chosen by the assembly, not directly elected) |

Not in scope yet: Rajya Sabha (indirectly elected, no geographic constituency to map).
**Municipal wards: research done, not yet decided/built — see dedicated section at the end
of this doc.** Unlike Canada/US municipal (genuinely "thousands of independent systems,
research one at a time"), India turns out to have a real candidate for *centralized* ward
data via a national government program (Swachh Bharat Mission) — see below before assuming
this has to be per-city research.

## Prerequisites (same as parent doc)

- `ogr2ogr`, `psql`, `python3` confirmed on `PATH` in this environment.
- `DATABASE_URL` — same Supabase project as Canada/USA (`qlzyfdwrkcxyqapewxwg`, pooler
  `aws-1-us-east-2.pooler.supabase.com`), password from `.env.local` comments, URL-encoded.
  **Never use the Supabase MCP tools for this project** (wrong account) — confirmed still
  true, using `psql` directly throughout.
- Current `country_boundary_types` state (checked live, before this work):
  ```
  Canada | Province | 1 | admin_only=t | is_container=t
  Canada | Federal | 2 | f | f
  Canada | Municipal | 3 | f | f
  Canada | Provincial | 4 | f | f
  Canada | Advance Polling District | 6 | f | f
  Canada | National | 7 | t | f
  USA | Federal | 1 | f | f
  USA | State Senate | 2 | f | f
  USA | State House | 3 | f | f
  USA | Municipal | 4 | f | f
  USA | State | 5 | admin_only=f | is_container=t
  USA | National | 6 | t | f
  ```
  No `India` row in `countries` yet, no India `country_boundary_types` rows yet.

## 1. Find the official source — research log

**No single official ECI GIS portal exists.** Confirmed via web research: unlike Canada
(per-province government sources) or the US (Census Bureau's consolidated Cartographic
Boundary Files), India's Election Commission publishes constituency data only as
non-GIS statistical reports/PDFs — every GIS shapefile in circulation (DataMeet, ML
Infomap/Esri commercial reseller, academic datasets) is a third party's *derivative* of
that same underlying ECI data, not a direct government GIS download. This is a structurally
different situation from every prior country in the parent doc, closer to "no shortcut
through existing open data" (Nunavut) than to a clean single source — the compensating
factor is that the underlying raw data (ECI reports) is genuinely public and multiple
independent groups have already digitized it, so it's a "pick the best derivative"
problem, not a "digitize from scratch" one.

### Candidate sources evaluated

- **DataMeet** (`github.com/datameet/maps`) — the original community-maintained India GIS
  project. **Ruled out for direct use**: its own docs flag known issues — pre-delimitation
  boundaries for several states (J&K, Jharkhand, Assam, Manipur, Nagaland, Arunachal
  Pradesh), incorrect/missing constituency names, and **Telangana constituencies still
  labeled Andhra Pradesh** (stale since Telangana's 2014 creation).
- **`yashveeeeeeer/india-geodata`** (GitHub) — a newer (2023) aggregator that re-packages
  several sources, including two relevant to us:
  - **LGD** (Local Government Directory, `lgdirectory.gov.in` — an actual Government of
    India source, Ministry of Panchayati Raj) — used for both constituency layers and one
    of two state-outline options. **This is what got used**, see below.
  - **Susewind** (Raphael Susewind, academic, 2014 vintage) — an alternative constituency
    dataset, not used (LGD's Parliament layer checked out clean, no need for a fallback;
    kept in mind as a fallback specifically for Vidhan Sabha, see below).
  - Also offers **SOI** (Survey of India) and **Bhuvan** (ISRO) state-outline alternatives.
  - Distribution: GitHub Releases, tag `electoral/constituencies` (Parliament + Assembly)
    and `admin/states` (LGD/SOI/Bhuvan state outlines) — files as `.geojsonl.7z` (7z-
    compressed newline-delimited GeoJSON, needs `brew install p7zip` — not on this machine
    by default), `.parquet`, `.pmtiles`. Used the `.geojsonl.7z` variant since `ogr2ogr`
    reads `.geojsonl` directly via its `GeoJSONSeq` driver, same as any other format.
- **GADM** — has India admin levels but no electoral constituencies at all (ruled out,
  wrong data type, confirmed before downloading anything).

### Redistricting check (India-specific "read the actual news" step)

**The current delimitation (543 Lok Sabha seats, ~4,123 assembly seats across states) is
the 2002 Delimitation Commission's map, in force since 2008, based on the 2001 Census.**
Checked for a pending redistricting given this project's history of "the newest-sounding
file isn't always in force" (Alberta, Quebec, Nova Scotia all bit the Canada load) —
**found one, and it's not yet in effect**: the **Delimitation Bill, 2026** was introduced in
Lok Sabha on 2026-04-16, proposing to expand the Lok Sabha from 543 to 850 seats and
redraw both Lok Sabha and Vidhan Sabha constituencies nationally. As a constitutional
amendment it needs a two-thirds majority in both houses — as of this research (2026-08-09)
it has reportedly passed the Rajya Sabha but not the Lok Sabha, and the ruling coalition is
short of the required margin. **Conclusion: the 543-seat/2008-delimitation map used below
is still the legally current one** — but this bill is worth checking on again in any future
session before assuming that stays true, exactly like Alberta's rejected 2026 redistribution
in the Canada load.

## 2–3. Download and analyze

```bash
brew install p7zip   # not present by default; needed to decompress .geojsonl.7z
mkdir -p <scratch>/india && cd <scratch>/india
curl -sL -o LGD_Parliament_Constituencies.geojsonl.7z \
  "https://github.com/yashveeeeeeer/india-geodata/releases/download/electoral/constituencies/LGD_Parliament_Constituencies.geojsonl.7z"
curl -sL -o LGD_States.geojsonl.7z \
  "https://github.com/yashveeeeeeer/india-geodata/releases/download/admin/states/LGD_States.geojsonl.7z"
7z x LGD_Parliament_Constituencies.geojsonl.7z
7z x LGD_States.geojsonl.7z
```

**Verification before trusting either file** (this is what caught Vidhan Sabha's problems
below — always do this per-file, don't assume a "clean-looking" source is actually clean):
```bash
wc -l LGD_Parliament_Constituencies.geojsonl LGD_States.geojsonl   # feature count via JSONL line count
python3 -c "import json; [print(json.loads(l)['properties']) for l in open('<file>').readlines()[:1]]"  # schema peek
```
- **Lok Sabha**: 543 lines = 543 features, matching the real seat count exactly. All 543
  `pc_id` values unique. All 28 states + 8 UTs present, **Telangana correctly separate from
  Andhra Pradesh** (unlike DataMeet) — confirms this LGD layer is genuinely post-2014
  vintage for this layer. Fields: `pc_name` (name), `pc_id` (unique numeric code, use as
  `--code-field`), `st_name`, `st_code`. Already EPSG:4326. Vertex range 162–26,268 (well
  under the 100k cutoff, no `--vertex-cutoff` override needed).
- **State**: 36 lines = 36 features (28 states + 8 UTs exactly). Fields: `STNAME`,
  `STCODE11`, `State_LGD` (used as `--code-field`). Already EPSG:4326. Vertex range
  737–94,286 (under cutoff, no pre-simplification needed — smaller/cleaner than StatsCan's
  Canada province file was).
- **Vidhan Sabha (Assembly)**: see dedicated section below — **do not upload as-is**.

## 4. Upload — done

Registered in `supabase/migrations/20260809000004_india_country_and_boundary_types.sql`:
`India` in `countries`; `Lok Sabha` (rank 1, `admin_only=false`, `is_container=false`) and
`State` (rank 2, `admin_only=true`, `is_container=true`) in `country_boundary_types`.
`Vidhan Sabha` deliberately not registered yet (nothing to point it at).

```bash
python3 scripts/upload_boundary.py LGD_Parliament_Constituencies.geojsonl \
  --country India --type "Lok Sabha" --name-field pc_name --code-field pc_id \
  --name "India Lok Sabha Constituencies (2008 delimitation, LGD)" --yes

python3 scripts/upload_boundary.py LGD_States.geojsonl \
  --country India --type "State" --name-field STNAME --code-field State_LGD \
  --name "India States/UTs outlines (LGD)" --yes
```

Both ran clean, no `--select-fields` workaround needed (no numeric overflow on
`Shape_Area`/`Shape_Length` this time, unlike some of the Canada loads).

## 5. Verify

```sql
SELECT bu.name, bu.expected_count, count(ms.id) AS loaded,
       count(*) FILTER (WHERE NOT ST_IsValid(ms.geom)) AS invalid
FROM boundary_uploads bu JOIN map_shapes ms ON ms.upload_id = bu.id
WHERE bu.country = 'India' GROUP BY bu.id, bu.name, bu.expected_count;
```
- **State**: 36/36 loaded, 0 invalid. ✅
- **Lok Sabha**: 543/543 loaded, 0 invalid. ✅ (upload_id `3c6a8942-6d86-40fb-8a20-c4b95db6eef6`)

**Live spot-check** (New Delhi, 28.6139°N 77.2090°E):
```sql
SELECT * FROM find_boundaries_by_point(28.6139, 77.2090);
--  id   |   name    | country | boundary_type | code | rank
-- 62945 | NEW DELHI | India   | Lok Sabha     | 704  |    1
```
Correctly resolves to the real Lok Sabha constituency. Only one row comes back because
`find_boundaries_by_point` deliberately filters `WHERE NOT cbt.admin_only` (a later,
undocumented-in-the-original-migration addition to the live function — checked via `psql
\sf find_boundaries_by_point`) — so `State` (`admin_only=true`) is correctly excluded from
this citizen-facing RPC, exactly as intended for a pure admin container type. Confirmed
`State` itself still resolves correctly with a direct query:
```sql
SELECT name, ST_Contains(geom, ST_SetSRID(ST_Point(77.2090, 28.6139), 4326))
FROM map_shapes WHERE country='India' AND boundary_type='State' AND name ILIKE '%DELHI%';
-- DELHI | t
```
This is the same validated pattern as Canada's `Province` (also `admin_only=true`) —
confirms the `admin_only` decision for India's `State` type was correct.

---

## Vidhan Sabha (MLA / State Assembly constituencies) — BLOCKED, do not upload yet

The same `yashveeeeeeer/india-geodata` release (`electoral/constituencies`,
`LGD_Assembly_Constituencies.geojsonl.7z`) is the only Vidhan Sabha source checked so far,
and it has real, confirmed data-quality problems — not registered in `country_boundary_types`
and not uploaded, on purpose, per this project's rule (`adding-boundary-data.md`) that
citizen-membership-determining boundaries need to be right, not just "close enough."

**What's wrong, confirmed by direct inspection (4,177 total features, only 4,101 unique
`AC_ID`):**

1. **Andhra Pradesh / Telangana boundary confusion, unlike the Lok Sabha layer from the
   same release.** AP shows 296 assembly features under `st_code='28'` — close to the
   *undivided* pre-2014 AP+Telangana combined total (294), not AP's real current 175. No
   `TELANGANA` state name appears anywhere in the Assembly file at all. Confirmed a real
   collision: `AC_ID='28172'` is shared by two different real constituencies —
   "Rampachodavaram(ST)" (`ac_no=172`) and "Bhadrachalam (ST)" (`ac_no=119`, a seat that
   was actually transferred to Telangana in the 2014 bifurcation) — i.e. this file's ID
   scheme silently collides across what should be two different states' numbering.
2. **Seat-count mismatches against real, known current totals** for at least: Gujarat (166
   in file vs. 182 real), Maharashtra (302 vs. 288 real), Madhya Pradesh (226 vs. 230 real).
   Not yet root-caused per-state (could be a mix of true duplicates, true gaps, and
   multi-part-polygon artifacts — see next point — needs per-state reconciliation before
   trusting any of these).
3. **Junk placeholder rows**: several `(ac_no=0, ac_name=' ')` rows per state (seen: Gujarat
   ×4, Andhra Pradesh ×2) — empty/invalid records that would need filtering (`WHERE ac_no !=
   0`) regardless of the other issues.
4. **Some of the 76 `AC_ID` duplicates look like legitimate multi-part geometries** (same
   `ac_no`/`ac_name` appearing 2-3× — e.g. Assam's "Sidli" ×3) that a real GIS often splits
   into separate polygon rows for non-contiguous constituencies. These would need a
   `GROUP BY AC_ID` dissolve (same technique as Manitoba's voting-area dissolve in the
   parent doc) rather than being treated as errors — but that fix needs to happen *after*
   the AP/Telangana ID-collision problem is resolved, since dissolving by a colliding ID
   would merge two genuinely different constituencies into one shape.
5. Minor, cosmetic: the state name is misspelled `"UTTARKHAND"` (missing the second "A")
   throughout this file — harmless once known, just don't join/filter by exact string match
   against `"UTTARAKHAND"` from the other layers without normalizing.

**Not yet tried:** the `Susewind_Assembly_Constituencies_2014` file from the same release
(2014-vintage academic dataset, so also predates any AP/Telangana-aware boundaries — likely
has the *opposite* problem of being pre-bifurcation entirely, needs its own check, not
assumed better); DataMeet's raw Assembly layer directly (already known to have the same
Telangana issue per its own docs, so unlikely to help); a from-scratch reconciliation
against each state election commission's own site the way Alberta/Saskatchewan/PEI's
*candidate* data was found in the parent research doc (heavy — 28 states, only justified if
no existing dataset can be fixed).

### Alternate-source research (round 2, prompted by "find alternate URLs")

Went looking for a real fix rather than accepting the LGD/Susewind gap. Findings:

- **Telangana: SOLVED.** `data.opencity.in` (a CKAN open-data portal, unrelated to the
  blocked `.gov.in` hosts below) mirrors **`tracgis.telangana.gov.in`'s own official 2018
  Assembly Constituency KML** — dataset page:
  `data.opencity.in/dataset/telangana-and-hyderabad-assembly-constituencies-maps`, credited
  to "Election Commission of India" as the CKAN organization, licensed public-domain
  (`license_id: other-pd`). Downloaded and verified directly:
  ```bash
  curl -sL -o telangana_ac_2018.kml "https://data.opencity.in/dataset/ddf1cb4a-1433-4e8b-aeeb-afb2d5ba5021/resource/ab8095a4-cc07-4a73-8da2-3458baab4600/download/8137a4f0-4d33-48d9-ae93-23b2bf558424.kml"
  ogrinfo -so telangana_ac_2018.kml assembly_boundary   # Feature Count: 119 — exact match
  ```
  **119/119 features, exactly matching Telangana's real current assembly seat count** —
  ogr2ogr reads the KML natively via the `LIBKML` driver, EPSG:4326, no conversion needed.
  Fields: `ASSEMBLY_N` (name, e.g. "Bellampalle (Sc)"), `DNAME1` (district), `Parlament`
  (parent Lok Sabha seat), `FID` (0-based sequential — not confirmed to match official AC
  numbering, treat as a local id only, not necessarily `--code-field`-worthy without more
  checking). This file alone resolves the Telangana half of the AP/Telangana problem.
  Same dataset also has a **Telangana Parliamentary Constituencies 2019** KML (not needed —
  Lok Sabha layer already correctly includes Telangana) and a separate Hyderabad/Rangareddy
  detail KML (redundant with the state-wide one, skip).

- **Andhra Pradesh (post-2014, real 175 seats): still not found.** Checked and ruled out:
  - **Esri India's "India Legislative Assembly Boundaries" ArcGIS Living Atlas layer**
    (`livingatlas.esri.in/.../Legislative_Assembly_Boundaries_2022/MapServer/0`, found via
    `arcgis.com/sharing/rest/search`) — real, ECI-sourced, but **explicitly license-
    restricted**: "Users are not permitted to export data for offline use," requires an
    ArcGIS Online org/developer login. Not used — this project doesn't bypass license
    terms or paywalls, same rule that ruled out CAPTCHA-solving for the candidate-data
    research.
  - **`stategisportal.nic.in`** (a genuine National Informatics Centre/Government of India
    GIS portal, confirmed reachable, unlike `data.telangana.gov.in`/`data.ap.gov.in` which
    both connection-timeout from this environment — DNS resolves fine, so likely an
    IP-range block rather than a wrong domain, same pattern as Colorado's WAF issue in the
    candidate-data doc, not an Alberta-style wrong-domain issue). Its map viewer
    (`/Home/Map/28` for Andhra Pradesh, state code 28) genuinely has an "Assembly
    Constituency"/"Parliamentary Constituency" layer toggle (confirmed in `map.js`), backed
    by a `MapImageLayer` pointed at a config object (`acPCLayerSpecs.url` /
    `.token`) — but that config object's actual value **isn't in any static JS file
    fetched** (`config.js`, `map.js`), meaning it's assembled some other way (inline
    per-request script, a separate AJAX config call, or similar) that wasn't tracked down
    in this pass. Worth another look if picking this up — the layer clearly exists and is
    used by a real government portal, this is an incomplete lead, not a dead end.
  - **DataMeet's own Assembly layer** — not rechecked directly (already known, per its own
    docs, to have the same AP/Telangana problem — unlikely to help).
  - **Bhuvan (ISRO) WFS** — tried two guessed `GetCapabilities` endpoint URLs, both returned
    empty (likely wrong path, not confirmed blocked) — not pursued further, deprioritized
    since Bhuvan's `admin/states` layer (already checked, used for nothing so far) suggests
    Bhuvan may not carry electoral-constituency-level layers at all, only administrative
    boundaries.
  - **`HindustanTimesLabs/shapefiles`** GitHub repo — repo exists but the specific path
    referenced in search results (`state/ac`) 404s; repo structure has likely changed or
    that path never existed as described. Not explored further (repo root not browsed).

### BREAKTHROUGH: found the real live source, not just a Telangana patch

Followed up on the "`stategisportal.nic.in` has a real AC/PC layer but the config value
wasn't in static JS" lead using the Browser tool to load the actual page and read the
live JS variable after the page finished initializing (`acPCLayerSpecs` in `window`, not
retrievable from a static fetch of `map.js`/`config.js` alone — it's assembled at runtime).
This revealed the real service:

```
https://mapservice.gov.in/gismapservice/rest/services/BharatMapService/AC_PC/MapServer/2
```

This is a **live, national, government of India (NIC "BharatMapService") ArcGIS REST
service** — sublayer `2` = Assembly Constituency, sublayer `1` = Parliamentary Constituency
— serving the *same underlying LGD data lineage* (identical field schema: `ST_NAME`,
`AC_NAME`, `AC_ID`, `State_LGD`, etc.) but clearly a **more current/better-maintained
pass** than the static `yashveeeeeeer/india-geodata` export used above. Confirmed by
direct query (`returnCountOnly=true` per state):

| State | This live service | Real official count | Earlier static LGD file |
|---|---|---|---|
| Andhra Pradesh | **175** | 175 | 296 (broken, undivided) |
| Telangana | **119** | 119 | *(absent entirely)* |
| Madhya Pradesh | **230** | 230 | 226 |
| Uttar Pradesh | **403** | 403 | 403 |
| West Bengal | **294** | 294 | 294 |
| Gujarat | 183 | 182 | 166 |
| Maharashtra | 289 | 288 | 302 |

**This resolves the entire Andhra Pradesh/Telangana problem outright** — both come back
exactly correct, no patching-together-two-sources needed. Gujarat/Maharashtra are still
off by exactly 1 each (down from 16 and 14 off, respectively) — much more likely to be a
single leftover multi-part-geometry duplicate each (harmless, dissolvable) than a real
data gap, but not yet confirmed — check before final upload. Total across all states:
**4,132** (vs. the ~4,123 commonly-cited figure — the small excess is consistent with a
handful of harmless multi-part duplicates, not a systemic problem).

**Access mechanism** (worth understanding before reusing this pattern elsewhere): the page
embeds a bearer token in its rendered JS (`acPCLayerSpecs.token`), and the ArcGIS REST
endpoint additionally requires a matching `Referer` header — both are trivially readable
from the public page's own JS (nothing hidden, no login), so this is functionally public
data with lightweight anti-hotlinking, not an access-controlled system. Reproducible any
time by loading `https://stategisportal.nic.in/stategisportal/Home/Map/28` in a real
browser and reading `window.acPCLayerSpecs` — **the token is almost certainly short-lived
(standard ArcGIS token pattern)**, so fetch a fresh one at download time rather than
reusing the one recorded in this doc.

```bash
# 1. Load the portal in a browser, evaluate in devtools console (or via an automated
#    browser tool) to get a fresh token + referer:
#    JSON.stringify(acPCLayerSpecs)
# 2. Paginate the query (maxRecordCount=1000, supportsPagination=true):
TOKEN="<fresh token from step 1>"
REF="https://stategisportal.nic.in/stategisportal/Home/Map/28"
BASE="https://mapservice.gov.in/gismapservice/rest/services/BharatMapService/AC_PC/MapServer/2/query"
for offset in 0 1000 2000 3000 4000; do
  curl -s --max-time 180 -H "Referer: $REF" -H "User-Agent: Mozilla/5.0" \
    "$BASE?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultOffset=$offset&resultRecordCount=1000&token=$TOKEN" \
    -o "page_$offset.geojson"
done
# 3. Merge the 5 pages' "features" arrays into one FeatureCollection before feeding to
#    upload_boundary.py (it expects one file, not raw ArcGIS pagination pages).
```
Each page is large (~80MB+ for 1000 features at full precision, no coordinate
generalization applied server-side) — budget real time per request (150-180s each was
observed), and always background/poll rather than running all 5 sequentially in one
foreground shell call (hit the harness's 2-minute default command timeout doing this the
naive way).

**Update: done.** All 17 pages (250 records each, reduced from an initial 1000-per-page
attempt that hit transient server errors on the largest batches) fetched cleanly on retry.
Merging + cleanup found:
- **301 blank-`AC_NAME` rows** — 294 of them were West Bengal's *real* constituencies
  (correct, unique `AC_ID`s, just missing this one field in this service) — backfilled by
  name-lookup against the earlier static LGD file, which shares the same `AC_ID` scheme.
  The remaining 7 were genuinely non-constituency remainder areas (Gujarat's Rann of Kutch,
  a J&K border strip, 2 small Goa slivers, a tiny Mumbai-suburban area, and both Ladakh rows
  — Ladakh is a UT with no legislative assembly at all) — dropped.
- **4 duplicate `AC_ID`s** after the above: 2 were the same junk-remainder pattern (Goa,
  Ladakh — already dropped), 2 were real multi-part geometries (Himachal Pradesh's
  Bharmour ×3, Punjab's Amargarh ×2) — dissolved via `ogr2ogr -dialect sqlite -sql
  "SELECT ... ST_Union(geometry) ... GROUP BY AC_ID"` (same technique as the parent doc's
  Manitoba voting-area dissolve).
- **Final: 4,122 unique features**, uploaded via
  `supabase/migrations/20260810000000_india_vidhan_sabha_boundary_type.sql` (registers
  `Vidhan Sabha`, rank 2, bumping `State` to rank 3) +
  `upload_boundary.py --country India --type "Vidhan Sabha" --name-field AC_NAME
  --code-field AC_ID`. Result: **4122/4122 loaded, 0 invalid.**
- **Verified per-state**: queried `properties->>'st_name'` grouped counts against real
  official seat counts — **30 of 31 states/UTs with an assembly match exactly** (Andhra
  Pradesh 175, Telangana 119, Gujarat 182, Maharashtra 288, Uttar Pradesh 403, West Bengal
  294, all others also exact). **Sikkim is the one exception: 31 loaded vs. 32 real** — not
  yet root-caused, small enough state that a single missed/merged seat is plausible; check
  before treating this doc as "fully closed."
- **Live spot-check**: Hyderabad (17.3850°N, 78.4867°E) correctly resolves to Vidhan Sabha
  seat "Khairatabad" under Telangana's own code (`36060`, state_LGD 36) via
  `find_boundaries_by_point` — confirms the AP/Telangana fix works end-to-end, not just in
  the raw counts.

### Recommended next step (superseded by the breakthrough above, kept for history)

With Telangana now solved, the remaining gap is narrower than it looked: **just Andhra
Pradesh's real current 175 seats**, not "the whole AP/Telangana mess." Three options:

1. **Ship 35 of 36 states/UTs now**: use LGD's Assembly file for everywhere *except*
   `st_code='28'` (Andhra Pradesh), add the Telangana KML found above, and hold back only
   Andhra Pradesh's assembly constituencies until its own source is found — mirroring how
   the parent doc shipped 12 of 13 Canadian provinces/territories and left Nunavut
   explicitly unfinished rather than blocking on it. **Still needs**: resolving the
   Gujarat/Maharashtra/Madhya Pradesh seat-count mismatches found earlier (166 vs 182, 302
   vs 288, 226 vs 230) — not yet root-caused, could be the multi-part-geometry dissolve
   issue (harmless, fixable with `GROUP BY AC_ID`) or something else; needs checking
   per-state before trusting those three either.
2. **Push further on `stategisportal.nic.in`** — a real government portal with a
   confirmed-existing AC/PC layer; the blocker is purely "the JS config value wasn't found
   in static files yet," not "this doesn't exist" or "this is paywalled." A browser-based
   session (watching the actual network request the map viewer makes when state=28 is
   selected, the way Manitoba's real POST method was discovered in the candidate-data
   research) would likely reveal the real service URL directly.
3. **Skip Vidhan Sabha entirely for now**, ship only Lok Sabha + State (already done),
   revisit once a complete clean source exists for all 36 states/UTs at once.

## Open questions / decisions made

- **`State` boundary type: `admin_only=true`, `is_container=true`** — decided and shipped.
  India has no directly-elected statewide office (Governor is appointed by the President of
  India, not elected; Chief Minister is chosen by the assembly majority, not a direct
  statewide vote) — so unlike USA's `State` (which backs real Governor/Senator elections),
  India's `State` is a pure container, same role as Canada's `Province`.
- **Redistricting risk**: checked and resolved for now — see "Redistricting check" above.
  The Delimitation Bill, 2026 is the thing to re-check in any future session before trusting
  this data blindly.

## Known gotchas hit this session

- `.geojsonl.7z` needs `p7zip` (`brew install p7zip`) — not on this machine by default,
  unlike `unzip` which is. `ogr2ogr`/`ogrinfo` read the decompressed `.geojsonl` directly
  via the `GeoJSONSeq` driver with no extra flags — same as any other format
  `upload_boundary.py` already supports.
- **Always verify feature counts and spot-check for known historical bugs (Telangana,
  in this case) before trusting a "looks fine" file** — the Lok Sabha and Assembly layers
  came from the *same* release/pipeline, and one was clean while the other had a serious,
  specific, confirmable data-integrity bug. A vintage/source label on a release page is not
  a substitute for checking the actual feature-level content.
- **A blank attribute value is not automatically junk — check whether it's "no real entity
  here" or "the entity is real, this one field just wasn't populated" before dropping
  rows.** The BharatMapService Assembly layer had 301 blank-`AC_NAME` rows; a naive filter
  would have silently deleted **all 294 of West Bengal's real constituencies** along with 7
  genuinely-non-constituency remainder areas (Rann of Kutch, a J&K border strip, etc.).
  Checking *why* each blank existed (all 294 WB rows had real, unique, correctly-numbered
  `AC_ID`s; the 7 real junk rows didn't correspond to any seat number at all) caught this
  before it shipped. Fixed by backfilling names from the AC_ID-keyed lookup already built
  from the earlier (static) LGD file, since both datasets share the same ID scheme.
- **A live ArcGIS token embedded in a public page's rendered JS is short-lived — don't treat
  a value captured once as reusable across a multi-minute paginated download.** The first
  attempt died partway through (page 2 of 5 came back as an HTML "invalid token" error page,
  not JSON) purely from token expiry between requests; the fix was smaller
  page sizes (fewer/shorter requests, less total elapsed time) plus per-page validation
  (check `type == "FeatureCollection"` before accepting a page) with automatic retry,
  not a fundamentally different access method.
- **Multi-part-geometry duplicates need `GROUP BY <id> + ST_Union` dissolving, not
  deduplication by dropping extra rows** — `upload_boundary.py`'s own resumability logic
  (skip a row if its code already exists in `map_shapes` for this upload) would have
  silently dropped the *second and third polygon parts* of Himachal Pradesh's Bharmour and
  Punjab's Amargarh constituencies if left as separate same-`AC_ID` rows, quietly shrinking
  those two seats' real shapes. Caught by checking for duplicate codes *before* uploading,
  not after.

---

## Municipal wards — research done (prompted by "where else do we have ward-wise data,
## besides Esri"), nothing downloaded/uploaded yet, needs a scope decision

### What Esri has (confirming what was already noticed)

`arcgis.com/sharing/rest/search?q=india%20ward%20boundaries` turns up **Esri India's
"India Ward Boundaries"** Living Atlas layer
(`livingatlas.esri.in/server1/rest/services/Wards/India_Ward_Boundaries/MapServer/0`) — a
genuine national-scale ward layer, plus several individual-city ones (Nagpur, Ahmedabad,
Pune) from the same Esri India account. Same licensing pattern as the Legislative Assembly
layer found earlier in this doc: Esri India Living Atlas content, almost certainly requires
an ArcGIS Online org/developer login and (going by the Assembly layer's terms) likely
disallows offline export — **not independently re-verified for this specific layer's
license page**, but no reason to expect it differs from the sibling layer already checked.

### Two other candidates found — one looks like the real answer

Both come from the same `yashveeeeeeer/india-geodata` release already used above
(`urban/boundaries`), which per the repo's own README draws from a real list of government
sources including **Swachh Bharat Mission** — not just DataMeet/community scrapes:

1. **`SBM_Wards`** (Swachh Bharat Mission — Urban, a Ministry of Housing and Urban Affairs
   flagship sanitation program that requires every enrolled Urban Local Body to map its own
   wards). **This is the real find**: 70,419 ward features across **3,712 distinct ULBs** —
   two orders of magnitude more coverage than any single-city dataset, and explicitly a
   named government program in the aggregator's own sources list (same trust tier as LGD,
   which already checked out clean for Lok Sabha/State). Fields: `statename`, `districtname`,
   `ulbname`, `ulbcode`, `wardname`, `wardcode`, `status` (`APPROVED`/`OPEN`/`REJECTED`/null).
   A sibling file, **`SBM_ULBs`** (3,373 features), has the whole-municipality outline for
   each ULB — would work as a `Municipal`-equivalent container the way `State` containers
   Lok Sabha/Vidhan Sabha seats.
2. **`LivingAtlas_Wards`** (9,100 features) — smaller coverage, and given the name is
   almost certainly a re-export of the same Esri Living Atlas data flagged above (license
   status unclear, not the government-sourced pick). **Deprioritized in favor of SBM.**

### Real data-quality problem found in SBM_Wards: unnormalized, self-reported state names

Each of the 3,712 ULBs entered its own metadata independently into the SBM portal, with
**zero centralized normalization of the `statename` field** — confirmed by direct
inspection: 69 distinct string values for what should be ~36 real states/UTs, including
`"Uttar Pradesh"` / `"UTTAR PRADESH"` / `"Uttar Pradeshh"` / `"Uttar Pardesh"` / `" Uttar
Pradesh"` (leading space) / `"Uttarpradesh"` all referring to the same state, similarly
`"Andhra Pradesh"` / `"Andhra Pradhesh"` and `"Telangana"` / `"Telanagana"`, plus ~40 rows
with a blank state name and 58 with `null`. **This is real, substantial cleanup work**
(a fuzzy/manual state-name normalization map across ~69 variants, plus deciding what to do
with the `OPEN`/`REJECTED`/null-status and blank-state rows) before this could be uploaded
as clean per-state boundary batches the way Lok Sabha/Vidhan Sabha/State were.

### Decided and built (confirmed with the user to proceed)

Registered `Ward` (rank 4, `admin_only=false`, `is_container=false` — citizen-facing,
since a ward elects a real corporator/councillor) via
`supabase/migrations/20260810000001_india_ward_boundary_type.sql`.

**Cleaning pipeline** (`SBM_Wards.geojsonl`, 70,419 raw rows):
1. **Status filter**: kept only `status == 'APPROVED'` (6,477 dropped: `OPEN` presumably
   means not-yet-finalized by the ULB, `REJECTED` is self-explanatory — this is a judgment
   call, not verified against SBM's own documentation of what these statuses mean formally;
   revisit if `OPEN` turns out to mean something more benign).
2. **State-name normalization**: raw data had **69 distinct spellings** for what should be
   ~36 real states/UTs (self-reported per-ULB, zero central QA). Fixed with a small
   typo-correction map (`ANDHRA PRADHESH`→`ANDHRA PRADESH`, `TELANAGANA`→`TELANGANA`,
   `MAHARASTRA`/`MAHRASHTRA`/`MAHARSHTRA`→`MAHARASHTRA`, `JAMMU AND KASHMIR`/`JAMMU
   &AMP; KASHMIR`→`JAMMU & KASHMIR`, etc. — see
   `scripts`-equivalent in the scratch dir, `clean_sbm_wards.py`, `TYPO_FIXES` dict) plus
   whitespace/case normalization, matched against the canonical 36-name list already
   established from `LGD_States`. **Worked cleanly**: only 52 rows (all blank/whitespace
   state names, no lingering typos) couldn't be resolved and were dropped.
3. **Unique code construction**: `wardcode` alone repeats across every ULB (every city has
   a "Ward 1"), and **36 ULBs had `wardcode` entirely null** (236 rows, distinguished only
   by `wardname`). Built a synthetic `ward_full_code = f"{ulbcode}_{wardcode or
   slugified(wardname)}"` for use as `--code-field`, since leaving `code` null across many
   rows in one upload risks the resumability check's `IS NOT DISTINCT FROM NULL` matching
   unrelated rows against each other if a resume is ever needed.
4. **Dissolve real duplicates**: 156 duplicate `ward_full_code`s (370 rows) after the above
   — same multi-part-geometry pattern as Vidhan Sabha's Bharmour/Amargarh, confirmed by
   inspection (identical `ulbname`/`wardname`/`status` per duplicate group, e.g. Junagadh's
   "Sukhnath Chowk" ward appearing as 2 rows). Dissolved via the same
   `ogr2ogr -dialect sqlite -sql "... ST_Union(geometry) ... GROUP BY ward_full_code"`
   technique. (One dissolve group hit a GEOS `TopologyException: side location conflict` —
   ogr2ogr still produced the full expected feature count, so this was a non-fatal
   warning for that one group, not investigated further since the final count matched
   exactly.)
5. **Result: 63,676 unique wards**, vertex profile confirmed via `--analyze-only`:
   overwhelmingly simple polygons (median 53 vertices, mean 113 — municipal wards are much
   smaller/simpler than state or even assembly-constituency polygons). Only 1 shape exceeds
   the 100k-vertex cutoff (a ward named "30" somewhere, 127,982 vertices — skipped,
   negligible loss of 1/63,676).
6. Uploaded via `upload_boundary.py --country India --type "Ward" --name-field wardname
   --code-field ward_full_code --name "India Municipal Wards (Swachh Bharat Mission,
   APPROVED status only)"`. **Given the size (63,676 shapes — ~15x Vidhan Sabha's
   already-largest 4,122), this ran as a long background job; check
   `boundary_uploads`/`map_shapes` directly for final status if picking this up mid-run.**

### Coverage gap, confirmed real (not a cleaning miss)

**Only 28 of 36 states/UTs are present at all** in the raw `SBM_Wards` source — missing
entirely (zero rows, checked in the *raw* pre-cleaning data, so this isn't something the
typo-fix pass could have caused): Arunachal Pradesh, Manipur, Meghalaya, Mizoram, Tripura,
Lakshadweep, Dadra & Nagar Haveli/Daman & Diu, and Andaman & Nicobar. Likely explanation:
these states/UTs' ULBs simply haven't been onboarded to this specific SBM data-collection
initiative (or have but with zero `APPROVED` wards yet) — not investigated further this
session. **If ward coverage for any of these is needed later, this specific source won't
provide it — would need separate per-state research**, same as the parent doc's
Canada/US "research one municipality at a time" fallback, just scoped to 8 states/UTs
instead of an entire country.

### Deferred, not built this session

- **`Municipal` container type backed by `SBM_ULBs`** (3,373 whole-ULB outline features,
  3,349 unique `ulbcode` after the same kind of near-duplicate check — 17 dup codes, not
  yet dissolved/cleaned) — would mirror `State`→Lok Sabha/Vidhan Sabha, letting an admin
  pick "every ward in Mumbai" as a container the way `ElectionsAdmin.jsx` already does for
  states. Same `stnm`/`ulbnm`/`ulbcode` field shape as `SBM_Wards`, so the same
  state-name-normalization map would apply directly. Not done — flagged as the natural
  next step if ward-scoped seat creation is needed.
