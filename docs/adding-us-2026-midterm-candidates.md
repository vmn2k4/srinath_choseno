# Starting the 2026 US Midterms & loading confirmed candidates — how-to / progress log

**Status (as of this writing, run still in progress after a full data-correctness
fix + clean redo — see "Critical bug" section below before trusting any earlier
numbers from this session). See "RESUMING THIS WORK" if you're picking this up
cold.**

## Critical bug found and fixed: `candidate_status == 'C'` is not enough

**Read this before running anything against the FEC API for this feature.**
The first full run of this script (House + Senate, ~2,500 candidate rows)
looked clean and finished successfully, but was actually **wrong**: Senate
came back with a "race" in **all 50 states**, when only ~33 states have a real
Class II or special 2026 Senate election. Confirmed live: New York, California,
and Washington (all Class III/Class I seats not up until 2028 or later) each
returned `candidate_status: "C"` ("active") results for `cycle=2026`.

**The bug**: the FEC API's `cycle` parameter on `/v1/candidates/` is a **filing
-activity window**, not "on the ballot this year." A candidate/officeholder
whose committee is financially active during the 2025-2026 reporting period
comes back as `candidate_status: "C"` under `cycle=2026` even if their actual
election is a different year entirely. The field that actually says when
they're on the ballot is `election_years` (an array), e.g. a real record
observed live: `{"name": "COCHRAN, HEIDI", "candidate_status": "C",
"election_years": [2028], "cycles": [2026]}` — active, but not a 2026 race.

**The fix** (`fetch_candidates()` in the script): require **both**
`candidate_status == 'C'` **and** the target cycle actually present in
`election_years`, not `candidate_status` alone:

```python
return [c for c in results if c.get("candidate_status") == "C" and cycle in (c.get("election_years") or [])]
```

Verified the fix directly: NY/CA/WA Senate queries now correctly return 0
candidates, while genuine 2026 races (SD, TX, IL Senate) still return realistic
non-zero counts (slightly *lower* than before the fix, since a few individual
stale filers get correctly dropped from otherwise-real races too — this isn't
Senate-only contamination, House candidate lists had the same low-level noise,
just without the "phantom whole race" symptom since every House seat really is
up every 2 years regardless).

**What this meant for already-loaded data**: the entire first run's output
(seats, candidates, stub profiles, politician_profiles for the "2026 US
Midterm Elections" election) was deleted and the run redone from scratch with
the fix — not patched surgically, since there was no cheap way to tell which
already-inserted rows were contaminated without re-querying every one anyway.
See "Exact repeatable workflow" for the delete-everything-and-redo commands if
you ever need to blow away and rebuild this election's data again.

**If you write a new sync script against FEC's `/v1/candidates/` for any other
office/purpose: always filter on `election_years`, never trust `cycle` +
`candidate_status` alone.** This will bite `scripts/sync_us_federal_candidates.py`
too (it only filters on `candidate_status`, confirmed by reading it) — not
fixed as part of this pass since that script populates the separate read-only
cache table, not the live election feature, but flagged here so a future
session doesn't have to rediscover this.

This doc is the repeatable recipe for what `scripts/start_us_2026_midterms.py`
does: turning "the 2026 US midterms are happening" into a real, live election on
Choseno — an `elections` row, one `election_seats` row per real House/Senate race,
and one `election_candidates` row per candidate currently on file with the FEC —
plus what it took to get there and the mistakes made along the way, so the next
session (human or agent) doesn't repeat them.

## The one-paragraph version, if you're in a hurry

Run `python3 scripts/start_us_2026_midterms.py run --office both --cycle 2026`
with `DATABASE_URL` and `FEC_API_KEY` set. It's idempotent — safe to just re-run
after any crash/interruption, it'll skip everything already loaded. See "Exact
repeatable workflow" below for the full command and what each part means.

## Two different things named "election data" in this codebase — don't conflate them

This tripped up the first pass at this task and is worth stating explicitly:

1. **`us_federal_election_candidates`** (migration `20260729000012`) — a
   read-only *cache* of official FEC data, filled by
   `scripts/sync_us_federal_candidates.py`. Nothing on the live site reads from
   it directly as far as user-facing candidate listings go; it exists for
   reference/backfill.
2. **`elections` / `election_seats` / `election_candidates`** (migration
   `20260724000000_election_mode.sql` onward) — the *real*, user-facing
   platform feature. This is what "an election is happening on Choseno" means:
   a real `elections` row, real `election_seats` (one per district/state), and
   real `election_candidates` rows that each point at an actual `profiles` row
   with a public Ghost Wall (`/wall/[ghostId]/[slug]`).

**"Start the election race and add confirmed candidates" means the second one.**
Populating the FEC cache table does nothing visible on the site by itself — you
have to create the election, the seats, and the candidates in the real tables.
`scripts/start_us_2026_midterms.py` does exactly this (it does *not* touch
`us_federal_election_candidates` at all — it's a separate, purpose-built script,
not a variant of `sync_us_federal_candidates.py`).

## How a candidate normally gets added (the human path) — read this first

Before writing anything that touches these tables, go click through it once as
an admin at `/admin/elections`:

1. **Create the election**: name + date. **Always starts as `status = 'draft'`**
   — confirmed live, there's no way to create it any other way. It needs an
   explicit "Open Nominations" click (or a direct status update) to become
   `nominations_open`, which is the status that actually makes it visible to
   voters/candidates.
2. **Build seats** (`ElectionsAdminClient.tsx`'s "Build Seats" panel): pick a
   country, optionally scope to one state ("container"), pick a target boundary
   type (`Federal` for US House, `State` for US Senate — **`State` is shared
   with Governor**, disambiguated only by which `role_title` you assign when
   creating the seat, since both attach to the identical `map_shapes` row),
   review/deselect the matched boundaries, pick the (usually single, auto-shown)
   role, and bulk-create. **This whole panel only renders while
   `selectedElection.status === 'draft'`** (`ElectionsAdminClient.tsx` line
   ~1512) — confirmed live: once you open nominations, the seat-builder
   disappears. Build every seat you'll ever need *before* opening nominations,
   or go back to the DB directly afterward (see below).
3. **Per seat, "Fetch candidates"** calls the `fetch-candidates` Edge Function,
   which live-queries the right official source for that seat's jurisdiction
   (`detectJurisdiction()` in the Edge Function — for the US, `Federal` boundary
   → FEC House, `State` boundary **and** `role_title === 'U.S. Senator'** → FEC
   Senate). Returns a read-only list of `{name, party}` — this function commits
   nothing to the DB itself.
4. **Per candidate, click "+"** — calls `addFetchedCandidate()`
   (`src/lib/services/candidateSync.ts`), which resolves the free-text party
   name against `political_parties` for that seat's country and then calls the
   `add_unregistered_candidate` RPC. That RPC (admin- or seat-election-admin-only)
   creates: a stub `profiles` row (`role='politician'`, a fresh `current_ghost_id`
   so it has a real wall immediately), a `politician_profiles` row, and the
   `election_candidates` row itself with `status='approved'` — no self-signup,
   no video/questionnaire required for an admin-added stub (those stay optional
   until/unless the real candidate later claims the profile).

Confirmed live against a real seat (South Dakota's at-large House district) that
this whole path works end to end and produces exactly the row shape you'd
expect — see "Verifying the script matches the UI" below for how that was
checked.

## Why this needed a script instead of just clicking through the UI

Clicking is fine for a handful of seats. It does not scale to a full midterm
cycle:

- **~470 real races** (435 House + however many of the 50 states actually have
  a 2026 Senate race — only Class II seats + any specials, not hardcoded, see
  below) each need their seat built.
- **Each seat's candidate list needs its own "Fetch" + N × "+" clicks** — with
  multi-candidate primaries (NY-12 alone had 20 active filers), that's easily
  1,500+ individual "+" clicks across the whole midterm cycle.
- **The seat-builder is only available in `draft`** (see above) — once you've
  opened nominations (which you need to do for the election to be live/visible),
  you're locked out of the bulk-boundary-picker UI entirely and have to go
  straight to the DB for any further seats anyway.

So: build seats and add candidates via a script that reproduces exactly what the
UI's "Build Seats" panel and "+" button do at the SQL level, driven by the same
FEC data the "Fetch candidates" button uses.

## Data source: FEC's OpenFEC API

- **Endpoint**: `https://api.open.fec.gov/v1/candidates/`, queried by
  `(cycle, office, state[, district])` — `office=H` needs state+district,
  `office=S` needs state, `office=P` (President) needs neither (not handled by
  this script — no `map_shape_id` fits a nationwide race, same limitation noted
  in `sync_us_federal_candidates.py`).
- **API key**: get one free, instantly, at `https://api.data.gov/signup/`.
  Stored in `.env.local` as `FEC_API_KEY` (gitignored). `DEMO_KEY` works but is
  rate-limited to ~30 req/hour — nowhere near enough for a 435-district run (that
  alone needs ~435 requests); get a real key before running this at full scope.
- **"Confirmed candidate" = `candidate_status == 'C'`** (an active filing),
  per explicit user direction this session — **not** "won their party's
  primary." In a state whose primary hasn't happened yet, you'll legitimately
  see multiple same-party candidates for one seat (e.g. South Dakota's House
  race: 3 Republicans + 2 Democrats, all still "active" as of Aug 2026). This
  is real, correct FEC data, not a bug — verified by spot-checking several
  different states/parties (SD, CA-12, NY-12, IL Senate, NJ Senate) all came
  back with a realistic multi-party mix; one all-Republican-looking result for
  a single district earlier in this session was that district's real filing
  list, not a systemic party-skew bug.
- **US House scope = the 435 apportioned voting districts only**, not the 441
  `boundary_type='Federal'` shapes in `map_shapes` (which also includes DC + 5
  territories' non-voting delegate seats). Excluded to match the existing
  convention: `office_holders` has zero rows with `role_key='us_representative'`
  in DC/AS/GU/MP/PR/VI — confirmed live via a direct query — so `election_seats`
  follows the same convention rather than inventing a new one. Filtered by
  `properties->>'statefp' NOT IN ('11','60','66','69','72','78')`.
- **US Senate scope is *not* hardcoded to "Class II states"** — the script
  just queries `office=S` for all 50 states and only creates a seat where the
  FEC actually returns ≥1 active candidate. This is deliberately more robust
  than hardcoding a state list: it self-corrects for special elections in
  off-class states without needing updates.

## Two real bugs found and fixed this session (read before touching the SQL builder)

1. **psql's `:'var'`/`\gset` variable interpolation does not reach inside
   `DO $$ ... $$` bodies.** First version of the seat/candidate SQL builder
   used a `DO $$ ... $$` block per candidate (to conditionally skip inserting a
   duplicate) referencing `:'seat_id'` inside the block — this sent the literal
   text `:'seat_id'` to Postgres and errored (`syntax error at or near ":"`),
   confirmed against the real DB, not a hypothetical. **Fix**: no `DO` blocks at
   all — every candidate insert is three plain
   `INSERT ... SELECT ... WHERE NOT EXISTS (...)` statements (guarded
   individually, all referencing `:'seat_id'` directly, which *does* interpolate
   correctly outside dollar-quoting), and the stub profile's UUID is generated
   client-side in Python (`uuid.uuid4()`) and inlined as a literal, so no
   server-side variable ever needs to cross the DO-block boundary in the first
   place. See `build_seat_and_candidates_sql()`.
2. **`elections.name` has no `UNIQUE` constraint.** First version's
   get-or-create used `INSERT ... ON CONFLICT DO NOTHING` with no conflict
   target — with nothing to conflict on, this just silently inserts a duplicate
   election row every time instead of catching anything. **Fix**: an explicit
   `WHERE NOT EXISTS` existence check instead of relying on `ON CONFLICT`. Same
   function also needed to handle the case where the election already exists as
   `'draft'` (e.g. created by hand through the admin UI first, which is exactly
   what happened this session) by advancing it to `'nominations_open'` — never
   downgrades an election that's already further along.

Also worth knowing, not a bug exactly: **FEC names come back as `"LAST, FIRST
MIDDLE"`, all caps** (e.g. `"CRABTREE, CASEY"`) — the admin UI displays this
completely raw. `normalize_candidate_name()` reformats to `"Casey Crabtree"` for
the public wall profile. Not perfect for suffixes (`"SMITH, JOHN JR"` →
`"John Jr Smith"`, suffix ends up mid-name) — an accepted trade-off for a bulk
import, and strictly better than the UI's current raw-passthrough behavior, not
worse.

## New, reusable piece added this session: `get_or_create_political_party`

Found a real gap while reading `addFetchedCandidate()`
(`src/lib/services/candidateSync.ts`): when an official source's party name
doesn't match any existing `political_parties` row for that country, it
**silently falls back to no party** (stuffs the raw name into `bio` as text)
rather than adding it — i.e. the UI's own "+" button did not actually satisfy
"if a new party is showing up, add it."

Fixed with a new admin-only RPC (migration
`20260810000004_get_or_create_political_party.sql`):

```sql
get_or_create_political_party(p_country text, p_name text) RETURNS bigint
```

Upserts on `(country, name)` (same unique constraint the table already has),
admin-only (mirrors the existing "Admins manage political parties" RLS policy).
Wired into `addFetchedCandidate()` so **the real admin UI's "+" button now also
auto-creates new parties**, not just this script — this was a deliberate choice
to fix the underlying gap once, in the shared service layer, rather than only
in the one-off bulk script. Added to `src/lib/supabase/types.ts`'s `Functions`
map by hand (not regenerated) since only one function needed adding.

The script itself (`start_us_2026_midterms.py`) does the equivalent
upsert directly in SQL rather than calling this RPC over the network, purely for
bulk-throughput reasons — the RPC exists for the UI and any future
non-bulk/authenticated-session caller, not because the script needs it.

## Verifying the script matches the UI (do this again if you touch the SQL builder)

Don't trust a from-scratch SQL rewrite without checking it against a real
`add_unregistered_candidate` call. Method used this session:

1. Click through the real UI once (see "How a candidate normally gets added"
   above) against a throwaway single seat, note the resulting row shape via a
   direct `SELECT` joining `election_candidates` → `election_seats` →
   `profiles` → `politician_profiles` → `political_parties`.
2. Run the script's SQL builder against a **disposable scratch `elections` row**
   (`name = 'TEST SCRATCH ELECTION - DELETE ME'`) with fabricated candidates,
   run the same verification `SELECT`, confirm the shape matches exactly
   (same `status`, same `added_by_election_admin_id` attribution pattern, same
   party-matching behavior).
3. Re-run the exact same SQL script a second time, confirm the row count is
   unchanged (idempotency check).
4. Delete every scratch row (`politician_profiles` → `profiles` →
   `political_parties` test row → `elections` row, in that FK order) and
   confirm zero leftover rows before touching real data.

## Exact repeatable workflow

```bash
export DATABASE_URL="postgresql://postgres.qlzyfdwrkcxyqapewxwg:pa.8tX5%2BHh%2FGZn2@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
export FEC_API_KEY="<real key from api.data.gov, not DEMO_KEY>"

# Both House and Senate, full 2026 cycle. Safe to just re-run after any crash --
# every seat/candidate insert is idempotent (ON CONFLICT upsert for seats/parties,
# WHERE NOT EXISTS for candidates), so a re-run just fills in whatever's missing
# and re-fetches already-done districts harmlessly (a few minutes of wasted API
# calls, no wasted writes).
python3 scripts/start_us_2026_midterms.py run --office both --cycle 2026

# Or split by office if you want to check progress / re-run just one half.
# Running these two as separate background processes at the same time is
# safe and roughly halves wall-clock time -- confirmed this session -- since
# House and Senate touch entirely disjoint seats/candidates, and both resolve
# to the same election row without conflict (the get-or-create is a plain
# WHERE NOT EXISTS check, no lock contention that matters at this scale):
python3 scripts/start_us_2026_midterms.py run --office H --cycle 2026 &
python3 scripts/start_us_2026_midterms.py run --office S --cycle 2026 &
wait
```

**Sharding House further, by state, for even more parallelism**: `--states`
takes a comma-separated USPS list and restricts a run to just those states —
safe to run N of these at once (confirmed this session with 5 concurrent
shards, no rate-limit errors on a real, non-`DEMO_KEY` key). House is the real
bottleneck (435 districts vs Senate's 50 states), so this is where sharding
actually matters. Districts aren't evenly distributed per state (California
alone has 52, seven states have only 1), so **don't just chop the alphabet
into equal-sized chunks of states** — that stacks all the big states into
whichever shard happens to contain CA/TX/FL/NY and leaves the others idle.
Balance by district count instead, e.g. (2020-apportionment counts,
round-robin dealt across 5 buckets so each gets a mix of big and small):

```bash
python3 scripts/start_us_2026_midterms.py run --office H --cycle 2026 --states CA,IL,NJ,MA,MO,LA,IA,NE,MT,DE &
python3 scripts/start_us_2026_midterms.py run --office H --cycle 2026 --states TX,OH,VA,TN,WI,OR,KS,NM,NH,ND &
python3 scripts/start_us_2026_midterms.py run --office H --cycle 2026 --states FL,GA,WA,CO,AL,OK,MS,HI,RI,SD &
python3 scripts/start_us_2026_midterms.py run --office H --cycle 2026 --states NY,NC,AZ,MD,SC,CT,NV,ID,WV,VT &
python3 scripts/start_us_2026_midterms.py run --office H --cycle 2026 --states PA,MI,IN,MN,KY,AR,UT,ME,AK,WY &
wait
```

Each shard's totals are independent (`cmd_run`'s "new parties" diff is only
meaningful per-process, not combined) — get the real combined total from the
DB query in "Checking progress" below once all shards finish, not by summing
each shard's own printed total.

**To wipe this election's seats/candidates and start over clean** (e.g. after
a data-correctness fix like the `election_years` one above, where patching
already-inserted rows isn't worth it) — deletes stub profiles,
politician_profiles, and seats for just this one election; leaves the
`elections` row itself and the shared `political_parties` table untouched:

```bash
psql "$DATABASE_URL" -c "
WITH target AS (
  SELECT ec.politician_id FROM public.election_candidates ec
  JOIN public.election_seats es ON es.id = ec.seat_id
  JOIN public.elections e ON e.id = es.election_id
  WHERE e.name = '2026 US Midterm Elections'
)
DELETE FROM public.politician_profiles WHERE id IN (SELECT politician_id FROM target);
"
psql "$DATABASE_URL" -c "
WITH target AS (
  SELECT ec.politician_id FROM public.election_candidates ec
  JOIN public.election_seats es ON es.id = ec.seat_id
  JOIN public.elections e ON e.id = es.election_id
  WHERE e.name = '2026 US Midterm Elections'
)
DELETE FROM public.profiles WHERE id IN (SELECT politician_id FROM target);
"
psql "$DATABASE_URL" -c "
DELETE FROM public.election_seats es
USING public.elections e
WHERE e.id = es.election_id AND e.name = '2026 US Midterm Elections';
"
# election_candidates rows delete automatically via ON DELETE CASCADE from
# both the profiles delete and the election_seats delete above.
```

**Mid-run network timeouts are expected and handled** — added a 5-attempt retry
with backoff for both HTTP 429 (rate limit, 30s backoff) and plain network
errors/timeouts (5s backoff) after a real `TimeoutError` killed the first full
run partway through California's districts (transient network issue on this
machine, not an FEC-side problem — the retry logic wasn't there yet at that
point). If a district/state still fails after 5 attempts, the script now logs
it and **keeps going** rather than crashing the whole run — check the log for
lines like `House districts that FAILED and need a re-run: ...` and re-run
those specifically (or just re-run the whole `--office H`/`--office S` command,
which is idempotent and will only actually write the missing ones).

**Checking progress mid-run**, since a full run takes tens of minutes:

```bash
# How far through the House list the log has gotten (states are processed in
# FIPS numeric order, not alphabetical -- AL,AK,AZ,AR,CA,CO,CT,DE,FL,GA,HI,ID,
# IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,MT,NE,NV,NH,NJ,NM,NY,NC,ND,OH,OK,OR,
# PA,RI,SC,SD,TN,TX,UT,VT,VA,WA,WV,WI,WY):
tail -5 <script output>

# Real saved totals so far:
psql "$DATABASE_URL" -c "
SELECT es.role_title, count(DISTINCT es.id) seats, count(ec.id) candidates
FROM public.election_seats es
JOIN public.elections e ON e.id = es.election_id
LEFT JOIN public.election_candidates ec ON ec.seat_id = es.id
WHERE e.name = '2026 US Midterm Elections'
GROUP BY es.role_title;
"
```

## Extending this to a future cycle / other offices

- **Next midterm/presidential cycle**: bump `--cycle` (e.g. `2028`) and update
  `ELECTION_NAME`/`ELECTION_DATE` at the top of the script — everything else
  (district list, party matching, idempotency) is cycle-agnostic already.
- **President**: not handled — no `map_shape_id` fits a nationwide race under
  this seat-per-boundary model. Would need either a special "nationwide seat"
  convention or a separate mechanism; out of scope for this pass, same as it
  was for `sync_us_federal_candidates.py`.
- **State Governor / State Senate / State House**: same `election_seats` model,
  different `boundary_type` (`State` for Governor — same ambiguity-with-US-
  Senator caveat applies in reverse — `State Senate`/`State House` for the
  others) and a different, not-yet-built official data source per state (no
  FEC equivalent exists below federal level; see `ELECTION_DATA_SOURCES.md`'s
  "USA — Governor + state legislature" section for what's been researched so
  far).
