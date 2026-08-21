# Choseno — Architecture Reference

This document exists so a future session (human or Claude) can pick this project back up
without re-deriving context. It covers what existed before this working session, everything
built during it, how it's designed, and known gaps that were flagged but intentionally left
unfixed. Written 2026-07-23, updated same day across four further work sessions (§§11–15), again
2026-07-24 (§17), again 2026-07-25 across a sixth session (§§18–22), across several later
sessions through 2026-07-29 (§§23–26), again 2026-07-30 (§27), twice more on
2026-08-02 (§28, §29), 2026-08-03 (§30, a documentation-only backfill), and twice more on
2026-08-04 (§31 — the Next.js migration cutover, a post-migration parity/SEO audit-and-fix
pass, and debug-persona tooling; §32 — the onboarding/edit-profile flow, reported directly
against the debug personas built in §31), and again 2026-08-14 (Canada `School District`
boundary type — see bottom of file).

---

## 1. What Choseno is

An anonymous civic social platform. Users post under a rotating "ghost ID" (not their real
identity), and every post is automatically scoped to the real electoral/administrative
boundaries (federal riding, municipality, etc.) the poster's location falls inside — so
conversation is naturally local, without anyone's real identity or address ever being exposed
in the product surface.

**Stack (current, post-migration):** Next.js 16 (App Router) + React 19 + TypeScript,
Tailwind v4, `react-leaflet` + `@turf/turf` for maps, `shpjs` for client-side shapefile
parsing, Supabase (Postgres 17 + PostGIS) for backend/auth/storage. The repo root **is** the
Next.js app now — the original Vite `src/` tree described throughout most of this document
(`.jsx` files, `react-router`) was deleted at migration cutover; every `.jsx` filename cited
below (`FeedPage.jsx`, `ElectionsAdmin.jsx`, etc.) is historical and maps to a `.tsx`
equivalent under `src/app/` or `src/components/features/` today — see §31 for the mapping
and for what changed in the port itself. No server code beyond Postgres functions (RPCs) and
a couple of Supabase Edge Functions (`send-claim-invite`, `fetch-candidates`) — the client
(now split into Server and Client Components) talks to Supabase directly via `supabase-js`,
gated by Row Level Security (RLS) policies and `SECURITY DEFINER` functions. This
RPC/RLS-centric backend design is *why* the Next.js port was mechanical rather than a
rewrite: no API routes were needed, every service-layer function just moved from a
`.js`/Vite-env-var file to an equivalent `.ts` file reading `NEXT_PUBLIC_*` vars instead.

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
  guarantee the whole product is built around. **Gotcha, found and fixed in §27:** this
  function was described here (and called by `feed.js`) for sessions, but never actually
  existed in the database — every burn attempt silently failed. See §27.
- Auth: Supabase email/password. `AuthContext.jsx` self-heals a missing `profiles` row on
  first login and auto-promotes the hardcoded admin email (`vmn2k4@gmail.com`) to
  `role='admin'`.

**Formerly-flagged issue, resolved by deletion in §27:** `FeedPage.jsx`'s `silentExportData()`
used to write a file linking the real `profile.id` to `current_ghost_id` plus full
post/comment history into a `user_exports` storage bucket, on every post/comment — a
deanonymization risk (bucket RLS allowed any authenticated user to read any file in it),
non-functional in practice only because the bucket never existed. It was deleted outright
(not fixed) once its actual purpose came up directly with the user — see §27's civic score
writeup for the privacy-preserving replacement (a single running score integer, no
post-id-to-profile mapping stored anywhere).

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

## 15. Boundary Visualizer + two hard-won RPC performance fixes

*Built in a fifth work session, same day.* New admin tab: pick a country, optionally narrow
to a container (e.g. one province), pick a target boundary type, and see every matching
boundary rendered on a map — read-only, no selection, no editing. Directly reuses the
container/target-type pattern already built for `ElectionsAdmin.jsx`'s seat-building flow
(`find_shapes_within`), just for display instead of seat creation.

### Files
- **`src/pages/Admin/BoundaryVisualizer.jsx`** (new): country → container-type → container
  (`BoundaryPicker mode="single"`) → target-type → "Visualize". A **500-shape render cap**
  (checked via a count *before* fetching any geometry) shows a plain name list with a "Load
  Map Anyway" opt-in instead of silently trying to fetch/render a huge geometry payload —
  same spirit as `BoundaryPicker`'s existing `EAGER_LOAD_LIMIT` warning.
- **`src/components/AdminSubNav.jsx`** (new): the "Boundaries / Elections" tab bar was
  independently hardcoded in both `AdminPage.jsx` and `ElectionsAdmin.jsx` — extracted to a
  shared component (now Boundaries/Elections/Visualizer) rather than duplicating a third time.
- **`src/App.jsx`**: `admin/visualize` added as a flat sibling route, same
  `ProtectedRoute requireAdmin` pattern as the other two admin routes.
- **`src/components/map/MapComponent.jsx`**: real performance work, not cosmetic — added
  `preferCanvas` to `MapContainer` (canvas rendering instead of one SVG DOM node per polygon),
  extracted a memoized `BoundaryLayer` sub-component (`React.memo` + `useMemo`'d style/
  eventHandlers — most effective for the Visualizer's read-only case, where `onShapeClick` is
  always `undefined` so memoization actually holds across re-renders), and fixed
  `AutoFitBounds`'s `useEffect` to key off a stable joined-id string instead of the raw
  `boundaries` array reference (callers like `BoundaryPicker` recreate that array via
  `.filter()` every render even when contents haven't changed, causing redundant
  `turf.bbox` recomputation). Benefits every existing `BoundaryPicker` caller, not just the
  new Visualizer.

### Two RPC performance bugs found and fixed — both looked like "just add an index" problems and weren't
Testing the Visualizer against a real province (Ontario, 622 municipalities inside it)
immediately timed out in ways that didn't reproduce in an interactive `psql` session — both
turned out to be genuine bugs, not environmental flakiness, found by comparing `EXPLAIN
ANALYZE` plans and REST-vs-psql timing side by side.

**1. `find_shapes_within` timed out through PostgREST** (anon: 3s / authenticated: 8s
`statement_timeout`) **even though the identical query ran in ~0.5s over a warm psql
session.** Root cause: the container geometry (Canada's `Province` outlines, §13 — up to
279,418 vertices for Nunavut) forced a full-precision `ST_Intersects` test against ~8,600
bbox-overlapping candidates every call. Tried and **rejected**: simplifying the container
geometry *inline* in the query (via a CTE, or wrapping `container.geom` in
`ST_Simplify(...)` directly in the `WHERE` clause) — both approaches broke the planner's
GiST index pushdown entirely, falling back to a full sequential scan that was **slower**
than the unsimplified original. The only fix that preserved the working index-based plan
was simplifying the **stored** geometry once (migration `20260727000004_simplify_province_
containers.sql`): plain `ST_Simplify` (not `ST_SimplifyPreserveTopology` — confirmed the
topology-preserving variant barely reduced vertex count at all, since it refuses to collapse
the thousands of small lake/coastal islands that dominate these provinces' vertex counts) at
0.02° (~2km) tolerance, repaired via `ST_MakeValid` + `ST_CollectionExtract(...,3)` (same
pattern `scripts/upload_boundary.py` already uses). Ontario: 161,272 → 1,733 vertices, area
preserved to within 0.01%, fully valid. **This is a precision tradeoff only appropriate
because `Province` is `admin_only`** (§13) — never shown to citizens, never determines a
real membership, always admin-reviewed before use (Ontario's matched-municipality count
shifted by 2, from 624 to 622, as a direct result — acceptable for this use case, would not
be for a boundary type citizens actually belong to).
- Also note: the first call after the bulk geometry `UPDATE` took 11s even via warm psql
  (cold buffer cache), settling to ~0.4–1.3s on repeat — expect one slow query after any
  large geometry `UPDATE`, not a regression.

**2. `get_geojson_shapes` (the id-filtering fix from §11) hit a *second*, different timeout**
bulk-fetching geometry for real municipality sets, again passing fine in `psql` (~450ms) but
failing consistently through PostgREST. Root cause, confirmed by testing 10/50/100/150-id
subsets of the same set: **not** shape count — a small minority of outlier geometries (26 of
622 Ontario municipalities, ~4%, StatsCan "Unorganized"/rural subdivisions with complex
coastlines — the same pattern as the Arctic territories in §6) inflated the total
`ST_AsGeoJSON` payload from a few MB to 59MB, and *that* (not raw query time) is what
PostgREST/the pooler couldn't handle in budget. Tried and **rejected**: simplifying every
requested geometry uniformly (`ST_SimplifyPreserveTopology` on all 622 took 20+ seconds —
expensive per-geometry, and wasted on the 96% that were already simple). Fix (migration
`20260727000005_simplify_geojson_outliers.sql`): only simplify geometries over 5,000
vertices (matches `scripts/upload_boundary.py`'s own "medium complexity" tier boundary) using
plain `ST_Simplify` at 0.005° (~500m — coarser than the container fix above is fine here
since this only affects on-screen *display*, repaired the same `ST_MakeValid`+
`ST_CollectionExtract` way. Ontario's full 622-shape set went from a consistent timeout to
15.6MB / ~5s, well inside the authenticated role's 8s budget (654ms of that is actual query
time; the rest is response transfer). **This changes what every caller of
`get_geojson_shapes` receives** (`BoundaryPicker.jsx`'s individual-shape fetches too, not
just the Visualizer's bulk ones) — judged acceptable because this RPC only ever feeds map
*display*, never a real boundary/membership decision (those query `map_shapes.geom`
directly via `find_boundaries_by_point`/`find_shapes_within`/`sync_user_boundary_
memberships`, all untouched by this migration).

**General lesson for future sessions**: if a query is fast in an interactive `psql` session
but times out through the app/PostgREST, don't assume it's cold-cache flakiness without
testing — subset the input to binary-search for a size/complexity threshold (as done for
both bugs above) before concluding it's environmental. Both of these looked identical to
"just PgBouncer connection pooling being slow" at first and were something else entirely.

### Verified
Ontario container + `Municipal` target correctly identified 622 real municipalities
(down from the pre-fix 624, per the documented precision tradeoff above) via the live UI;
500-shape cap correctly triggered with the exact matched count; "Load Map Anyway" correctly
rendered all 622 on the map (confirmed via DOM inspection — canvas rendering active, only a
handful of actual DOM nodes for 622 shapes, confirming `preferCanvas` is working as intended)
with no console/server errors. The large, visually striking colored regions on the resulting
map are genuine — verified directly against the *original, untouched* source data that
"Kenora, Unorganized" and "Division No. 23, Unorganized" really are single StatsCan census
subdivisions covering vast, sparsely-populated areas of Northern Ontario, not a rendering bug.

---

## 16. Election role catalog, region-correct seat creation, and Feed notifications

Built to answer: what elected positions actually exist per boundary level/country (Federal
MP, Provincial MLA — or MPP/MNA/MHA depending on province, Municipal Mayor/Councillor, USA's
equivalents plus statewide Governor/US Senator), and to let citizens learn an election in
their area has gone live without manually checking `/elections`.

**Role catalog — `election_role_types`** (new table, `20260728000000_election_role_types.sql`):
`(country, boundary_type, role_key, region_override, role_title)`, `FOREIGN KEY (country,
boundary_type) REFERENCES country_boundary_types(country, type_name)`. `region_override` uses
`''` (empty string) as the "default for this country+boundary_type" sentinel, not `NULL` —
Postgres unique indexes treat every `NULL` as distinct, which would've silently allowed
duplicate default rows. `election_seats.role_title` itself is unchanged (still a plain
string, no FK) — the catalog only pre-fills `ElectionsAdmin.jsx`'s seat-creation UI. Seeded:
Canada Federal→MP, Provincial→MLA (Ontario→MPP, Quebec→MNA, Newfoundland and
Labrador→MHA), Municipal→Mayor+Councillor; USA Federal→U.S. Representative, State
Senate→State Senator, State House→State Representative, Municipal→Mayor+Council Member,
State→Governor+U.S. Senator. School trustee elections were explicitly scoped out for both
countries (no national school-board boundary dataset for Canada; skipped for USA too, for
consistency, even though Census does publish one).

**Per-shape region resolution — `resolve_region_names(p_shape_ids bigint[], p_country text)`**
(`20260728000001_resolve_region_names.sql`): given a batch of shapes, resolves which
admin_only container (Province/State) each one spatially falls inside via `ST_Contains`. This
exists because the *first* design draft resolved region from whichever single container the
admin picked in the UI for the whole batch — wrong, because `ElectionsAdmin.jsx`'s seat-
building flow lets an admin freely mix `find_shapes_within` results with manually-searched
additions from a different region in one create action. A Plan-agent validation pass caught
this before implementation. Verified in practice, not just in theory: building Ontario
Provincial seats via `find_shapes_within` (whose *container* geometry is deliberately
simplified per §15) pulled in a few real near-border ridings that actually beIong to Quebec;
`resolve_region_names`'s per-shape resolution correctly labeled those MNA rather than
blindly stamping the whole batch MPP — the exact class of bug the redesign was meant to
prevent, caught live during verification, not hypothesized.

**USA "State" admin_only boundary** (`20260728000003_usa_state_boundary_type.sql` + data
load + `20260728000004_simplify_state_containers.sql`): mirrors Canada's `Province` pattern
(§13) — needed because Governor/US Senator are statewide offices. Source: Census cartographic
boundary "state" file, 20m (lowest-detail) tier, filtered to the 50 states only (Census ships
56: 50 states + DC + 5 territories; DC/territories have different offices — Delegate/Resident
Commissioner, not Governor/Senators — so were deliberately excluded, same "skip rather than
half-support" call as school trustees). **Alaska crosses the antimeridian** (raw X-extent
-179.17 to 179.77) — confirmed via a direct coordinate check before upload, fixed with
`ogr2ogr -wrapdateline -datelineoffset 10` (splits the Aleutian tail into properly-bounded
MultiPolygon parts instead of one ring spanning almost the whole globe). Simplified
unconditionally post-load (`ST_Simplify(0.02)` + repair), not conditionally — Canada's
Province layer already needed a second simplify pass after an insufficient upload-time one
(§15), no reason to wait and rediscover that here. Result: 50 rows, all valid.

**Two more `find_shapes_within` performance bugs found and fixed while verifying this
feature** (same symptom pattern as §15's — fast via direct `psql`/`EXPLAIN ANALYZE`, but
consistently timing out through PostgREST):
- **Wide return type forced full-row materialization.** `find_shapes_within` returned `SETOF
  map_shapes` (every column, including raw `geom`+`properties`), even though every caller
  only ever chains `.select('id')` or `.select('id,name,code')` afterward. PostgREST
  materializes a set-returning function's result before projecting the caller's requested
  columns (needed for correctness with VOLATILE functions in general), which forced Postgres
  to fully construct/detoast every column of every matched row regardless of what was
  actually asked for — confirmed by testing a throwaway narrow-return variant side by side:
  it succeeded via PostgREST in under 1.5s where the wide version consistently timed out.
  Fixed in `20260728000006_narrow_find_shapes_within.sql` by narrowing the function's own
  return type to `TABLE(id bigint, name text, code text)` (dropped and recreated, since
  Postgres can't `CREATE OR REPLACE` across a return-type change; also dropped a stale,
  unused 2-arg overload left over from before `p_country` was added, which still returned the
  old wide type). `ElectionsAdmin.jsx`'s `handleFindMatching` was also missing the
  `.select('id')` narrowing entirely (unlike `BoundaryVisualizer.jsx`, which already had it) —
  fixed alongside.
- **No index supported `boundary_type`+`country` filtering.** `map_shapes` (54k+ rows across
  10 boundary-type/country combinations, all in one table) only had a plain GiST index on
  `geom`. For a container like Ontario, whose bounding box overlaps thousands of shapes across
  every type and both countries, `idx_map_shapes_geom` alone returned every nearby shape
  regardless of type before `boundary_type`/`country` were applied as a plain post-hoc filter
  — for Provincial-riding targets specifically (unsimplified, real electoral geometry, unlike
  Municipal shapes) this meant evaluating expensive `ST_Intersects` against ~8500 candidates
  to find ~130 real matches: 1.68s execution (`EXPLAIN ANALYZE`), well past PostgREST's role
  timeouts once connection/serialization overhead is added. Fixed in
  `20260728000007_map_shapes_type_country_index.sql`: a partial btree index on `(boundary_type,
  country) WHERE retired_at IS NULL`, letting Postgres combine it with the GiST index via
  `BitmapAnd` — candidates dropped from 8558 to 761 pre-filter, execution time from 1.68s to
  ~30ms warm / ~900ms cold (single backend not yet holding the plan).
- **General lesson reconfirmed**: even after both fixes, the *very first* PostgREST call
  against a given backend connection for a not-yet-touched `(container, target_type)`
  combination still reliably fails once (matches §15's documented cold-cache pattern) before
  succeeding on retry — this is a property of Supabase's connection pool, not a bug in either
  fix. Don't treat a single PostgREST timeout as proof of a broken query; retry once before
  investigating further, but don't stop at "retrying fixed it" either — as this session
  showed, that can mask a real, fixable bug (both issues above were genuine and are now fixed,
  not just retried around).

**Bulk-selected shapes never got a map preview** (`BoundaryPicker.jsx`): a pre-existing gap
unrelated to the above — `handleFindMatching`-style bulk mutations to `selectedIds` (setting
the whole `Set` at once, not via the component's own `toggle()`) never triggered the
per-shape lazy geometry fetch, so any selection above `EAGER_LOAD_LIMIT` (400) showed a plain
checkbox list with zero map, even after geometry-fetching succeeded. Fixed with an effect that
bulk-fetches geometry (one `get_geojson_shapes` call) for whatever's selected but missing it,
capped at `SELECTED_GEO_FETCH_CAP = 500` (mirrors `BoundaryVisualizer`'s `RENDER_CAP`) — above
that, stays list-only by design, same as before. Benefits every caller (`ElectionsAdmin.jsx`,
`RedistrictingPanel.jsx`, `UserPage.jsx`), not just this feature.

**`ElectionsAdmin.jsx` seat-creation rework**: the free-text `roleTitle` input is gone,
replaced with a checkbox list sourced from `election_role_types` (filtered by
`{country: seatCountry, boundary_type: targetType}`, showing each `role_key`'s *default*
title — per-seat resolution happens at creation time via `resolve_region_names`, not from the
checkbox labels). `handleCreateSeats` now loops `pendingShapeIds × selectedRoleKeys`,
inserting one `election_seats` row per pair with the resolved title — multiple roles per
shape was already schema-legal (`UNIQUE(election_id, map_shape_id, role_title)`) but never
exercised by the old single-role-title UI. Switching `targetType` now resets both
`pendingShapeIds` and `selectedRoleKeys` (previously only `seatCountry` changes cascaded,
leaving a stale selection from a different boundary type in place).

**Feed notification**: `election_notification_dismissals` (own-row RLS, `profile_id +
election_id` PK) + `get_active_elections_for_user()` (`20260728000002_...sql`) — joins
`elections` (status='active') → `election_seats` → `user_boundary_memberships` for
`auth.uid()`, excluding already-dismissed elections. **No `SECURITY DEFINER`**: every table
touched is already RLS-scoped to exactly what the function needs (`elections`/
`election_seats` already allow public read of non-draft rows; `user_boundary_memberships` and
the dismissals table both already restrict to `auth.uid()`), so plain invoker mode returns
identical results and can't be walked to leak another user's data if the query is ever
extended later without an explicit `auth.uid()` filter — same posture as `find_shapes_within`.
`FeedPage.jsx` calls it once on mount alongside the existing `fetchMemberships()`, renders one
dismissible amber card per active election (same inline styling convention already used
elsewhere in that file), dismiss inserts into the dismissals table. In-app banner only — no
push/email, per explicit scope decision (nothing like that exists anywhere in this app yet).

Verified end-to-end in the browser with real (then cleaned-up) test data: role-catalog
checkboxes render correct titles per country+type; a mixed Ontario/Quebec seat-creation batch
produced correctly-per-shape titles (123 MPP, 11 MNA for border ridings `find_shapes_within`
had over-included, 1 MLA default-fallback, 1 explicitly-added MNA — not one uniform title
across the batch); the Feed banner appeared for a real active election + matching membership
and stayed gone after dismiss + reload; USA State load is exactly 50 valid rows.

## 17. File map

*Migrations `20260728000008` through `20260729000005` below existed on disk but had never been written up in this doc before §21's session — backfilled here for completeness, one line each rather than a full retroactive narrative.*

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
  20260727000004_simplify_province_containers.sql §15 (stored-geometry fix for find_shapes_within)
  20260727000005_simplify_geojson_outliers.sql    §15 (selective simplify for get_geojson_shapes)
  20260728000000_election_role_types.sql          §16 (role catalog table + FK + seed data)
  20260728000001_resolve_region_names.sql         §16 (per-shape region resolution RPC)
  20260728000002_election_notification_dismissals.sql  §16 (dismissals table + Feed RPC)
  20260728000003_usa_state_boundary_type.sql      §16 (admin_only State type for USA)
  20260728000004_simplify_state_containers.sql    §16 (unconditional simplify, USA State)
  20260728000005_election_role_types_usa_state.sql §16 (Governor/US Senator seed rows)
  20260728000006_narrow_find_shapes_within.sql    §16 (return-type fix, PostgREST timeout)
  20260728000007_map_shapes_type_country_index.sql §16 (composite index, same timeout family)
  20260728000008_fix_find_shapes_within_containment.sql  ST_Intersects falsely matched shapes
                                                   merely touching the container's border;
                                                   tightened to a real area-ratio containment test
  20260728000009_shape_containers_cache.sql       precomputed shape_containers cache table so
                                                   admin tools don't redo the live geometry join
                                                   from §28000008 on every request
  20260728000010_optimize_shape_containers_recompute.sql  fixed a timeout in the cache's own
                                                   backfill (same ST_Area(ST_Intersection(...))
                                                   planner pathology as §28000008, one query later)
  20260728000011_find_shapes_in_containers.sql    cache-backed, multi-container replacement for
                                                   calling find_shapes_within live from the frontend
  20260728000012_political_parties.sql            political_parties table (admin-managed,
                                                   country-scoped) replaces politician_profiles'
                                                   old free-text party field
  20260729000000_storage_buckets.sql              storage.buckets was completely empty in this
                                                   project — post-images/politician_videos buckets
                                                   actually created (every upload had been silently
                                                   failing until this)
  20260729000001_election_questionnaire.sql       admin-configured per-election candidate
                                                   questionnaire (election_questions/_options/
                                                   _candidate_answers)
  20260729000002_candidate_applications.sql       turned self-nomination into a real
                                                   application/approval workflow (status pending/
                                                   approved/rejected) — this gate is what §21 removes
  20260729000003_nominations_open_through_election_date.sql  apply_for_seat accepts
                                                   nominations_open and active, not just the former
  20260729000004_public_read_shape_containers.sql public SELECT on the shape_containers cache
  20260729000005_find_open_seats_in_container.sql find_open_seats_in_container RPC backing
                                                   PoliticianElections.jsx's "browse a different area"
  20260729000006_widen_get_active_elections_for_user.sql  §18 (Feed pills go per-seat, not
                                                   per-election; includes nominations_open)
  20260729000007_election_administrators.sql      §21 (election_administrators table + RPCs)
  20260729000008_unregistered_candidates.sql      §21 (add/update/remove_unregistered_candidate)
  20260729000009_fix_submit_candidate_application.sql  §21 (auto-approve on submit + guard trigger)
  20260729000010_fix_candidate_status_guard_null_bypass.sql  §21 (bug found + fixed during
                                                   verification — the guard trigger was a no-op)

src/
  components/
    AdminSubNav.jsx              §15 — shared Boundaries/Elections/Visualizer/Election Admins
                                 tab bar (4th tab added §21)
    wall/WallPostFeed.jsx       §18 — shared post-card + owner-pinned-first comment thread +
                                 comment composer, used by both PoliticianWall and CandidacyWall
                                 so they're actually the same wall, not two lookalikes
    map/BoundaryPicker.jsx      §4 — reusable list+search+map picker (countryFilter/
                                 boundaryTypeFilter props now actually wired up, §12) +
                                 get_geojson_shapes calls fixed to pass ids server-side +
                                 bulk-fetches geometry for externally-set selectedIds (§16)
    map/MapComponent.jsx        §4 — Leaflet render layer (extended for click-select) +
                                 preferCanvas, memoized BoundaryLayer, stable-key
                                 AutoFitBounds (§15 — perf fixes, benefit every caller)
    CandidacyWall.jsx           §5 — rebuilt on WallPostFeed (§18): owner-pinned comments,
                                 support button, campaign video gallery, wide 2-column sticky-
                                 profile layout, candidateId/embedded props for inline embedding;
                                 §21 added the nomination-filed badge + owner toggle
    LinkPreview.jsx             pre-existing
    PoliticianSidebar.jsx       §22 design-centralization pass: migrated onto ui/ primitives,
                                 and its direct `supabase.from()` call moved into a new
                                 `getInterestedPoliticians()` in `services/profile.js` — closes
                                 the standing service-layer violation noted in §20
  pages/
    AdminPage.jsx                    boundary types + upload form (§8 analyze/tiered-upload
                                      flow) + Countries section / Add Country / standard-set
                                      preset (§12) + AdminSubNav (§15)
    Admin/ElectionsAdmin.jsx         §5 + country-scoped seat building (§12) +
                                      Container Type filter (§13) + AdminSubNav (§15) +
                                      role-catalog checkboxes + resolve_region_names (§16) +
                                      §21 removed the now-redundant per-candidate Approve button
    Admin/ElectionAdminApplications.jsx  §21 — new site-admin review queue for election-
                                      administrator applications
    Admin/BoundaryVisualizer.jsx     §15 — new admin tab, container+type -> map visualization
    Admin/BoundaryUploadsPanel.jsx   §6 (batch list) + §8 (incomplete badge/resume) +
                                      countryFilter prop (§12)
    Admin/RedistrictingPanel.jsx     §6 + self-contained country scoping (§12)
    FeedPage/FeedPage.jsx            §4 — dynamic membership tabs; Country tab null-safe (§12) +
                                      §18 replaced the single dismissible election banner with a
                                      row of per-seat pills (one per matching open seat)
    ElectionSeatPage.jsx             §18 — new page, route `elections/seat/:seatId`: seat header,
                                      candidate avatar switcher embedding CandidacyWall, nominate-
                                      yourself flow; §21 added the volunteer-as-election-admin
                                      banner and the add-unregistered-candidate form
    PoliticianElections.jsx          §5 + §21 added a "My Election-Administrator Applications"
                                      section alongside the existing "My Candidacies"
    ElectionsPage.jsx                §5 — §18 simplified seat cards to link into
                                      ElectionSeatPage instead of listing candidates inline
    PoliticianWall.jsx               pre-existing — §18 rebuilt on WallPostFeed (behavior
                                      unchanged); still has a direct `supabase.channel()`/
                                      `removeChannel()` realtime subscription, see §20
    Onboarding/OnboardingFlow.jsx    country now derived, not hardcoded (§12) + §19 removed the
                                      redundant `min-h-screen bg-background` wrapper that was
                                      painting a solid black box over the app's real gradient
    Onboarding/StepLocation.jsx      §4 (shared: onboarding + profile edit)
    Onboarding/StepPolitician.jsx    §5 (added education/hometown fields)
    Onboarding/StepRole.jsx          §19 — responsive padding/sizing pass (was desktop-only)
    Profile/EditProfileFlow.jsx      dead country field fixed to re-derive+save (§12)
    ProfilePage.jsx                  §19 — added a one-click "Switch to Citizen Account" button
                                      (politicians previously had no way back except the full
                                      multi-step Edit Profile wizard). §27 removed this button
                                      again — downgrading is now blocked outright.
    CandidateApplication.jsx         §21 — success copy now reflects auto-approval (and the
                                      resubmit-after-rejection edge case) instead of "an admin
                                      will review it soon"
  utils/
    fetchAllPages.js             §6 — pagination helper, use for any large map_shapes query
    countVertices.js             §8 — client-side vertex counter (ST_NPoints equivalent)

contexts/
  AuthContext.jsx                §19 — fixed a real bug: `loading` flipped to false on the
                                 first (signed-out) resolution and never reset, so a fresh
                                 sign-in's profile fetch raced against AuthPage's
                                 navigate-on-session-truthy and ProtectedRoute would redirect to
                                 /onboarding on every sign-in regardless of the account's actual
                                 onboarding_completed value. Now re-arms `loading` for each fresh
                                 session's profile fetch; also stopped hiding all children while
                                 loading (relies on ProtectedRoute's own spinner instead)

scripts/
  upload_boundary.py            §7 — two bugs fixed in second session, see §11

docs/
  adding-boundary-data.md       §11 — repeatable runbook for loading a new jurisdiction's
                                 boundary data (source-finding method + worked example)

.claude/
  settings.json                 project-level permission allowlist (curl/python/git/grep/
                                 find/npm/node prefix rules) — separate from this doc's
                                 subject matter, noted here so it isn't mistaken for stray config

Removed:
  src/pages/UserPage.jsx        §19 — the public "Boundary Finder" (/explore) page, its nav
                                 link, and its homepage CTA were removed at the user's request.
                                 BoundaryPicker.jsx and the boundaries.js service functions it
                                 used are untouched (still used elsewhere).
```

---

## 18. Feed + Election pages redesign: seat-scoped pages, one shared candidate/politician wall

*Built in a sixth work session, same day.* Prompted by hand-drawn sketches: the Feed should surface active elections as a row of pills instead of one generic banner, and clicking through should land on a page where a seat's candidates appear as a switcher — selecting one loads their statement/Q&A/videos/discussion inline, with self-nomination available right there. Separately, `CandidacyWall.jsx` (a candidate's election page) and `PoliticianWall.jsx` (a politician's own public wall) had drifted into two near-identical implementations; the ask was to make them demonstrably the same wall.

**`get_active_elections_for_user()`** (`20260729000006`) widened from one aggregated row per *election* to one row per *seat* (`seat_id, election_id, election_name, election_date, role_title`), and its status filter widened from `= 'active'` to `IN ('nominations_open', 'active')` so citizens can discover — and a politician can self-nominate for — a seat before an admin flips the election fully active. Return-type change meant drop+recreate, not `CREATE OR REPLACE` (same precedent as `20260728000006`).

**`src/components/wall/WallPostFeed.jsx`** (new): the post-card + owner-pinned-first comment thread + comment composer, extracted out of `PoliticianWall.jsx` (which already had this pin-to-top behavior) and reused by `CandidacyWall.jsx` (which didn't — it had no comment UI at all before this). Pure presentational component: takes `posts`, an `ownerGhostId` (for the pin-to-top sort and the owner badge), and comment input state/handlers as props; does not call any service itself, per the Components-layer rule. Both walls now render this component — that's what actually makes them the same wall rather than two lookalikes.

**`CandidacyWall.jsx`** rebuilt: added the comment thread (via `WallPostFeed`), a support button (reusing `politicianWall.js`'s existing `politician_supporters` functions, keyed on `candidate.politician_id`), and a campaign-video gallery (the required intro video from the application step, plus the candidate's own later video posts — no new schema, both already live on existing rows). Also gained `candidateId`/`embedded` props so it can be rendered standalone at `/candidacy/:id` or embedded inline elsewhere. Layout changed from a single `max-w-3xl` centered column to a wide `max-w-6xl` two-column grid — a sticky left profile column (header, support, video gallery, Q&A) beside a right column for the composer and feed, the classic profile+feed split, so it actually uses a wide screen instead of a narrow centered strip with empty margins on both sides.

**`src/pages/ElectionSeatPage.jsx`** (new page, route `elections/seat/:seatId`): seat/election header, a candidate avatar-switcher row (only shown once a seat has more than one candidate), and a role-gated nominate-yourself section mirroring the citizen/politician banners already established on `ElectionsPage.jsx`. Selecting a candidate renders `<CandidacyWall candidateId={selected} embedded />` below — same component, same width, no separate "seat page wall" implementation.

**`ElectionsPage.jsx`** simplified: each seat card is now a summary (role, boundary, candidate count) linking into `ElectionSeatPage` instead of listing every candidate inline — the seat page now owns candidate browsing, so this page stopped duplicating it.

**`FeedPage.jsx`**: the single dismissible banner replaced with a row of pills, one per seat row from the widened RPC (label `${role_title} · ${election_date}`), each linking to its `ElectionSeatPage`. Dismissing any pill still calls the same `dismissElectionNotification(profile.id, election_id)` — dismissal stays election-scoped, so dismissing one pill hides every pill sharing that election (an accepted simplification, not a bug).

Verified end-to-end with disposable test accounts across desktop/tablet/mobile widths: pills render and dismiss correctly, the seat page's candidate switcher and embedded wall work, self-nomination's RPC→navigate flow lands on `/apply/:id` correctly, comments post and the candidate's own reply correctly sorts above an earlier citizen comment even when posted later, and `/wall/:ghostId` is unchanged after the `WallPostFeed` extraction.

## 19. Sign-in race condition, Boundary Finder removal, role-switch button, onboarding visuals

*Same session, smaller fixes bundled together.*

**AuthContext sign-in bug (real, reproducible, not cosmetic)**: `loading` started `true` and flipped to `false` the first time it resolved (typically on the signed-out landing page, where `fetchProfile` short-circuits immediately since there's no user id) — and then never reset. On an actual sign-in, `onAuthStateChange` fires with the new session and starts a fresh `fetchOrHealProfile` round-trip, but `AuthPage.jsx`'s own `useEffect` navigates to `/feed` the instant `session` becomes truthy, well before that fetch resolves. Since `loading` was already `false` from the earlier resolution, `ProtectedRoute` rendered immediately with the *previous* (`null`) profile and redirected to `/onboarding` — on every single sign-in, regardless of the account's real `onboarding_completed` value (confirmed `true` in the DB the whole time for the account that reported this). Fixed by re-arming `loading` for the duration of each fresh session's profile fetch, and by no longer hiding all of `children` while loading (relied on `ProtectedRoute`'s own spinner instead, avoiding a full-app blank flash on every sign-in). Verified: a test account with `onboarding_completed = true` now lands directly on `/feed` after signing in, no redirect.

**Boundary Finder removed** at the user's request: deleted `src/pages/UserPage.jsx`, its `/explore` route, its `MainLayout.jsx` nav link, and its "Explore boundaries" homepage CTA. `BoundaryPicker.jsx` and the `boundaries.js` service functions it used (`getCountries`, `findBoundariesByPoint`) are untouched — still used by `StepLocation.jsx` and the various admin panels.

**Politician → Citizen role switching**: turned out to already work end-to-end via the existing multi-step Edit Profile wizard (`EditProfileFlow.jsx`'s Account Type toggle) — verified live, no backend bug. The actual gap was discoverability: citizens see "Become a Politician" prompts throughout the Elections pages, but politicians had no equivalent one-click way back. Added a "Switch to Citizen Account" button directly on `ProfilePage.jsx`'s Political Details card — one click (with a confirmation prompt) flips the role while preserving the existing name/country/constituency, no need to re-enter location or step through the wizard. **Reversed in §27**: this whole direction turned out to be wrong on reflection — a politician profile accumulates real state (candidacies, a public wall, supporters) that a downgrade would orphan, so the product decision became "politicians can never downgrade," not "make downgrading easier." Both this button and `EditProfileFlow`'s ability to pick Citizen for an existing politician were removed, backstopped by a database trigger.

**Onboarding visuals**: `OnboardingFlow.jsx` wrapped itself in its own `min-h-screen bg-background` div — a solid, flat near-black rectangle that didn't match the app's actual radial-gradient background (which every other page, like the auth screen, just lets show through from `body`). Replaced with the same translucent/backdrop-blurred card style used elsewhere. `StepRole.jsx` (the role-selection first step) also got a responsive pass — smaller heading/padding/icon sizes below the `sm` breakpoint, cards stack instead of a fixed two-column grid on narrow screens.

---

## 20. Roles & Permissions Reference

Four roles exist. Three are `profiles.role` values (`CHECK (role IN ('normal', 'politician', 'admin'))`); the fourth — Election Administrator — is deliberately **not** a role value at all, it's a permission grant (a row in `election_administrators`, §21) layered on top of whichever role an account already has, scoped to exactly one election seat. This was an explicit product decision: the request was for election administrators to keep their ordinary citizen/politician feed and everything else, which only works cleanly as an additive grant, not a fourth mutually-exclusive role.

### Citizen (`role = 'normal'`) — the default

- Posts/comments/votes under a rotating anonymous ghost ID (`current_ghost_id`); can burn it any time via `burn_ghost_identity()` to sever all links to past activity (§3).
- Earns a `civic_score` (§27) from posts/comments/votes received — 10/post, 5/comment, ±1 per like/dislike on their own posts — banked permanently into `profiles.civic_score` at burn time so it survives across ghost identities. Shown on `FeedPage.jsx` and `ProfilePage.jsx`, recalculated on demand via `calculate_my_score()`.
- Feed scoped to their boundary memberships (municipal/federal/provincial/etc., from `user_boundary_memberships`) plus fixed Country/International tabs.
- Can support politicians and candidates ("I Support", `politician_supporters`).
- Can discuss/comment on any politician's wall or any election candidate's page.
- Can volunteer to be the Election Administrator for any seat (§21) — this is open to citizens, not politician-gated.
- To self-nominate for a seat, must first switch to the Politician account type (`ProfilePage.jsx` → Edit Profile) — there's no separate "citizen nominates directly" path. **One-way as of §27**: once switched to Politician, there is no way back (see below).
- Cannot: manage boundary data, review candidate or election-administrator applications, or do anything gated by `role = 'admin'`.

### Politician (`role = 'politician'`)

- Everything a citizen can do, plus:
- A public wall (`/wall/:ghostId`) — post updates and (recorded in-browser) video pitches; citizens can visit, comment, and support them there. Wall content and any candidacy page's content are now provably the same feed, not two lookalikes (§27, closing the gap §18 only partially closed by sharing `WallPostFeed.jsx` — the two pages still queried disjoint post sets under the hood until §27).
- Can self-nominate for any open seat (`apply_for_seat` → `CandidateApplication.jsx` → `submit_candidate_application`) — submitting now makes the candidacy immediately public, no site-admin approval needed (§21; the site admin can still reject a live candidacy afterward as a moderation action).
- Once a candidate, gets a candidacy page (`/candidacy/:id`) — the *same* wall component as their personal wall (§18), scoped to that specific race, with a self-editable "Nomination Papers Filed" status (§21) they're expected to keep current as the real-world filing fact it represents (distinct from the platform's own approval status).
- **Cannot switch back to Citizen, as of §27.** A politician profile accumulates real state (candidacies, a public wall, supporters) a downgrade would orphan — blocked at the database (`guard_politician_role_downgrade` trigger on `profiles`), not just hidden in the UI. Superseded §19's one-click "Switch to Citizen Account" button, which is gone.

### Election Administrator (a grant, not a role) — new in §21

- Any citizen or politician can volunteer to administer one specific seat, via the banner on that seat's `ElectionSeatPage.jsx`.
- Approved either by the site admin, or automatically 48 hours after applying if the site admin hasn't acted — first applicant wins; only one approved administrator can exist per seat at a time (a DB-level partial unique index, not just application logic).
- Once approved for a seat, can add a candidate who is running in real life but hasn't registered on the platform — just a name and party. This creates a real candidate row with the full wall experience (citizens can discuss, comment, support) behind a synthetic profile that has no login — nobody can post as that candidate, since nobody is logged in as them.
- Can hand an unclaimed stub candidacy to its real owner (§28): email them a one-time claim-invite link, or review/approve a citizen's own "this is me" self-request on that stub's wall. A site admin can do the same for any seat, without needing to be its approved administrator — same dual-permission shape as adding a stub in the first place.
- The grant is per-seat: being approved for one seat gives no standing on any other seat.
- Keeps their existing citizen/politician feed, wall, and everything else unchanged — this is additive capability, not a role switch.
- Cannot: review applications for other seats, act as site admin, or override a site admin's decision.

### Site Admin (`role = 'admin'`)

- The hardcoded email (`vmn2k4@gmail.com`) auto-promotes on first login; any other account is promoted manually via SQL.
- Manages electoral boundary data end to end: upload, redistrict (retire, never mutate), delete (only where safe), country/boundary-type configuration (§6–§16).
- Manages elections: create them, build seats (auto-select by container or manual multi-select), configure the candidate questionnaire, advance election status through its lifecycle (draft → nominations_open → active → closed).
- Reviews election-administrator applications (`Admin/ElectionAdminApplications.jsx`, §21) — though most resolve on their own after 48 hours if left untouched.
- Can reject a live candidate's application as a moderation action, even though self-nomination itself no longer needs their sign-off to go public first.
- Manages political parties and countries.
- Does **not** belong to a specific constituency feed — `FeedPage.jsx` shows an "Admin Account" notice instead of a normal feed for this role, since an admin account has no boundary membership of its own.

### Known gap, not addressed here

`OnboardingFlow.jsx`'s `submitOnboarding` still unconditionally overwrites `profiles.role` from the onboarding UI's selection on every completion — flagged in §2/§12, still true, still not fixed. An admin (or an election administrator, by extension) who ever runs through onboarding again would silently lose that status. Out of scope for §21; noted here since this section is the natural place someone would look for it. **Narrower as of §27**: the politician-specific case (a politician re-onboarding and picking Citizen) is now caught — `guard_politician_role_downgrade` blocks the resulting `UPDATE` at the database regardless of which code path attempts it — but the admin-demotion case above is untouched, since `guard_politician_role_downgrade` only fires on `OLD.role = 'politician'`, not `'admin'`.

---

## 21. Election Administrators, no-approval self-nomination, and nomination-filed status

*Built in the same sixth session, directly after §18–19.* Two related requests: let a citizen or politician volunteer to moderate one specific seat and add real-world candidates who haven't registered on the platform (so citizens aren't missing races that actually have candidates), and remove the admin-approval gate on self-nomination entirely (§16/`20260729000002`'s workflow — submitting should make a candidate immediately public). Plus a small third piece: a self-editable "have I actually filed my nomination papers" status, distinct from and shown alongside the platform's own status.

Design confirmed with the user before building: election-administrator scope is **per seat**, not per whole election; the 48-hour auto-approval is a genuine delay (not instant), implemented as a lazy sweep run from inside the handful of RPCs that read/act on the table rather than a `pg_cron` job — no scheduler to manage, and the state is always correct by the time anything actually needs it; admin-added candidates get the **full** candidate wall, not a stripped-down info card, so `CandidacyWall.jsx`/`WallPostFeed.jsx` needed zero changes to support them.

**`election_administrators`** (`20260729000007`): `seat_id, profile_id, status (pending/approved/rejected), motivation, social_media_info, contact_email, submitted_at, reviewed_at, reviewed_by`, `UNIQUE(seat_id, profile_id)`, plus a **partial unique index** `(seat_id) WHERE status = 'approved'` making "one admin per seat" a hard DB invariant rather than something only application logic enforces — closes a real race a validation pass caught (two stale pending applications for the same seat both becoming eligible for auto-promotion at once). No public SELECT policy (motivation/contact email/social-media info are real PII); a dedicated `get_seat_admin_status(seat_id)` RPC returns just `(has_approved_admin, my_application_status)` for the frontend instead. `apply_for_election_admin` blocks reapplying after an explicit rejection (raises, rather than silently letting a rejected applicant wait out the clock) and blocks applying to a seat that already has an approved admin. `review_election_admin_application` (site-admin only) auto-rejects any other pending applicants for the same seat when one is approved.

**`election_candidates` additions** (`20260729000008`): `nomination_filed boolean default false` (self-editable through the same pre-existing "Candidates update own application" policy `updateCandidateStatement` already relies on — no new RPC), `added_by_election_admin_id uuid references profiles(id)` (provenance marker, and the flag that identifies an unclaimed/stub candidacy — a future "claim this candidacy" flow is a natural next step but explicitly out of scope here). `add_unregistered_candidate(seat_id, full_name, party_id, education, hometown, bio)` (SECURITY DEFINER): checks the caller has an approved `election_administrators` row for that seat, validates the party's country matches the seat's, then creates a synthetic `profiles` row (`role='politician'`, a freshly generated `current_ghost_id`, `target_boundary_id`/`target_boundary_type` deliberately left `NULL` so the stub never shows up in `PoliticianSidebar.jsx`'s "People Interested in Politics" query) + a `politician_profiles` row + the `election_candidates` row itself (`status='approved'` immediately). No `auth.users` row is created or needed — `profiles.id` has had no FK to `auth.users` since `20260721000001_drop_fk.sql`, and nothing in `CandidacyWall.jsx`/`WallPostFeed.jsx` assumes one exists; `isOwner` is simply always `false` for a stub candidate, which is exactly correct (nobody can post as them, citizens can still discuss/comment/support). `update_unregistered_candidate`/`remove_unregistered_candidate` are scoped to `added_by_election_admin_id = auth.uid()`, covering the likely "typo in the name" case.

**Two real bugs found and fixed during this work, not just the intended feature:**

1. **A logic bug in the auto-approve-on-submit change itself**: `CandidateApplication.jsx` already supports editing and resubmitting after a first submission. Making `submit_candidate_application` unconditionally set `status = 'approved'` would silently undo an explicit site-admin rejection the next time the candidate resubmits. Fixed with a conditional (`CASE WHEN status = 'rejected' THEN status ELSE 'approved' END`) — verified live: rejected a test candidacy as the site admin, resubmitted it as the candidate, confirmed status stayed `rejected` rather than flipping back.
2. **The guard trigger was a no-op** (`20260729000010`, found during the same verification pass): the trigger blocking direct client changes to `status`/`reviewed_at`/`reviewed_by` compared `current_setting('app.bypass_candidate_status_guard', true)` directly to `'true'` — but when that setting has never been set in a session (the overwhelmingly common case), `current_setting(..., true)` returns `NULL`, `NULL = 'true'` is `NULL`, and PL/pgSQL's `IF NOT (NULL) THEN` treats a `NULL` condition as false, so the exception branch was never entered for anyone. Confirmed directly: a raw `UPDATE election_candidates SET status = 'rejected'` with no admin role and no bypass flag succeeded when it should have been blocked. Fixed by coalescing the missing-setting `NULL` to `'false'` before comparing, then re-verified the same raw update now correctly raises `Cannot modify candidate status directly`, while the legitimate admin-reject path (`reviewCandidateApplication`, which checks `role='admin'`) still works unchanged. This guard matters more than it would have before §21: with admin review no longer gating initial visibility at all, it was the only thing stopping a candidate from directly setting their own `status` to `approved` and skipping the video/questionnaire checklist `submit_candidate_application` enforces.

**Frontend**: `ElectionSeatPage.jsx` gained an "Election Administrator" banner (apply / pending / seat-already-taken / approved-with-add-candidate-form states) and a checkmark badge per candidate chip; `PoliticianElections.jsx` lists "My Election-Administrator Applications" alongside "My Candidacies" (this route already has no role restriction beyond a session, matching that either a citizen or politician can apply); new `Admin/ElectionAdminApplications.jsx` mirrors `ElectionsAdmin.jsx`'s list/approve/reject visual pattern for the site-admin review queue, wired into a 4th `AdminSubNav` tab; `ElectionsAdmin.jsx` dropped the now-redundant per-candidate Approve button (submissions auto-approve now) but kept Reject for moderation; `CandidacyWall.jsx` shows the nomination-filed badge to everyone with an owner-only toggle.

Verified end-to-end with disposable test accounts: applied and confirmed the pending state; backdated `submitted_at` past 48 hours and confirmed the next page load auto-promoted it; added an unregistered candidate and confirmed a second citizen could comment on and support them with the composer/video-record affordances correctly absent (no real account behind the candidate); confirmed a second application to the same seat is correctly refused; self-nominated, submitted, confirmed immediate public visibility, then walked through the reject → resubmit → stays-rejected sequence above; toggled nomination-filed and confirmed it persisted. All test data cleaned up afterward.

### Service-layer compliance check (requested directly — full audit, not just this session's new code)

Every file touched or added in §18–21 goes through `src/services/**` exclusively — no page or component in this session's work calls `supabase.from/.rpc/.storage/.auth` directly. A full-codebase grep for direct `supabase` usage in `src/pages/**` and `src/components/**` turned up three pre-existing spots, none introduced by this session's work:

- **`src/components/PoliticianSidebar.jsx`** — **Fixed in §22.** Previously called `supabase.from('politician_profiles')` directly; the query now lives in `getInterestedPoliticians()` in `services/profile.js`, and the component just calls that.
- **`src/pages/PoliticianWall.jsx`** — **Fixed in §22.** Previously called `supabase.channel(...)`/`supabase.removeChannel(...)` directly for a realtime subscription on `politician_supporters` changes; now `subscribeToSupportChanges()`/`unsubscribeFromSupportChanges()` in `politicianWall.js`.
- **`src/components/map/MapComponent.jsx`** — imports `supabase` but never actually calls it; a dead import, not a functional violation. Still not fixed — cheap to remove whenever this file is next edited.

## 22. App-wide design centralization: `src/components/ui/` primitives + responsive/modern polish pass

*Built in the same session, directly after §21, in response to a direct request to "improve each and every screen," make everything "more responsive and modern," and "ensure all pages are using centralized theme colors, components and fonts... so that we can control look and feel from one place."*

**Starting diagnosis**: colors and fonts were already centralized — Tailwind v4's `@theme` block in `src/index.css` (`--color-surface`, `--color-primary`, `--font-sans`, `--font-display`, etc.) is the single source every page already drew from; nothing needed to change there. The actual gap, found via a thorough audit before any code was written, was component-level: cards, buttons, badges, inputs, spinners, and empty states were each hand-rolled independently in every one of the app's ~20 pages and ~14 shared components, with constant small drift — at least 12 different "card" recipes (opacity/border/radius/shadow all varying independently), 7+ button variants including a real 3-way contrast bug (primary-button text alternating between `text-slate-950`/`text-white`/`text-surface` against the same pale-yellow primary token), and no consistent empty-state or loading-spinner pattern anywhere (admin panels had plain unanimated "Loading..." text).

**Phase 1 — built `src/components/ui/`** (barrel-exported from `index.js`), nine small presentational-only primitives, each collapsing the variants the audit found into one prop API: `Card` (`variant`: default/hero/composer/row/dashed; `padding`: none/sm/md/lg; `interactive` hover state; `as` prop for polymorphic rendering, e.g. `as="form"`/`as="button"`/`as="a"`), `Button` (`variant`: primary/secondary/outline/danger/ghost/icon; standardizes primary-button text on `text-slate-950`, fixing the contrast bug above — a third occurrence of the same bug was found and fixed in `VideoRecorder.jsx`'s "Attach to Post" button during the sweep, beyond the two already known from the audit), `Badge` (`tone`/`shape`/`size`/`icon`), `Input`/`Textarea`/`Select` (one consistent surface/border/radius recipe, with a focus ring — `focus:ring-4 focus:ring-primary/10` — applied everywhere; previously only `AuthPage` had visible keyboard-focus styling), `Spinner` (`size`, `fullPage`), `EmptyState` (icon circle + title + description + action slot — genuinely new, no icon-based empty state existed anywhere before), `PageHeader` (icon + title + subtitle + action slot, `size="hero"` variant).

**Phase 2 — migrated every page and shared component onto the new primitives**, one file-group at a time: `HomePage`/`AuthPage`, `FeedPage`, `ElectionsPage`/`ElectionSeatPage`, `CandidacyWall`/`wall/WallPostFeed`, `PoliticianWall`, `PoliticianElections`/`CandidateApplication`, `ProfilePage`/`Profile/EditProfileFlow`, all 5 `Onboarding/Step*` files, `AdminPage`, `Admin/ElectionsAdmin`/`Admin/ElectionAdminApplications`, `Admin/BoundaryUploadsPanel`/`Admin/BoundaryVisualizer`/`Admin/RedistrictingPanel`, and `AdminSubNav`/`PoliticianSidebar`/`LinkPreview`/`map/BoundaryPicker`/`video/VideoRecorder`. `HomePage.jsx` was deliberately left unmigrated onto the generic `Card` — on inspection it already had its own bespoke, appropriately distinct marketing-page treatment (hero/reveal animations, `.glass-card` CSS class, proper responsive breakpoints), and forcing it onto the interior-page `Card` recipe would have made the landing page *less* distinctive, not more consistent. Every other file's data/logic was left untouched — this was a styling-only sweep.

**Concrete bugs fixed along the way** (found during the sweep itself, not a separate pass):
1. `text-text-main0` (not a real design token — a typo for `text-text-muted`) — found in **three** places, not the two the original audit caught: `FeedPage.jsx`, `PoliticianWall.jsx` (both already known), plus a third occurrence in `LinkPreview.jsx` found only while migrating it.
2. `AdminPage.jsx`'s two `grid-cols-2` sections (Country/ISO/Flag country-form row, Name/Rank boundary-type row, upload form's Country/Boundary-Type and Name/Code-attribute rows) and `EditProfileFlow.jsx`'s `StepBasicInfo` role-selector grid → all `grid-cols-1 sm:grid-cols-2`, matching `Onboarding/StepRole.jsx`'s already-correct version of the identical citizen/politician selector UI.
3. `BoundaryVisualizer.jsx`'s fixed `height: '600px'` map wrapper and `AdminPage.jsx`'s fixed `h-[650px]` boundary-list panel → `h-[70vh] max-h-[…px] min-h-[…px]`, viewport-relative with sane caps instead of a constant that didn't adapt to the actual screen.
4. `FeedPage.jsx`'s `hidden lg:block` sidebar → `w-full lg:w-80`, so `PoliticianSidebar` now stacks below the feed on mobile/tablet instead of vanishing outright below the `lg` breakpoint (verified live at 375px width — see below).
5. `PoliticianWall.jsx`'s QR-code popover, previously `group-hover`-only (unreachable on touch devices) → a `useState` toggle + click handler, so it opens on tap.
6. `AdminSubNav.jsx`'s tab row → `flex-wrap` (verified live at 375px: 4 tabs now wrap onto two rows instead of overflowing the viewport).
7. `BoundaryPicker.jsx`'s `height` prop was applied identically to both the list and map columns even when the responsive grid stacks them into one column below `md` — doubling the total scroll height on a phone. Fixed with a `MOBILE_HEIGHT` constant (`260px`) applied via a CSS custom property (`h-[var(--picker-mobile-h)] md:h-[var(--picker-h)]`), so the stacked-mobile layout gets a capped height and only grows to the caller's requested height once the columns actually split.

**Also closed, opportunistically, since the files were already open for this pass** (previously flagged in §21's service-layer compliance check as known-but-deferred violations): `PoliticianSidebar.jsx`'s direct `supabase.from('politician_profiles')` query moved into a new `getInterestedPoliticians()` in `services/profile.js`; `PoliticianWall.jsx`'s direct `supabase.channel()`/`removeChannel()` realtime subscription moved into `subscribeToSupportChanges()`/`unsubscribeFromSupportChanges()` in `politicianWall.js`. `map/MapComponent.jsx`'s dead `supabase` import remains unfixed — genuinely out of scope for a styling pass, not touched.

**Verification**: `npx oxlint src/` run after every file group and once at the end — zero new warnings introduced by this pass (a handful of pre-existing unrelated warnings, e.g. unused `Loader2`/`CheckCircle` imports and a couple of `exhaustive-deps` hints, were confirmed pre-existing by checking they weren't on lines this pass touched). Every `<Card>`/`</Card>` (and similar) tag pair was grep-counted balanced after each file's edits. Live-verified in the browser, logged in as the standing admin test account (`vmn2k4+admintest@gmail.com`): `AuthPage`, `FeedPage` (both logged-out and logged-in), `ElectionsPage`, `Admin/ElectionsAdmin` (list view and an election's detail view with the questionnaire card), `Admin/ElectionAdminApplications`, `Admin/BoundaryVisualizer`, and `ProfilePage`'s admin-locked view all rendered correctly with no console errors; the `FeedPage` sidebar-stacking fix and `AdminSubNav` tab-wrap fix were specifically re-checked at a 375px mobile viewport width and confirmed working as designed.

None of these block anything — they're noted here so a future session doesn't mistake "found during a compliance check" for "introduced by §18–21," and doesn't need to re-discover them from scratch.

## 23. US Senate/Governor candidate sync + reversing the 'State' admin_only decision

*Built in a later session, following on from the US House candidate-fetch work (`fetchUsFederal` in `supabase/functions/fetch-candidates/index.ts`, see `docs/ELECTION_DATA_SOURCES.md`).*

**US Senate candidate fetch wired in**: `fetchUsSenate` added alongside `fetchUsFederal`, sharing a new `fetchFecCandidates(office, state, district?)` helper (both are plain FEC OpenFEC queries differing only in whether `district` is set). Senate and Governor seats both attach to the same `'State'` `boundary_type` map_shape, so a map_shape alone can't tell them apart — `detectJurisdiction` (both the Edge Function's and `candidateSync.js`'s copies) now also takes the seat's `role_title` and only returns `'us-senate'` when it's exactly `'U.S. Senator'`; a `'Governor'` seat on the identical shape correctly falls through to `unsupported` (no data source exists for that office). The Edge Function's seat query now selects `role_title` alongside `map_shapes` for exactly this reason.

**Discovered while wiring this in: Governor/Senator seats couldn't actually be created at all.** `election_role_types` had carried `('USA','State','governor',...)` and `('USA','State','us_senator',...)` rows since §16, but `ElectionsAdmin.jsx`'s seat-creation UI filtered `targetTypeOptions` to `!t.admin_only` — and `'State'` was `admin_only=true` (added in §16 specifically *because* Governor/Senator needed a boundary to attach to, but the container/target dropdown split added in the same session accidentally re-excluded it from ever being selectable as that boundary). So the role catalog rows existed but were dead code: no admin could ever pick `'State'` as a seat's target type to reach them.

**Bigger problem found underneath that**: even with seats created directly (e.g. via SQL), ordinary citizens would never see or become eligible for a Governor/Senate race. `ElectionsPage.jsx` and `get_active_elections_for_user()` (§16) both scope to `user_boundary_memberships`, and `admin_only` boundary types are *deliberately* excluded from ever populating that table (§13's whole point — no citizen-facing "your whole province/state" tab). `'State'` inherited that exclusion as a side effect of being marked `admin_only`, even though by §16 it was also meant to back two real, citizen-votable offices.

**Resolution, decided with the user**: promote `'State'` from `admin_only=true` to a normal, citizen-facing boundary type — reversing the `admin_only` half of §16's original design (`20260729000014_promote_usa_state_boundary_type.sql`). Because every gate above (`sync_user_boundary_memberships`, `find_boundaries_by_point`, `add_user_boundary_membership`, `get_active_elections_for_user`, and both admin tools' target/container dropdowns) already reads the `admin_only` column dynamically rather than hardcoding type names, flipping this one flag was the entire fix — no other function or component needed code changes. The migration also one-time-backfills `user_boundary_memberships` for every existing user with a stored location (mirroring `reconcile_shape_memberships()`'s own insert logic), since that trigger only fires on a `map_shapes` insert/geometry update, not on this flag flip, and would otherwise leave existing users without a state membership until their location next happened to re-sync.

**Trade-offs accepted, not fixed**: `'State'` can no longer be used as a *container* to scope a Federal/Municipal seat-creation batch (e.g. "every House district in California") — every `admin_only` type doubles as a container, so this fell out structurally, but it was never the reason `'State'` was added (§16) and wasn't otherwise in use. `resolve_region_names(shape_ids, 'USA')` now finds zero `admin_only` containers for USA and returns no rows for any USA shape — harmless, since no USA `role_key` has ever used a non-`''` `region_override` (only Canada's Provincial MPP/MNA/MHA does; USA's Governor/U.S. Senator/State Senator/State Representative/Mayor/Council Member are all plain `''`-only titles), so callers already fall back to each role's default title correctly.

President remains out of scope for the one-click "Fetch candidates" mechanism (no `map_shape_id` at all — a nationwide race, doesn't fit this seat→map_shape-keyed model) — `sync_us_federal_candidates.py` still covers it for manual backfills.

## 24. US state-by-state candidate research + a full jurisdiction link audit

*Built across several later sessions. Full detail lives in `docs/ELECTION_DATA_SOURCES.md` — this section is a pointer, not a duplicate, to avoid two documents drifting out of sync on the same facts.*

**Governor + state legislature research, batched.** Extended the candidate-source research from §23 to US Governor and State Senate/State House races — no unified national source exists (unlike FEC for federal), so this is per-state research, same shape as Canada's provinces. First batch of 12 states fully researched; real, live-fetch handlers built and verified against the deployed Edge Function for Idaho, Connecticut, and Hawaii. Colorado's handler is written and its parsing verified correct, but the live site returns 403 specifically to Supabase's Edge Function egress (confirmed via a temporary debug redeploy — the identical request succeeds from a plain dev-machine `curl`) — a WAF blocking known cloud IP ranges, not a code bug. Arkansas was downgraded from an initial "clean API" research finding to manual-link-only after direct verification found a Cloudflare block the first pass missed.

**New `manual_only` status tier**, introduced while auditing whether every already-"built" jurisdiction actually surfaces a working admin link. It didn't: Alberta/Saskatchewan/PEI, and — found on a second, deeper pass — **BC/Ontario/Quebec too**, all had zero `provincial_election_events` rows in production despite their `fetch*` handlers being fully wired, so `getCandidateSourceInfoForSeats` had nothing to build a link from. Worse, the *old* behavior for any jurisdiction that did have an event row was to always mark it `'active'` (link + "Fetch candidates" button) regardless of whether a real `HANDLERS` entry backed it — meaning the button could render and then fail, not stay hidden. Fixed with a `JURISDICTIONS_WITH_FETCH` set (mirrored in both `candidateSync.js` and the Edge Function) that gates `'active'` vs `'manual_only'` independently of whether an event row exists, plus seed migrations (`20260729000015`, `20260729000016`) giving all six provinces a real, confirmed-working `source_url`.

**Two real, previously-undetected bugs found and fixed** during that same audit (by running the actual production code against live data, not just re-reading it):
1. **BC's candidate parser had the wrong column mapping** — `fetchBc`'s regex read `name`/`party` from columns 3/4, but BC's real table has a duplicate district-name column for mobile responsiveness (`class="bold-on-mobile"`) shifting the real columns to 4/5. `scripts/sync_bc_candidates.py` already had the correct mapping; only the Edge Function's TypeScript port had the off-by-one.
2. **Canada federal's event-picker could point most ridings at the wrong `EV`** — it preferred "whichever event has the latest `event_date`," with no distinction between a general election (every riding) and a by-election (its own few ridings only, not tracked structurally anywhere). A scheduled-but-not-yet-held by-election's future date outranked the actual general election's past date, so any riding not in that specific by-election got redirected to a generic "find your district" page instead of showing candidates. Fixed by preferring `is_general = true` first in both `pickEvent` (Edge Function) and `getCurrentEventsByJurisdiction` (`candidateSync.js`).

All ten previously-built jurisdictions (Canada Federal, BC, Ontario, Quebec, Manitoba, Alberta, Saskatchewan, PEI, US Federal House, US Federal Senate) were reverified end-to-end against the real live database after these fixes, using a throwaway REST-based script (not the actual app — Node 20 can't run `@supabase/supabase-js` in this environment without a WebSocket polyfill) that faithfully re-implements `getCandidateSourceInfoForSeats`'s exact logic.

## 25. ElectionsAdmin: seat-id filter chunking + URL-persisted election selection

*Built in response to a direct bug report: selecting a large election took ~1 minute to load, and navigating away and back lost the selection entirely.*

**Root cause of the slow load, found by direct measurement, not guessing**: `getElectionCandidatesBySeatIds` paginated the *result rows* via `fetchAllPages`' `.range()`, but the `.in('seat_id', seatIds)` **filter itself** was never chunked — every page of every request carried the *entire* seat-id list. Harmless for a small election, but for "2028 municipal elections" (2,310 seats) this produced an ~85KB query string. Confirmed directly with `curl -v`: the request fails outright above ~60KB of combined headers ("Failed sending data to the peer"), not just slowly — the perceived "1 minute" was very likely failure-and-retry, not a slow query. Fixed in `src/services/elections.js`: seat ids are now chunked into batches of 200 and fetched in parallel via `Promise.all`, then merged — verified a 200-id chunk resolves in 0.35s against the real 2,310-seat election (the unchunked request never resolved at all).

**State loss on navigation**: `/admin/elections` is a standalone top-level route (`App.jsx`), not a tab — leaving it for any other page truly unmounts `ElectionsAdmin`, resetting all local state including `selectedElection`. Fixed by syncing the selection to a URL search param (`?election=<id>`) via `useSearchParams`: `selectElection` now also calls `setSearchParams` (with `replace: true`, so it doesn't spam browser history), and a `useEffect` keyed on the `elections` list auto-restores the selection from the URL once it's loaded, guarded on `selectedElection` being unset so it never fights a manual click. Still re-fetches seat data on return (that's not cached), but combined with the chunking fix above this is now fast rather than requiring a full manual reselect.

## 26. `is_container` split from `admin_only` — USA's State as both container and target

*Built in direct response to: "USA should have state as container types as we have province as container type in Canada."*

**The gap**: §23's `admin_only` promotion made USA's `'State'` a normal target/citizen-membership type — but as an explicitly accepted trade-off, it stopped being usable as a *container* to scope a Federal/Municipal seat-creation batch (e.g. "every House district in California"), because `ElectionsAdmin.jsx`/`BoundaryVisualizer.jsx`'s container/target dropdown split, and the `shape_containers` cache (§15's follow-up, `20260728000009`), all used the single `admin_only` column to mean two different things at once: "excluded from citizen boundary membership" and "usable as an admin container." Once `'State'` needed the first to be `false` but the second to stay `true`, one column couldn't express both — Canada's `Province` never hit this because it's *only* ever a container, never a target.

**Fix** (`20260729000017_state_as_container_too.sql`): a new `is_container` column on `country_boundary_types`, decoupled from `admin_only`. Backfilled to match `admin_only` for every existing type (so `Province` and everything else behaves identically to before), with `'State'` the one deliberate exception — `admin_only=false`, `is_container=true`. Every place that previously read `admin_only` to mean "is a container" was repointed at `is_container`: `shape_containers`'s two recompute functions and its `reconcile_shape_containers` trigger, `resolve_region_names`, and the container-dropdown filters in `ElectionsAdmin.jsx`, `BoundaryVisualizer.jsx`, and `PoliticianElections.jsx`'s "browse a different area" filter (which had the exact same `adminOnly: true` pattern as the admin tools and needed the same fix for a citizen-facing feature to keep working). `admin_only` itself is untouched everywhere else (`sync_user_boundary_memberships`, `find_boundaries_by_point`, `add_user_boundary_membership` all keep their original, narrower meaning).

The migration also force-recomputes `shape_containers` for every existing USA `'State'` shape, rather than trusting whatever rows happened to survive §23's flag flip (that migration only changed `country_boundary_types`, never touched the cache table itself).

**Verified live**: Idaho as a container correctly returns exactly its 2 real congressional districts via `find_shapes_in_containers`. Ontario as a container still correctly returns 126 shapes (124 real Ontario ridings + 2 near-border Quebec ones — an already-documented quirk from §16, not a regression) — confirming the Canada path is untouched.

---

## 27. Ghost display names, a missing RPC, civic score, candidacy/wall unification, an auth refocus bug (twice), and a politician-downgrade guard

*Built across one later session, 2026-07-30 — a series of separate direct requests handled one after another, bundled here together.*

**Readable ghost names** (`src/utils/ghostName.js`, new): every place in the app rendered `Ghost-${id.split('-')[0]}` inline — 11 separate occurrences across `FeedPage.jsx`, `PoliticianWall.jsx`, `CandidacyWall.jsx`, `WallPostFeed.jsx`, `PoliticianSidebar.jsx`, `ElectionsAdmin.jsx`, `ElectionSeatPage.jsx` — at the user's request for something easier to read than a hex fragment. `getGhostDisplayName(ghostId)` hashes the UUID (no new storage) and deterministically picks an adjective + animal noun from two small word lists, e.g. `Ghost-QuietFalcon`. Purely cosmetic on top of the existing id — doesn't change the anonymity model in either direction (same reversibility as the hex fragment already had). All 11 call sites now share this one function.

**`burn_ghost_identity()` didn't exist.** Investigating why a user's "Burn Identity" button did nothing (same Ghost ID before and after) led to querying the live database directly: zero functions with "ghost" in the name existed anywhere, despite §3 describing this RPC and `feed.js` calling it every session since. It had presumably only ever been described/assumed, never actually shipped as a migration. Every burn attempt was failing with a PostgREST "function not found" error, caught and only `console.error`'d — no visible failure, so it looked like the button just did nothing. Fixed (`20260730000000_burn_ghost_identity.sql`): a straightforward `SECURITY DEFINER` RPC matching §3's description. Verified directly against a real profile in a rolled-back transaction (confirmed `current_ghost_id` actually rotates, then rolled back so nothing was permanently touched) before also wiring a visible `alert()` on failure in `FeedPage.jsx`'s `handleBurnIdentity`, in case it — or anything else — ever fails silently again.

### Civic score (`profiles.civic_score`)

Requested directly: a per-user score (10 pts/post, 5/comment, +1/like, −1/dislike on their own posts) that survives ghost burns. The original ask sketched a `silentExportData()`-style file of the user's post/comment ids written to storage at burn time — flagged immediately: any stored `profile_id → post_id` list is itself a deanonymization index, since `posts.ghost_id` is already public on every post, so that design would have recreated exactly the pre-existing flagged `silentExportData()` risk (§3), not fixed it.

**Resolution, decided with the user**: a single running integer, no post-id list ever stored anywhere. `calculate_my_score()` (`20260730000001_civic_score.sql`, perf-tuned in `20260730000002_civic_score_perf.sql`) returns `profiles.civic_score` (banked total from all previously-burned ghosts) plus a live tally of the *current* ghost's posts/comments/votes — computed fresh on every call, nothing persisted until burn. `burn_ghost_identity()` was extended to fold that live contribution into `civic_score` before rotating — the last moment a legitimate link between the profile and that ghost exists. After that, only the number survives; which specific old posts contributed is not reconstructable by anyone, including the account owner.

**Perf note, found and fixed in the same session**: `posts.ghost_id`/`comments.ghost_id` had no index at all — every score calculation and every burn was a full sequential scan of both tables (confirmed via `EXPLAIN`). Added `idx_posts_ghost_id`/`idx_comments_ghost_id`, and collapsed the original 3-scan implementation (separate `count()` and `sum()` subqueries against `posts`) into one pass per table. Re-verified the exact score math after the rewrite against real data (9 posts + 1 comment + 2 likes = 97) in a rolled-back transaction.

Displayed on `FeedPage.jsx` (below the Ghost ID badge, next to Burn Identity) and `ProfilePage.jsx` (inside the Privacy & Ghost ID card) via an "Update My Score" button — deliberately not auto-fetched on load, to keep it a cheap on-demand read rather than a query on every page visit.

### `silentExportData()` deleted

Its whole purpose turned out to be "the future civic-score feature" — now built the privacy-preserving way above, so the original function (and its now-dead `getPostsForExport`/`getCommentsForExport`/`uploadUserExport` service functions) was removed outright from `FeedPage.jsx`/`feed.js`, closing the §3-flagged deanonymization risk for good rather than leaving it dormant.

### Burn paths consolidated

`docs/SERVICES.md` had documented `ProfilePage.jsx`'s `burnGhostIdRaw()` (a raw `profiles.current_ghost_id` column update) and `FeedPage.jsx`'s `burnGhostIdentityViaRpc()` as a deliberate, do-not-merge divergence. Given the RPC didn't exist until this session (above), that divergence was almost certainly a workaround for the missing function, not an intentional design choice — confirmed with the user before touching it. `burnGhostIdRaw` is deleted; both pages now share `burnGhostIdentityViaRpc()`. This mattered concretely once civic-score banking moved into the RPC: the raw path would have silently skipped crediting the score for anyone burning via `ProfilePage`.

### Candidacy wall ↔ permanent wall content unification

Asked directly to verify a candidate's election-seat wall (`CandidacyWall`, via `getCandidatePosts` — matched only `posts.election_candidate_id`) showed the same content as their permanent politician wall (`PoliticianWall`, via `getWallPosts` — matched `posts.ghost_id`/`wall_ghost_id`). It didn't — two disjoint post sets for the same person, depending which URL you viewed them from.

**Fix**: `elections.js`'s new `getCandidacyWallPosts(candidateId, ghostId)` matches `election_candidate_id.eq.candidateId` OR'd with `ghost_id`/`wall_ghost_id` when a ghost id is resolvable — the OR is what pulls in the rest of the person's permanent wall, not just this candidacy's own posts. `CandidacyWall.jsx`'s post composer now also tags new posts with `wall_ghost_id` (previously only `election_candidate_id`), so future posts flow into both views from one write. `20260730000003_unify_candidacy_and_wall_posts.sql` backfilled the one existing candidacy post's `wall_ghost_id` from its candidate's current ghost — verified directly against the row afterward.

**A regression introduced and caught in the same pass**: the first version of this fix made post-fetching depend on `candidate.profiles.current_ghost_id` (from a nested `profiles` join). That join is RLS-gated to `role = 'politician'` for non-owner viewers (§5's "Related fix bundled in") — and the one real candidate this was tested against has `profiles.role = 'normal'` despite an active candidacy (very likely a leftover from earlier test-account role-switching, not representative of a real candidate). Posts vanished for any non-owner viewer as a result. Fixed by keying `getCandidacyWallPosts` on `election_candidate_id` first (always available, no join required) with the ghost-id match as a bonus when resolvable — verified working regardless of that RLS/role edge case. The underlying data anomaly (a real candidate with `role='normal'`) was flagged to the user, not fixed — a genuinely pre-existing issue, unrelated to this session's changes, that also explains why that same candidate shows as `Ghost-Unknown` instead of their real name to non-owner viewers, and why their `/wall/:ghostId` URL 404s ("Wall not found") for anyone but themselves.

### `ElectionSeatPage.jsx` layout compaction

Direct request, from an annotated screenshot: remove the mobile-style "Back to Elections" button (redundant with the nav bar), compact the seat/election header from a 4-line hero card into one row (status pill + title + election name, small inline icons for location/date/candidate count), and move the "Become a Politician"/"Nominate Yourself"/"Election Administrator" action cards into a sticky `lg:w-72` right sidebar instead of stacking full-width above the candidate list. The candidate switcher (previously hidden below 2 candidates) now always renders, even for a single candidate, for layout consistency.

### `AuthContext.jsx` tab-refocus reload — two rounds, the real fix was deeper than it looked

First report: switching tabs and back made the whole app flash a full-page spinner and looked like it reloaded. First fix: `onAuthStateChange`'s handler special-cased `TOKEN_REFRESHED` (fires on a timer and — per the theory at the time — on tab focus) to update `session` without re-arming `loading` or refetching the profile; also memoized `user` (`useMemo` keyed on `session?.user?.id`) since `supabase-js` hands back a structurally-new `user` object on every session update even when the underlying account hasn't changed, and several pages key a `useEffect` directly on `[user]`.

**Reported as still happening.** Reading `@supabase/auth-js`'s actual `GoTrueClient` source (not just its public docs) found the real mechanism: `_onVisibilityChanged` → `_recoverAndRefresh()` only emits `TOKEN_REFRESHED` when the access token is near expiry. The far more common case — tab refocus with a token that still has plenty of life left — takes a different branch entirely and re-emits **`SIGNED_IN`** with a freshly-deserialized copy of the *same* session read back from storage. The first fix never touched this path, so `applySession` still ran in full: `loading` still flipped (the spinner), the profile still refetched, and any page effect keyed on `[..., authLoading, ...]` (`ElectionSeatPage.jsx`, `CandidacyWall.jsx` both match this pattern, not just a bare `[user]`) still refired — which is what was aborting an in-flight `politician_supporters` request in the reported console log.

**Real fix**: track the currently-applied user id in a `ref` (not `session` state, to avoid a stale closure over the effect's single `useEffect(..., [])` registration), and treat *any* re-notification of that same user — `TOKEN_REFRESHED` or `SIGNED_IN` alike — as a no-op session refresh rather than a real change. Only a genuinely different user id (or `null`, i.e. sign-out) goes through the full `applySession`/loading/refetch cycle. Verified by triggering the actual internal code path, not a synthetic stand-in: overriding `document.visibilityState` and dispatching real `visibilitychange` events reproduced repeated real `SIGNED_IN` events (amplified further by this dev environment's own background HMR churn) — zero spinner flashes and zero new network requests, confirmed via a `MutationObserver` on `.animate-spin` and a `performance.getEntriesByType('resource')` diff across the event.

### Politician role downgrade blocked, at the database

Direct request: a politician should never be able to become a citizen again, because the account can have accumulated real state (candidacies, a public wall, `politician_supporters`) that a downgrade would silently orphan. Three client paths could set `profiles.role` back to `'normal'` for an existing politician: `ProfilePage.jsx`'s "Switch to Citizen Account" button (§19), `EditProfileFlow.jsx`'s Citizen/Politician picker (shown even when editing an *existing* politician, not just during first-time signup), and — found while auditing this — `/onboarding` itself, reachable again after completion since its route uses `requireOnboarding={false}` (already flagged as a related, narrower gap in §20's "Known gap" note, re: admin demotion).

Per this codebase's own stated principle (client checks can be bypassed, correctness belongs in the database), the actual fix is `guard_politician_role_downgrade()` (`20260730000004_guard_politician_downgrade.sql`) — a `BEFORE UPDATE` trigger on `profiles`, structurally identical to the pre-existing `guard_candidate_status_change` pattern on `election_candidates` (§21), including the same `admin`-role and `app.bypass_*` session-flag exceptions (mirroring §21's fixed, `COALESCE`-guarded version, not its originally-buggy one). Blocks any `role = 'politician' → anything else` transition; `normal → politician` is completely untouched. Verified directly against real profile rows in rolled-back transactions: a politician's own session gets a clean rejection (`Cannot change a politician profile back to a citizen account`) attempting to self-downgrade, while `normal → politician` still succeeds. (The trigger's admin-bypass clause is currently unreachable via any normal client query regardless — `profiles` has no RLS policy letting an admin write a *different* user's row at all, matching its behavior before this trigger existed; it's there for parity with the existing pattern and for a future service-role/SECURITY DEFINER admin path, not because one exists yet.)

The two client paths were then also removed for good UX (not just relying on the DB to reject a doomed request): `ProfilePage.jsx`'s button and handler deleted outright; `EditProfileFlow.jsx`'s `StepBasicInfo` now takes a `lockToPolitician` prop (`initialData.role === 'politician'`) and renders a locked, non-interactive "Politician" display instead of the picker when true — new signups picking their role for the first time are unaffected. `/onboarding`'s reachability-after-completion was **not** separately closed off — the DB trigger already makes that path safe (a stray re-submission would just fail with a clear error), and closing the route itself is a broader concern affecting all roles, not scoped to this request.

### Diagnosed, no code change: `/politician/elections` looked empty

Reported directly. Root cause, confirmed against live data: the account being used to check was the standing admin test account, which has zero `user_boundary_memberships` (verified: `0` rows) and zero `election_candidates` rows — both sections on that page (`My Candidacies`, filtered by `politician_id`; `Open Seats Near You`, filtered by boundary membership) are correctly, structurally empty for any admin account, not a bug. Not evidence of a wider problem: `getMyCandidacies` isn't role-gated, so a real candidate account (even one with `role='normal'`, per the anomaly found above) sees their own candidacies here regardless.

---

## 28. Candidacy claim flow — resolving §21's deferred "future 'claim this candidacy' flow"

*Built in a later session, 2026-08-02.* §21 shipped `add_unregistered_candidate()` (a citizen-facing "stub" candidacy an election administrator creates for a real-world candidate who hasn't signed up) and explicitly flagged handing it over to the real person as a deferred next step. This session built that: two entry points, converging on one reassignment operation.

**Design, decided with the user before building:** an election administrator can either (a) email the real candidate a one-time invite link, or (b) a citizen/politician can self-request "this is me" on the stub's wall, reviewed by the seat's approved election administrator **or** a site admin. The reviewer question resolved quickly once checked against the existing code: `ElectionSeatPage.jsx`'s Election Administrator panel already renders identically for both an approved seat admin and `role === 'admin'` (§21), and the site admin's own seat list (`Admin/ElectionsAdmin.jsx`) already links into that same page — so "site admin picks a seat, sees the election-admin view" needed zero new UI, just a review queue added to the panel both audiences already land on. Email delivery uses Supabase Auth's built-in `admin.inviteUserByEmail` rather than standing up a third-party provider (no SMTP/Resend was wired into this project at all — `supabase/config.toml` only has a commented-out example); invites expire after 7 days.

**`20260802000001_candidacy_claims.sql`**: `election_candidates.claimed_at` (null while still an unclaimed stub; `added_by_election_admin_id` stays untouched as permanent provenance, separate from claim status). `candidate_claim_invites` (candidate_id, email, `token_hash`, expires_at, used_at) — the token is `encode(gen_random_bytes(32), 'hex')`, stored **hashed** (`digest(..., 'sha256')`), compared hashed on redemption, since this is an account-takeover-shaped credential (same trust level as a password-reset link) unlike the plaintext `contact_email` etc. `election_administrators` was fine storing. `candidacy_claim_requests` (candidate_id, requester_profile_id, motivation/contact_email/social_media_info, status, `UNIQUE(candidate_id, requester_profile_id)`) — column shape and the reject-blocks-resubmission behavior directly mirror `election_administrators` (§21).

**`finalize_candidate_claim(candidate_id, claiming_profile_id)`** is the shared reassignment, not client-callable — only invoked from the two entry RPCs below once they've each authorized the caller their own way. It repoints `election_candidates.politician_id` and sets `claimed_at`; upserts the claiming profile's `role/full_name/country/onboarding_completed` and `politician_profiles` (education/hometown/bio/political_party_id/avatar_url) **from the stub** — the stub's identity fields win, since it was already vetted as "the real candidate" and claiming is the claimer asserting they *are* that identity, not proposing a new one; repoints existing wall discussion (`posts.ghost_id`/`wall_ghost_id`) onto the claiming profile's ghost id (safe here specifically because candidate walls are already public/named, not anonymous like a citizen's — not the deanonymization risk repointing a citizen's ghost_id would be); merges any existing `politician_supporters` rows onto the claiming profile before deleting the now-empty stub `profiles`/`politician_profiles` rows. `onboarding_completed = true` here is what lets a brand-new invited signup skip onboarding entirely — claiming *is* onboarding for them.

`claim_candidacy_via_token(token)` (Flow A) hashes the input, looks up an unexpired/unused invite, and calls the shared function — the emailed link's inbox ownership *is* the authorization, no extra review step, same trust model as any password-reset flow. `create_claim_invite`/`request_candidacy_claim`/`review_candidacy_claim` (Flow B) share a new `is_claim_reviewer_for_candidate(candidate_id)` helper for the "site admin or this seat's approved election administrator" check (see bug #2 below for why it's a function and not an inline `EXISTS`).

**`supabase/functions/send-claim-invite/`** (new, mirrors `fetch-candidates`'s shape): the one place in this feature that has to run server-side, and for two different reasons at once — it calls `create_claim_invite` through a client scoped to the *caller's own JWT* (so the RPC's permission check runs as the real election admin, not a service identity), then switches to a service-role client for `admin.inviteUserByEmail`, which needs the service role key and can't be called from the browser at all.

**Frontend**: `CandidacyWall.jsx` shows "This is me — claim this candidacy" next to the existing "Listed by verified election administrator" note, for any signed-in non-owner viewer, whenever a candidate is still an unclaimed stub (`added_by_election_admin_id` set, `claimed_at` null) — opens an inline motivation/contact-email/proof-link form calling `requestCandidacyClaim`. `ElectionSeatPage.jsx`'s Election Administrator panel gained per-stub "Invite to Claim" (email input → `inviteCandidateToClaim`) and a "Pending Claim Requests" review list (approve/reject → `reviewCandidacyClaim`), both inside the same branch that already serves site admins and seat admins alike. New `ClaimCandidacy.jsx` at `/claim/:token` (`requireOnboarding={false}`, same override `/onboarding` itself uses) redeems the token on load and hands the new owner straight to their campaign page.

**Two real bugs found and fixed during verification, not just the intended feature** (both would have broken every single claim in production, not edge cases):

1. **A type mismatch**: `posts.wall_ghost_id` turned out to be `text`, not `uuid` like `posts.ghost_id`/`profiles.current_ghost_id` — `finalize_candidate_claim`'s repoint `UPDATE` compared/assigned a `uuid` variable directly against it and failed every time with `operator does not exist: text = uuid`, caught on the very first live redemption attempt (confirmed the failure rolled back cleanly — `election_candidates.politician_id` and `claimed_at` were untouched, since the whole function body is one implicit transaction). Fixed with explicit `::text` casts on both sides.
2. **Nested-RLS fragility**: the first version of the `candidacy_claim_requests` review policy did its own inline `EXISTS` join through `election_candidates` to check seat ownership — but `election_candidates`'s own SELECT policy hides rows whose parent election is still `'draft'` from anyone who isn't `role='admin'` (§5), so that subquery, evaluated under the *calling* role's RLS (not bypassed, since this was a plain policy expression, not a SECURITY DEFINER call), silently returned false for the seat's own legitimate election administrator whenever the election happened to still be in draft. Caught directly: an election admin's `SELECT` for their own seat's pending request returned zero rows even with correct, verified data underneath. This would have broken not just an ad-hoc query but the real `getClaimRequestsForSeat()` call `ElectionSeatPage.jsx`'s review queue depends on. Fixed with `is_claim_reviewer_for_candidate()`, a `SECURITY DEFINER` helper used both inside the RLS policy and — replacing the previously-duplicated inline checks — inside `create_claim_invite`/`review_candidacy_claim` themselves. Same reasoning as `get_seat_admin_status()` (§21) existing at all instead of a raw client query against `election_administrators`.

Verified end-to-end against the real database with disposable test data (a seat, an election administrator, three stub candidates, a supporter, and a wall post — all deleted afterward): Flow A's full invite → hashed-token-stored → redeem → profile/politician_profiles merge → wall-post and supporter migration → stub deletion → invite-marked-used → reuse-blocked sequence; Flow B's self-request → duplicate-upsert (confirmed still exactly one row) → election-admin approval with the same full reassignment; a second stub rejected by a site admin instead (confirming the OR-branch of `is_claim_reviewer_for_candidate` independently); RLS confirmed an unrelated citizen sees zero rows for either queue; resubmission after an explicit rejection confirmed blocked, mirroring `apply_for_election_admin`'s existing behavior. `npx oxlint src/` clean on every touched file; `/claim/:token`'s error state confirmed rendering correctly in the browser with no console errors for an invalid token.

## 29. Per-question video + public comment threads on candidate answers, then a flexible question-type rework

*Built in a later session, 2026-08-02, in two requests back to back — documented together since the second reshaped the schema the first landed on.*

### Part 1: per-answer video + comments

The ask: on top of a candidate's multiple-choice answer and optional written context (`20260729000001_election_questionnaire.sql`/`20260729000002_candidate_applications.sql`), let the candidate optionally attach a short video *to that specific answer* (distinct from the whole-application `intro_video_url`), and let voters comment on a candidate's answer to a specific question, not just on the general wall.

`20260801000001_answer_video_and_comments.sql`: `video_url` added to `election_candidate_answers`. New `election_answer_comments` table (`answer_id`, `ghost_id`, `content`, `created_at`) — same shape as `public.comments` (`20260721000000_init_schema.sql`), scoped to an answer instead of a post. RLS: readable/writable under the same condition the parent answer is itself publicly visible under (`ec.status = 'approved' AND q.visible_to_public = true`, from the existing `election_candidate_answers` policy), plus the answer's own owner and admins.

Frontend: `CandidateApplication.jsx` gained a per-question "Add a video for this answer (optional)" affordance (reusing `VideoRecorder`, independent of the admin's `allow_context` toggle — that one only ever governed the *written* context field). `CandidacyWall.jsx`'s questionnaire card became click-to-expand per question, revealing a comment thread + composer (mirrors the ghost-id anonymous-comment pattern used everywhere else, not a new one).

### Part 2: flexible question types

The ask, immediately after: don't limit the questionnaire to multiple-choice — support free-text answers and a 1–5 rating scale too (mockup supplied: a municipal-election issues questionnaire mixing single-select, multi-select, and a "rate each issue 1–5" scorecard section — the scorecard turned out to need no special handling, it's just several ordinary `rating` questions, one per issue).

`20260802000000_flexible_questionnaire.sql`: `election_questions.question_type` (`single_choice` / `multiple_choice` / `text` / `rating`, default `single_choice` so existing rows need no backfill). `election_candidate_answers.option_id` dropped its `NOT NULL` (only `single_choice` uses it now); `text_answer`/`rating_value` added. New `election_candidate_answer_options` junction table (`answer_id`, `option_id`) for `multiple_choice` — every question type still gets exactly one `election_candidate_answers` row per (candidate, question) regardless of type, so `context_text`/`video_url`/comments keep working unchanged; the junction table only holds *which options* for the multi-select case. RLS on the junction mirrors `election_candidate_answers`'s three-policy shape, joined through the parent answer row. `submit_candidate_application`'s "missing required question" check, previously just "does a row exist," became type-aware (`text` needs non-empty `text_answer`, `rating` needs non-null `rating_value`, `multiple_choice` needs at least one junction row, `single_choice` needs `option_id`) — a `multiple_choice` question with a row present but zero boxes checked (e.g. checked then unchecked again) would otherwise have silently counted as answered.

Design choices made without re-confirming, worth flagging if they turn out to matter: the rating scale is a fixed 1–5 (`src/utils/ratingScale.js`), not admin-configurable per question; there's no per-option "write-in" field for an explicit "Other: ___" choice on a multiple/single-choice question — the existing `allow_context` toggle is the intended escape hatch for that instead of new schema.

**Frontend**: new shared `src/components/AnswerValue.jsx` renders just the *value* of an answer (selected option / pill list of selected options / quoted text / rating dots) branching on `question_type` — used identically by `CandidacyWall.jsx` (public) and `Admin/ElectionsAdmin.jsx` (review), so the four-way branch exists in exactly one place instead of being copy-pasted into both. `CandidateApplication.jsx`'s per-question save path was rebuilt around one `persistAnswer(questionId, overrides)` helper: since every save writes the *whole* `election_candidate_answers` row (`option_id`/`text_answer`/`rating_value`/`context_text`/`video_url` together, one upsert), it merges `overrides` onto whatever's already known for that question first — without this, saving a context edit after already picking a rating would silently null the rating back out. A `hasStartedAnswering(question, answer)` helper (type-aware, mirrors the RPC's own per-type check) gates both the "add context"/"add video" affordances (nothing to elaborate on yet) and the client-side "required questions remaining" count. `Admin/ElectionsAdmin.jsx`'s question builder gained a type `<Select>`; the option-text inputs only render for `single_choice`/`multiple_choice`.

### A regression found and fixed during verification, not part of either request

Rewriting `submit_candidate_application` for the type-aware required-question check (`CREATE OR REPLACE`, necessarily replacing the whole function body) accidentally dropped two lines that had nothing to do with this change: the `app.bypass_candidate_status_guard` bypass and the `status = CASE WHEN status = 'rejected' THEN status ELSE 'approved' END` flip that §21 added specifically to make submission auto-approve instead of sitting admin-gated at `'pending'` forever. Caught live, not in review: after submitting a real test application through the actual UI, `Admin/ElectionsAdmin.jsx` showed it as **pending** instead of the expected **approved**. Root-caused by diffing against `20260729000009_fix_submit_candidate_application.sql`'s original function body. Fixed in a third migration, `20260802000001_fix_submit_auto_approve_regression.sql` — the already-applied one from earlier in the same session was left alone rather than edited in place, per this repo's own migration convention. Recorded here mainly as a reminder for the next session: a full-body `CREATE OR REPLACE FUNCTION` on an existing RPC needs a side-by-side diff against what it's replacing, not just a check that the new logic being added is correct — it's easy to correctly implement the requested change while silently dropping something unrelated that was already in there.

**Verified end-to-end against the real database** with disposable test data (question of each of the four types, a seat, a fresh candidate account run through actual signup/onboarding/declare-candidacy/apply — not seeded directly — camera-dependent steps like the intro video substituted via direct `UPDATE` since this browser sandbox has no camera access): answered all four question types as the candidate (single-select, two-of-two on the multi-select, a written paragraph, rating "4"), confirmed every field persisted correctly including both `election_candidate_answer_options` rows, reloaded the application page and confirmed all four rehydrated into the right controls (radio/checkboxes/textarea/highlighted rating button), submitted, and confirmed both `CandidacyWall.jsx` (public) and `Admin/ElectionsAdmin.jsx`'s review panel render all four types correctly via the shared `AnswerValue` — including catching the auto-approve regression above from the admin panel's status display. `npx oxlint src/` clean on every touched file (two pre-existing, unrelated warnings confirmed pre-existing and left alone, same posture as every prior session's verification pass). All test data (candidate, seat, questions, test account) deleted afterward; the one real election in the database was left exactly as found (`draft`, no seats/questions).

---

## 30. Documentation backfill: Analytics admin page, Ghost ID rotation history (not built this session — recording what already existed undocumented)

*2026-08-03.* A docs-audit pass found two shipped, working pieces of the app with no write-up anywhere in this file (both predate this session — introduced in earlier commits with generic messages, "Improved" — so the design rationale below is inferred from the code, not from a session transcript). Recorded here so a future session doesn't have to rediscover them by grepping `src/pages/Admin/`.

**`/admin/analytics`** (`AnalyticsAdminPage.jsx` + `AnalyticsPanel.jsx`, data from `src/services/analytics.js`'s `getAdminAnalyticsMetrics()`): a read-only platform-engagement dashboard — total posts/comments/registered users, daily-new-users, DAU/WAU/MAU (unique users touching `posts`/`comments`/a `profiles.updated_at` bump in the past 24h/7d/30d, unioned into a `Set` client-side rather than a dedicated activity-log table) with a stickiness ratio, a content-velocity breakdown, and a roles-breakdown bar chart. Everything is computed with plain `count`-mode `.select()` calls and small `.select('user_id')`/`.select('id')` pulls done in parallel via `Promise.all`, not an RPC or materialized view — fine at current data volume, but the same 1000-row PostgREST cap that motivated `fetchAllPages.js` (§6) would eventually apply to the raw id-list queries (`postsToday`/`comments7d`/etc. use `head: true` counts and are exempt, but the DAU/WAU/MAU `user_id`/`id` pulls are not) if either table's 30-day activity volume ever exceeds it. Added to `AdminSubNav` as **Analytics**, positioned first after Boundaries.

**Ghost ID rotation history**: `profiles` carries `burnCount`/`lastBurnedAt` (surfaced by `profile.js`'s existing profile fetch), shown on `ProfilePage.jsx` under Privacy & Ghost ID as "Rotated N times, last on `<date>`" beneath the Civic Impact Score. Not previously cross-referenced from §3's core anonymity model or §27's civic-score writeup — both still apply unchanged; this is purely a display of already-existing columns, not new schema.

No code changes in this session — this section exists solely to close the gap between what `docs/SCREENS_AND_FEATURES.md`/`docs/SERVICES.md` described and what the app actually ships. Those two docs were updated in the same pass to add the Analytics and Theme (`/admin/theme` — mechanism already covered in `DESIGN.md`'s Theming section, just missing from the admin route list) admin screens, the civic-score UI on Feed/Profile, and a few stale `docs/SERVICES.md` "used by" references (`UserPage.jsx`, removed in §19, was still listed as a `boundaries.js` consumer; `ClaimCandidacy.jsx`, added in §28, was missing from `elections.js`'s).

---

## 31. Next.js migration cutover, then a parity & SEO readiness pass

*Migration itself built across a separate multi-session effort tracked phase-by-phase in
[`NEXTJS_MIGRATION.md`](NEXTJS_MIGRATION.md) — that file is the *how*/*progress log*; this
section is the *current-state* summary plus what a later audit-and-fix session (2026-08-04)
found and fixed once the port was functionally complete. Every `.jsx` component name cited
in §§1–30 above is the pre-migration file; the table below is the rename/relocation map.**

### What actually changed in the port

Mechanical, not a rewrite — see §1's updated Stack note for why the RPC/RLS-centric backend
made this possible. Component logic, service-layer function signatures, and the RLS/RPC
backend itself are unchanged; what moved:

| Pre-migration (Vite) | Post-migration (Next.js) |
|---|---|
| `src/pages/*.jsx`, `react-router` routes | `src/app/**/page.tsx`, App Router file-based routing |
| `src/pages/Admin/*.jsx` | `src/components/features/*AdminClient.tsx`, thin `page.tsx` wrappers |
| `src/services/*.js` | `src/lib/services/*.ts`, same functions, typed against generated `src/lib/supabase/types.ts` |
| `src/components/ui/*.jsx` | `src/components/primitives/*.tsx` |
| `VITE_SUPABASE_*` env vars | `NEXT_PUBLIC_SUPABASE_*` |
| Fully client-rendered (SPA) | Server Components fetch real data server-side for public pages (§31's "SSR conversion" below); interactive pieces (composer, vote buttons, video recorder) stay `"use client"` islands seeded with server-fetched `initial*` props |

The most consequential *behavioral* change: pre-migration, every page was client-rendered
after a loading spinner, so a crawler (or a social-media unfurl bot) saw an empty shell.
Post-migration, `/`, `/elections`, `/elections/seat/[seatId]`, `/candidacy/[candidateId]`,
`/wall/[ghostId][/[slug]]`, and `/news[/[slug]]` all render real content server-side on
first paint. Large existing Client Components (Candidacy Wall, Politician Wall, Election
Seat — each 700+ lines) were **not** decomposed into Server+Client pairs to get this; instead
their `page.tsx` fetches everything server-side and passes it in as `initial*` props, and the
Client Component seeds its own `useState()` from those props (Next.js still server-renders
Client Components on first pass, so this gets real content into the initial HTML without the
cost/risk of a full rewrite). `/feed` and `/admin/*` are still pure client components gated
by client-side auth checks, unchanged from the Vite version — not part of this SSR work,
since neither is meant to be publicly crawlable.

### 2026-08-04 audit-and-fix pass

A full-repo audit (build/type/lint status, live-DB verification, rendering architecture,
metadata coverage, line-by-line feature comparison against the retired Vite app) found and a
follow-up session fixed:

- **Production domain**: `https://choseno.app` (a guess baked into `sitemap.ts`, `robots.ts`,
  and every page's canonical/OG metadata during the port) corrected to the real domain,
  `https://choseno.com`, everywhere it was hardcoded, including the visible homepage copy.
- **Dynamic OG images**: `src/lib/utils/og.tsx`'s `renderOgCard()` (a `next/og`
  `ImageResponse`-based branded card — eyebrow/title/subtitle, optional circular photo, Satori
  fetches the remote photo URL itself so no `next.config.ts` domain allow-listing was needed
  for it specifically) plus an `opengraph-image.tsx` file-convention route per public segment:
  static cards for `/`, `/elections`, `/news`; dynamic (server-fetched, real DB data) cards for
  `/news/[slug]`, `/candidacy/[candidateId]`, `/wall/[ghostId]` (covers the nested
  `/wall/[ghostId]/[slug]` too via Next's segment-inheritance), `/elections/seat/[seatId]`.
  Old manual `openGraph.images`/`twitter.images` metadata fields were removed from the 4 pages
  that had them so each route has exactly one image source. **Build-caught follow-on bug**:
  `next build` warned `metadataBase` wasn't set, meaning every one of these OG image URLs (and
  any other relative image resolution) would have resolved against `http://localhost:3000`
  even in production — fixed by adding `metadataBase: new URL("https://choseno.com")` to the
  root `layout.tsx` metadata export.
- **`PostCard` unification** (closing a gap §5/§9's original port left open): Candidacy Wall
  and Politician Wall now render posts through the same shared `PostCard` Feed already used,
  instead of a separately-maintained `WallPostFeed.tsx` (now deleted). Both pages already
  tracked comment-input state as `Record<postId, string>`, so this was a render-path swap
  (map `posts` to `<PostCard>` with per-post closures, same pattern `FeedPageClient.tsx`
  already used) plus a type change from a hand-rolled `WallPost` interface to `PostCard`'s own
  `PostWithComments` (`PostRow & { comments }`) — both walls' post-fetch queries already
  `select("*, comments (*)")`, so no data-shape change, type-only.
- **Lint/type-quality cleanup**: `no-explicit-any` cleared in the three named service files
  (`news.ts`, `boundaries.ts`, `elections.ts`); `no-unused-vars` cleared (14 dead imports/dead
  state, including genuinely-dead `myAdminApplications`/`myShapeIds` state in
  `PoliticianElectionsClient.tsx` that was set but never read anywhere); all 21 remaining
  `react-hooks/set-state-in-effect` warnings fixed by deferring the offending call one
  microtask tick (`Promise.resolve().then(() => fn())`) — the rule only flags setState calls
  reachable *synchronously* from the effect body, so this satisfies it without changing
  behavior; for the handful of effects with an existing `let cancelled = false; return () => {
  cancelled = true }` cleanup guard, only the synchronous portion was wrapped, since React
  requires the cleanup function itself to be returned synchronously from the effect, not from
  inside a delayed `.then()`. **This microtask-defer pattern is now the standing convention
  for this codebase** — apply it to any future `useEffect(() => { someAsyncFn(); }, [...])`
  that trips this rule, rather than reaching for `eslint-disable`.
- **`next/image` adoption**: only 1 of 8 raw `<img>` occurrences found was safe to convert
  (`OnboardingFlowClient.tsx`'s avatar preview — sourced only from `uploadAvatarImage`'s
  Supabase Storage `publicUrl`, never a blob or admin-editable URL); added
  `images.remotePatterns` for `*.supabase.co/storage/v1/object/public/**` to `next.config.ts`
  to support it. The other 7 stay `<img>` with an `eslint-disable-next-line` (matching the
  style already used in `PostCard.tsx`/`AvatarUploader.tsx`) for real reasons: news
  hero-image/author-photo fields are admin-editable free-text URL inputs (genuinely
  arbitrary-domain), and the four post composers' image-preview state is
  `URL.createObjectURL(file)` — `next/image` can't render `blob:` URLs at all.
- **`/feed` and `/profile` infinite-spinner-for-anonymous-visitor bug**: both pages' data-load
  effect started with `if (!user) return;` before ever calling `setLoading(false)`, so a
  logged-out visitor never left the full-page spinner — a Next.js-migration-era regression
  (the Vite versions gated this differently), not present in the original app. Fixed by
  destructuring `loading: authLoading` from `useAuth()` in both files, gating the effect on it
  (`if (authLoading) return;`), and explicitly calling `setLoading(false)` in the `!user`
  branch. Both pages' render logic was already null-safe for `profile === null` (`profile?.`
  used throughout), so no further changes were needed. Verified live in both the anonymous and
  authenticated cases.

### Debug tooling added in the same pass

See `docs/adding-boundary-data.md`-style standalone doc reference pattern — kept here brief,
full detail lives with the code: a fixed set of backend-seeded debug personas
(`sql/seed_debug_personas.sql` — 1 election/seat, 2 candidates, 1 approved election
administrator, 5 citizens, all `debug.*@choseno.test`) plus a dev-only floating user-switcher
(`src/components/dev/DebugUserSwitcher.tsx`, rendered only when
`NODE_ENV !== "production"`) for fast manual QA across roles without re-entering credentials
each time. Unlike the standing `vmn2k4+admintest@gmail.com` QA account (§2) or the disposable
per-session test data every other section in this document describes creating-and-deleting,
these personas are meant to be **persistent** — re-running the seed script is idempotent
(upserts by email), so they're safe to leave in the database indefinitely rather than
cleaning up after each session.

---

## 32. Onboarding/edit-profile flow: a remount-on-every-keystroke bug, and reusing the signup wizard for edits

*2026-08-04, same day as §31 — found by clicking through the app using the §31 debug
personas, exactly the workflow they were built for.*

**Bug 1 — typing in the politician "Your Public Name" step (and any other onboarding text
field) looked like the page was refreshing after every character.** Root cause:
`OnboardingFlowClient.tsx` defined `StepLocation`, `StepUsername`, and `StepPolitician` as
components *inside* the parent's render body (`const StepUsername = () => {...}`, called as
`<StepUsername />`). Every keystroke updates `formData` via `updateData()`, re-rendering the
parent — which redefines those three functions as new identities on every render. React
treats a changed component identity as a different component type and unmounts/remounts the
whole subtree rather than reconciling it, which drops the `<Input>`'s DOM node (and its
focus) on every single keystroke. This is a general React anti-pattern ("never define a
component inside another component's render"), not something specific to this form — it
would have hit every text field in the wizard, for every new politician signup, not just the
one screen it was reported on.

**Fix**: hoisted `StepRole`/`StepLocation`/`StepUsername`/`StepPolitician` to module-level
components taking `formData`/`updateData`/`nextStep`/`prevStep`/`error`/`loading`/
`submitOnboarding`/`supabase`/`user` as props instead of closing over parent scope. Verified
directly: typed a full name character-by-character in the live app and confirmed both the
accumulated input value and DOM focus survived every keystroke (previously, only closure
capture obscured the bug in casual review — the component functions *looked* like normal
helper functions, not proof of what actually breaks when used as JSX).

**Bug 2 — "Edit Profile" pushed a politician through the full first-time-signup wizard,
including a role picker that always fails.** `ProfilePageClient.tsx`'s edit button routed to
`/onboarding` — the exact same component built for a brand-new account, with `formData`
starting completely blank (not pre-filled from the existing profile) and a step-1 role picker
that lets anyone pick "Citizen" regardless of their real current role. For an existing
politician, submitting after that mis-click hits `submitOnboarding()`'s `upsertProfileCore()`
call, which is rejected by the `guard_politician_role_downgrade()` trigger (§27) with `Cannot
change a politician profile back to a citizen account` — and because `error` state is shared
across the whole wizard and never cleared on `nextStep()`/`prevStep()`, that message kept
showing on *every subsequent screen* even after the user went back and picked "Politician"
correctly, looking like an unrelated, unexplained failure on a screen that had nothing to do
with the actual mistake. (Historical note: the pre-migration Vite app already hit this exact
problem and fixed it — `EditProfileFlow.jsx`'s `StepBasicInfo` took a `lockToPolitician` prop
that hid the picker entirely for an existing politician, per §27. That dedicated edit flow —
and its fix — was dropped during the Next.js port; `/profile`'s edit button was pointed at
`/onboarding` as a shortcut instead, silently reintroducing the bug §27 had already closed.)

**Fix**: built a real, separate edit experience instead of restoring the old stepper —
`src/components/features/EditProfileClient.tsx` (`/profile/edit`), a single-page form, not a
wizard: fetches and pre-fills the current profile (name, matched boundaries, and — for
politicians — avatar/party/hometown/education/bio) in one effect, has **no role field or
picker at all**, and saves everything in one `handleSave()` call that always passes the
caller's *existing* `role` through to `upsertProfileCore()` unchanged — there is no code path
in this component that could ever attempt a role change, downgrade or otherwise, so the
trigger can never fire from here. `ProfilePageClient.tsx`'s edit button now points at
`/profile/edit` (relabeled "Edit Profile"). Location re-verification still works from this
page (reuses the same `InteractiveLocationPicker` + `findBoundariesByPoint`/
`syncUserBoundaryMemberships` calls `StepLocation` uses) but is optional, not a forced step —
existing boundaries stay untouched unless the user actively re-verifies.

**Bug 3 (same underlying issue, closed at the source instead of patched around) — a
"Switch to Citizen Account" button existed for politicians and would always fail.**
`ProfilePageClient.tsx` had its own second path to the same doomed downgrade — a raw
`supabase.from("profiles").update({ role: "normal" })` call, guarded only by the DB trigger,
with no client-side check that it could ever succeed. Per this codebase's own established
principle (client checks can be bypassed, but a UI control that *always* fails serves no one),
the button itself is now conditionally rendered — `{profile?.role !== "politician" && (...)}`
— so it only ever appears for citizens, offering the one-way citizen→politician upgrade the
trigger actually allows. The handler was simplified to match (`switchToPolitician()`, no
longer branches on current role).

---

## 33. Entity-type filtering & RPC properties column: Boundary Visualizer + Elections Admin improvements

*2026-08-06, continuing from the previous session's work on boundary visualization and seat
creation flows.*

This update adds entity-type subfiltering (e.g., distinguishing Cities, Towns, Villages,
Municipal Districts within a "Municipality" boundary type) to both the Boundary Visualizer and
Elections Admin seat-creation flows, uncovering and fixing two related RPC and data-access bugs
in the process.

### Supabase schema changes

**Migration `20260807000005_find_shapes_in_containers_properties.sql`**: the
`find_shapes_in_containers()` RPC (used when you select a container in the Visualizer or seat
builder, e.g., "all municipalities inside British Columbia") previously returned only `(id,
name, code)` — no `properties` column where entity-type info is stored. This caused downstream
filtering to fail silently when the UI tried to request properties for entity-type checkboxes.
Fixed: RPC return type now includes `properties jsonb`, properly exposing the data the frontend
was attempting to filter by.

### Frontend improvements

**`BoundaryVisualizerClient.tsx`**:
- Added entity-type filter UI: after selecting a target boundary type (e.g., "Municipal"),
  a "Select entity types" panel appears with checkboxes for every subtype present in the
  selected country/type combo (Cities, Towns, Villages, Municipal Districts, etc. for Alberta
  Municipalities). Extracted to a derived value `entityTypesForCountry` computed from the
  properties column's CSDTYPE code.
- `handleVisualize()` now filters results by the selected entity types before rendering the map.
- Entity-type selection is gated on a valid target type being chosen (matching the existing
  UX flow where you select country → target type → container).

**`ElectionsAdminClient.tsx`** (seat-builder):
- **Container scoping bug fixed**: the "2. Review" boundary list (`boundaryCandidates`) was
  previously fetched country-wide the moment you picked a target type, completely ignoring the
  container you'd selected. Only once you clicked "Find Matching Boundaries" separately (a
  second, confusing step) would the container actually narrow the selection. This created a
  UX gap where selecting "British Columbia" + "Municipal" would still show all ~1,000 Canadian
  municipalities, not the ~160 in BC.

  **Fixed**: picking a container now immediately scopes the review list to that container's
  shapes, matching the Visualizer's behavior (which already worked correctly). The container
  now acts as a real-time filter, not a "activate this later" option.

- **Silent 400 error from mismatched column request**: `findShapesInContainers` was called
  requesting `"id, name, country, boundary_type, code, properties"`, but the RPC only returns
  `(id, name, code, properties)`. Postgres was silently returning a 400; the fetch call's
  error wasn't surfaced to the UI, so the review list just appeared empty.

  **Fixed in two parts**: (1) RPC schema change above (adding properties column), (2)
  frontend fix (`ElectionsAdminClient.tsx`) requesting only the columns that actually exist.
  Error handling was also improved — any future fetch error is now logged to the console and
  visible in the browser's Network tab instead of silently discarded, making similar bugs
  faster to diagnose.

### Verification & data ground truth

Alberta's municipal count was validated against the live data: 326 municipalities across
6 entity-type categories (19 Cities, 106 Towns, 81 Villages, 63 Municipal Districts, 51
Summer Villages, 6 Specialized Municipalities) — bringing the total near the commonly-cited
"361 municipalities" figure (the delta is unaccounted-for in public sources; the 326 verified
count matches our schema exactly). British Columbia's count is 161 municipalities (all cities,
towns, or villages — no MDs or summer villages — per BC's distinct administrative structure).
The Elections Admin flow now shows "Select all (326)" for Alberta + Municipal vs. "Select all
(160)" for BC + Municipal, confirming both container scoping and entity-type filtering are
working end-to-end.

### Related bugs surfaced but not fixed

- `OnboardingFlow` defines step components inside the parent render body (§32 documented a
  similar bug in the same file), potentially causing unmount/remount cycles — not fixed this
  session but flagged for cleanup.

### Files changed

- `supabase/migrations/20260807000005_find_shapes_in_containers_properties.sql` (new)
- `src/components/features/BoundaryVisualizerClient.tsx` (+42 lines entity-type UI, derived
  values)
- `src/components/features/ElectionsAdminClient.tsx` (+20 lines container-scoping logic,
  error handling)

---

## 34. Complete Active Office Holder Pipeline, Schema Fixes & Politician Wall Integration

*2026-08-06, building upon the election mode and boundary directory systems.*

This update establishes nationwide and international active office holder coverage (7,448 elected officials), resolves critical database foreign key & PostgREST query bugs, integrates automatic Politician Wall profile generation for all office holders, and upgrades the Feed and Boundary Directory UI components.

### 1. Data Ingestion Pipeline & Coverage

- **Automated Pipeline**: `scripts/populate-all-office-holders.py` aggregates data across:
  - **Canada Federal & Provincial**: OpenNorth Represent API (342 MPs, 591 MLAs/MPPs/MHAs).
  - **US Federal & State Executives**: `unitedstates/congress-legislators` & Civil Services (431 US Reps, 50 US Senators, 50 Governors).
  - **US State Legislatures**: OpenStates 50-state open-data repository (1,814 State Senators, 4,169 State Representatives).
- **PostGIS Boundary Mapping**: Performs fuzzy string and FIPS matching against `map_shapes` to assign exact `map_shape_id`s.
- **CSV Ground Truth**: Exports clean compiled data to `scripts/office-holders-data.csv`.
- **Documentation**: Added `OFFICE_HOLDERS_DATA_GUIDE.md` detailing pipeline execution, manual CSV updates, and admin UI options.

### 2. Auto-Generated Politician Wall Profiles

- Executed a database initialization transaction (`DO` block) that created 7,448 linked `profiles` rows (`role = 'politician'`, `current_ghost_id`) and `politician_profiles` entries for all office holders.
- Linked `office_holders.linked_profile_id = profiles.id`.
- **Politician Wall Route**: Every office holder now possesses a fully functioning Politician Wall page (`/wall/[ghostId]/[slug]`) displaying their official photo, role title, party affiliation, bio, boundary context, and constituency feed posts.
- **Seamless Account Claiming**: When real politicians register or claim their profile on Choseno, their existing wall profile seamlessly pairs with their verified account via `linked_profile_id`.

### 3. Database Foreign Key & PostgREST Query Repair

- **Foreign Key Fix**: Resolved a schema misconfiguration where `office_holders_linked_profile_id_fkey` pointed to `office_holders(linked_profile_id)` instead of `profiles(id)`.
- **PostgREST Query Column Cleaning**: Fixed `getOfficeHoldersForShape`, `getOfficeHoldersForShapes`, and `getOfficeHolderByRole` in `src/lib/services/elections.ts` to remove non-existent column requests (`color_hex`, `avatar_url`, `term_start`, `term_end`), eliminating PostgREST 42703 SQL errors.

### 4. UI Components & Directory Upgrades

- **`PoliticianSidebar.tsx`**:
  - Rendered a **Current Office Holders** section directly above `Candidates & Representatives`.
  - Displays active incumbents for the user's active district or boundary memberships.
  - Decoupled `fetchHolders` from `profile` loading state so office holders render instantly.
  - Added direct action links (`View Full Office Holder Directory →`) and links directly to each representative's Politician Wall page.
- **`src/app/elections/[boundarySlug]/page.tsx`**:
  - Fixed `ReferenceError: slugifyText is not defined` import error.
  - Upgraded boundary directory pages to render parent container badges (*British Columbia*, *Canada*), active representative count badges, contact email/phone, official website links, and direct **`Politician Wall →`** buttons for all incumbent representatives.

### Files Changed / Added

- `OFFICE_HOLDERS_DATA_GUIDE.md` (new)
- `scripts/populate-all-office-holders.py` (new)
- `scripts/office-holders-data.csv` (new)
- `src/lib/services/elections.ts` (query column fixes, `getOfficeHoldersForShapes` added)
- `src/components/features/PoliticianSidebar.tsx` (Current Office Holders section & Wall links)
- `src/app/elections/[boundarySlug]/page.tsx` (import fix, rich boundary rendering)
- `PRODUCT.md` (updated capabilities and commitments)

---

## 35. Canadian Municipal Mayors & Multi-Councillor Pipeline & Database Uniqueness Update

*2026-08-06, extending representative coverage to municipal governments across Canada.*

This update ingests 2,642 active Canadian municipal elected officials (359 Mayors and 2,249 Councillors across 479 cities/towns), modifies PostgreSQL table constraints to support multiple councillors per municipality, and auto-links ghost profile walls for all municipal officials.

### 1. Database Schema Constraint Adjustment (Multi-Councillor Support)

- **Problem**: `office_holders` previously had a UNIQUE constraint on `(map_shape_id, election_role_type_id)`. While valid for single-seat offices (MP, MLA, Governor, Mayor), this prevented storing multiple councillors for a single city (e.g. 10 City Councillors in Vancouver, 25 Ward Councillors in Toronto, 14 Ward Councillors in Calgary).
- **Fix**: Dropped `office_holders_map_shape_id_election_role_type_id_key` constraint and created `office_holders_map_shape_id_role_full_name_key` defined as `UNIQUE (map_shape_id, election_role_type_id, full_name)`.

### 2. Ingestion Pipeline & Coverage (`scripts/populate-canadian-municipal.py`)

- **OpenNorth API Query**: Paged through OpenNorth's representative endpoint (`https://represent.opennorth.ca/representatives/`) to pull all municipal Mayors, Reeves, Maires, City Councillors, Regional Councillors, and Conseillers.
- **Fuzzy Shape Matching**: Matched municipal district titles and representative set names against 5,159 Canadian `Municipal` boundary shapes in PostGIS.
- **Matched Official Count**: Successfully matched **2,642 active Canadian municipal officials** (359 Mayors & 2,249 Councillors) across 479 cities, towns, and regional municipalities (Vancouver, Toronto, Calgary, Edmonton, Ottawa, Surrey, Montreal, Winnipeg, Mississauga, Brampton, Victoria, Halifax, etc.).
- **CSV & Database Upsert**: Appended clean municipal records to `scripts/office-holders-data.csv` (10,055 total records) and executed batched SQL upserts into `office_holders`.

### 3. Ghost Profiles & Politician Wall Generation

- Executed a PostgreSQL transaction block generating linked `profiles` rows (`role = 'politician'`, `current_ghost_id`) and `politician_profiles` entries for all 2,642 newly inserted municipal office holders.
- Linked `office_holders.linked_profile_id = profiles.id`.
- Every Canadian Mayor and Councillor now possesses a dedicated **Politician Wall** (`/wall/[ghostId]/[slug]`).

### Files Changed / Added

- `scripts/populate-canadian-municipal.py` (new)
- `scripts/office-holders-data.csv` (appended 2,642 Canadian municipal records)
- `OFFICE_HOLDERS_DATA_GUIDE.md` (updated total count to 10,055 officials)
- `PRODUCT.md` (updated active office holder scope)

---

## 36. US Municipal Mayors & Council Members Pipeline & National Coverage Expansion

*2026-08-06, expanding representative coverage to US municipal local governments.*

This update ingests 606 active US municipal elected officials (598 Mayors and 8 City Council Members across 571 US cities), bringing the platform's total active office holder database count to **10,661 elected officials**, and auto-links ghost profile walls for all US municipal officials.

### 1. Ingestion Pipeline & Data Scope (`scripts/populate-us-municipal.py`)

- **OpenStates Municipal YAML Processing**: Cloned `openstates/people` repository and parsed municipal YAML files (`data/*/municipalities/*.yml`) across all 50 US states.
- **Data Extracted**: Full Name, Role Title (`Mayor` vs `Council Member`), Role Type ID (`53d611c8...` for Mayor, `3ecded5c...` for Council Member), City Name, State Code, Contact Email, Voice Phone, Office Address, Source Website URL, Headshot Photo URL.
- **State-Aware Boundary Matching**: Matched state code and normalized city names against 32,612 US `Municipal` PostGIS boundary shapes in `map_shapes`.
- **Major City Coverage**: Ingested Mayors and Council Members for major US cities including New York City, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, San Antonio, San Diego, Dallas, Austin, San Jose, Seattle, Miami, Anchorage, Akron, Allentown, Amarillo, and 571+ US municipal jurisdictions.
- **CSV Export & Database Upsert**: Appended clean records to `scripts/office-holders-data.csv` (10,661 total records) and executed batched SQL upserts into `office_holders`.

### 2. Auto-Generated Politician Wall Profiles

- Executed a PostgreSQL transaction block generating linked `profiles` rows (`role = 'politician'`, `current_ghost_id`) and `politician_profiles` entries for all 606 newly inserted US municipal office holders.
- Linked `office_holders.linked_profile_id = profiles.id`.
- Every US Mayor and Municipal Council Member now possesses a dedicated **Politician Wall** (`/wall/[ghostId]/[slug]`).

### Files Changed / Added

- `scripts/populate-us-municipal.py` (new)
- `scripts/us_muni_import.sql` (new)
- `scripts/office-holders-data.csv` (appended US municipal records, 10,661 total rows)
- `OFFICE_HOLDERS_DATA_GUIDE.md` (updated total count to 10,661 officials)
- `PRODUCT.md` (updated capabilities)

---

## 37. Ratings & Reviews System, Office Holder Sidebar Display, Election Page Refactoring & Avatar Robustness

*2026-08-09, adding community feedback mechanisms, centralizing office holder display, and fixing avatar consistency across the app.*

This update introduces a community ratings system for politicians, refactors office holder display from custom components into a centralized sidebar pattern, fixes broken wall page links via ghost_id, and makes the Avatar component resilient to broken/missing images platform-wide.

### 1. Ratings & Reviews System

**Schema**: `ratings` table (2020, pre-existing but enhanced):
- `id` (UUID), `politician_id` (FK to `profiles.id`), `ghost_id` (anonymous poster), `rating` (1–5 stars), `comment` (optional text)
- `created_at`, `updated_at`
- RLS: own-record-only read (each ghost_id sees only their own ratings), all-read for average aggregates
- 6-month update cooldown per ghost_id per politician (enforced server-side via `getMyRatingTimestamp` + RPC validation)

**Service Layer** (`src/lib/services/ratings.ts`):
- `upsertPoliticianRating(politicianId, rating, comment)` — RPC + validation, server enforces cooldown
- `getPoliticianEngagementSummaries(politicianIds[])` — batch-fetches `supporter_count`, `avg_rating`, `rating_count`, `comment_count` per politician in one round-trip
- `getPoliticianRatingsList(politicianId)` — all public reviews for display in modal
- `getMyRatingTimestamp(politicianId, ghostId)` — check cooldown eligibility

**Components**:
- **`PoliticianRatingModal.tsx`**: unified "view ratings + post new review" surface, reused everywhere politician star ratings are shown
  - Header: politician name, current avg rating + count
  - Composer (if eligible): 5-star picker + optional comment textarea, "Submit Your Rating" button
  - Cooldown message (if locked): "Come back on [date] to rate again" in high-contrast text
  - All public reviews rendered below, newest first, with star count, date, and comment text
  - Modal width increased from `max-w-md` to `w-[90vw] max-w-4xl` for readability
  - Page overlay reduced from `rgba(0,0,0,0.75)` to `rgba(0,0,0,0.25)` to keep background visible

- **Theme Variables** (`src/app/globals.css`):
  - `--color-status-text`: maps to `text-main` (dark text for message contrast)
  - `--color-status-highlight`: maps to `vanilla-custard` (highlight color for dates/emphasis)
  - `--color-label-text`: maps to `text-secondary` (section labels like "Community feedback")

**Workflow**: Click any politician's star rating → modal opens → see existing reviews → if eligible, rate & comment → 6-month lock applies → rating appears in aggregate totals app-wide (wall header, sidebars, candidate cards, etc.)

### 2. Office Holder Sidebar Display & Centralization

**Previous Issue**: Custom `CurrentOfficeHolderCard` component duplicated the office holder display pattern already implemented in `PoliticianSidebar.tsx`. Consumed too much space in main content area; only showed one office holder instead of all.

**Fix**: Moved office holders from main content to right sidebar (responsive: full-width below content on mobile, sticky `lg:w-72` column on desktop), reusing the existing `PoliticianSidebar` pattern.

**Updated File**: `src/components/features/ElectionSeatPageClient.tsx`
- Added `getOfficeHoldersByShapeAndRole` to elections service imports
- Added state: `officeHolders`, `loadingHolders`, `engagementSummaries` (Map<politician_id, engagement_stats>)
- Fetch logic in `fetchAll`: queries office holders + batch-loads engagement stats via `getPoliticianEngagementSummaries`
- Sidebar Card displays:
  - Heading: "Current Office Holders" + Landmark icon
  - Loading state (spinner)
  - If empty: "No active office holders for this seat yet"
  - If populated: up to 5 office holders in compact cards, each showing:
    - Avatar (via `<Avatar>` primitive, with fallback to initials)
    - Name + "On Choseno" badge (if linked_profile_id exists)
    - Engagement stats (`PoliticianEngagementStats` component: supporters, star rating, comment count)
    - Role/Party info (e.g. "Councillor · Independent")
    - Link to politician wall via `profiles.current_ghost_id` (not `linked_profile_id`)

**Deleted**: `src/components/features/CurrentOfficeHolderCard.tsx` (redundant; logic merged into sidebar)

### 3. Election Page Wall Link Fix

**Bug**: Office holder cards on election seat page linked to `/wall/{linked_profile_id}/...`, which looked up by raw `profile.id`. Wall pages require `/wall/{current_ghost_id}/...` to resolve. Result: every office holder link 404'd on the wall page, showing empty "Politician Wall" placeholder.

**Root Cause**: `linked_profile_id` is the profile's database `id` (internal); `current_ghost_id` is the person's anonymous identifier (public). Wall page router expects the ghost ID.

**Fix**: Changed link generation in `ElectionSeatPageClient.tsx` from `holder.linked_profile_id` to `holder.profiles.current_ghost_id` (already present in the `getOfficeHoldersByShapeAndRole` query response, which joins profiles data).

**Verification**: Daniel Fontaine's wall now correctly displays name, "Councillor" badge, constituency, and profile data instead of generic "Politician Wall" placeholder.

### 4. Avatar Robustness & Consistency

**Problem**: Multiple avatar/photo rendering locations across the app had ad-hoc fallback logic:
- `EditProfileClient.tsx`: manual `rounded-full` div with conditional Image
- `OnboardingFlowClient.tsx`: same pattern
- `PoliticianWallClient.tsx`, `PoliticianSidebar.tsx`, `ElectionSeatPageClient.tsx`: all used `<Avatar>` from primitives

When `photo_url`/`avatar_url` fields pointed to broken URLs (e.g. Daniel Fontaine's `avatar_url` was mistakenly set to a Facebook tracking pixel), the browser would:
- Render a broken-image glyph (varies by browser/extensions)
- Overflow alt text into the tiny circle
- Show nothing visible at very small sizes

Result: inconsistent appearance across the app — some office holders showed initials, some showed nothing, some showed wrapped text.

**Fix**: Updated `Avatar.tsx` primitive to track image load failures and gracefully fall back:

```tsx
const [failed, setFailed] = useState(false);
if (src && !failed) {
  return <img src={src} onError={() => setFailed(true)} ... />;
}
return <div className="...gradient...initials...">
```

Now every surface that uses `<Avatar>` (walls, sidebars, candidate cards, office holders, feed) automatically shows a colored initial-letter circle whenever an image is missing or 404s. **One fix, app-wide consistency.**

**Verified**: Manually dispatched error event on a test image → correctly swapped to initials. Real 404 test also triggers fallback.

**Note**: Facebook tracking pixels in this sandboxed browser silently stall instead of cleanly 404ing (network-level blocks), so they don't trigger the error handler here — but in real browsers with normal networking, the `onError` will fire and the fallback will render correctly.

### Files Changed / Added

- `src/components/features/ElectionSeatPageClient.tsx` (office holder sidebar, link fix, engagement stats)
- `src/components/primitives/Avatar.tsx` (error handler, graceful fallback)
- `src/lib/services/ratings.ts` (batch engagement fetching, rating lookups)
- `src/components/features/PoliticianRatingModal.tsx` (width, overlay opacity, theme colors)
- `src/app/globals.css` (status-text, status-highlight, label-text theme variables)
- `PRODUCT.md` (updated with ratings, office holders, avatar system docs)

**Deleted**:
- `src/components/features/CurrentOfficeHolderCard.tsx` (logic merged into sidebar)

### Known Non-Issues / Out of Scope

- **Data Quality**: Some office_holders rows have garbage avatar_url values (e.g. tracking pixels) — not a rendering bug (the fix above handles it), but worth auditing the data source pipeline to prevent future loads. Current workaround: stale URLs will show as initial-letter circles until the office_holders record is updated.
- **Opengraph Cards**: `/wall/[ghostId]/opengraph-image.tsx` files still pull `avatar_url` directly for social-share previews. A broken URL there produces a broken share-card image (can't use React Avatar component server-side). Lower visibility, not touched this session.
- **Facebook Tracking Pixel**: Daniel Fontaine's `avatar_url` pointing to `https://www.facebook.com/tr?...` is a data issue, not a code issue. To fix: audit office_holders.populate scripts and update the erroneous row via SQL.

---

## 2026-08-11: Municipal Civic Party Ingestion & Active Office Holder Detection

### Problem & Context
1. **Municipal Party Data**: OpenNorth API returns empty party strings for municipal representatives across Canada because official city websites present mayors and councillors non-partisans. Consequently, Canadian municipal office holders defaulted to `'Independent'`.
2. **Aspiring Badge Rendering**: The Politician Wall (`/wall/[ghostId]/[slug]`) previously prepended `"Aspiring "` unconditionally to `political_target_role` (e.g. `[ASPIRING MAYOR]`), causing current sitting office holders (like Brenda Locke, Mayor of Surrey) to be incorrectly displayed as "Aspiring Mayor".

### Changes & Solution
1. **Civic Party Ingestion (BC & QC)**:
   - Sourced live municipal party data from **CivicInfo BC** (`civicinfo.bc.ca`) for British Columbia municipalities and **Élections Québec / Wikipedia MediaWiki API** for Quebec municipalities (Montreal, Quebec City, Laval, Gatineau, Longueuil).
   - Created [`scripts/fast-populate-bc-qc.py`](file:///Users/vmn2k4/Coding/Choseno/scripts/fast-populate-bc-qc.py) to seed missing civic parties into `public.political_parties` and update `office_holders.political_party_id` for matched office holders.
   - Re-exported updated records to [`scripts/office-holders-data.csv`](file:///Users/vmn2k4/Coding/Choseno/scripts/office-holders-data.csv).

2. **Active Office Holder Detection**:
   - Updated `enrichProfileWithContactFallback()` in [`src/lib/services/politicianWall.ts`](file:///Users/vmn2k4/Coding/Choseno/src/lib/services/politicianWall.ts) to query `office_holders` (by `linked_profile_id` or matching full name) and set `is_office_holder = true` on the profile.
   - Updated [`src/components/features/PoliticianWallClient.tsx`](file:///Users/vmn2k4/Coding/Choseno/src/components/features/PoliticianWallClient.tsx) badge rendering:
     - **Active Office Holders**: Render official role badge directly (e.g. **`[MAYOR]`**, **`[COUNCILLOR]`**, **`[GOVERNOR]`**, **`[MP]`**).
     - **Candidates / Non-Office Holders**: Render **`[ASPIRING MAYOR]`**, **`[ASPIRING COUNCILLOR]`**, etc.

3. **Documentation**:
   - Updated [`OFFICE_HOLDERS_DATA_GUIDE.md`](file:///Users/vmn2k4/Coding/Choseno/OFFICE_HOLDERS_DATA_GUIDE.md) to document the updated multi-source municipal party pipeline and office holder detection method.

---

## 2026-08-14: Canada `School District` boundary type (third layer type, no national source)

New `country_boundary_types` row: `Canada` / `School District` (rank 8, `admin_only=false`,
`is_container=false`, `election_eligible=true`). Loaded via `scripts/upload_boundary.py`
following the [`docs/adding-boundary-data.md`](docs/adding-boundary-data.md) runbook.

**Confirmed before sourcing anything**: unlike Municipal (StatsCan Census Subdivisions, one
national file) and unlike USA's four Census Cartographic layers, school boards/divisions are
**provincial jurisdiction** in Canada with no StatsCan national boundary file — same
per-province-portal situation as §11's Provincial ridings load. Checked the standard StatsCan
`*_000b21a_e.zip` naming pattern directly (404s) before committing to the per-province search.

| Province | Source | Layer chosen | Loaded |
|---|---|---|---|
| BC | DataBC WFS, `WHSE_ADMIN_BOUNDARIES.ADM_EDUC_TRUSTEE_ELEC_AREAS_SP` (198 trustee electoral areas) | Dissolved by `SCHOOL_DISTRICT_NUMBER` → 59 districts; names joined from a hardcoded BC Ministry of Education SD-number→name table (no name field in the source) | 59/59 |
| Alberta | Alberta govt ArcGIS Server, `geospatial.alberta.ca/titan/.../edu_school_and_school_authority_boundary/MapServer`, layer 3 "Public School Authority Boundaries" | Public only (layers 7/11 are Separate/Catholic and Francophone, overlapping the same geography — skipped for a clean partition, same call as Ontario below) | 42/42 |
| Ontario | `services.arcgis.com/rGKxabTU9mcXMw7k/.../School_Board_Boundaries` (72 total: Public/Catholic × English/French, all overlapping) | Filtered to `TYPE=Public, LANGUAGE=English` for a clean province-wide partition | 31/31 |
| Quebec | `donneesquebec.ca` dataset `territoires-des-commissions-scolaires-du-quebec`, `cs_fra.geojson` (francophone service centres, the general province-wide system; anglophone boards overlap on top of it for eligible students, same reasoning as ON/AB) | — | 60/60, needed `--vertex-cutoff 200000` (2 shapes over 100k, incl. Baie-James) |
| Manitoba | `services.arcgis.com/mMUesHYPkXjaFGfS/.../Manitoba_School_Divisions` | — | 36/36 (see gotcha below) |
| Saskatchewan | `gis.saskatchewan.ca/arcgis/rest/services/Education/SchoolsAndDivisions/MapServer`, layer 7 "SD_Public" | Public only, same reasoning as AB/ON | 18/18 |
| New Brunswick | GNB Socrata, dataset `4ei4-9dzg` ("NB School Boundaries") — per-**school** catchment polygons (439 features), not per-district | Dissolved by `districtid` (`ASD-E/N/S/W`, `DSF-NE/NO/S`) → 7 districts. Needed `ST_MakeValid(geometry)` wrapped around the dissolve `ST_Union` — the raw per-school catchments had self-intersections that made a plain `ST_Union` throw `TopologyException: side location conflict` | 7/7, needed `--vertex-cutoff 200000` |
| Nova Scotia | `data.novascotia.ca` Socrata, dataset `v69y-jn74` ("Nova Scotia School Board Zones - English") | English only — the French board (CSAP, dataset `76iu-75v2`) is a single province-wide zone that overlaps all 7 English boards, not a partition | 7/7 |
| PEI, Newfoundland & Labrador, Yukon, NWT, Nunavut | — | **Not loaded** — each of these has only one province/territory-wide school authority (NL consolidated to one English district in 2013; PEI has one English + one French board, both island-wide; the three territories run community school councils under a single territorial department). A single boundary equal to the whole province/territory isn't a useful sub-division, and there's nothing to source — direct parallel to Nunavut's missing riding data in §11 | — |

**Total: 260 shapes across 8 provinces, 0 invalid geometries** (verified via the same
`boundary_uploads`/`map_shapes` join query as §11, plus a live `find_boundaries_by_point`
spot-check against Toronto/Winnipeg/Vancouver/Halifax/Montreal — all five resolved to the
correct district).

**Decision made across every multi-board province (AB, ON, SK, QC, NS)**: where a province
runs overlapping public/separate/Catholic/Francophone/Anglophone systems covering the *same*
geography rather than partitioning it, load only the one system that partitions the whole
province (the larger/general one — Public in AB/ON/SK, Francophone in QC, English in NS) so
`map_shapes` stays a clean one-boundary-per-point lookup like every other type. The minority-
language/system boards were deliberately not loaded — flagged here in case that's revisited.

**A new class of "over-granular source" gotcha, beyond §1's Manitoba-voting-areas precedent**:
BC and NB's sources weren't just finer-grained, they lacked a name field at the level needed
(BC) or were per-*school* rather than per-*district* (NB), and NB's raw catchment polygons had
real topology errors that only a dissolve `ST_Union` (not `--analyze-only`) surfaces. Wrap
`ST_MakeValid(geometry)` around the geometry argument in the dissolve SQL by default for any
future per-school/per-facility source, not just when a plain `ST_Union` first fails.

**A real bug hit and fixed here**: Manitoba's source `Source` field (chosen as `--code-field`)
is `NULL` on 9 of 36 features — the resumability dedup check treats those as colliding,
so 2 of the null-code shapes silently failed to insert (34/36 loaded, not caught until the
verification query). Fixed by deleting that batch and re-running with `OBJECTID` (guaranteed
unique) as the code field instead, keeping `Source` as a plain property. **Always check a
chosen `--code-field` for nulls/duplicates before uploading**, not just after a count mismatch.

**Mandatory Rule for Office Holder Ingestion: Always Create & Link Ghost Profile Walls**:
Never insert bare rows into `office_holders` without creating corresponding `profiles` and `politician_profiles` rows.
Every elected official in Choseno requires:
1. `profiles`: `role = 'politician'`, `full_name`, `country`, `constituency` (boundary name), `designation` (role title), and `current_ghost_id = gen_random_uuid()`.
2. `politician_profiles`: `id = profile_id`, `political_target_role = role_title`, `target_boundary_type`, `target_boundary_name`, `wall_slug = slugify(full_name + '-' + role_title)`.
3. `office_holders.linked_profile_id = profile_id`.

**Why**: `RepresentationBranchTree.tsx` and boundary directory widgets only render the `"View Wall ->"` button if `node.ghost_id` exists (derived from `profiles.current_ghost_id`). Without this link, the official card renders in a truncated contact-only state without an interactive wall, breaking claiming and constituent engagement. Additionally, if the newly added role is the head of the branch (e.g. `Board Chair`, `Mayor`), it MUST be added to `HEAD_ROLE_TITLES` in `FindMyDistrictClient.tsx` and `src/app/elections/[boundarySlug]/page.tsx` so it renders at the top of the hierarchy tree.

---

## 33. News Ingestion, Verification & Directives Pipeline (Added 2026-08-17)

Choseno employs a structured, multi-tier news ingestion pipeline designed to ingest substantive (350–750 words), verified political and civic news articles into the `news_articles` table, link them to politician profile walls, resolve them to PostGIS electoral boundary polygons, and generate ranked social distribution files.

### 33.1 News Directives Suite (`NewsPrompts/`)
All news collection operations are governed by standardized directives located in `NewsPrompts/`:
1. **`NewsPrompts/NewsCollectionPrompt.md`**: Broad civic news directive focusing on wire feeds (AP, Reuters, CP), executive councils, and provincial/state portals (up to 100 articles/batch).
2. **`NewsPrompts/KeyLeadersNewsCollectionPrompt.md`**: Targeted collection directive focused on the 30 designated Key Political Leaders in Canada and the U.S. with pre-mapped UUIDs for instant wall mirroring.
3. **`NewsPrompts/UniversalWebNewsCollectionPrompt.md`**: Broad-spectrum Google and deep-web discovery directive spanning 50 U.S. states, 10 provinces, 100+ cities, and court dockets with dynamic politician profile lookup and tagging.

### 33.2 Ingestion Engine & Execution (`scripts/insert-news-batch.js`)
The sanctioned ingestion engine is `scripts/insert-news-batch.js`. It performs:
- **Deduplication Screening**: Compares candidate articles against the 1000 most recent database rows across three axes: exact slug match, canonical source URL overlap, and headline token overlap (≥70%) within a ±3-day window. Colliding articles are `PATCH`ed with new information rather than creating duplicate rows.
- **Politician Wall Synchronization**: Calls `admin_sync_news_article_tags(p_article_id, p_politician_ids)` to create mirrored wall post rows in the `posts` table backdated to the article's `event_date`.
- **Geographic Electoral Boundary Synchronization**: Calls `admin_sync_news_article_boundaries(p_article_id)` to resolve the article's `latitude`/`longitude` against PostGIS boundary polygons (`news_article_boundaries`), automatically populating local riding and state feeds.
- **Virality Ranking & Archive Tracking**: Prepend new stories to `batch-ranked-news.csv` (12-column format tracking top-100 ranked stories) and saves any overflow (#101+) to `scripts/overflow-news-batch.json`.

---

## 2026-08-20/21: Candidate Video Interview System

Full plan and running implementation log: [`docs/VIRTUAL_INTERVIEW_SYSTEM.md`](docs/VIRTUAL_INTERVIEW_SYSTEM.md)
— kept as its own doc rather than folded in here because it doubles as the working design doc
(open questions, superseded drafts, build order) as well as the record of what shipped. This
entry is the condensed architecture summary.

**Starting point, deliberately not rebuilt from scratch**: the "create questions → candidate
answers with video → public sees it → people comment" system already existed at ~80%, under
the name *election questionnaire* (`election_questions`/`election_candidate_answers`/
`submit_candidate_application`, §16/§21). The entire feature below is additive columns and new
components on top of that, not a parallel schema.

**Schema** (`20260821000000_candidate_video_interviews.sql`,
`20260821000002_election_question_narration_text.sql`): `election_questions` gains
`question_video_url`/`question_video_path` (a video played *to* the candidate before they
answer) and `max_answer_seconds` (admin-configurable per question, replaces a hardcoded 30/60s
in `VideoRecorder`'s `maxDuration` prop) and `narration_text` (the spoken script for a
generated question video — independent of `question_text`, since a ranking/choice question's
raw text isn't speakable as-is; defaults to `question_text` with its options appended for
choice/ranking types). `posts` gains `election_answer_id` (nullable FK to
`election_candidate_answers`, `ON DELETE SET NULL` so a deleted answer doesn't take its
comments/likes with it) and `post_kind` (`'standard' | 'answer_pitch'`), with a unique partial
index on `election_answer_id` so retaking an answer updates one post in place rather than
piling up duplicates.

**Every video answer is also a real wall post (TikTok model)** — the moment a candidate saves
a video answer, `upsert_answer_pitch_post(answer_id)` (modeled on
`create_wall_post`, §31, but with `is_country`/`is_international` forced `false` so these stay
scoped to the candidate's wall and the comparison carousel, not the main feed) creates or
updates a linked `posts` row, `post_kind='answer_pitch'`. This gets a video answer the
*standard* treatment for free — `comments`, `likes_count`/`dislikes_count`, moderation, rate
limiting — instead of a bespoke comment system. Retake (`CandidateApplicationClient.tsx`,
"Retake Video Answer") replaces the linked post's `video_url` in place; likes and comments on
it are a deliberate keep, not reset.

**Three viewing modes, mapped to one underlying data shape ("a question + a list of
`{person, video post}`")**:
1. **One combined video per candidate** — `PlayInterviewReel.tsx`, a full-screen closeable 9:16
   sequencer that autoplays a candidate's answers in question-rank order
   (`getCandidateVideoAnswersForReel`). Two entry points open the same component: the seat
   page's candidate strip ("has a pitch" badge, via `getCandidateIdsWithVideoAnswers`, one
   batched query) and a "Play Interview" button on the candidate's own `CandidacyWall.tsx`.
2. **One video per question, single candidate** — unchanged, already existed on
   `CandidacyWall` as the per-answer video.
3. **One question, many candidates' answers, swipeable** — the genuinely new piece.
   `getCandidateAnswersByQuestion(questionId)` (a deliberately separate service function from
   the candidate-scoped `getPublicCandidateAnswers`, per `docs/SERVICES.md` — different query
   shape, not a parameterized variant) feeds `QuestionAnswerCarousel.tsx`: question pinned at
   top (+ its own video, if set), one candidate's answer, next/prev/swipe to the same question's
   next candidate. `ElectionInterviewTab.tsx` is the seat-page tab ("Candidate Interview",
   sibling to "Community Support") listing every public video-answerable question; tapping one
   opens the carousel inline.

**Candidate access — two paths, no new auth model:**
- **Already has an account / mid-application**: unchanged, `/apply/[candidateId]`.
- **No account yet ("invite a politician")**: `SendInterviewInviteFlow.tsx` is the new
  search-and-invite on-ramp on the seat page ("Search & Send Interview Invite", next to the
  existing "Add Candidate Directly" / per-stub "Invite to Claim" panels — both of those stay,
  this is a faster single-step alternative). It searches everyone on Choseno *and* every
  unclaimed office-holder record via `search_politicians_and_officeholders` (the same RPC the
  nav-bar global search uses), creates an `add_unregistered_candidate` stub if the selected
  person isn't already a candidate for the seat, then sends the invite through the existing
  claim-token infrastructure (`create_claim_invite` → Supabase `admin.inviteUserByEmail` →
  `claim_candidacy_via_token`, §28) — which already merges onto a real account if the invitee
  turns out to have one, so "search finds an already-registered politician" and "search finds
  a total stranger" are the same code path. `ClaimCandidacyClient.tsx` now leads with "Answer
  Interview Questions" (→ `/apply/[candidateId]`) as the first action after a successful claim,
  ahead of the campaign-page link — the claim itself already handled auth, so this is the real
  first step, not a second signup screen.
- **Invite-link edge case fixed** (`20260821000003_claim_candidacy_via_own_email.sql`,
  `/auth/confirm`): a Supabase invite email's link doesn't reliably carry the claim token or a
  working `next` param through to the browser. `claim_candidacy_via_own_email()` matches a
  pending `candidate_claim_invites` row by the *just-`verifyOtp`'d* caller's own email as a
  fallback, and `/auth/confirm` routes a successful match through `/auth/reset-password`
  first — the account `admin.inviteUserByEmail` created has no password yet and nothing else
  in this flow ever prompts for one — before landing on `/apply/[candidateId]`.

**Admin — question video, two ways** (`ElectionsAdminClient.tsx`, the question editor):
upload directly (`VideoRecorder` → `updateElectionQuestionVideo`), or generate one from text.
Generation (`GenerateQuestionVideosFlow.tsx`, "Generate Question Videos", bulk — edit a
narration script per question, generate sequentially since the generator's shared working
files make parallel calls unsafe, review, save each) calls
`/api/admin/generate-question-video`, which shells out to a **local-only** pipeline:
`nvidia_shorts_studio/question_card_engine/generate.py` (Qwen TTS via MLX for narration audio,
then HyperFrames — the same 9:16 kinetic-caption video engine used for the news-shorts
pipeline — over one fixed Choseno-branded background, no per-question AI image generation).
The route 403s outside `next dev`: the pipeline needs local MLX model weights and ffmpeg that
don't exist in a deployed environment, and shelling out to an external script is deliberately
never exposed over the network. Generated (or uploaded) videos upload to the existing
`politician_videos` storage bucket.

**Playback constraint**: full-screen, closeable, strictly 9:16 everywhere (recording, upload,
and generated video). Recording already complied (`VideoRecorder`'s `aspectRatio: 9/16`
capture); upload-time aspect-ratio validation for question/answer videos was flagged as a
follow-up, not yet built.

**Scope note**: the new UI primitives (`QuestionAnswerCarousel`, `PlayInterviewReel`, the
`answer_pitch` post rendering) are written against "a question + a list of people's video
posts," not hardcoded to elections — a future non-election video-reaction case (e.g. "officials
react to this news story") could reuse them with a different data-fetching function, but
nothing beyond the election case is built now.

---

## 2026-08-21: Election Nomination Windows & Unified Candidate Removal

**Problem**: `elections.status` was a 3-stage lifecycle (`draft → nominations_open → active →
closed`) advanced by an admin manually clicking "Activate Election" — but "activating" had
nothing to do with nominations at all; it was really "voting day has arrived." There was no
stage representing "nominations have closed but voting hasn't happened yet," so
`apply_for_seat` had to keep accepting new applications straight through `active` as a
workaround (§ `20260729000003`), meaning a candidate could self-nominate on election day itself.

**Fix — a real 4th stage, date-driven** (`20260821000004_election_nomination_windows.sql`):
`elections` gains `nomination_open_date`/`nomination_close_date` (both set once at creation,
`CHECK (nomination_open_date <= nomination_close_date AND nomination_close_date <=
election_date)`), and the status enum gains `nominations_closed`, sitting between
`nominations_open` and `active`. `compute_election_status(status, nomination_close_date,
election_date)` is a pure function: `draft`/`closed` pass through unchanged (still the two
manual, admin-only bookends — draft because an election shouldn't go live just because a date
rolled past while it's still being built, closed because archiving is a deliberate call, not
automatic); the three date-driven stages are derived fresh from `CURRENT_DATE` every call, so
there's never a "stale status" to reconcile at read time — there's a stateless function of
today's date and two stored dates. `sync_election_status(election_id DEFAULT NULL)` writes that
computed value back to the stored `status` column (same lazy-sync shape as
`promote_expired_election_admin_applications()`) so every existing query/RLS policy that
filters on the raw `elections.status` column keeps working unchanged — callers just need to
sync before reading (`getElections`, `getOpenSeatsNearShapeIds`, `getActiveSeatsByShapeIds`,
`getActiveSeats` in `elections.ts` all now call `sync_election_status` first) or after writing
(`updateElectionDates` re-syncs immediately, since moving `nomination_close_date`/
`election_date` can flip the stage instantly).

**Security-sensitive paths don't trust the cached column at all**: `apply_for_seat` calls
`sync_election_status(election_id)` then re-derives the effective status via
`compute_election_status(...)` directly before gating — a stale, not-yet-synced `status` column
can never wrongly grant or deny a nomination. Two read-facing RPCs
(`20260821000005_election_status_functions_use_effective_status.sql`) —
`find_open_seats_in_container` and `get_active_elections_for_user` — were switched from
filtering on the raw stored column to `compute_election_status(...) IN ('nominations_open',
'nominations_closed', 'active')` for the same reason: a voter-facing browse shouldn't show
stale data just because nothing recently wrote to that election row. A seat now stays visible
for browsing straight through `nominations_closed` and into voting day, same as it already did
across `nominations_open`/`active`.

**Unified candidate removal** — `remove_candidate(candidate_id)` (same migration): lets a
platform admin *or* that seat's approved election administrator remove **any** candidate on the
seat (registered or stub, self-added or not) — distinct from the pre-existing
`deleteCandidacy`/"Candidates withdraw own application" RLS policy, which only ever let a
candidate remove their own application and is untouched. This is the power the
`nominations_closed`/`active` stages need: once self-nomination through Apply is gated off,
managing a seat's roster (removing a no-show, a duplicate, or someone disqualified) has to be
possible some other way. `ElectionsAdminClient.tsx`'s existing delete-candidate action now
calls `removeCandidate` instead of `deleteCandidacy`; `ElectionSeatPageClient.tsx` gained a new
"Manage Candidates" list (visible whenever the seat has candidates, not just to the approved
election administrator's other panels) with a per-candidate remove button using the same RPC.

**Admin UI** (`ElectionsAdminClient.tsx`): election creation now takes three dates (nominations
open / nominations close / election day) instead of one, validated client-side
(`open ≤ close ≤ election day`) before the request. An existing election's dates are editable
in place ("Edit Dates" → `updateElectionDates`, same validation, re-syncs status on save) — this
also covers fixing up the 4 pre-existing elections that got a backfilled guess when the columns
were added (`nomination_open_date = created_at`, `nomination_close_date = GREATEST(created_at,
election_date - 14 days)`). `STATUS_FLOW`/`STATUS_LABEL` collapsed to reflect that
`draft → nominations_open` is the only manual "publish" step left — from there,
`nominations_open → nominations_closed → active` happen on their own as dates pass; the
"Advance Status" button on any date-driven stage now only ever means "Close Election," the
other manual bookend, archivable from any of the three.

