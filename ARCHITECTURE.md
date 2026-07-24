# Choseno — Architecture Reference

This document exists so a future session (human or Claude) can pick this project back up
without re-deriving context. It covers what existed before this working session, everything
built during it, how it's designed, and known gaps that were flagged but intentionally left
unfixed. Written 2026-07-23, updated same day after a second work session (§§11–13).

---

## 1. What Choseno is

An anonymous civic social platform. Users post under a rotating "ghost ID" (not their real
identity), and every post is automatically scoped to the real electoral/administrative
boundaries (federal riding, municipality, etc.) the poster's location falls inside — so
conversation is naturally local, without anyone's real identity or address ever being exposed
in the product surface.

**Stack:** React 19 + Vite, Tailwind, `react-leaflet` + `@turf/turf` for maps, `shpjs` for
client-side shapefile parsing, Supabase (Postgres 17 + PostGIS) for backend/auth/storage.
No server code beyond Postgres functions (RPCs) — the client talks to Supabase directly via
`supabase-js`, gated by Row Level Security (RLS) policies and `SECURITY DEFINER` functions.

---

## 2. Operational / environment notes (read this before touching infra)

**There are two separate local clones of this project on this machine.** The real one —
where all work in this document happened — is `/Users/vmn2k4/Coding/Choseno`. There is
also a stale, disconnected clone at `/Users/vmn2k4/Claude/Projects/Choseno/app`, frozen at a
June 15 commit, pointed at a *different* (paused) Supabase project. If a dev server on
port 5173 looks wrong or old, check `ps -p <pid> -o command` — if it's not running from
`/Users/vmn2k4/Coding/Choseno`, kill it and restart from the correct directory.

**Supabase project:** ref `qlzyfdwrkcxyqapewxwg`, linked via the Supabase CLI (`supabase`
command, run from `/Users/vmn2k4/Coding/Choseno`). Connection details are in
`.env.local` (gitignored) — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. The DB password
is noted in that file's comments.

**Important gotcha:** the Supabase MCP connector available in this environment
(`mcp__8a274a81-8e05-43df-9a10-4c48a0b718f7__*`) is authenticated to a *different* Supabase
account/org and cannot see project `qlzyfdwrkcxyqapewxwg` at all — it only sees an unrelated
project (`rmpmnhnsaptghfeyueay`, coincidentally also called "choseno", INACTIVE/paused —
this is the same project the stale clone above points to). **Do not use the Supabase MCP
tools for this project.** All migrations were applied via the Supabase CLI instead:
```bash
cd /Users/vmn2k4/Coding/Choseno
supabase db push --yes
```
Direct SQL/inspection was done via `psql` with the pooler connection string (see any
migration-adjacent commit in this session's history for the exact connection string pattern:
`postgresql://postgres.qlzyfdwrkcxyqapewxwg@aws-1-us-east-2.pooler.supabase.com:5432/postgres`,
password via `PGPASSWORD` env var).

**A standing admin test account now exists**: `vmn2k4+admintest@gmail.com` /
`ChosenoTest2026!` (`role='admin'` in `profiles`). Use this for UI verification instead of
minting a new throwaway account. **Gotcha, hit live in the second session:**
`OnboardingFlow.jsx`'s `submitOnboarding` always overwrites `profiles.role` from the
onboarding UI selection (`'normal'`/`'politician'`, or `'admin'` only for the one hardcoded
email `vmn2k4@gmail.com`) — if this test account (or any admin account) ever goes through
onboarding again, it will silently get demoted back to `'normal'`. This happened once
already and was fixed with a manual `UPDATE profiles SET role='admin' ...`. **Flagged, not
fixed** — see §12's "known unresolved issues."

For any *other* one-off admin/politician test account, the previous session's pattern still
works: insert into `auth.users` directly via SQL with a bcrypt-hashed password via
`pgcrypto`'s `crypt()` (bypasses Supabase's email-confirmation/rate-limiting entirely),
promote via `UPDATE profiles SET role = ...`, test through the real UI, delete afterward.
Real signup email confirmation has a low rate limit that gets exhausted quickly during
iterative testing, which is why this exists.

**Browser automation cannot drive native file inputs.** Every boundary-data upload in this
session that required an actual file was done by mirroring exactly what the admin panel's
upload flow does (via `ogr2ogr` + direct SQL, or the new `scripts/upload_boundary.py`)
rather than clicking through a file picker. This is a hard platform limitation (CDP-based
browser automation refuses to programmatically set `<input type="file">`.value for security
reasons), not a Choseno-specific issue.

---

## 3. Core anonymity model (pre-existing, foundational — do not break this)

- `profiles` table: one row per real auth user (`id` = `auth.users.id`, **no FK anymore** —
  it was dropped in `20260721000001_drop_fk.sql` for flexibility). Holds `role`
  (`normal` | `politician` | `admin`), `full_name`, `country`, `current_ghost_id`,
  `onboarding_completed`.
- `current_ghost_id`: a UUID that stands in for the user on every post/comment/vote. Posts
  and comments store `ghost_id`, **never** `profile_id` — there's no FK from `posts.ghost_id`
  back to `profiles`, by design, so a burned ghost ID is truly unlinkable.
- `burn_ghost_identity()` RPC (`SECURITY DEFINER`): regenerates `current_ghost_id` for
  `auth.uid()`. All prior posts/comments stay under the old (now orphaned) ghost ID forever —
  nothing is deleted or re-attributed. This is the core "burn and start fresh" anonymity
  guarantee the whole product is built around.
- Auth: Supabase email/password. `AuthContext.jsx` self-heals a missing `profiles` row on
  first login and auto-promotes the hardcoded admin email (`vmn2k4@gmail.com`) to
  `role='admin'`.

**Known unresolved issue (flagged, not fixed):** `FeedPage.jsx`'s `silentExportData()`
function writes a file linking the real `profile.id` to `current_ghost_id` plus full
post/comment history into a `user_exports` storage bucket, on every post/comment. The
bucket's RLS allows any authenticated user to read any file in it (no ownership scoping) —
this would fully deanonymize any user whose `profile.id` became known. Currently
non-functional in practice only because the `user_exports` bucket doesn't exist in this
Supabase project (errors silently, caught). **This should be removed entirely**, not fixed —
no other code reads these export files, there's no evident product purpose for it.

---

## 4. Multi-boundary constituency membership system

*Built this session. Migration: `20260723000000_multi_boundary_memberships.sql`.*

### Problem it replaced
Originally each user had at most two boundary IDs (`polling_district_id`,
`federal_boundary_id` on `user_locations`), guessed by regex from whichever geometry match
came back first. Posts could only be tagged to one of those two, chosen by which feed tab
was active when posting. This didn't match the real requirement: a user belongs to *every*
group their location falls inside (municipal AND federal AND polling district, etc.), and a
post should show up in all of them at once.

### Schema
- **`map_shapes`** (pre-existing, PostGIS): `id` (bigserial), `country`, `boundary_type`
  (free text, e.g. "Federal", "Municipal"), `name`, `code`, `properties` (jsonb, raw source
  attributes), `geom` (`geometry(MultiPolygon, 4326)`).
- **`country_boundary_types`** (new): admin-registered list of valid `boundary_type` values
  per `country`, each with a `rank` (1 = broadest/national, higher = more local — purely for
  UI ordering, no enforced real-world hierarchy). `map_shapes.boundary_type` has an FK
  constraint requiring `(country, boundary_type)` to exist here first — this is what makes
  "admin defines what boundary types exist for a country" actually enforced, not just a UI
  suggestion.
- **`user_boundary_memberships`** (new): `(profile_id, map_shape_id)` pairs — which groups a
  user currently belongs to. No denormalized country/type/rank copied onto this table
  deliberately, always joined through `map_shapes`/`country_boundary_types` so admin edits to
  a type's name or rank never leave stale copies.
- **`post_boundaries`** (new): `(post_id, map_shape_id)` — snapshot of which groups a post
  belonged to *at creation time*. This is what makes a post show up in multiple feeds
  simultaneously.

### Key RPCs
- **`sync_user_boundary_memberships(lat, lng)`**: full recompute for the calling user —
  updates/inserts their `user_locations` row, deletes their old memberships, inserts one row
  per currently-active `map_shapes` row containing that point (`ST_Contains`). Called from
  `StepLocation.jsx` (shared by onboarding and profile-edit).
- **`find_boundaries_by_point(lat, lng)`**: read-only point lookup, returns every matching
  active boundary. Used for the onboarding preview and the public "Boundary Finder" page.
- **`find_shapes_within(container_shape_id, target_boundary_type)`**: returns every active
  shape of `target_boundary_type` that `ST_Intersects` a given container shape. Powers the
  admin "select everything of type X inside this boundary" tool (used for both election-seat
  building and redistricting suggestions — see §5/§6).
- **`create_post(content, image_url, video_url, link_metadata)`**: replaces the old direct
  `posts` insert. Looks up the caller's `ghost_id`, inserts the post, then copies their
  *current* `user_boundary_memberships` into `post_boundaries` in the same transaction. This
  is the actual mechanism behind "one post appears in every group I belong to."
- **`reconcile_shape_memberships()`** trigger (`AFTER INSERT OR UPDATE OF geom ON
  map_shapes`): whenever a boundary's geometry changes (new upload, or — historically — an
  edit), recomputes exactly that shape's membership rows against every user's stored
  `user_locations` point. This is what makes newly-uploaded boundaries retroactively pick up
  existing users without them touching their profile.

### Frontend
- **`src/components/map/BoundaryPicker.jsx`**: reusable list+search+map multi/single-select
  component, extracted from what was originally inline in `UserPage.jsx`. Handles large
  datasets safely — see §6's "scale lessons" for why this matters.
- **`src/components/map/MapComponent.jsx`**: Leaflet render layer, supports an
  `onShapeClick`/`selectedIds` mode for click-to-select (used by `BoundaryPicker`) alongside
  its original read-only "just display these shapes" mode.
- **`FeedPage.jsx`**: tabs are now generated dynamically from the user's
  `user_boundary_memberships` (joined to `map_shapes`, ordered by `country_boundary_types.rank`)
  plus two fixed pseudo-tabs, "Country" and "International", which are just boolean flags on
  `posts` (`is_country`, `is_international`, both set `true` on every post — no shapefile
  needed for country outlines). The composer is a single always-available box — no more
  "pick a tab, then post."
- **`StepLocation.jsx`**: shared by `OnboardingFlow.jsx` and `EditProfileFlow.jsx`. Shows
  *every* matched boundary (not a guessed pair), and offers a manual search-and-add path
  (`add_user_boundary_membership(shape_id)` RPC) for boundaries the point-lookup misses.

---

## 5. Election Mode

*Built this session. Migration: `20260724000000_election_mode.sql` (+
`20260724000001_public_politician_profiles.sql` for a related RLS fix).*

An admin declares an election over a set of boundaries; politicians self-nominate for seats;
citizens in the affected area see a dedicated candidate-discovery/discussion space, separate
from the regular constituency feeds.

### Schema
- **`elections`**: `name`, `election_date`, `status` (`draft` → `nominations_open` →
  `active` → `closed`), `created_by`. RLS: non-admins can only see non-draft rows.
- **`election_seats`**: `(election_id, map_shape_id, role_title)` — one row per boundary +
  office within an election (e.g. "Mayor" × every municipal shape in a province).
- **`election_candidates`**: `(seat_id, politician_id, statement)` — a politician's
  application for a seat. No client `INSERT` policy — only created via `apply_for_seat()`.
- **`posts.election_candidate_id`** (nullable FK, added to the existing `posts` table):
  scopes a post to one candidacy's "wall" (video pitches + discussion), exactly parallel to
  the pre-existing `wall_ghost_id` mechanism `PoliticianWall.jsx` already used — same
  `posts`/`comments` infrastructure, one new tag column, no new post pipeline.
- **`politician_profiles`** (pre-existing table) gained `education` and `hometown` columns
  — persistent, cross-election identity fields, distinct from the per-election `statement`
  on `election_candidates` ("why I'm running *this time*").

### Key RPC
- **`apply_for_seat(seat_id, statement)`**: `SECURITY DEFINER`. Checks the caller's
  `profiles.role = 'politician'` and that the seat's election is actually
  `nominations_open`, then upserts an `election_candidates` row. This is the only way
  candidacy rows get created — enforces both checks server-side regardless of client trust.

**Design decision (explicit, discussed with the user before building):** candidacy is fully
open — any `politician`-role account can apply to *any* seat anywhere, no geographic
restriction to their own home boundary, and no admin approval queue.

### Frontend
- **`src/pages/Admin/ElectionsAdmin.jsx`**: create elections, build seats two ways —
  "auto-select by container" (pick one boundary + a target type, calls
  `find_shapes_within`, result is an editable pre-fill, never auto-applied) or manual
  multi-select via `BoundaryPicker` — then bulk-create seats with a role title. Lifecycle
  buttons advance `elections.status`.
- **`src/pages/PoliticianElections.jsx`**: browse all `nominations_open` seats (sorted with
  "near you" ones first, using the politician's own `user_boundary_memberships` as a
  convenience, not a filter), apply with a statement, manage/withdraw existing candidacies.
- **`src/components/CandidacyWall.jsx`**: modeled directly on the pre-existing
  `PoliticianWall.jsx` pattern — owner (the candidate) posts pitches, anyone can post
  discussion, mirrors the `wallOwner.id === user.id` owner/visitor branching. Route:
  `/candidacy/:candidateId`.
- **`src/pages/ElectionsPage.jsx`**: citizen-facing — lists `active` elections whose seats
  match the viewer's `user_boundary_memberships`, grouped by seat, linking into
  `CandidacyWall` per candidate. Route: `/elections`.

### Related fix bundled in
`profiles` SELECT RLS was previously **own-row-only** — meaning `PoliticianWall.jsx` (and
every new election view) could never actually read another user's `full_name`/
`current_ghost_id`, silently breaking "view someone else's public politician profile" even
before this session. Added a public-read policy scoped to `role = 'politician'` only —
citizens stay unreadable by anyone but themselves (they're never looked up by `profile.id`
anywhere in the app, only by ghost ID), politicians are public figures by design.

### Explicitly out of scope (by design, not oversight)
No vote casting/tallying (discussion/discovery only), no candidacy approval workflow, no cap
on how many seats one politician can apply to. Also unresolved: politician
`target_boundary_id` (on `politician_profiles`, pre-existing field) always reuses whatever
boundary the politician's *own* location resolved to, regardless of which office/boundary
type they actually selected — a mayoral candidate ends up "targeting" their federal riding.
Not touched this session.

---

## 6. Boundary lifecycle management (upload / redistrict / delete)

*Built this session. Migrations: `20260725000000_boundary_lifecycle.sql`,
`20260725000001_stable_pagination_order.sql`, `20260725000002_delete_shapes.sql`.*

### Design principle: retire, never mutate or delete-with-history
A boundary that's ever been used by an election (`election_seats`) or tagged on a post
(`post_boundaries`) must never be deleted or have its geometry mutated in place — both of
those FKs are `ON DELETE CASCADE`, so deleting a shape silently destroys election/post
history. Redistricting is instead: upload the new boundaries (always additive), then
**retire** the old ones (`retired_at` timestamp, `NULL` = active). Retiring clears current
`user_boundary_memberships` for that shape (safe — it's just a cache of "who's in here
right now") but leaves `election_seats`/`post_boundaries` completely untouched, so a past
election's seat still resolves to the exact boundary that was real when it was held,
forever. Every "what boundary is this point in" query (`sync_user_boundary_memberships`,
`find_boundaries_by_point`, `find_shapes_within`) filters `retired_at IS NULL`.

### Schema
- **`boundary_uploads`**: `(id, name, country, boundary_type, uploaded_by, created_at)` —
  every upload is a named, dated batch. `map_shapes.upload_id` (nullable — legacy shapes
  from before this feature have `NULL`) points here, `ON DELETE CASCADE`.
- **`map_shapes.retired_at`**: see above.

### Key RPCs
- **`retire_shapes(shape_ids[])`**: sets `retired_at = now()` + clears memberships for the
  given shapes. Works on *any* shape ids, not just a batch — this is what lets legacy
  (pre-batch-tracking) shapes be retired too.
- **`suggest_replaced_shapes(upload_id)`**: for a freshly-uploaded batch, finds every
  currently-active same-country/same-type shape it `ST_Intersects` — purely advisory input
  to the redistricting UI, always shown as an editable selection.
- **`preview_retirement_coverage_gap(shape_ids[])`**: returns which real users (via
  `user_locations`) would end up with *no* active same-type coverage if the given shapes
  were retired right now. Shown as a warning before confirming, never a hard block — real
  redistricting sometimes legitimately has a temporary gap.
- **`delete_boundary_upload(upload_id)`**: hard-deletes an entire batch **only if** nothing
  in it is referenced by `election_seats`/`post_boundaries`; otherwise raises
  `RETIRE_REQUIRED: N boundaries...` and the frontend redirects into the retire flow instead.
- **`delete_shapes(shape_ids[])`**: same safety check as above, generalized to an arbitrary
  shape-id set — needed because legacy (pre-batch) shapes have no `upload_id` to delete by
  batch. This is how the 482 legacy `POLLING DISTRICT` shapes were removed (see §10) — via
  the admin panel's new "Select by Type" tool + this RPC, not raw SQL.
- **`insert_map_shape(...)`** (pre-existing RPC, extended): gained an optional
  `p_upload_id` param (backward compatible) and an admin-role check — it was previously
  callable by anyone, `SECURITY DEFINER` with no gate at all.

### Frontend
- **`src/pages/Admin/BoundaryUploadsPanel.jsx`**: lists upload batches with live active/
  retired counts (see scale lessons below for why the count query looks the way it does),
  expandable per-batch shape list with search, rename, and the smart delete button.
- **`src/pages/Admin/RedistrictingPanel.jsx`**: pick a batch → "load its own boundaries" or
  "suggest what it replaces" → review/edit selection in `BoundaryPicker` → preview coverage
  impact → confirm retirement (or delete, if the selection turns out to be safe to hard-delete).
  Also has a "select by type" tool (queries `map_shapes` directly by country+type, not batch-
  scoped) specifically for legacy shapes with no upload batch.
- **`AdminPage.jsx`**: the original upload form gained an "Upload Name" field and now
  creates a `boundary_uploads` row before inserting shapes, threading its id through.

### Scale lessons learned (real, hard-won — don't repeat these bugs)
1. **Supabase/PostgREST caps any unbounded `.select()` or `.rpc()` result at 1000 rows by
   default.** With real datasets in the thousands (8,197 Advance Polling Districts,
   5,161 Census Subdivisions), this silently truncated the admin panel's shape lists,
   selection tools, and impact-preview counts. Fixed by extracting
   **`src/utils/fetchAllPages.js`** — a `.range()`-based pagination helper — used
   everywhere a result set could realistically exceed 1000 rows. **Any new query against
   `map_shapes` or similar large tables should use this, not a bare `.select()`.**
2. **`.range()` pagination requires a fully deterministic `ORDER BY`** (a plain
   `.order('name')` isn't enough when names repeat) — otherwise pages can silently
   duplicate or skip rows. `suggest_replaced_shapes` and `preview_retirement_coverage_gap`
   were both given explicit `ORDER BY id` for this reason.
3. **Real government shapefiles can have geometries with hundreds of thousands to millions
   of vertices** (Arctic/coastal "Unorganized" territories especially — one Nunavut polygon
   had 3.5 million vertices). `ST_MakeValid`/`ST_CollectionExtract` on these can run for
   many minutes, and — critically — **a single PostGIS/GEOS call is not interruptible**:
   Postgres's `statement_timeout` cannot cancel a query stuck inside one long C function
   call; `pg_terminate_backend` only takes effect once that call returns. The practical
   fix used everywhere: tier inserts by `ST_NPoints(geom)` — bulk-batch the simple majority,
   insert medium-complexity shapes one at a time with a longer timeout, and either skip or
   `ST_SimplifyPreserveTopology` (before `ST_MakeValid`) anything above a cutoff. This
   exact logic is what `scripts/upload_boundary.py` (§7) automates.
4. **Long-lived single connections through Supabase's pooler can die silently** without the
   client (`psql`) noticing — a 30-minute single-statement `INSERT` once just hung forever
   with no error, while the server-side connection had already gone away. Prefer many
   short-lived connections (fresh `psql` invocation per batch) over one long transaction for
   any bulk operation.
5. **`map_shapes_id_seq` can fall behind the actual max id** (this table was originally
   bulk-loaded by some process that set explicit ids without advancing the sequence) —
   `SELECT setval('map_shapes_id_seq', (SELECT MAX(id) FROM map_shapes));` before any bulk
   insert avoids a primary-key collision.

---

## 7. `scripts/upload_boundary.py`

*Built this session, in response to the scale lessons above.* Zero Python dependencies
beyond the standard library — shells out to `ogr2ogr` and `psql` (both already required to
be on `PATH`), reading `DATABASE_URL` from the environment.

Does exactly what §6's "scale lessons" describe, packaged as a repeatable tool: reprojects
the source file to WGS84 into a staging table, prints a vertex-count distribution
(histogram + the N largest offenders by name), recommends and applies a `--vertex-cutoff`
(default 100,000), then loads in the same three-tier strategy (bulk/medium/skip) with live
per-batch terminal progress. **Resumable by construction** — every insert filters
`WHERE NOT EXISTS (... map_shapes WHERE upload_id = X AND code = ...)`, so re-running the
exact same command after an interruption just skips whatever already landed; no separate
state file needed, the database is the source of truth. `--analyze-only` runs the whole
report with zero writes.

```bash
python3 scripts/upload_boundary.py <file> --country Canada --type Municipal \
  --name-field CSDNAME --code-field CSDUID --analyze-only

python3 scripts/upload_boundary.py <file> --country Canada --type Municipal \
  --name "2021 Census Subdivisions" --name-field CSDNAME --code-field CSDUID

python3 scripts/upload_boundary.py <file> --country Canada --type Municipal \
  --resume <upload_id> --name-field CSDNAME --code-field CSDUID
```

This CLI tool remains the right fit specifically for rare, large, national-scale bulk loads
(hundreds of MB) — the browser can't handle that client-side regardless of UI polish, a file
that large would stall a tab before any upload UI mattered. §8 covers the equivalent
resumable flow built directly into the admin panel, for the realistic day-to-day case.

---

## 8. Admin-panel batch upload (histogram, cutoff, tiered insert, resume)

*Built this session. Migrations: `20260726000000_admin_batch_upload.sql`,
`20260726000001_backfill_completed_at.sql`.* Brings §7's logic into the browser so a regular
admin can do it through the website — for realistically-sized files (single-digit MB, low
thousands of features), not the CLI script's rare-huge-file niche (still out of scope here:
`shpjs` parsing itself would stall a tab on a 300MB+ file regardless of what happens after).

### Schema
- **`boundary_uploads.expected_count`**: set once, right after parsing+analysis, to the
  total feature count before any cutoff skip. Lets the panel show "743 / 5,161 loaded" for
  an in-progress or interrupted batch instead of a raw, context-free count.
- **`boundary_uploads.completed_at`**: set once the tiered insert loop finishes running
  through every tier — regardless of how many were skipped for exceeding the cutoff (a skip
  is an intentional, complete outcome, not an interruption). Any batch with `completed_at
  IS NULL` is what the panel's "Resume" affordance targets. **Existing batches from before
  this column existed were backfilled** (`completed_at = created_at` for any batch that
  already had shapes) so they don't show as falsely incomplete — any *new* migration adding
  a "such-and-such happened" timestamp column to an existing table needs the same
  backfill-on-add treatment, or old rows read as if that thing never happened.
- **`insert_map_shapes_batch(p_shapes jsonb)`** (new RPC): admin-gated like `insert_map_shape`,
  inserts a whole array of shapes in one round-trip via `jsonb_array_elements` — this is what
  makes the bulk tier fast (one network call per ~200 shapes instead of one per shape).
  Verified directly via an authenticated REST call during this session (bypassing the browser
  file-input limitation — see below): correctly inserts a batch, correctly rejects
  unauthenticated/non-admin callers.

### Frontend (`AdminPage.jsx`, `BoundaryUploadsPanel.jsx`)
Upload becomes two explicit steps instead of one:
1. **Analyze** (`handleAnalyze`) — parses the file exactly as before (`shpjs` for `.zip`,
   `JSON.parse` otherwise), but instead of inserting anything, computes a vertex count per
   feature via **`src/utils/countVertices.js`** (a pure function that walks
   `Polygon`/`MultiPolygon` coordinate arrays — the client-side equivalent of PostGIS's
   `ST_NPoints`, verified byte-exact against known geometries). Renders a bucketed histogram
   (same buckets as `upload_boundary.py`'s `analyze()`) plus an adjustable vertex-cutoff
   input with a live "N shapes will be skipped" list.
2. **Confirm Upload** (`handleConfirmUpload`) — tiers the analyzed features exactly like the
   CLI script: `<=5000` vertices bulk-batched via `insert_map_shapes_batch` (chunks of 200),
   `5000 < v <= cutoff` one at a time via the existing `insert_map_shape`, `> cutoff` skipped
   entirely. Sets `completed_at` on full completion.

**Resume**: `BoundaryUploadsPanel.jsx` shows an amber "Incomplete — N/expected" badge and a
Resume button for any batch with `completed_at IS NULL`. Clicking it (`handleResumeUpload`)
pre-fills country/type/upload-name/`resumeUploadId` and prompts the admin to re-select the
same source file — same resumability contract as the CLI script (nothing persists across a
closed tab; re-parsing the same file and filtering out already-present `code`s is what makes
continuing safe), just triggered through the UI. Verified directly: the badge and pre-fill
both render correctly against a simulated partial batch.

**Verification note for future sessions:** the browser automation available in this session
cannot programmatically select a file into a native `<input type="file">` — neither the
in-app browser pane nor `claude-in-chrome`'s `file_upload` tool (the latter is restricted to
files explicitly shared with the session; a scratchpad/temp path doesn't qualify). This means
the full click-through journey (choose file → Analyze → review histogram → Upload → watch
tiered progress) was **not** exercised end-to-end through the UI. What *was* verified
directly: `insert_map_shapes_batch` via a real authenticated REST call (correct insert,
correct admin rejection), `countVertices()` against known geometries including a real
6,001-vertex polygon, the `completed_at` backfill, and the resume badge/pre-fill behavior
against a simulated interrupted batch. The `handleAnalyze`/`handleConfirmUpload` wiring
itself was reviewed carefully but not click-tested — worth a manual pass by an actual admin
before depending on it heavily.

---

## 9. Pre-existing systems (context for the above, not built this session)

- **`PoliticianWall.jsx`** (`/wall/:ghostId[/:slug]`): a politician's public page — posts
  under `wall_ghost_id` (anyone can post/comment), `politician_supporters` table for a
  simple no-moderation "I support this politician" toggle. `CandidacyWall` (§5) is modeled
  directly on this component.
- **Admin boundary upload** (`AdminPage.jsx`, original): country/boundary-type selection
  (validated against `country_boundary_types`), file upload via `shpjs` (client-side
  shapefile→GeoJSON parsing) or raw GeoJSON, chunked RPC calls to `insert_map_shape`. This
  session extended it (upload naming/batching) rather than replacing it.
- **`UserPage.jsx`** ("Boundary Finder", `/explore`): public, no-login-required boundary
  search+map viewer. Its original inline list/search/map logic was extracted into the
  reusable `BoundaryPicker.jsx` this session (§4) — this page now just uses that component.
- **Feed post primitives**: `posts`, `comments`, `post_votes` (like/dislike, one vote per
  ghost ID per post via `vote_on_post()` RPC), `link_metadata` (jsonb, populated by
  `LinkPreview.jsx` client-side link unfurling), `video_url`/`image_url` (Supabase Storage).

---

## 10. Real data currently loaded (as of this session)

For `country = 'Canada'`:

| `boundary_type` | count | admin_only | source |
|---|---|---|---|
| `Province` | 13 | **yes** (§13) | StatsCan 2021 Cartographic Boundary File (`lpr_000b21a_e.shp`), simplified 1km before load |
| `Federal` | 352 | no | pre-existing (predates this session) |
| `Municipal` | 5,159 | no | Statistics Canada 2021 Census Subdivisions (`lcsd000b21a_e.shp`) — 2 of 5,161 skipped (Nunavut "Unorganized" remainder zones, 1.2M–3.5M vertices each) |
| `Provincial` | 761 | no | 12 of 13 provinces/territories — see §11 |
| `Advance Polling District` | 8,197 | no | Elections Canada `ADVPD_CA_2025_EN.shp` |

The original `POLLING DISTRICT` type (482 legacy shapes, partial/regional coverage,
predated batch tracking) was deliberately **deleted** (not retired — verified zero real
usage first) via the admin panel's "select by type" + `delete_shapes` path, at the user's
request, after determining a separate uploaded file (`ADVPD_CA_2025_EN`) was actually
Advance Polling District data, not municipal boundaries as initially assumed — always verify
a shapefile's actual attribute schema (`ogrinfo -so`) before trusting its filename or the
person supplying it. It's since been fully removed from `country_boundary_types` too (no
longer just orphaned).

`country_boundary_types` for Canada, current live state: `Province` (rank 1, `admin_only`),
`Federal` (rank 2), `Municipal` (rank 3), `Provincial` (rank 4), `Advance Polling District`
(rank 6 — rank 5 is a harmless gap, purely cosmetic per the "no enforced hierarchy" design
note above). Note `Province` outranking `Federal` has no citizen-facing effect since
`admin_only` types never become a membership or feed tab (§13) — rank only matters for
admin-panel list ordering here.

---

## 11. Provincial/territorial boundary data (Canada) + `upload_boundary.py` fixes

**The repeatable method for finding/downloading/uploading a new jurisdiction's boundary data
is written up as a standalone runbook**: [`docs/adding-boundary-data.md`](docs/adding-boundary-data.md)
— use it (not this section) when loading the next country/jurisdiction; this section is the
record of what was loaded and why, that doc is the *how*.

*Built in a second work session, same day.* Loaded provincial/territorial legislative
riding boundaries for **12 of Canada's 13 provinces/territories** (761 ridings total) under
the new `Provincial` boundary type (§10), using `scripts/upload_boundary.py` (§7) —
downloaded each jurisdiction's official current shapefile/GeoJSON directly from government
open-data portals (Elections Ontario, DataBC WFS, Elections Alberta, GIS Saskatchewan,
Elections Manitoba, Élections Québec, GeoNB, NS government GIS, PEI ArcGIS, Open Data NL,
Yukon Electoral District Boundaries Commission, NWT Centre for Geomatics).

| Jurisdiction | Ridings | Vintage |
|---|---|---|
| Ontario | 124 | 2022 |
| British Columbia | 93 | 2023 redistribution |
| Alberta | 87 | 2017 (still in force — 2026 redistribution not finalized as of this session) |
| Saskatchewan | 61 | 2022 |
| Manitoba | 57 | 2023 (dissolved from voting-area-level source data — see below) |
| Quebec | 127 | **2026 map** (took effect July 15, 2026, mid-way through this session's date) |
| New Brunswick | 49 | 2020 |
| Nova Scotia | 56 | ED2026 |
| PEI | 27 | current |
| Newfoundland & Labrador | 40 | current (2 Labrador ridings needed `--vertex-cutoff 500000`, up from default 100k) |
| Yukon | 21 | approved 2024 |
| Northwest Territories | 19 | 2023 |
| **Nunavut** | **0** | **no digital boundary data exists publicly** — Elections Nunavut's constituency map is a static image with a clickable-hotspot overlay, not a GIS layer. Checked: their own site, Nunavut government GIS resources, ArcGIS Online, the OpenNorth `represent-canada-data` GitHub aggregator, Open Government Portal. If this needs solving, the realistic path is hand-digitizing from Elections Nunavut's PDF maps or contacting them directly — no shortcut exists. |

**Manitoba needed a dissolve**: Elections Manitoba's public shapefile is voting-area
granularity (2,371 features), not riding-level. Ridings were produced with GDAL's SQLite
dialect: `ogr2ogr -f GeoJSON out.geojson in.shp -dialect sqlite -sql "SELECT EDNUM, EDNAMEEN,
ST_Union(geometry) AS geometry FROM layer GROUP BY EDNUM, EDNAMEEN"`.

### Two real bugs found and fixed in `scripts/upload_boundary.py` (§7)
1. **Code-field type mismatch**: `map_shapes.code` is `text`, but the script compared it
   against the source shapefile's code field with no cast (`ms.code IS NOT DISTINCT FROM
   s.{code_col}`) — fails with `operator does not exist: text = numeric` whenever the source
   code field is a numeric type (e.g. Ontario's `ED_ID`, an `Integer64`). This would have hit
   *every* province with a numeric code column. Fixed: `code_expr = f"s.{code_col}::text"`.
2. **Missing `expected_count`/`completed_at` tracking**: the CLI script never set these two
   columns (added in §8, after the script was first written), so every CLI-driven upload
   batch showed as permanently "Incomplete" in `BoundaryUploadsPanel` even after a clean
   finish. Fixed: `expected_count` set at batch-creation time, `completed_at` set at the end
   of the tiered-insert loop — mirrors the admin-panel upload flow's contract exactly. The
   one batch that ran before this fix (Ontario) was backfilled manually.

### `get_geojson_shapes()` RPC timeout — found this session, **fixed in a later session**
**`get_geojson_shapes()` RPC timed out on any single-shape lookup.** Defined (pre-existing,
`20260721000000_init_schema.sql`) with no arguments and no `WHERE` clause — computed
`ST_AsGeoJSON` for *every* row in `map_shapes` before either call site's PostgREST filter
(`.eq('id', ...)` / `.in('id', ...)`) was applied, because it's an opaque `plpgsql`
set-returning function, not something Postgres can push a predicate into. This almost
certainly worked fine when `map_shapes` was small (352 Federal rows) and broke silently once
Municipal/Advance Polling District/Provincial data pushed it past ~14,000 rows. **Practical
effect at the time: single-boundary map rendering was broken app-wide** — every
`BoundaryPicker.jsx` map view showed "No map data available. Please upload shapefiles."
regardless of what was actually loaded.

**Fixed** (migration `20260727000003_fix_get_geojson_shapes.sql`): `get_geojson_shapes` now
takes `ids bigint[] DEFAULT NULL` and filters `WHERE ids IS NULL OR ms.id = ANY(ids)`
server-side. Both `BoundaryPicker.jsx` call sites updated to pass `{ ids }` /
`{ ids: [id] }` as the RPC parameter instead of relying on a PostgREST-side
`.eq()`/`.in()` that the function was silently ignoring. Verified: direct REST call for a
single id now returns in ~1s instead of timing out; confirmed live in `/explore` that
selecting a boundary now renders its map instead of the "No map data" error.

---

## 12. Multi-country support

*Built in the second session, prompted by "make it truly multi-country, easy for admin —
we're building this for all countries."* Everything backend-side was already
country-agnostic in principle (`country` is free text throughout, no logic assumed Canada
specifically) — this work made the *admin experience* actually usable once a second country
has data, and fixed several places that silently assumed Canada.

### Schema — migration `20260727000000_countries_table.sql`
- **`countries`** (new): `name` (PK, matches the free-text values already used everywhere —
  **deliberately no data migration** on `map_shapes`/`country_boundary_types`/
  `boundary_uploads`/`profiles`, which all keep their existing `country` values as-is),
  `code` (ISO 3166-1 alpha-2, e.g. `'CA'`), `flag_emoji`. RLS: public read, admin write —
  same pattern as `country_boundary_types`. This is now the canonical list every admin
  country selector draws from, replacing free-text `<input list>` entry.
- **FK added**: `country_boundary_types.country` → `countries.name`. Safe to add immediately
  because that table is now fully admin-managed via a dropdown (no free text reaches it
  anymore). **Deliberately not** added to `map_shapes`/`boundary_uploads`/`profiles.country`
  yet — those are populated by user-facing flows and RPCs; revisit once `countries` has been
  live for a while.
- **`find_shapes_within`**: gained an optional trailing `p_country` param (backward
  compatible — existing 2-arg callers unaffected). Previously had *no* country awareness at
  all, so a container in one country and a same-named target type in another (e.g. both have
  "Municipal") could theoretically cross-match.
- **`find_boundaries_by_point`**: now joins `country_boundary_types` and `ORDER BY rank ASC`
  (added `rank` to the return columns — this changed the return type, so the function was
  dropped and recreated rather than `CREATE OR REPLACE`d). Needed so the frontend can
  reliably take "the country of the broadest/first matched boundary" as the user's country.

### Admin UX (`src/pages/AdminPage.jsx`, `Admin/BoundaryUploadsPanel.jsx`,
`Admin/RedistrictingPanel.jsx`, `Admin/ElectionsAdmin.jsx`)
- **`AdminPage.jsx`** gained a "Countries" section above "Boundary Types": add a country
  (name/ISO code/flag emoji), and an **"Add standard set" one-click preset** — when a
  country has zero registered boundary types, one click seeds `National`/rank 1,
  `State-Province`/rank 2, `Municipal`/rank 3, which the admin then renames/adjusts rather
  than filing three separate manual form submissions. The Boundary Types add-form's country
  field is now a `<select>` sourced from `countries` (was free text with a `<datalist>`).
- **Every admin surface that previously mixed all countries' boundaries into one flat/global
  list now scopes by country**: `BoundaryUploadsPanel` takes a `countryFilter` prop (country
  `<select>` lives in `AdminPage.jsx` above it); `RedistrictingPanel` and `ElectionsAdmin`
  each manage their own country `<select>` and use it to filter their "Focus Upload
  Batch"/"Select by Type"/"target boundary type" dropdowns and their `<BoundaryPicker>`
  calls (via the `countryFilter` prop that already existed on `BoundaryPicker.jsx` but was
  never wired up by any caller before this). The old `"Country||TypeName"`-fused-string
  dropdown pattern (used in both `RedistrictingPanel` and `ElectionsAdmin`) was removed
  entirely in favor of two linked selects — it was fragile (breaks if a type name ever
  contains `||`) and exactly what country-first UX should replace.
- `ElectionsAdmin`'s `handleFindMatching` now passes the selected country through as
  `find_shapes_within`'s new `p_country` arg.
- **`RedistrictingPanel` fetches its own `countries`/`boundaryTypes` once on mount** (a
  deliberate self-contained-component choice, unlike `BoundaryUploadsPanel` which is fed by
  a shared selector in `AdminPage.jsx`) — so `AdminPage.jsx` bumps a `redistrictingPanelKey`
  to force a remount/refetch whenever a country is added via `handleAddCountry`, or a
  newly-added country wouldn't show up there until a full page reload. Verified live
  (added a test country, confirmed it appeared in `RedistrictingPanel`'s dropdown with zero
  page reload).

### User-facing fixes
- **`OnboardingFlow.jsx`** no longer hardcodes `country: 'Canada'` on every signup. At
  submit, `country` is derived from `formData.matchedBoundaries[0]?.country` (now reliably
  the broadest match, thanks to `find_boundaries_by_point`'s new rank ordering above) —
  `null` (not a guess) if zero boundaries matched yet for that area.
- **`FeedPage.jsx`**'s "Country" pseudo-tab now hides itself (and the fetch guards against
  running) when `profile.country` is `null`, instead of silently querying nothing. The
  politician `locationDisplay` fallback was also null-guarded (would have shown literal
  `"null - <designation>"`).
- **`EditProfileFlow.jsx`** had a vestigial `country` form field: seeded from
  `initialData.country` but never actually saved by `handleSave`. Removed the dead state;
  `handleSave` now re-derives `country` from `formData.matchedBoundaries[0]?.country` the
  same way onboarding does, so it stays in sync if the user's location moves to a different
  country rather than trusting a stale/hand-edited value.
- **`UserPage.jsx`** (public `/explore`) gained an optional country `<select>` (defaults to
  "All countries", persisted per-tab in `sessionStorage`) wired into its `<BoundaryPicker>`
  — the same "13,832+ unscoped candidates" degradation from §4's `EAGER_LOAD_LIMIT=400` note
  applies here and gets strictly worse as more countries load in.

### Bugs found and fixed while building/verifying this (not pre-existing — introduced and
fixed within this same session)
- `RedistrictingPanel`'s "Select by Type" dropdown fell back to showing *all* countries'
  types unfiltered when no country was selected (only cosmetically hidden by the `disabled`
  attribute) — fixed the fallback to an empty array, matching the actual UX intent.
- See "`RedistrictingPanel` fetches its own `countries`..." above for the remount-key fix.

### Known unresolved issue found this session (flagged, not fixed — see §2)
Completing onboarding unconditionally overwrites `profiles.role` based on the onboarding UI
selection, clobbering any pre-set `'admin'` role (the one hardcoded exception is the literal
email `vmn2k4@gmail.com`). Hit live with the admin test account; fixed manually for that one
row via SQL. Real fix belongs in `OnboardingFlow.jsx`'s `submitOnboarding` — needs to check
the *existing* DB role before deciding what to write, not just trust the onboarding
selection.

### Explicitly out of scope / next steps
- No FK yet from `map_shapes`/`boundary_uploads`/`profiles.country` to `countries.name`.
- `StepLocation.jsx`'s free-text boundary search (onboarding) is still globally unscoped —
  fine at current (2-country) scale, revisit if it becomes a real UX problem.
- Per-country admin roles: confirmed unnecessary — every admin-gated RPC checks a single
  global `profiles.role = 'admin'`, no country column consulted anywhere in authorization.
- ~~Pending idea raised at end of session: `ElectionsAdmin.jsx`'s "Auto-select by container"
  step needs a Container Type filter~~ — **built, see §13**.

---

## 13. Admin-only boundary types + province/territory container data

*Built in a third work session, same day, following directly from §12's "pending idea."*

### The Container Type filter (built) revealed a real data gap
`ElectionsAdmin.jsx`'s "Auto-select by container" step gained a "Container Type" `<select>`
(reuses `BoundaryPicker.jsx`'s existing `boundaryTypeFilter` prop, populated from
`typesForSeatCountry` — the same list already driving the target-type dropdown), so the
container `BoundaryPicker` can be narrowed to one type before picking a container. Testing it
immediately surfaced the thing it was built to solve wasn't actually possible yet: filtering
to `Provincial` narrowed the container list to **761** candidates, not 13 — because
`Provincial` (§11) means individual *ridings* (e.g. "Abbotsford South"), not whole-province
outlines. There was no boundary type in `map_shapes` representing a province/territory as a
single shape, so "pick Ontario, then find every municipality inside it" had no valid
container to pick.

### Fix: load actual province/territory outlines — but *admin-only*
The user supplied StatsCan's official **"Provinces/Territories Cartographic Boundary File"**
(2021 Census vintage, `lpr_000b21a_e.shp` — same source family as the already-loaded
Municipal/Federal data), containing exactly 13 polygons (10 provinces + 3 territories).
Before uploading, a real product question had to be resolved first: `map_shapes` has no
concept of "this type is admin-tooling-only" — `sync_user_boundary_memberships` and the
`reconcile_shape_memberships` trigger (§4) match a user against **any** active boundary type
with zero filtering. Loading whole-province polygons as a normal boundary type would have
silently given every citizen a new "Ontario (Province)" feed tab and tagged it onto every
post — a real product change, not a side-effect-free admin tool. **Decision (explicit, asked
of the user): keep this admin-only.**

**Schema — migrations `20260727000001_admin_only_boundary_types.sql` +
`20260727000002_admin_only_reconcile_trigger.sql`:**
- **`country_boundary_types.admin_only`** (new, `boolean default false`). Canada's `Province`
  type is the only `true` row so far.
- **`sync_user_boundary_memberships`**: now joins `country_boundary_types` and excludes
  `admin_only` types from the membership INSERT.
- **`find_boundaries_by_point`**: same exclusion — so onboarding's "you belong to N groups"
  preview and the public Boundary Finder never imply a membership that sync wouldn't actually
  create.
- **`add_user_boundary_membership`** (the manual "search and add a jurisdiction" RPC): gained
  a server-side guard that rejects adding an `admin_only` shape as a membership, since a
  client could call it directly with any shape id regardless of what the search UI offers.
- **A real bug found and fixed during this**: `reconcile_shape_memberships()` — the `AFTER
  INSERT ON map_shapes` trigger that retroactively enrolls existing users when a new boundary
  is uploaded — was missed in the first pass. It has no knowledge of `admin_only` at all, so
  uploading the 13 province shapes silently auto-created 5 real memberships (for users whose
  stored `user_locations` point happened to fall inside one) via this trigger alone, bypassing
  every guard added above. Fixed the same way (join + exclude `admin_only`); the 5 erroneous
  rows were deleted as part of the same migration. **Lesson: `user_boundary_memberships` has
  two independent write paths — the explicit RPC and this trigger — any future membership-
  eligibility rule needs both updated together, not just the RPC that seems obviously
  relevant.**

**Data — `Province` boundary type, `Canada`, `admin_only = true`, 13 shapes:**
- Source file was 265 MB for only 13 features — StatsCan's cartographic boundary files retain
  full coastline detail even at province scale, and this was too large/complex for even
  `ogr2ogr`'s raw COPY into a staging table to complete (timed out before any vertex analysis
  was possible — a new failure mode, distinct from §6's "scale lessons" which all assume the
  data *loads* and then chokes on `ST_MakeValid`). **Fix: pre-simplify before handing the file
  to `upload_boundary.py`** — `ogr2ogr -f "ESRI Shapefile" out.shp in.shp -simplify 1000` (1km
  tolerance, applied in the source file's native metre CRS) brought it down to 13 MB in ~4
  minutes. Appropriate here specifically because this data is an admin container-selection
  aid (the pre-fill is always admin-reviewed before seats are created, per §5's design), not
  survey-grade boundary data — this simplification would *not* be appropriate for a boundary
  type that determines actual user membership. Even after simplifying, Nunavut/Ontario/BC
  still needed `--vertex-cutoff 300000` (up from the 100,000 default) and took ~3 minutes on
  the medium-complexity tier.
- **Verified end-to-end**: `find_shapes_within(<Ontario-id>, 'Municipal', 'Canada')` returns
  **624** — the actual "select every municipality in this province" workflow this was all
  built for. Confirmed zero memberships exist for any `Province` shape after upload.

### Known issue found this session (flagged, mitigated but not fully fixed)
**`BoundaryPicker.jsx`'s candidate/selected list has no virtualization.** Country-scoping
(§12) keeps the *candidate* list smaller, but once a bulk action like "Find Matching
Boundaries" selects several hundred shapes at once (624, in the Ontario-municipalities test),
or a picker's candidate set itself is just large, the browser tab visibly hangs for several
seconds re-rendering — confirmed via a stuck `computer` action, no console/server errors,
just a slow synchronous render of a very long unwindowed list.

This got meaningfully worse after §14's USA load (`map_shapes` grew from ~14,700 to ~54,700
rows): `UserPage.jsx`'s (`/explore`) country filter defaulted to "All countries," so the
picker hung the tab on page load itself, not just on a large bulk-select.

**Mitigated**: `UserPage.jsx` now defaults to a specific country (the first one alphabetically
— currently `Canada`) instead of "All countries" on a visitor's first visit, while still
respecting an explicit later choice (including deliberately picking "All countries" again).
This avoids the worst case, but **does not fix the underlying issue** — verified live that
even a single country's candidate list (Canada alone, 14,482 rows, type-unscoped) still
visibly hangs the tab for a few seconds on render. `RedistrictingPanel`/`ElectionsAdmin` are
unaffected by any of this since their country selects have no "all countries" default and
their candidate lists are naturally smaller once a type filter is also applied. **The real
fix is still list virtualization** (e.g. `react-window`) for `BoundaryPicker`'s list column —
not done this session.

---

## 14. Second country: USA (Federal / State Senate / State House / Municipal)

*Built in a fourth work session, same day, directly following §§11–13's multi-country work.*

### The big simplification: Census Cartographic Boundary Files are national, not per-state
Unlike Canada (§11 — 12 separate provincial/territorial government portals, no consolidated
source), the US Census Bureau publishes **"Cartographic Boundary Files"** (`cb_*`, distinct
from the more detailed per-state `tl_*` TIGER/Line files) as **single national shapefiles**
for every layer needed here. Confirmed by listing `https://www2.census.gov/geo/tiger/GENZ2024/shp/`
directly rather than guessing from memory — this collapsed what could have been ~150
per-state downloads into 4.

| `boundary_type` | Source file | Features | Vintage |
|---|---|---|---|
| `Federal` | `cb_2024_us_cd119_500k.zip` | 441 | 119th Congress |
| `State Senate` | `cb_2024_us_sldu_500k.zip` | 1,960 | 2024 |
| `State House` | `cb_2024_us_sldl_500k.zip` | 4,874 | 2024 |
| `Municipal` | `cb_2024_us_place_500k.zip` | 32,612 | 2024 |

All four loaded via `scripts/upload_boundary.py` directly with no pre-simplification needed
(unlike Canada's Province outlines, §13) — the Census `cb_*` files are already generalized to
1:500,000 resolution, median vertex counts were low (30–811 depending on layer), and only
Congressional District's Alaska at-large seat needed a raised `--vertex-cutoff` (150,000).
**0 invalid geometries across all four batches, exact expected counts loaded in every case.**

### Two decisions made with the user before loading (see `docs/adding-boundary-data.md`)
- **State legislatures are bicameral** (except Nebraska) — Senate (`SLDU`) and House (`SLDL`)
  districts are geometrically different, overlapping layers, unlike Canada's single-chamber
  provincial legislatures. Loaded as two separate boundary types, `State Senate` and
  `State House` (both normal, not `admin_only` — citizens get separate feed tabs for each,
  matching how Federal/Provincial work today).
- **Municipal uses `Place` only** (incorporated cities/towns/villages + census-designated
  places, ~32,600 nationally), not `County Subdivision` (~35,000+ townships/MCDs, more
  relevant in New England/Midwest). Direct parallel to how Canada's `Municipal` type used
  StatsCan Census Subdivisions. `County Subdivision` was deliberately skipped to avoid two
  overlapping "municipal" layers covering the same area — not loaded, could be added later
  as a distinct type if needed.
- **Name field**: `NAMELSAD` for Federal/State Senate/State House (bare `NAME` on those layers
  is just a number like `"19"` — ambiguous without the office name Census's own `NAMELSAD`
  provides, e.g. `"State Senate District 19"`, `"Assembly District 28"` — note this correctly
  captures each state's real terminology, e.g. New York calls its lower chamber "Assembly,"
  not "House"). `NAME` for `Municipal` (cleaner plain city name; `NAMELSAD` there adds a legal
  suffix like `"city"`/`"town"`).

### Registered: `countries` row + 4 `country_boundary_types` rows
```sql
INSERT INTO countries (name, code, flag_emoji) VALUES ('USA', 'US', '🇺🇸');
-- USA: Federal(1), State Senate(2), State House(3), Municipal(4) — none admin_only
```

### Verified
`SELECT ... FROM find_boundaries_by_point(40.7580, -73.9855)` (Times Square-area Manhattan)
correctly returned, in rank order: `Congressional District 12`, `State Senate District 28`,
`Assembly District 75`, `New York` — confirming the multi-boundary membership system (§4),
rank ordering (§12), and country scoping all generalize correctly to a second country exactly
as designed, with zero USA-specific code changes required anywhere in the app.

---

## 15. File map

```
supabase/migrations/
  20260721*.sql                          pre-existing: profiles, posts, comments, votes,
                                          politician_profiles/supporters, map_shapes (orig)
  20260723000000_multi_boundary_memberships.sql   §4
  20260724000000_election_mode.sql                §5
  20260724000001_public_politician_profiles.sql   §5 (RLS fix)
  20260725000000_boundary_lifecycle.sql           §6
  20260725000001_stable_pagination_order.sql      §6 (ordering fix)
  20260725000002_delete_shapes.sql                §6
  20260726000000_admin_batch_upload.sql           §8
  20260726000001_backfill_completed_at.sql        §8 (backfill for pre-existing batches)
  20260727000000_countries_table.sql              §12 (countries table, FK, RPC changes)
  20260727000001_admin_only_boundary_types.sql    §13 (admin_only column + RPC guards)
  20260727000002_admin_only_reconcile_trigger.sql §13 (reconcile_shape_memberships fix)
  20260727000003_fix_get_geojson_shapes.sql       §11's timeout bug, actually fixed here

src/
  components/
    map/BoundaryPicker.jsx      §4 — reusable list+search+map picker (countryFilter/
                                 boundaryTypeFilter props now actually wired up, §12) +
                                 get_geojson_shapes calls fixed to pass ids server-side
    map/MapComponent.jsx        §4 — Leaflet render layer (extended for click-select)
    CandidacyWall.jsx           §5
    LinkPreview.jsx             pre-existing
    PoliticianSidebar.jsx       pre-existing (updated to use user_boundary_memberships)
  pages/
    AdminPage.jsx                    boundary types + upload form (§8 analyze/tiered-upload
                                      flow) + Countries section / Add Country / standard-set
                                      preset (§12)
    Admin/ElectionsAdmin.jsx         §5 + country-scoped seat building (§12) +
                                      Container Type filter (§13)
    Admin/BoundaryUploadsPanel.jsx   §6 (batch list) + §8 (incomplete badge/resume) +
                                      countryFilter prop (§12)
    Admin/RedistrictingPanel.jsx     §6 + self-contained country scoping (§12)
    FeedPage/FeedPage.jsx            §4 — dynamic membership tabs; Country tab null-safe (§12)
    PoliticianElections.jsx          §5
    ElectionsPage.jsx                §5
    PoliticianWall.jsx               pre-existing
    UserPage.jsx                     pre-existing (refactored onto BoundaryPicker) +
                                      optional country filter (§12), defaults to a specific
                                      country instead of "All" (§13's perf issue, mitigated)
    Onboarding/OnboardingFlow.jsx    country now derived, not hardcoded (§12)
    Onboarding/StepLocation.jsx      §4 (shared: onboarding + profile edit)
    Onboarding/StepPolitician.jsx    §5 (added education/hometown fields)
    Profile/EditProfileFlow.jsx      dead country field fixed to re-derive+save (§12)
  utils/
    fetchAllPages.js             §6 — pagination helper, use for any large map_shapes query
    countVertices.js             §8 — client-side vertex counter (ST_NPoints equivalent)

scripts/
  upload_boundary.py            §7 — two bugs fixed in second session, see §11

docs/
  adding-boundary-data.md       §11 — repeatable runbook for loading a new jurisdiction's
                                 boundary data (source-finding method + worked example)

.claude/
  settings.json                 project-level permission allowlist (curl/python/git/grep/
                                 find/npm/node prefix rules) — separate from this doc's
                                 subject matter, noted here so it isn't mistaken for stray config
```
