# How to add a new set of boundary data to Choseno

A repeatable method for finding, downloading, and uploading an administrative/electoral
boundary layer (a province's ridings, a country's states, etc.) via `scripts/upload_boundary.py`.
Written after loading Canada's 12 available provincial/territorial legislatures in one session
(761 ridings, 12 separate government sources) — this is that method generalized so it can be
repeated for any new jurisdiction (e.g. USA states, US congressional districts, another
country's national legislature).

Since applied a second time for the USA (Federal/State Senate/State House/Municipal, 4 files
instead of ~150 — see below) — this method held up unchanged across two very differently-
structured countries.

See [ARCHITECTURE.md](../ARCHITECTURE.md) §11 (Canada) and §14 (USA) for what's currently
loaded, and §6/§7 for the underlying schema/tooling this method uses. This doc is the *how*;
ARCHITECTURE.md is the *what/why*.

---

## 0. Prerequisites

- `ogr2ogr` and `psql` on `PATH` (both required by `scripts/upload_boundary.py`).
- The DB connection string — pooler string + password are in `.env.local`'s comments (see
  ARCHITECTURE.md §2). Export it once per session:
  ```bash
  export DATABASE_URL="postgresql://postgres.<ref>:<url-encoded-password>@<pooler-host>:5432/postgres"
  ```
  URL-encode any special characters in the password (`+` → `%2B`, `/` → `%2F`, etc.) or
  `ogr2ogr` will fail to parse the connection string.
- **Never use the Supabase MCP tools for this project** — they're authenticated to a
  different, wrong Supabase account. Use the CLI/`psql` directly (ARCHITECTURE.md §2).
- The `boundary_type` you're loading into must already exist in `country_boundary_types` for
  that country (admin panel's "Countries"/"Boundary Types" sections, or a direct SQL insert)
  — the upload will fail fast with a clear error if not.

## 1. Find the official source

- **Check first whether the country's national statistics agency publishes a single
  consolidated national file per layer, before assuming a per-region patchwork.** Canada
  turned out to require 12 separate provincial/territorial government sources (§11) with no
  national alternative for provincial ridings — but that's a Canada-specific quirk (each
  province runs its own elections agency), not the general case. The US Census Bureau's
  **"Cartographic Boundary Files"** (`cb_*`, at `https://www2.census.gov/geo/tiger/GENZ<year>/shp/`
  — distinct from the more detailed, always-per-state `tl_*` TIGER/Line files at
  `.../TIGER<year>/<LAYER>/`) publish Congressional Districts, State Legislative Districts
  (upper *and* lower chamber), and incorporated Places as **single national shapefiles** —
  collapsing what could have been ~150 downloads (50 states × up to 3 layers) into 4. Always
  check the national statistics agency's own bulk/cartographic data pages, not just the
  per-state/per-region election-authority sites, before committing to a per-region plan.
- Search `"<jurisdiction> electoral district boundaries shapefile"` / `"...open data"`.
  Government open-data portals, not third-party aggregators, are the goal — accuracy and
  license terms matter for a civic app.
- **Check for a pending redistricting before trusting the "obvious" file.** Several
  jurisdictions had this bite during the Canada load: Quebec's 2026 map took effect
  *mid-session*, Nova Scotia's file was labeled `ED2026`, Alberta's 2026 redistribution was
  rejected by the legislature so the 2017 map is still actually in force. Read the actual
  news/legislation, don't assume the newest-sounding filename is current.
- Common source *types*, roughly in order of how clean the download ends up being:
  1. **A direct WFS/ArcGIS REST feature service** — best case, pulls straight to GeoJSON with
     no license click-through. Two ways to find one:
     - `curl -s "https://www.arcgis.com/sharing/rest/search?q=<terms>&f=json"` — searches all
       public ArcGIS Online content. Look for `"type": "Feature Service"` results, then hit
       `<url>/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`.
     - A government's own ArcGIS Server, if you can find its hostname (e.g.
       `nsgiwa.novascotia.ca/arcgis/rest/services/...`) — list layers via
       `<service-url>/MapServer?f=json`, inspect each with `<service-url>/MapServer/<id>?f=json`
       to find the actual polygon layer (as opposed to point/line layers in the same service).
  2. **A CKAN-style open-data catalogue** (`catalogue.data.gov.bc.ca`, `open.canada.ca`, etc.)
     — use the CKAN API directly rather than scraping the JS-rendered page:
     `curl -s "<catalogue>/api/3/action/package_show?id=<dataset-id>"` returns a `resources`
     array with real download URLs and the `object_name`/layer name.
  3. **A direct government download link** — sometimes behind a license-agreement
     click-through page (Elections Ontario); follow the chain of pages to find the actual
     file URL, or fetch the "I Agree" landing page's HTML for the real link.
  4. **Socrata portals** (`*.socrata.com`, common for provincial/state open-data sites) —
     append `?method=export&format=GeoJSON` to the dataset's `/api/geospatial/<id>` endpoint.
- Verify the URL actually resolves and is the right size/type before treating it as found:
  `curl -sI "<url>"` and check `content-type`/`content-length`.

## 2. Download and inspect

```bash
mkdir -p <scratch-dir>/<XX>
cd <scratch-dir>/<XX>
curl -sL -o data.zip "<url>"        # or .geojson directly if the source serves that
unzip -o data.zip -d extracted      # if a zip
ogrinfo -so extracted/*.shp <layer-name>   # schema, feature count, CRS
```
Check the feature count against the jurisdiction's actual known number of seats/ridings —
this catches wrong files immediately (e.g. a polling-division file instead of a riding file).

**If the file is at a finer granularity than you need** (e.g. voting areas instead of
ridings, as Manitoba's public shapefile was — 2,371 features instead of 57), dissolve it with
GDAL's SQLite dialect before uploading:
```bash
ogr2ogr -f GeoJSON dissolved.geojson source.shp \
  -dialect sqlite -sql "SELECT <ID_FIELD>, <NAME_FIELD>, ST_Union(geometry) AS geometry \
                         FROM <layer_name> GROUP BY <ID_FIELD>, <NAME_FIELD>" \
  -t_srs EPSG:4326
```

## 3. Analyze before writing anything

```bash
python3 scripts/upload_boundary.py <file> \
  --country <Country> --type <BoundaryType> \
  --name-field <NAME_FIELD> --code-field <CODE_FIELD> \
  --analyze-only
```
- If this errors with `numeric field overflow` mentioning `shape_area`/`shape_leng`, retry
  with `--select-fields <ID_FIELD>,<NAME_FIELD>,...` to drop the offending numeric attribute
  (a known `ogr2ogr` precision issue with ESRI's computed area/length fields, not a bug in
  this project's script).
- Check the vertex-count histogram it prints. Default `--vertex-cutoff` is 100,000 — coastal
  or Arctic geometries can exceed this legitimately (Newfoundland's Labrador ridings needed
  `--vertex-cutoff 500000`). Raise the cutoff rather than accepting a skip, unless the count
  is extreme (millions of vertices — see ARCHITECTURE.md §6 "scale lessons" for why that's a
  different problem).

## 4. Upload for real

```bash
python3 scripts/upload_boundary.py <file> \
  --country <Country> --type <BoundaryType> \
  --name-field <NAME_FIELD> --code-field <CODE_FIELD> \
  [--select-fields ... ] [--vertex-cutoff N] \
  --name "<Human-readable batch name>" --yes
```
Resumable by construction — if a batch fails partway, rerun the exact same command with
`--resume <upload_id>` (printed on failure) instead of starting over.

## 5. Verify

```bash
psql "$DATABASE_URL" -c "
SELECT bu.name, bu.expected_count, count(ms.id) AS loaded,
       count(*) FILTER (WHERE NOT ST_IsValid(ms.geom)) AS invalid
FROM boundary_uploads bu JOIN map_shapes ms ON ms.upload_id = bu.id
WHERE bu.id = '<upload_id>' GROUP BY bu.id, bu.name, bu.expected_count;"
```
`loaded` should match the jurisdiction's real seat count, `invalid` should be 0. Spot-check
one known point against `find_boundaries_by_point(lat, lng)` and/or the live `/explore` page.

---

## Worked example: Ontario (today's session)

```bash
curl -sL -o ontario.zip "https://www.elections.on.ca/content/dam/NGW/sitecontent/2017/preo/shapefiles/Electoral%20District%20Shapefile%20-%202022%20General%20Election.zip"
unzip -o ontario.zip -d extracted
ogrinfo -so extracted/*/ELECTORAL_DISTRICT.shp ELECTORAL_DISTRICT
# -> 124 features, fields: ED_ID, ENGLISH_NA, FRENCH_NAM, Shape_Leng, Shape_Area

export DATABASE_URL="postgresql://postgres.qlzyfdwrkcxyqapewxwg:<url-encoded-pw>@aws-1-us-east-2.pooler.supabase.com:5432/postgres"

python3 scripts/upload_boundary.py "extracted/.../ELECTORAL_DISTRICT.shp" \
  --country Canada --type Provincial --name-field ENGLISH_NA --code-field ED_ID \
  --select-fields ED_ID,ENGLISH_NA,FRENCH_NAM \
  --name "Ontario 2022 Provincial Electoral Districts" --yes
# -> 124/124 loaded, 0 invalid
```

## Sources used for all 12 Canadian provinces/territories loaded today

| Jurisdiction | Source type | Where |
|---|---|---|
| Ontario | Direct download (license click-through) | elections.on.ca |
| British Columbia | WFS (DataBC) | `openmaps.gov.bc.ca/geo/pub/WHSE_ADMIN_BOUNDARIES.EBC_ELECTORAL_DISTS_BS11_SVW` |
| Alberta | Direct download | elections.ab.ca |
| Saskatchewan | ArcGIS REST | `gis.saskatchewan.ca/arcgis/rest/services/Administrative/MapServer/6` |
| Manitoba | Direct download, dissolved from voting-area data | electionsmanitoba.ca |
| Quebec | Direct download (license click-through) | donnees.electionsquebec.qc.ca |
| New Brunswick | Socrata (GeoNB) | `gnb.socrata.com` |
| Nova Scotia | ArcGIS REST (found via arcgis.com content search) | `nsgiwa.novascotia.ca/arcgis/rest/services/BND/BND_ElectoralBoundaries_UT83` |
| PEI | ArcGIS REST (found via arcgis.com content search) | `services9.arcgis.com/zow9Ot3ujGSyJI3C/.../Electoral_Districts_Features` |
| Newfoundland & Labrador | CKAN-adjacent custom portal, direct file download | opendata.gov.nl.ca |
| Yukon | ArcGIS REST (found via arcgis.com content search) | `services.arcgis.com/bwohQix8s7zRvYC9/.../Approved_Yukon_Electoral_Districts_2024` |
| Northwest Territories | Direct download | geomatics.gov.nt.ca |
| Nunavut | **None found** — see below | — |

**Nunavut has no publicly available digital boundary data.** Elections Nunavut's
"constituency map" is a static image with a clickable-hotspot overlay, not a GIS layer.
Checked: their own site, Government of Nunavut GIS resources, ArcGIS Online search, the
OpenNorth `represent-canada-data` GitHub aggregator, and the federal Open Government Portal.
If this is ever needed, the only path is hand-digitizing from their PDF constituency maps or
contacting Elections Nunavut directly — there's no shortcut through existing open data.

## Known gotchas already fixed in `scripts/upload_boundary.py`

Both of these were real bugs hit and fixed during this load — you shouldn't hit them again,
but they're worth knowing about if the script errors in a similar way:
- Numeric source code fields (e.g. an `Integer64` ID column) used to crash the resumability
  check with `operator does not exist: text = numeric` — fixed by casting to `::text`.
- The script didn't used to set `expected_count`/`completed_at` on `boundary_uploads`, so
  CLI-driven batches looked permanently "Incomplete" in the admin panel — fixed.

## Extra step for very-large-area/low-feature-count files (national/province outlines)

A follow-up load (13 province/territory outlines, StatsCan's cartographic boundary file) hit
a new failure mode: the source file was **265 MB for only 13 features** — full coastline
detail retained even at province scale — and this was too much for `ogr2ogr`'s own `COPY`
into the staging table to complete at all (timed out *before* step 3's vertex analysis ever
ran, not after). If a file with very few features is unexpectedly huge, don't bother running
`--analyze-only` first — pre-simplify immediately:
```bash
ogr2ogr -f "ESRI Shapefile" simplified.shp original.shp -simplify 1000
```
`-simplify <tolerance>` applies Douglas-Peucker simplification in the *source file's own CRS
units* (check with `ogrinfo -so` — StatsCan's file was in metres, so `1000` = 1km tolerance).
This is only appropriate when the data doesn't need to be precise to the metre — e.g. an
admin container-selection helper where the result is always reviewed before use, never a
boundary type that determines actual user membership (see "admin-only boundary types" below).
1km tolerance took a 265 MB / country-scale file down to 13 MB in a few minutes; adjust the
tolerance to the file's actual scale (a single small municipality wouldn't need anywhere near
this much simplification, or possibly any).

## Admin-only boundary types (container-selection helpers that aren't citizen memberships)

Not every boundary needs to become something a citizen "belongs to." `sync_user_boundary_
memberships` and the `reconcile_shape_memberships` trigger both respect a
`country_boundary_types.admin_only` flag (see [ARCHITECTURE.md](../ARCHITECTURE.md) §13) —
set it when registering a boundary type via the admin panel (or directly in SQL) if citizens
should never get a membership/feed tab for it and it should never get tagged onto posts.
**If you add a new boundary-eligibility rule like this in the future, remember
`user_boundary_memberships` has two independent write paths** — the
`sync_user_boundary_memberships` RPC (called explicitly from `StepLocation.jsx`) and the
`reconcile_shape_memberships` trigger (fires automatically on every `map_shapes` insert,
retroactively enrolling existing users) — both need the same filter, not just the one that
seems obviously relevant. Missing the trigger was a real bug hit in that session: it silently
auto-created 5 real memberships the moment the province shapes were uploaded, before being
caught and fixed.

**`admin_only` is *not* the same thing as "usable as a container"** (a common trap — the two
happened to always coincide until USA's `State` needed to be both a real citizen membership
*and* a container, see [ARCHITECTURE.md](../ARCHITECTURE.md) §26). Container-eligibility for
`ElectionsAdmin.jsx`/`BoundaryVisualizer.jsx`'s seat-building "container" dropdown and the
`shape_containers` cache is its own `country_boundary_types.is_container` column. In practice:
- A pure container that should never be a citizen membership either (Canada's `Province`):
  `admin_only=true`, `is_container=true`.
- A normal citizen-facing boundary that's never useful as a container (most types — `Federal`,
  `Municipal`, ...): `admin_only=false`, `is_container=false`.
- A type that's both a real citizen membership *and* still useful to scope another type's
  search by (USA's `State`, backing Governor/Senator): `admin_only=false`,
  `is_container=true`.

Set `is_container` explicitly if a new boundary type needs to work as a container — it
defaults to `false` and does **not** automatically follow `admin_only`.

## Overlapping-system provinces (a boundary type isn't always a clean partition)

Some provincial layers are actually several *overlapping* systems on the same geography, not
one partition — Canada's school boards are the clearest case (Ontario/Alberta/Saskatchewan
each run separate overlapping Public/Catholic/Francophone school-board layers covering the
same area; a resident is inside all of them at once, by system, not by geography). Loading all
of them as one boundary type would break the "one boundary per point per type" assumption the
rest of the schema relies on (`find_boundaries_by_point`, feed tabs, etc. all assume a citizen
has *one* answer per type). **Pick the one system that actually partitions the whole
province/state** (usually the larger/general one — Public, or the historically-default
language) and skip the rest, same as choosing US `Place` over `County Subdivision` for
Municipal (§14 of ARCHITECTURE.md). Document which system you picked and why.

## Per-facility sources need a dissolve *and* a validity fix

A source can be finer-grained than "needs dissolving" (§2) in a worse way: New Brunswick's only
public school-boundary data was per-*school* catchment polygons (439 of them), not per-*district*.
Dissolving those with a plain `ST_Union(geometry)` GROUP BY district threw
`TopologyException: side location conflict` — the individual catchment polygons had real
self-intersections that only show up once you try to union them. Fix: wrap the geometry in
`ST_MakeValid()` inside the dissolve SQL from the start whenever the source is per-facility
rather than already-administrative-boundary-shaped:
```bash
ogr2ogr -f GeoJSON dissolved.geojson source.geojson \
  -dialect sqlite -sql "SELECT <ID_FIELD>, ST_Union(ST_MakeValid(geometry)) AS geometry \
                         FROM <layer_name> GROUP BY <ID_FIELD>" \
  -t_srs EPSG:4326
```
Also watch for a **missing name field on the dissolved output** — BC's school-district source
only had a numeric `SCHOOL_DISTRICT_NUMBER`, no name, at the granularity that needed dissolving
to. There was no separate name lookup dataset; the fix was a small hardcoded number→name table
(BC Ministry of Education's public school-district list) joined in before upload. Check for
this before uploading, not after — an upload with numeric-only names for a citizen-facing type
is a real product regression, not a cosmetic one.

## Always sanity-check your `--code-field` for nulls/duplicates first

The resumability check (§4) dedupes on `(name, code)` — if the chosen `--code-field` is `NULL`
on some fraction of features (seen on a Manitoba source, 9 of 36 rows), those rows collide with
each other and some silently fail to insert with no error, only a lower-than-expected final
count. Caught by step 5's verification query (`loaded` < `expected_count`), not by the upload
itself. `python3 -c "import json; ... Counter(f['properties'][field] for f in features)"` on
the candidate code field before uploading is cheap insurance — prefer a field guaranteed
unique per feature (an `OBJECTID`) over a "looks like an ID" field if there's any doubt.

## Worked example: Canada school districts (2026-08-14 session)

Full per-province source table and decisions are in
[ARCHITECTURE.md](../ARCHITECTURE.md) (search "School District boundary type"). Short version:
no StatsCan national file exists for this layer (confirmed by testing the standard
`*_000b21a_e.zip` naming pattern directly, not by assuming) — treated as a per-province job
like §11's Provincial ridings, sourced 8 of 13 provinces/territories (BC, AB, ON, QC, MB, SK,
NB, NS — 260 shapes, 0 invalid), and skipped PEI/NL/YT/NT/NU because each has only one
province/territory-wide school authority, not a real sub-division to load (parallel to
Nunavut's missing riding data above).

## Office Holder Ingestion Rule: Never insert without linking ghost profile walls

Whenever office holders are populated for a new boundary type (e.g. School Trustees, Mayors, Councillors):
1. **Never insert raw `office_holders` without `linked_profile_id`**: Always create corresponding entries in `profiles` (`role='politician'`, `current_ghost_id=gen_random_uuid()`) and `politician_profiles` (`wall_slug=slugify(...)`) and link `office_holders.linked_profile_id = profile_id`.
2. **Why**: The UI widgets (`RepresentationBranchTree.tsx` / `FindMyDistrictClient.tsx`) only render the `"View Wall ->"` button and route to `/wall/<slug>` when `node.ghost_id` is present.
3. **Register Head of Branch**: If the newly added role is the executive head of the branch (e.g., `Board Chair`, `Mayor`, `Premier`), add it to `HEAD_ROLE_TITLES` in `FindMyDistrictClient.tsx` and `src/app/elections/[boundarySlug]/page.tsx` so it renders at the top of the tree hierarchy.

