# Who's running, who dropped out — how it was pulled, election by election

A record of exactly how real candidate data was pulled onto every currently
open `elections` row on Choseno (the live, user-facing tables — not the
read-only reference-cache tables `ELECTION_DATA_SOURCES.md` is mostly about),
what source each pull used, what got skipped and why, and the repeatable
scripts to re-run each one. Written 2026-09-03, after the first real pull for
every election that existed at that point.

**Read [ELECTION_DATA_SOURCES.md](ELECTION_DATA_SOURCES.md) first** if you
haven't — this doc assumes you already know *where* each jurisdiction's data
comes from; this one is about the actual pull: what ran, what it found, what
it couldn't reach, and how "who dropped out" gets detected.

**TL;DR if you just want the current answer for US House/Senate**: FEC is
*not* the source of truth for "who's really running" once a district's
primary has happened — it has no concept of primary elimination and misses
real minor-party/independent nominees. **Ballotpedia's per-state
`United States House of Representatives elections in <State>, 2026` pages
are** — they track the full certified ballot and explicitly mark
withdrawals. See the "Re-running these" section near the bottom for the
current process, and the two big sections below it (primary-contamination
cleanup, then the minor-party/independent gap fill) for how this was
learned the hard way and what's still not automated.

## Summary, as of 2026-09-03

| Election | Seats | Candidates | Source | Script |
|---|---|---|---|---|
| 2026 BC Councillor Mayor Elections | 160 | 41 | Elections BC LECFA PDF | one-off (see below) |
| BC Municipal Mayor Elections | 160 | 20 (19 real + 1 pre-existing test row) | Elections BC LECFA PDF | one-off (see below) |
| 2026 School District Trustee Elections | 118 | 5 | Elections BC LECFA PDF | one-off (see below) |
| 2026 US Midterm Elections — House | 435 | 2,190 initially via FEC, now current via the two rows below | FEC `office=H` for the *original* pull only — **superseded for re-checks, see "Re-running these"** | `scripts/start_us_2026_midterms.py` (initial pull only; do not rely on `refresh_us_2026_candidates.py` alone post-primary) |
| 2026 US Midterm Elections — Senate | 35 | 304 | FEC `office=S` | same as House |
| 2026 US Midterm Elections — Governor | 36 | 32 (5 states: ID, CT, HI, MD, SD) | per-state, no unified source | `scripts/add_governor_candidates.py` (3 states) + one-off SQL (2 states) |
| 2026 Ontario Municipal Elections | 872 | 0 | **none found** — genuinely decentralized, no provincial registry | — |
| 2026 Manitoba Municipal Elections | 274 | 0 | **none found** — genuinely decentralized, no provincial registry | — |
| US House primary-contamination cleanup | 435 | — | Wikipedia (cites official certified results) | `scripts/us_house_primary_fixes/apply_fix.py` |
| US House minor-party/independent gap fill | 435 | ~350 added | Ballotpedia (full certified ballot, not just headline nominees) | `scripts/us_house_primary_fixes/add_missing.py` |

---

## BC (Councillor + Mayor + School Trustee) — Elections BC LECFA PDF

**Source**: the same [Registered-Candidates-LEGE-2026-10-17.pdf](https://elections.bc.ca/docs/lecfa/Registered-Candidates-LEGE-2026-10-17.pdf)
documented in `ELECTION_DATA_SOURCES.md`. Fetched fresh 2026-09-03 — 80 rows,
covering Councillor, Mayor, Board of Education Trustee, and Regional Trustee
offices in one file, which is why one pull covers all three BC elections.

**Pipeline** (ran as a one-off `psql` script, not yet promoted to a standing
`scripts/*.py` file — see "Next steps" at the end of this section):
1. Staged the raw PDF rows (jurisdiction, office, name, affiliation) into a
   temp table.
2. **Jurisdiction name normalization** — the PDF's punctuation doesn't always
   match `map_shapes.name` exactly (`"Langley, Township of"` →
   `"Langley (Township)"`, `"North Vancouver, City of"` →
   `"North Vancouver (City)"`, `"North Vancouver, District of"` →
   `"North Vancouver (District)"`, `"Esquimalt"` → `"Esquimalt (Township)"`)
   — handled with an explicit lookup table, not fuzzy matching.
3. **School district matching** — only 3 of the PDF's school-district rows
   named a specific district clearly enough to match
   (`"Coquitlam School District"` → `"SD43 - Coquitlam"`, `"Delta School
   District"` → `"SD37 - Delta"`, `"Saanich School District"` →
   `"SD63 - Saanich"`).
4. **Officeholder dedup, same principle as `find_existing_officeholder_profile()`**
   in `start_us_2026_midterms.py` — before minting a stub, checked
   `office_holders.linked_profile_id` for a current officeholder on that
   exact `map_shape_id` with a matching name. **32 of 65 matched candidates
   were incumbents already in the system** — these got linked to their
   existing profile, not duplicated.
5. **Party matching** — affiliation text matched against `political_parties`
   (country = `'Canada'`) case-insensitively, stripping a `"BCA - "` prefix
   where present (`"BCA - Burnaby Citizens Association"` → matched the
   existing `"Burnaby Citizens Association"` row). 3 affiliations had no
   existing match and were created fresh: **One Delta**, **Progress for
   Langley**, **Sustain OUR Central Saanich**.
6. The remaining 33 candidates with no officeholder match got a fresh stub
   `profiles` + `politician_profiles` row, exactly matching what
   `add_unregistered_candidate()` does.

**Result**: 65 of 80 rows resolved and added.

**15 rows could not be resolved, and were left out rather than guessed at**:
- **1 — Cariboo Regional District, Electoral Area Director (Margo Wagner)**:
  no `boundary_type` for BC Regional Districts exists in `map_shapes` at all
  (only `Municipal`/`School District`/`Provincial`/`Federal`), and the PDF
  doesn't say *which* of Cariboo's electoral areas (A through L) she's
  running in even if it did.
- **14 — Conseil Scolaire Francophone School District, Regional Trustee**:
  BC's province-wide French-language school district has no corresponding
  `map_shapes` row — our 59 BC School District shapes are all English-public
  districts (`SD5`–`SD92`). This is a real, standing gap in the boundary
  data, not a matching failure.

**Also found, not touched**: `BC Municipal Mayor Elections` already had one
pre-existing candidate — **"John Doe" for Surrey**, added 2026-08-24 with no
`added_by_election_admin_id` (self-registered, not a stub) and an obviously
placeholder name. Left in place and flagged here rather than deleted
unprompted — worth a decision on whether to remove it.

**Re-run 2026-09-04 — 117 new candidates found, one real bug caught along the way**:

Fetched the same PDF URL fresh (still resolves — Elections BC republishes to the
same filename as nominations roll in). It had grown from 80 rows to **13
pages / ~200 rows** in one day, since nomination filing is ongoing. Diffed
every row against the live DB by hand (jurisdiction/office/name), applying
the same methodology as the original pull:

- **68 brand-new stub candidates** across municipalities and school
  districts not resolvable before are now resolvable — most notably, **BC
  School District trustee matching turned out to be far more complete than
  the original pull found**: `map_shapes` actually carries ~90 BC school
  districts (`SD5`–`SD92`), not just the 3 the original pull happened to
  need. Simple `"<Name> School District"` → `"SDxx - <Name>"` matching
  cleared Abbotsford, Bulkley Valley, Coast Mountains, Cowichan Valley,
  Langley, Mission, Nanaimo-Ladysmith, Nechako Lakes, Nicola-Similkameen,
  Peace River South, Quesnel, Revelstoke, Sea to Sky, Surrey, Vancouver
  Island North, and West Vancouver — the "only 3 of the PDF's rows matched"
  finding in the original pull was an artifact of that smaller PDF snapshot
  only containing 3 school-district rows, not a real matching limitation.
- **37 more resolved via the officeholder-dedup check** (§4 of the
  original pipeline) — checked every new name's jurisdiction against
  `office_holders.linked_profile_id` on the *exact same* `map_shape_id`
  before minting a stub; genuine incumbents (e.g. Prince George's mayor
  Garth Frizzell, Delta's mayor Dylan Kruger) got linked to their existing
  profile instead of duplicated. One deliberate exception: a "Jim Hanson"
  appeared as a new North Vancouver *District* council candidate, but the
  only officeholder match by that name is a sitting North Vancouver *City*
  councillor (different `map_shape_id`) — treated as a distinct person
  (fresh stub) rather than force-linked across jurisdictions, since name
  match alone across two different municipalities isn't sufficient
  evidence they're the same real person.
- **Regional District Electoral Area Director rows remain unresolvable**,
  confirmed again this pass (`map_shapes` still has no boundary_type for
  BC Regional Districts at all) — same gap as the original pull, not new.
- **Conseil Scolaire Francophone (BC's French-language school district)
  remains unresolvable** for the same reason as before — no `map_shapes`
  row exists for it.
- **Real bug caught and fixed in the same session**: the insert script's
  `politician_profiles` step only ran for stub candidates who had a
  matched party (`WHERE party_name IS NOT NULL`), silently skipping the
  row entirely for the ~68 candidates with no party affiliation listed —
  even though `politician_profiles.political_party_id` is nullable and
  should have gotten a row with `NULL` there instead of no row at all.
  Caught immediately by checking `politician_profiles` coverage right
  after the insert (not by a user report) and backfilled before moving on.
  **If replicating this pattern elsewhere: always insert the
  `politician_profiles` row for every stub, using `LEFT JOIN` + accept
  `NULL`, never gate the insert on the party match succeeding.**

Working script for this pass:
[`bc_refresh_sept4.py`](../scripts/us_house_primary_fixes/bc_refresh_sept4.py)
(kept alongside the US House scripts for now since it's the only saved
artifact of this pipeline — see "Next steps" just below for why a proper
`sync_bc_municipal_candidates.py` still doesn't exist).

**Re-run 2026-09-06 — 147 more, and the PDF nearly doubled again**: same
URL, same file, still growing as BC's nomination period runs — 13 pages
(Sept 4) → **23 pages** two days later. Whole new jurisdictions showed up
with candidates for the first time this pass, including several of BC's
largest cities that simply hadn't had anyone registered yet as of the
first two pulls: **Vancouver** (TEAM's mayoral and council slate, one
Vancouver Liberal), **Surrey** (Surrey Connect's slate, including
incumbent mayor **Brenda Locke** — linked to her existing officeholder
profile, not duplicated), **Kamloops**, **Chilliwack**, **Maple Ridge**,
**Saanich**, plus ~25 smaller municipalities with zero prior LECFA rows
(Barriere, Bowen Island, Chase, Hope, Kitimat, Merritt, Mission, Oak Bay,
Oliver, Rossland, Salmon Arm, Smithers, Summerland, Williams Lake, and
more). 134 stub candidates + 13 more officeholder-dedup links (Fernie's
mayor, Grand Forks' mayor, Kamloops' mayor, Kitimat's mayor, Port Hardy's
councillor, Salmon Arm's mayor, Summerland's mayor, Williams Lake's mayor,
Victoria's mayor and one councillor, plus Surrey's mayor).

Two candidates ran for **two different races in the same small community**
this pass — Quesnel's Tony Goulet (already added Sept 4 as a Quesnel SD28
school trustee candidate) also filed for Quesnel Mayor, and Fraser Lake's
Dave Christie (already added Sept 4 as a Nechako Lakes SD91 school trustee
candidate, the district covering Fraser Lake) also filed for Fraser Lake
Councillor. Both linked to their existing profile rather than minting a
second one — small BC towns commonly have the same local figure run for
more than one seat, unlike the North Vancouver City/District "Jim Hanson"
case from the Sept 4 pass, which stayed a deliberate non-link (two
distinctly-sized, formally separate municipalities, no independent
confirmation it's the same person).

**A new category of unresolvable gap surfaced this pass**: Vancouver's
ballot includes two **Park Board Commissioner** candidates (a body unique
to the City of Vancouver among BC municipalities) — `election_seats` has
no `role_title` for this office at all, only `Councillor`, so there's
nowhere to attach them yet. Left out rather than mis-filed under
`Councillor`. Same treatment as the already-known Regional District
Electoral Area Director and Conseil Scolaire Francophone gaps, both of
which grew further this pass (more RDs and CSF trustee rows appeared) but
remain unresolvable for the same reasons as before.

Learned from the Sept 4 bug and got the `politician_profiles` insert right
the first time this pass — verified immediately after (0 orphaned rows)
rather than discovering it after the fact.

Script:
[`bc_refresh_sept6.py`](../scripts/us_house_primary_fixes/bc_refresh_sept6.py).

Running total: 66 (Sept 3) → 183 (Sept 4, +117) → 330 (Sept 6, +147).

**Re-run 2026-09-08 — LECFA itself hadn't moved, so this pass checked city
pages directly instead, and found real new filings anyway**: fetched the
LECFA PDF fresh and it came back **byte-identical (same MD5 hash) to the
Sept 6 copy** — Elections BC simply hadn't republished it in the 2 days
between checks. Rather than conclude "nothing new," re-checked each city's
own page directly (per the "Additional step" section below) — real gains
found in 3 of the ~7 cities checked this pass:

- **Vancouver**: 10 new councillors (Ibrahima Cisse, Mohadeseh Gharib P.
  Arasi, Judith Kasiama, Bilal Khan, Andy Lin, Yadwinder Mangat — all
  **Bright Future Vancouver**, a brand-new party/slate not seen before;
  plus Raj Mundra, Patrick Sauriol, Jonathan Weisman for **TEAM**; plus
  Eric Redmond for **Affordable Housing**, also new) and 2 new school
  trustees (Tasha Doucas — Vote Vancouver; Kat Nystedt — TEAM). Vancouver's
  own mayoral page is still stuck at 2 (Ahmad, Hardwick) — incumbent Ken
  Sim has still not appeared as a declared candidate on the city's own
  page as of this check, worth watching.
- **Nanaimo**: mayor race — added Leonard Krog (**linked to his existing
  officeholder profile**, not a stub — he's the sitting mayor) and Sarah
  Lovegrove (stub), per news coverage naming both alongside the
  already-known Anne Marie Dryden. Nanaimo's own site still won't publish
  its official list until after Sept 11 close, so this came from local
  news (CHLY 101.7FM), not a government source directly — flagged as
  slightly lower-confidence than the usual official-page sourcing, but a
  named incumbent mayor is about as safe a call as this gets.
- **Saanich** (District of Saanich specifically — not Central Saanich or
  North Saanich, three separate municipalities that all share "Saanich"
  in the name and are easy to conflate): 1 new mayor (Karen Harper,
  linked — sitting councillor), 3 new councillors linked as officeholders
  (Colin Plant, Nathalie Chambers) plus 3 more as fresh stubs (Alli
  Deelstra, Nancy Di Castri, Jordan Weaver), and 1 new SD63 school trustee
  (Karen MacEwan).
- **Checked, unchanged since Sept 6**: Surrey (still 29 councillors + 3
  mayors — a "Daniel, Isaac" vs "Daniel. Isaac" text-punctuation quirk on
  Surrey's own page briefly looked like 2 new names but was the same
  person, same slug, already counted), Burnaby (still 19 + 2), Coquitlam
  (still 9 + 6 + 1), Langley Township (still 9 + 1 + 1).
- **Checked, no usable data**: Richmond (still JS/iframe-rendered, resists
  extraction — same blocker as before), Abbotsford (explicitly says its
  declared-candidates list won't post until after the Sept 11 close, same
  as Kelowna/Victoria/Nanaimo).

Script:
[`bc_sept8_new_candidates.py`](../scripts/us_house_primary_fixes/bc_sept8_new_candidates.py).

Running total: 66 (Sept 3) → 183 (Sept 4, +117) → 330 (Sept 6, +147) →
347 (Sept 8, +17).

**Re-run 2026-09-09 — a real, repeatable methodology gap found by a user
spot-check: School Trustee sub-pages were being skipped for cities with
their own Mayor/Councillor/Trustee split into separate pages.** A user
checked `surrey.ca/.../candidates-office-of-school-trustee` directly (a
page that had simply never been visited in any earlier BC pass — every
"checked Surrey" note above only ever covered Mayor + Councillor) and
found **12 real candidates against 1 in the system**. Checking Burnaby's
equivalent page the same way (also never previously fetched, despite
its Mayor/Councillor pages being checked repeatedly) turned up the same
shape of gap: **9 real candidates against 2 in the system**, including
two sitting officeholders (Bill Brassington, Jen Mezei).

**Root cause: whenever a city splits candidates across separate
Mayor / Councillor / School Trustee pages (Surrey and Burnaby both do;
Vancouver, Coquitlam, Langley Township, Saanich do too but *were* checked
for all three race types each time**), every earlier pass's "checked
this city" claim silently meant "checked whichever pages I fetched," not
"checked every race type that city publishes." **When checking any city
page from now on, explicitly enumerate all of its candidate URLs/tabs
(Mayor, Councillor, School Trustee, and Park Board where applicable)
before concluding a city is "unchanged" or "fully checked" — do not
infer full coverage from having checked that city on an earlier date.**

Also caught, same duplicate-profile shape as Rob Stutt (Sept 6): **Kristin
Schnider** (Burnaby SD41) had been minted as a fresh stub in an earlier
pass without an officeholder-dedup check scoped to Burnaby's school
board specifically — she's the sitting Board Chair with an existing,
unused profile. Fixed the same way: repointed her `election_candidates`
row to the real profile, deleted the stray stub.

New parties found: **Our Surrey** (Surrey SD36 — Kyle Jones, Anne
Whitmore). Burnaby SD41's Burnaby Green Party and BCA - Burnaby Citizens
Association already existed from the councillor-race additions.

Script:
[`bc_sept9_school_trustee_fix.py`](../scripts/us_house_primary_fixes/bc_sept9_school_trustee_fix.py)
— 17 stubs, 2 officeholder-links, 1 duplicate-profile fix (Kristin
Schnider).

**Not yet re-verified for the same gap**: Nanaimo, Richmond, Delta,
Nechako Lakes, and every other municipality checked only for
Mayor/Councillor in earlier passes should be assumed to have an
unchecked School Trustee (and, for Vancouver specifically, Park Board)
page until explicitly confirmed otherwise — this pass fixed the two
instances a user happened to spot-check, not a systematic sweep of
every city already touched by this doc.

Running total: 66 (Sept 3) → 183 (Sept 4, +117) → 330 (Sept 6, +147) →
347 (Sept 8, +17) → 364 (Sept 9, +17).

**Re-run 2026-09-09 continued — user asked for a systematic sweep of BC's
top 50 municipalities by population, not just spot-checks.** Ranked all
BC municipalities by 2026 population estimate (`worldpopulationreview.com`,
filtered to actual incorporated municipalities — the raw list mixes in
regional-district electoral areas and reserve lands, which don't hold
Mayor/Council elections and had to be excluded by hand). Checked each of
the ~40 not already covered by earlier passes directly against its own
official election page.

**Real, immediate yield — 4 more cities had live rosters:**
- **Delta** (pop. ~127k, #9): 1 new mayor (Melissa Granum) + 6 new
  councillors, discovered via local news (Peace Arch News/Delta Optimist)
  naming all three slates' full tickets — Delta's own city page doesn't
  itself list names, so this is news-sourced like the Nanaimo mayor race
  on Sept 8, not a first-party government page. Two new parties: **Delta
  First**, **Achieving for Delta**.
- **Mission** (pop. ~48k, #24): city page explicitly says "updated as
  nomination documents are processed" and delivered — 1 new mayor
  (already had; fixed as a duplicate, see below), 5 new councillors, 2
  new SD75 school trustees.
- **Vernon** (pop. ~50k, #22): **had zero candidates in the system at
  all** before this check — genuinely missed entirely by every earlier
  LECFA pass. City's own `vernon.ca/candidatelist` page had a full live
  roster: 2 mayor, 8 councillor.
- **Coquitlam, Saanich, Nanaimo**, etc.: already covered by earlier
  passes, re-confirmed unchanged.

**Confirmed NOT yet available, checked directly (not inferred) — this is
most of the remaining ~35 of the top 50**: Kelowna (won't post until
**Oct 7**, well after close), Kamloops, Victoria, New Westminster,
Courtenay, Comox, Chilliwack, Prince George, North Vancouver (City),
Abbotsford, Richmond (still JS/iframe-blocked, separate issue from
"not published yet"). All of these either explicitly state their
Declaration of Candidates posts sometime after the Sept 11, 2026 4pm
nomination close, or (Prince George, North Vancouver City) have a
candidate-list page live but structurally empty as of this check.
**This is a real timing constraint of BC election administration, not a
research gap** — re-running this same sweep on or shortly after Sept 12
should be dramatically more productive in one pass than repeated partial
checks beforehand, since the majority of BC's ~30 largest cities that
don't publish live will all go live within roughly the same 24-48 hours.

**The big finding this pass, and the reason to re-audit before calling
any BC pass "done": a systemic duplicate-profile bug, far larger than
the two individual cases (Rob Stutt, Kristin Schnider) caught on Sept 6
and 9.** Checking Delta and Mission's new names against their own
officeholders caught 2 more of the same shape (Jag Gill — Mission Mayor;
Linda Hamel — SD75 Trustee), which prompted a full audit query across
**every** BC candidate profile added by this pipeline, matched by exact
name against `office_holders` scoped to the same `map_shape_id`:

```sql
select p.id as db_profile_id, oh.linked_profile_id as officeholder_profile_id
from election_candidates ec
join profiles p on p.id = ec.politician_id
join election_seats es on es.id = ec.seat_id
join map_shapes ms on ms.id = es.map_shape_id
join office_holders oh on oh.map_shape_id = ms.id and oh.is_current = true
  and lower(trim(oh.full_name)) = lower(trim(p.full_name))
where p.country = 'Canada'
  and oh.linked_profile_id is not null
  and oh.linked_profile_id != p.id;
```

**Result: 55 more duplicate pairs**, spread across roughly 40 different
municipalities and school districts touched by the Sept 3/4/6/8 mass
LECFA passes — every one of those passes' officeholder-dedup step had
only ever been scoped to whichever specific city was the focus of that
moment, never re-run as a full sweep against the complete BC officeholder
roster. **Root cause, stated plainly for next time: a per-city dedup
check during a large batch pass is not equivalent to a dedup check
against the full officeholder set — always run the full-roster query
above (or equivalent) after any multi-city batch, not just spot checks
on the cities that prompted the pass.**

Fixed by repointing every affected `election_candidates.politician_id`
from the stray stub to the real officeholder profile —
**deliberately did not delete the 55 orphaned stub profiles** in this
pass (unlike the two hand-verified Sept 6/9 fixes, which did delete
after individual confirmation). At this volume, auditing whether any of
the 55 stub profiles had accumulated real engagement (comments, ratings,
claims — no time to check every FK across the schema for 55 profiles
safely) wasn't feasible to do responsibly in one pass; leaving them as
harmless orphaned rows (no longer referenced by any `election_candidates`
row) is the safe choice over risking a cascading delete on something a
real visitor may have already interacted with. **Cleaning up the 55
orphaned stub profiles is a legitimate, low-risk follow-up once someone
confirms via the schema which tables can reference a `profiles` row and
checks each for hits** — not done here.

One data-entry wrinkle hit mid-fix: **Tony Goulet (Quesnel) holds two
different real officeholder records** — one as Mayor, one as SD28
School Trustee — and both of his candidacy rows shared a single stub
profile, so the batch UPDATE (keyed only on the stub's `politician_id`)
moved *both* to whichever pairing ran first, leaving the other pointed
at the wrong office's profile. Caught by re-checking his rows after the
batch ran, fixed with one more targeted `UPDATE` scoped by `seat_id` in
addition to `politician_id`. **When a stub profile turns out to cover a
person who holds multiple distinct current offices (mayor *and*
trustee, e.g.), a plain politician_id-keyed batch fix isn't safe on its
own — verify per-seat afterward.**

Verified after every step this pass: 0 remaining duplicate pairs by the
audit query above, 0 orphaned `politician_profiles` rows.

Scripts:
[`bc_sept9_top50_batch2.py`](../scripts/us_house_primary_fixes/bc_sept9_top50_batch2.py)
(Delta + Mission + the 2 duplicate fixes found via those cities),
[`bc_sept9_vernon_add.py`](../scripts/us_house_primary_fixes/bc_sept9_vernon_add.py),
[`bc_sept9_duplicate_profile_audit_fix.sql`](../scripts/us_house_primary_fixes/bc_sept9_duplicate_profile_audit_fix.sql)
(the 55-pair systemic fix — re-run the audit query above first if
reusing this, since the exact pairs will differ once more candidates
are added).

The hand-tracked running total in this doc (66 → 183 → 330 → 347 → 364 →
...) drifted from the real count somewhere across these passes — cross-
checked directly against the database after this pass and the **real,
verified total is 450** candidates across all three BC elections (288
Councillor/Mayor + 87 Mayor-only + 75 School Trustee), not the ~395 the
hand-tracked arithmetic above would suggest. **Trust a direct count over
the hand-tracked running total from here on**:
```sql
select count(*) from election_candidates ec
join election_seats es on es.id = ec.seat_id
join elections e on e.id = es.election_id
where e.name in ('2026 BC Councillor Mayor Elections',
                  'BC Municipal Mayor Elections',
                  '2026 School District Trustee Elections');
```

### How to check for new BC nominations (do this periodically until nominations close)

BC's LECFA candidate PDF is a **live, continuously-updated document at a
fixed URL** — Elections BC republishes to the same filename as candidates
file, right up until nominations close ahead of the 2026-10-17 general
local election. It grew 80 rows → 13 pages → 23 pages across the first three checks
(Sept 3, 4, 6), so re-checking every few days while filing is open is
worth it — but **the Sept 8 check found it byte-identical (same MD5) to
Sept 6's copy**, i.e. Elections BC doesn't republish every day even
though candidates keep filing with cities in the meantime. **Don't treat
an unchanged LECFA hash as "nothing to check" — compare the hash, and if
unchanged, go straight to the per-city page check (the "Additional step"
section below) instead of stopping.** That's exactly what turned up 17
real new candidates on Sept 8 even though LECFA itself hadn't moved at
all.

1. **Fetch the PDF fresh** (same URL every time, no rediscovery needed):
   ```bash
   curl -sL -o /tmp/lecfa_latest.pdf \
     https://elections.bc.ca/docs/lecfa/Registered-Candidates-LEGE-2026-10-17.pdf
   ```
   Read it with the `Read` tool (`pages: "1-N"`, ~12 pages per call) — it's
   a plain table, no OCR needed.
2. **Pull the current DB state** for comparison — this exact query, against
   all three BC election names, covers councillor/mayor/school-trustee in
   one shot:
   ```sql
   select ms.name, es.role_title, p.full_name
   from election_seats es
   join map_shapes ms on ms.id = es.map_shape_id
   join election_candidates ec on ec.seat_id = es.id
   join profiles p on p.id = ec.politician_id
   join elections e on e.id = es.election_id
   where e.name in ('2026 BC Councillor Mayor Elections',
                     'BC Municipal Mayor Elections',
                     '2026 School District Trustee Elections')
   order by ms.name, es.role_title, p.full_name;
   ```
3. **Diff by hand**, row by row of the PDF against that list (jurisdiction +
   office + name). All 160 municipalities' Councillor/Mayor seats and all
   BC school districts (`SDxx - Name`, ~90 of them, not just the ones a
   given pull happens to need) already have empty seats pre-created — a
   brand-new jurisdiction showing up in the PDF (as happened Sept 6 with
   Vancouver, Surrey, Kamloops, etc.) needs its `seat_id` looked up, not
   created.
4. **Dedup against `office_holders`** before minting any stub — a new PDF
   row might be a sitting officeholder re-filing for re-election:
   ```sql
   select oh.map_shape_id, ms.name, oh.full_name, oh.linked_profile_id, oh.is_current
   from office_holders oh join map_shapes ms on ms.id = oh.map_shape_id
   where oh.map_shape_id in (<the new candidates' map_shape_ids>)
   order by ms.name;
   ```
   Only link to an existing `linked_profile_id` when the name **and** the
   `map_shape_id` both match the seat being added to — a name match alone
   across two different municipalities isn't enough evidence (see the Sept
   4 "Jim Hanson" case, kept as a separate stub). Two exceptions worth
   knowing about: BC's smaller communities are geographically the
   catchment for a much bigger school district, and it's common for one
   local figure to run for two different seats in that same community at
   once (Quesnel's Tony Goulet: mayor *and* SD28 trustee; Fraser Lake's
   Dave Christie: councillor *and* SD91 trustee) — link those to the
   *already-added* profile from the other race rather than minting a
   second person.
5. **Insert stubs + linked candidates** — copy the pattern in
   [`bc_refresh_sept6.py`](../scripts/us_house_primary_fixes/bc_refresh_sept6.py)
   (the most recent, correct version): `NEW_PARTIES` for any affiliation
   not yet in `political_parties`, `STUB` for fresh profiles, `LINKED` for
   officeholder/cross-race matches. **Critical**: the `politician_profiles`
   insert must run for *every* stub regardless of whether a party matched
   (`political_party_id` is nullable) — gating it on a successful party
   match was a real bug caught and fixed mid-pass on Sept 4 (see above).

   **Mandatory, added 2026-09-09 after photo capture was twice missed
   (Surrey, then Burnaby) and had to be circled back for**: whenever the
   candidates for this batch came from an individual city page (not the
   LECFA PDF, which has no images), **check that page for a candidate
   `<img>` in the same pass that pulls the name** — don't insert the
   stub/link first and treat the photo as a follow-up. Grab the `<img
   src>` alongside the name/party/bio text in the same `fetch`/`DOMParser`
   batch (see the "Bonus" section below for the technique), and write it
   into both `avatar_url` (what `CandidacyWall.tsx` actually renders) and
   `photo_url`, `COALESCE`-safe, as part of the same insert. A plain
   LECFA-only stub has no photo source and this step is correctly a no-op
   for it — but for anything sourced from a city's own page, check the
   page for images before writing it off; see the Sept 9 photo-audit
   section below for which city pages actually carry headshots (an
   individual-profile accordion, so far only Surrey and Burnaby) versus
   which are plain name lists with nothing to fetch (Vancouver, Coquitlam,
   Langley Township, Vernon, Mission, and by all appearances most others).

   **Also mandatory, added 2026-09-09 after 768 candidates system-wide
   turned out to have a dead "Politician Wall" link (see "Politician Wall
   backfill" section below for the full root cause)**: every
   `politician_profiles` insert must also set `wall_slug` — `bc_refresh_
   sept6.py` now computes and sets it as part of the standard `new_stub`
   flow; copy that block rather than the old `(id, political_party_id)`-
   only insert. After applying, also run
   [`ensure_wall_slugs.py`](../scripts/us_house_primary_fixes/ensure_wall_slugs.py)
   as a catch-all — same role as the orphan-check below, just for this
   field.

   Always verify immediately after applying:
   ```sql
   select count(*) from election_candidates ec
   join profiles p on p.id = ec.politician_id
   left join politician_profiles pp on pp.id = p.id
   where ec.added_by_election_admin_id = '<admin id>'
     and ec.submitted_at > now() - interval '10 minutes'
     and pp.id is null;  -- must be 0
   ```

### Additional step, required for at least these municipalities: check the city's own official page too, not just LECFA

**Standing rule, added 2026-09-09 after a second user spot-check caught
Surrey's and Burnaby's School Trustee pages had simply never been
fetched despite both cities being "checked" repeatedly**: a city that
splits candidates across separate Mayor / Councillor / School Trustee
(and, for Vancouver, Park Board) pages needs **every one of those pages
enumerated and fetched explicitly** before it counts as checked — do not
infer "I checked Surrey" covers all race types just because Mayor and
Councillor were fetched on an earlier date. When re-visiting a city
already in the table below, look for a race-type page you haven't
fetched yet before concluding there's nothing new.

**Discovered 2026-09-06, from a user spot-check**: the LECFA PDF (steps
1–5 above) is a *financial-agent registration* list — Elections BC's own
page says as much. Filing nomination papers with a city is the actual
legal act of becoming a candidate; registering a financial agent with
LECFA is a separate step candidates can complete later, and in practice
several of BC's largest cities run their **own** official nomination page
that publishes live as papers are filed, running well ahead of LECFA's
provincial feed during the Sept 1–11 window. Checked directly (not via
LECFA) and confirmed real gaps in every city below except Langley
Township:

| City | Their official page | Confirmed gap vs. LECFA-sourced DB, as found 2026-09-06 |
|---|---|---|
| **Surrey** | `surrey.ca/city-government/2026-municipal-election/candidates` (separate `/candidates-office-of-mayor` and `/candidates-office-of-councillor` sub-pages) | 2 of 3 mayoral candidates, 27 of 29 councillor candidates missing |
| **Vancouver** | `vancouver.ca/your-government/2026-candidates-mayor.aspx` (also has separate councillor/park-board/school-trustee sub-pages) | 1 of 2 mayoral candidates missing (Muhammad Ahmad) — page explicitly says "candidate information... added as we receive them" |
| **Burnaby** | `burnaby.ca/our-city/mayor-and-council/elections/candidates/office-of-{mayor,councillor}-candidate-profiles` | Mayor race was already in sync; 11 of 19 councillor candidates missing, **including 2 sitting incumbents** (Joe Keithley, James Wang) |
| **Coquitlam** | `coquitlam.ca/1205/Candidate-Summaries` | 6 of 9 councillor candidates, 2 of 6 school-trustee candidates missing |
| **Langley Township** | `tol.ca/en/the-township/about-the-candidates.aspx` | Mayor + Councillor fully in sync (all 9 already matched from LECFA) — but its School Trustee entry ("Tina Patterson") names someone **different** from the LECFA-sourced trustee already in the system (Celene Hoag); SD35 elects 5 trustees total, so both are plausibly real, independently-filed candidates, not a conflict — added both rather than picking one. |

**One real bug this check surfaced and fixed in the same pass**: the Sept
6 LECFA-only sweep (above) added "Rob Stutt" for Surrey Councillor as a
fresh stub profile *without* checking Surrey's own officeholders first —
he's a sitting councillor with an existing, unused profile. Checking his
own city's page this time caught the duplicate: repointed his
`election_candidates` row to the real profile and deleted the stray stub.
**Moral: always run the officeholder-dedup check (step 4) scoped to the
specific city being checked, even when that city was already covered by a
broader LECFA-wide pass — a city-specific page can surface a name LECFA
never had, and that name might turn out to be an existing officeholder.**

**Caveat carried over from LECFA's own page**: neither source is
"complete official results" — both are pre-election filing lists. A city's
own page is simply *more current* during the active nomination window,
not more authoritative in a legal sense. Once nominations close (Sept 11)
and each city certifies its list, this gap should shrink or close on its
own for cities that already publish live; it doesn't help at all for
cities that only publish *after* close (Kelowna: Sept 18; Victoria:
shortly after Sept 11) — those were never behind LECFA to begin with.

**Not yet checked**: this pass only directly checked Surrey, Vancouver,
Burnaby, Coquitlam, and Langley Township (5 of BC's ~30 largest
municipalities) plus name-only searches confirming Abbotsford, Saanich,
Delta, Nanaimo, and Maple Ridge each have their own equivalent page (URLs
noted, pages not yet read for actual candidate names — Delta's in
particular is JS/accordion-rendered and resisted extraction). **If doing
another BC pass, check each of BC's ~30 largest municipalities' own page
directly, not just LECFA** — the pattern found in 4 of 5 cities checked
suggests this is closer to the norm than the exception for larger cities,
though city size doesn't perfectly predict it (Langley Township, a
mid-size municipality, was fully in sync).

A third-party aggregator, **VoteMate** (`en.votemate.org/bc2026`, covers
BC's 31 most populous municipalities), was also checked as a possible
faster path to all of them at once — **not recommended as a source**: its
Surrey page listed 5 mayoral candidates against the city's own confirmed
3, with mismatched party labels (a former mayor tagged with a different
person's actual party). Treat it as a rough lead for which cities to check
directly, never as a source to copy from.

Script for this pass:
[`bc_official_pages_supplement.py`](../scripts/us_house_primary_fixes/bc_official_pages_supplement.py)
— 44 stubs, 6 officeholder-links, 1 duplicate-profile fix (Rob Stutt).

#### Same source, same pass: these pages carry real bio/contact/party/photo data — pull all of it together, not as a follow-up

**(Originally written as an optional "bonus" step — re-titled 2026-09-09.
It isn't optional: leaving bio/contact/party for a later pass, or photo
for a later pass after that, is exactly the pattern that produced two
separate "you missed something" corrections from the user on Surrey and
Burnaby. Do this in one pass per city, photo included.)**

Every one of these city candidate pages is a full profile, not just a
name — phone, email, campaign website, social handles, elector-organization
(party) affiliation, and a submitted candidate statement. `profiles` /
`politician_profiles` already has columns sitting empty for exactly this:
`bio`, `contact_phone`, `contact_email`, `source_url`,
`political_party_id`. **No schema change needed** — this data was always
poll-ready, just never populated for LECFA-sourced stub candidates,
because LECFA's PDF only ever carries name + party + financial-agent
contact, never the candidate's own bio/phone/email.

**How this was pulled for Surrey (2026-09-06), reusable per-city**: rather
than navigating to each candidate's individual page one at a time, fetch
them all in one batch from the browser's own JS context (same-origin,
so no CORS issue) — the councillor list page's own links give the exact
slugs, no guessing:

```js
const links = Array.from(document.querySelectorAll('a'))
  .filter(a => a.href.includes('candidates-office-of-councillor/'));
// -> [{text: "Brown, Janet", href: ".../brown-janet"}, ...]
```

Then `Promise.all(urls.map(fetch))`, parse each response with
`DOMParser`, and pull the `<article>` (or main content container)'s
`innerText` for the bio/phone/website/socials block. **Watch for
Cloudflare email obfuscation** — a raw `fetch()` (unlike a real page
load) never runs the page's own JS, so emails render as the literal
string `[email protected]` instead of decoding. The real address is
recoverable from the `data-cfemail` attribute Cloudflare leaves on the
placeholder span, decoded with a standard single-byte XOR (first two hex
chars are the key, XOR every following byte-pair against it) — see
[`surrey_enrich.py`](../scripts/us_house_primary_fixes/surrey_enrich.py)
for the exact decoder. This isn't unique to Surrey; expect the same
Cloudflare pattern on any BC city site sitting behind Cloudflare.

**No dedicated social-links column exists** (checked — no `social` or
`link` table in the schema), so website + social handles are folded into
a short `Links: Website: ... | X: ... | Facebook: ...` line appended to
`bio` rather than dropped, pending an actual schema decision if this
becomes a permanent, structured field later.

**Applied to Surrey's all 32 mayor + councillor candidates** — every
`UPDATE` uses `COALESCE(new_value, existing_value)` per field, so it only
fills genuinely empty fields and never clobbers a better value already on
file (confirmed live: Linda Annis already had a real phone number on
file from an earlier source that Surrey's own candidate page didn't list;
the update correctly left it alone and only added her email). Real party
affiliations recovered this pass that LECFA-sourced stubs didn't have at
all: **SURREY NOW** and **New Surrey+** (both newly created
`political_parties` rows) alongside the already-known Surrey First and
Surrey Connect Public IA.

**Not yet done for Vancouver, Burnaby, Coquitlam, or Langley Township** —
same opportunity almost certainly exists on their own candidate pages
(each showed a per-candidate profile link in the "additional step" table
above), just not pulled yet. Reuse `surrey_enrich.py`'s pattern: swap the
base URL and the DATA dict.

**Follow-up fix, 2026-09-09, caught by a user spot-check**: the original
Sept 6 pass captured bio/phone/email/party/source_url but **never
captured each candidate's photo**, even though most of them have a real
headshot on their own Surrey page. Confirmed by reading
`CandidacyWall.tsx` directly: the seat/candidate page renders
`politician_profiles.avatar_url` specifically (`photo_url` is a separate
column that isn't what's shown there) — both were empty for all 32
Surrey candidates. Fixed by re-fetching each candidate page's `<img>`
tag (excluding the shared "Your City Your Vote" logo image every page
also embeds) and writing the same URL to both `avatar_url` and
`photo_url` via `COALESCE` (never clobbers a real photo if one's already
on file). 25 of 32 candidates had a submitted photo; 7 (Jesse Aajohl,
Gail Beszedes, Leanna Chatwin, Isaac Daniel, Brad Kielmann, Enrique
Ponce de Leon, Miguel Ting) genuinely have none — Surrey's own page for
them says "Photo not submitted," not a scraping miss.

**The photo fix was folded directly back into `surrey_enrich.py` itself
(a `PHOTOS` dict + updated SQL generation), not left as a separate patch
script** — a first version of this fix did save a standalone
`bc_sept9_surrey_photos.py`, but since this doc explicitly points at
`surrey_enrich.py` as *the* template to copy for Vancouver/Burnaby/
Coquitlam/Langley Township, leaving the photo capture out of the
template itself would mean the exact same gap gets copied into every
future city. Deleted that standalone file once its contents were merged
in. **General rule: when a fix corrects a bug in a script this doc names
as a reusable template, merge the fix into that script — don't leave a
second, harder-to-find patch file that a future reuse of the template
won't pick up.** When enriching a candidate profile from a source page
that has a headshot, always capture it in the same pass — bio-only
enrichment leaves a data gap a user will notice immediately, as this one
did.

Script:
[`surrey_enrich.py`](../scripts/us_house_primary_fixes/surrey_enrich.py)
(now the single, complete record — bio/contact/party/photo together).

### Same gap, one office type over: SD36 Surrey School Trustee had zero enrichment — 2026-09-09

**User caught it, same day, same city**: asked why
[Afzalur Rahman's School Trustee candidate page](http://localhost:3000/elections/seat/school-trustee-sd36-surrey-496873)
had none of the phone/email/bio/photo that Surrey's Councillor candidates
had, pointing at
[his own real profile on surrey.ca](https://www.surrey.ca/city-government/2026-municipal-election/candidates/candidates-office-of-school-trustee/rahman-afzalur)
as proof the same rich data exists for School Trustee too.

**Root cause, and exactly the gap the "Additional step" section already
warns about**: Surrey's 13 SD36 School Trustee candidates were added by
[`bc_sept9_school_trustee_fix.py`](../scripts/us_house_primary_fixes/bc_sept9_school_trustee_fix.py),
which pulled names + party from surrey.ca's school-trustee page but never
went back for bio/phone/email/photo — the exact same class of miss as the
Sept 6 Surrey Councillor pass, just on a different office type, one that
`surrey_enrich.py` (Mayor + Councillor only) never covered. Surrey
publishes a full individual profile page per candidate for **every**
office it runs, not just Councillor — checking one office type's
enrichment is done says nothing about the others.

**Fix**: fetched all 13 of Surrey's own SD36 School Trustee pages the
same way as Councillor (batch `fetch` + `DOMParser`, Cloudflare-email
decode included). 12 of 13 candidates matched a real surrey.ca page (3
have a submitted photo, all 12 have at least phone or email or both); the
13th, **Dee Reiter, has no matching page on surrey.ca at all** — checked
directly (`.../school-trustee/reiter-dee` 404s), not a scraping miss,
she's simply not on the city's own list yet. Folded directly into
`surrey_enrich.py`'s existing `DATA`/`PHOTOS` dicts rather than a new
file, since that script is already the named template for Surrey and
now covers all three of its office types in one place.

**Standing rule, reinforcing the existing "Additional step" section
above**: when enriching a city, enrich **every office type that city
publishes its own individual profile pages for** (Mayor, Councillor,
School Trustee, Park Board, ...) in the same pass — a city that does
this for one office overwhelmingly does it for all of them, so "already
checked this city" must mean all its office types, not just the one that
happened to prompt the check.

Script:
[`surrey_enrich.py`](../scripts/us_house_primary_fixes/surrey_enrich.py)
(now 44 candidates — Mayor + Councillor + School Trustee — the complete
Surrey record for every office it runs).

**Same-turn bonus fix, Burnaby Councillor**: checking whether the same
gap existed anywhere else already-touched today found it in Burnaby too
— the Sept 9 photo pass (`bc_sept9_burnaby_photos_and_new.py`) had
fetched each Burnaby councillor page's *full* text (bio, phone, email,
socials) in the same `fetch` batch as the photos, but only ever wrote the
photo half to the DB; the bio/contact text sat unused. Rather than
re-fetch, reused that already-captured text to enrich all 24 Burnaby
Councillor profiles. Also caught and fixed, while reading each
candidate's actual page text to write the bio: **James Wang, Joe
Keithley, and Maita Santiago had been imported with the wrong party**
("Independent") — burnaby.ca's own page states all three run under BCA
(Burnaby Citizens Association). A plain `COALESCE` enrichment update
would never have touched this since the existing value wasn't null, so
this needed (and got) a separate, narrowly-scoped direct `UPDATE`.
**Not yet done — a known, quantified gap, not silently skipped**:
Burnaby Mayor (3 candidates) and SD41 School Trustee (9 candidates) only
ever had their photos fetched+applied
(`bc_sept9_burnaby_mayor_trustee_photos.py`) — the full bio/contact text
fetch for those two office types hasn't happened yet.

Script:
[`burnaby_enrich.py`](../scripts/us_house_primary_fixes/burnaby_enrich.py)
— same DATA-dict pattern as `surrey_enrich.py`, the template to extend
for Burnaby's remaining two office types.

### Full BC photo audit, 2026-09-09 — "where else did we miss photos"

**Prompted by the same user spot-check that found Bilal Cheema's missing
photo, extended into a systematic check**: are there other cities where an
official page has real headshots we never captured, beyond Surrey? Ran a
DB-wide query grouping every BC candidate this pipeline added by
municipality/role, counting missing `avatar_url` — result: photo gaps
exist across nearly the entire dataset, but **the overwhelming majority
are pure-LECFA stub candidates with no photo source that ever existed**
(LECFA's PDF carries no images at all). Only candidates added via an
individual city's own official page could possibly have a missed photo.

**Checked every city with an official page fetched so far, specifically
for `<img>` tags this time:**

| City | Photos on the city's own page? | Action taken |
|---|---|---|
| **Surrey** | Yes (accordion, one `<img>` per candidate) | Already fixed Sept 9 (see above) |
| **Burnaby** | Yes (accordion, one `<img>` per candidate) — Mayor, Councillor, **and** School Trustee pages all carry headshots | **Fixed this pass**: 21 photos applied (12 Councillor + 1 Mayor + 8 School Trustee). Also found Burnaby's own roster had grown since our last check: 5 new Councillor names (Tina Fiorda, Morgan Nicholsfigueiredo, Vincent Tong, Sabrina Yang as fresh stubs; Daniel Tetrault linked to an existing, unused officeholder profile) and 1 new Mayor candidate (Sabina Hsu, fresh stub) — all added, with photos where the page had one. |
| **Vancouver** | **No** — mayor/councillor pages are plain text lists, zero `<img>` elements found (checked both) | Nothing to fetch — confirmed, not a miss |
| **Coquitlam** | **No** — plain text + PDF-link list only | Nothing to fetch |
| **Langley Township** | **No** — page has only unrelated site-chrome images | Nothing to fetch |
| **Vernon** | **No** — plain contact-info table (`vernon.ca/candidatelist`) | Nothing to fetch |
| **Mission** | **No** — news-article writeup, one banner image only | Nothing to fetch |
| **Delta** | N/A — Delta's own city page never listed candidate names at all; data was sourced from local news coverage (Peace Arch News/Delta Optimist) of each slate, not a first-party profile page | No photo source exists to check |

**Net result: Surrey and Burnaby are the only two BC cities checked so
far whose official candidate page is an individual-profile accordion with
headshots. Every other city's page is a plain name list (± PDF links),
so "missing photo" there isn't a scraping gap — there's nothing to
scrape.** If a future pass adds new cities via their own official page,
check whether that page's layout is a profile accordion (Surrey/Burnaby
pattern) or a plain list (everyone else so far) before assuming a photo
gap needs fixing.

Scripts:
[`bc_sept9_burnaby_photos_and_new.py`](../scripts/us_house_primary_fixes/bc_sept9_burnaby_photos_and_new.py)
(Councillor: 12 photos, 1 officeholder link, 4 new stubs) and
[`bc_sept9_burnaby_mayor_trustee_photos.py`](../scripts/us_house_primary_fixes/bc_sept9_burnaby_mayor_trustee_photos.py)
(Mayor: 1 photo + 1 new stub; School Trustee: 8 photos). Verified after
applying: 0 orphaned `politician_profiles` rows, 0 duplicate-profile
matches against `office_holders` (full-roster audit query, see above) —
**455 total BC candidates** as of this pass (direct `COUNT`, not
hand-tracked).

**Standing rule going forward, per explicit user instruction**: photo
capture is now a mandatory part of step 5 below, not a follow-up to
circle back for — see the amended step 5.

---

**Known, standing gaps** (confirmed unresolvable as of Sept 6, re-confirmed
each pass, not overlooked): Regional District Electoral Area Director races
(no `map_shapes` boundary type for BC Regional Districts at all), the
Conseil Scolaire Francophone (BC's French-language school district, no
`map_shapes` row), Vancouver's Park Board Commissioner race (no
`role_title` for that office anywhere in `election_seats`), and Okanagan
Falls' council/mayor race (its "District of" jurisdiction has no
`map_shapes` Municipal-type row despite appearing in the LECFA PDF).

**Script status**: two working, saved scripts exist —
[`bc_refresh_sept4.py`](../scripts/us_house_primary_fixes/bc_refresh_sept4.py)
and
[`bc_refresh_sept6.py`](../scripts/us_house_primary_fixes/bc_refresh_sept6.py)
— but both are one-shot, hand-built diffs (the STUB/LINKED lists were
derived by manually reading the PDF and comparing against the DB each
time), not a reusable script you can just re-run unmodified. Promoting
this into a real `scripts/sync_bc_municipal_candidates.py` that automates
steps 1–4 above (PDF parse → jurisdiction/SD name matching → officeholder
dedup → diff against current DB) is still the right next investment if
this needs to run routinely rather than by hand each time — genuinely not
built yet, not being glossed over.

---

## System-wide photo push, all election types — 2026-09-09

**User request**: "find out all candidates participating in elections and
see if you can get more photos for each candidate" — explicitly scoped
(user's choice, asked directly) to **official/party sources only, no
per-candidate web search**, across **every** election in the system, not
just BC.

**Starting point** (direct `COUNT`, all elections):

| Election | Role | Total | Missing photo |
|---|---|---|---|
| 2026 BC Councillor Mayor Elections | Councillor | 293 | 250 |
| BC Municipal Mayor Elections | Mayor | 88 | 80 |
| 2026 School District Trustee Elections | School Trustee | 75 | 67 |
| 2026 US Midterm Elections | U.S. Representative | 1285 | 1148 |
| 2026 US Midterm Elections | U.S. Senator | 302 | 292 |
| 2026 US Midterm Elections | Governor | 32 | 29 |

**1,866 of 2,075 total candidates system-wide had no photo.** The
overwhelming majority are FEC-sourced US challenger/open-seat stubs with
**no photo source that exists anywhere official** — FEC's own filing data
carries no images, and unlike BC's municipal pages, there's no
per-candidate US federal nomination page to check. Confirmed this isn't a
scraping gap for that majority before spending effort on it.

**One name-matching approach tested and explicitly rejected as unsafe**:
matching US candidates to our own `office_holders` table (state/local
officials, imported separately) by full name alone, or even by name +
state, produced real false positives from unrelated same-name people in
completely different jurisdictions — e.g. "Bernadette Smith, U.S. Senate
candidate (Michigan)" name-matched a *Manitoba* provincial riding
official holder, and several state-matched pairs turned out to be
different people in different states once the code prefix was checked
digit-by-digit. **Do not reuse this shortcut for US federal candidates —
state-level granularity isn't fine enough to be safe against common
names.** (BC's equivalent officeholder-dedup check stays safe because it
matches on the much finer `map_shape_id`, e.g. a specific city — see the
core methodology above.)

**What actually worked — matched at seat-level precision, not name alone:**

1. **US House + Senate incumbents seeking re-election** (233 matched):
   cross-referenced every missing-photo candidate against
   [`unitedstates/congress-legislators`](https://unitedstates.github.io/congress-legislators/legislators-current.json)
   — the authoritative current-members dataset (same data ProPublica,
   Congress.gov-adjacent tools, and most civic-data projects build on) —
   on the exact **(state, district, last name)** triple for
   Representatives and **(state, last name)** for Senators. This is
   seat-level precision (only one person represents a given district),
   not a name-only guess. Photo pulled from
   `https://unitedstates.github.io/images/congress/450x550/{bioguide}.jpg`
   — official congressional photography, public domain, served by the
   same open-data project.
2. **Governors seeking re-election** (2 matched: Larry Rhoden/SD, Edward
   "Ned" Lamont/CT): matched by last name + state against Wikipedia's
   ["List of current United States governors"](https://en.wikipedia.org/wiki/List_of_current_United_States_governors)
   page, which carries one official state-government portrait per sitting
   governor in a single fetchable table — the rest of that race's 29
   missing-photo candidates are genuinely challengers/minor-party filings
   with no incumbent photo to reuse.
3. **BC candidates that already had a `source_url` on file but no photo**
   (78 candidates, checked instead of assumed): all already dead ends —
   53 point to `civicinfo.bc.ca/people` and 14 to `bcsta.org/...` (both
   generic directory/listing pages, not per-candidate profiles, so no
   photo was ever retrievable from them), the 7 Surrey ones are the exact
   same 7 already confirmed "Photo not submitted" during the Sept 9
   Surrey photo fix, and the remaining 4 are Langley Township
   (`tol.ca`), already confirmed site-wide to have no candidate photos at
   all. **Zero new photos from this source, but zero was the correct,
   verified answer — not an unchecked gap.**

**Result**: 235 photos added (233 Congress + 2 Governor), all via
official, public-domain government photography, zero individual web
searches performed. Verified: 0 new orphaned `politician_profiles` rows.

**What's left, deliberately not attempted under an official-sources-only
scope**: ~1,631 candidates (mostly US House/Senate/Governor challengers,
plus most BC LECFA-only stubs) have no official government photo because
they don't currently hold the office they're running for, and BC's
remaining ~150 unchecked municipalities are, going by the pattern found
in the 8 checked so far (Surrey and Burnaby are photo-bearing profile
pages; Vancouver, Coquitlam, Langley Township, Vernon, Mission, and
Delta's own page are all plain text lists with nothing to fetch), more
likely than not to yield few or no further photos even if all were
individually re-checked. Filling the remaining US challenger gap would
require either individual research per candidate (news photos, campaign
sites, Ballotpedia) — explicitly out of scope for this pass — or a
lower-confidence bulk source; **this is a real, quantified, structural
gap, not an oversight**, and re-running this exact matching script after
future FEC/candidate refreshes will pick up newly-elected incumbents for
free as districts change hands.

Script:
[`match_us_incumbent_photos.py`](../scripts/us_house_primary_fixes/match_us_incumbent_photos.py)
— fully reusable: queries the live DB itself for missing-photo US
House/Senate/Governor candidates (no manual export step), matches against
`legislators.json` + `governors.json` (Sept 9 snapshots checked in next
to the script; the script's own docstring has the two-step browser fetch
to refresh them for a future run), and writes ready-to-apply SQL. The
actual SQL applied this pass is saved as
[`sept9_us_incumbent_photos.sql`](../scripts/us_house_primary_fixes/sept9_us_incumbent_photos.sql)
for the audit trail.

---

## Politician Wall backfill — 768 candidates had a dead wall link, all election types — 2026-09-09

**User caught it**: `/wall/dee-reiter-school-trustee` (linked from
[Dee Reiter's SD36 - Surrey School Trustee candidate page](http://localhost:3000/elections/seat/school-trustee-sd36-surrey-496873/candidate/dee-reiter-f1bd4e))
404'd. Asked: why, check whether other candidates have the same problem,
and make sure it can't happen again.

**Root cause**: `politician_profiles.wall_slug` is a real, `UNIQUE`
column, and it's the *only* thing the wall page actually resolves by
(`getWallOwnerProfileBySlug` in `src/lib/services/politicianWall.ts` does
an `!inner` join on it — no row with that exact slug stored means
`notFound()`). But **every link to a wall** anywhere in the app
(`CandidacyWall.tsx`, `NavBar.tsx`, `GlobalPoliticianSearch.tsx`, etc.)
renders its `href` as `wall_slug || buildPoliticianWallSlug(name, role)`
— a computed fallback that *always* produces a link, real slug or not.
So a candidate with no stored `wall_slug` still gets a normal-looking
"View Politician Wall" link that 404s the moment it's clicked — the
front end has no way to tell the difference, which is exactly why this
went unnoticed until a user actually clicked one.
`buildPoliticianWallSlug`'s own doc comment (`src/lib/utils/slugs.ts`)
says the database is supposed to be the one storing this value; the
computed version was only ever meant as a brief fallback (e.g. right
after a claim, before the real slug loads in), not a permanent stand-in.

`wall_slug` only gets written by the officeholder-claim/signup RPCs
(`supabase/migrations/2026081116*_officeholder_claim_prefill_on_signup.sql`
and its siblings) — i.e. only when a real person signs up and claims a
profile through the site. **Every script in this directory that
administratively inserts a candidate stub (`bc_refresh_sept4.py`,
`bc_refresh_sept6.py`, `bc_official_pages_supplement.py`,
`top50_batch2.py`, the US FEC import, etc.) has always left it out.**
This is a different, older bug than the photo-fetching one fixed earlier
today, but the same shape: an enrichment field silently missing from the
insert templates from day one, invisible until someone checks the actual
rendered page.

**Audit, all election types**: 768 of 2,075 total candidates system-wide
had no `wall_slug` — BC Councillor 203/293, BC Mayor 35/88, School
Trustee 56/75, US Representative 442/1285, US Senator 3/302, Governor
29/32.

**Fix**: computed the identical slug the front-end fallback would
compute (name + role, same slugify rules — lowercase, strip diacritics,
non-alphanumeric runs to a single hyphen) and **stored** it for all 768,
so the stored value and the fallback always agree from now on and every
wall resolves. `wall_slug` being `UNIQUE` means two different people can
land on the same computed slug at this scale — happened 12 times this
pass (e.g. two different "Michael Dunn, Councillor" in different
cities). Resolved by appending the first 6 hex characters of the
candidate's own `election_candidates.id` to the colliding slug — the
same disambiguator the candidate-page URL itself already uses
(`buildSeatSlug`'s pattern) — never by merging the two people onto one
wall. Verified after applying: 0 remaining missing `wall_slug`, 0
duplicate `wall_slug` values.

**Standing rule going forward, per explicit user instruction — "ensure
this doesn't happen in future"**: every script that inserts a new
`politician_profiles` row must compute and set `wall_slug` in that same
insert, not leave it for a later backfill. `bc_refresh_sept6.py` (the
template step 5 of the core methodology above points at) has been
updated with the pattern — copy its `new_stub` → `UPDATE ... wall_slug =
...` → `politician_profiles` insert block into any new script rather
than reinventing it. **Whichever script or pass adds candidates, run
[`ensure_wall_slugs.py`](../scripts/us_house_primary_fixes/ensure_wall_slugs.py)
afterward as a standing check** — same idea as the orphan-check and
duplicate-profile-audit queries already required after every batch (see
the core BC methodology above): it's idempotent (finds only rows still
missing a slug) and safe to run after any insert, from any pipeline, so
it catches a gap even if a future script's author forgets to wire
`wall_slug` into their own INSERT.

Script:
[`ensure_wall_slugs.py`](../scripts/us_house_primary_fixes/ensure_wall_slugs.py)
— queries the live DB directly for every candidate missing a `wall_slug`
(no manual export step), computes the front-end-matching slug, resolves
collisions with the candidate-id suffix, and writes ready-to-apply SQL.

---

## New election category: BC provincial by-elections — 2026-09-09

**User asked**: "is this election added to our system
[elections.bc.ca/2026-abbotsford-mission-by-election](https://elections.bc.ca/2026-abbotsford-mission-by-election/)?
I don't see it." Checked directly — it wasn't, and **couldn't have
been**: every `elections` row in the system up to this point was
municipal/school-trustee/US-midterm. A **BC provincial by-election**
(an MLA seat) is a category this system had never added at all, not a
gap in an existing pipeline. Confirmed scope before adding (asked the
user first, since this expands the election taxonomy rather than just
adding candidates to an existing race): only this one BC provincial
by-election is currently active (checked the province-wide by-elections
listing, no others called).

**What existed already, what didn't**: `map_shapes` already has the
Abbotsford-Mission provincial riding (id 22307) and a current
officeholder (Reann Gasper, Conservative — the seat's vacancy is what
triggered this by-election; her record is untouched, she isn't one of
the 5 by-election candidates). `election_role_types` already supports
`MLA` / Canada / Provincial. What was missing was the `elections` row
itself, an `election_seats` row for this specific by-election, and the
candidates.

**Added**: a new `elections` row (`2026 Abbotsford-Mission By-election`,
election day Sept 26, `nominations_closed` since the by-election's own
Sept 5 nomination deadline already passed), one `election_seats` row
(MLA, Abbotsford-Mission), and its 5 finalized candidates — Pam Alexis
(NDP), Kerry-Lynne Findlay (Conservative), Stephen Fowler (Green),
Lakhwinder Jhaj (CentreBC), Jeff Monds (Libertarian) — pulled directly
from the by-election's own candidates table (a closed, stable list, not
a moving nomination-period snapshot). None matched an existing profile
or `office_holders` row (checked all 5 by name). Party names matched to
the exact strings this DB already uses for other BC MLAs (`New
Democratic Party (NDP)`, `Conservative Party`, `Green Party`, confirmed
via Reann Gasper's own record) rather than the page's own shorthand
("BC NDP", "BC Green Party"); CentreBC and Libertarian are new parties,
added as-is. No photos — this by-election's candidate table is a plain
financial-agent-contact listing, the same shape as LECFA's municipal
data, not a per-candidate profile page with a headshot.

**Standing note for future passes**: BC provincial by-elections are
called individually and irregularly (not on the fixed municipal
election-cycle calendar this doc otherwise tracks) — worth an occasional
direct check of `elections.bc.ca`'s by-elections listing page, since
nothing about the existing municipal/school-trustee re-check cadence
would ever surface one.

Script:
[`bc_sept9_abbotsford_mission_byelection.py`](../scripts/us_house_primary_fixes/bc_sept9_abbotsford_mission_byelection.py)
— creates the election + seat inline (not just candidates), the template
to copy for the next BC provincial by-election.

---

## Full active-elections sweep, 2026-09-09 — "find the change in candidates"

**User asked**: go over every active election in the system and find
candidate changes, and for Ontario specifically — since no single
province-wide source exists there the way BC has LECFA — go municipality
by municipality, most populated to least.

### BC re-check (LECFA grew 23 → 25 pages)

Re-fetched the LECFA PDF (same URL, always current). Rather than a full
manual row-by-row read, used `pdfplumber` to extract all page text
programmatically, then **counted rows per (jurisdiction, office) pair
and compared against the DB's candidate count for that same pair** —
fast and robust without needing a brittle full-column parse (name /
affiliation / financial-agent-name run together with no reliable
delimiter when a candidate isn't their own agent). Any pair where
`PDF count > DB count` was checked by hand against the raw extracted
text for the actual names.

Found 15 real municipal-council gaps across 8 municipalities — **5 of
which (Elkford, Golden, Lytton, Port Alice, Trail) had zero candidates
in the system at all**, not just an undercount — plus 8 more school-
trustee gaps across 4 districts, including **SD33 - Chilliwack, entirely
missing** (0 candidates, 5 in LECFA). All new names checked against
`office_holders` first: 8 of the 23 total were sitting officeholders
re-filing (linked to their existing profile, not stubbed).

Scripts:
[`bc_sept9_lecfa_recheck.py`](../scripts/us_house_primary_fixes/bc_sept9_lecfa_recheck.py),
[`bc_sept9_school_trustee_recheck.py`](../scripts/us_house_primary_fixes/bc_sept9_school_trustee_recheck.py).
BC total after this pass: 485 candidates (direct `COUNT`).

### US House + Senate — flagged, not re-run this pass

Re-verifying "who's really on the ballot" requires the full per-state
Ballotpedia sweep documented below (**"Re-running these"** section) —
50 states, each read and diffed by hand. Doing that properly would have
consumed this entire pass on its own, and the user's explicit priority
was Ontario. **Deliberately deferred, not silently skipped** — the
existing 1,619 US candidates are the Sept 3-4 FEC-based pull plus this
session's incumbent-photo matching; a fresh Ballotpedia sweep is still
owed and should be its own dedicated pass.

### Ontario — 872 seats, every single one at 0 candidates

Direct `COUNT` before this pass: **0 candidates across all 435 Ontario
municipalities**, despite the `2026 Ontario Municipal Elections` row's
own `nomination_close_date` (Aug 21, 2026) already 19 days past as of
this check. Not a partial gap — the entire province had never been
touched beyond seat pre-creation. Confirmed (again) no single
province-wide registry exists for Ontario the way BC has LECFA, so this
has to go municipality by municipality — ranked by 2021 Census population
(Wikipedia's "List of municipalities in Ontario", 435 rows, matches our
435 exactly) and worked top-down as asked.

**New structural pattern established on the first city, Toronto (pop.
#1, 2,794,356), with the user's explicit sign-off (asked twice, since it
governs every multi-ward city after this one)**: Toronto and most large
Ontario cities elect councillors **by ward**, not city-wide, but every
Ontario municipality's seats were pre-created as one generic city-wide
Mayor + Councillor pair (matching BC's convention, where it's actually
correct — BC councils are elected at-large). Checked whether real ward
polygon boundaries exist anywhere in the system before doing anything:
**they don't** — a `Ward` boundary type exists only for India (64k
rows); zero Canadian ward polygons exist anywhere, and Toronto's own
~370 "Advance Polling District" shapes are a different, unrelated
federal/provincial voting-logistics geography that doesn't align with
municipal wards. Real ward shapefile import is its own separate GIS
project, not something derivable from a scraped candidate list.

**Decision**: model wards as **name-only placeholder `map_shapes`** (`
country='Canada', boundary_type='Ward'`, no geometry) so candidates
group correctly by who they actually compete against — "Find my
District" resolves to the parent municipality only, not the specific
ward, until real boundaries are imported later (a known, documented
gap, not an oversight). Required adding a new `country_boundary_types`
row for `(Canada, Ward)` first — `map_shapes` has an FK to that table,
so a boundary_type can't be used until it's registered there.

**Toronto result**: 25 wards created (`Toronto Ward 1 - Etobicoke North`
… `Ward 25 - Scarborough-Rouge Park`), each with its own `Councillor`
seat; 190 councillor candidates attributed to the correct ward, 53
mayor candidates (city-wide, uses the existing single Mayor seat). The
old, now-superseded generic city-wide Councillor seat (confirmed 0
candidates, 0 admins) was deleted. Source:
`toronto.ca/city-government/elections/2026-election/candidate-list/` —
an official, tabbed (Mayor/Councillor-by-ward/Trustee) page; **Trustee
races (TDSB/TCDSB/CSV/CSCM, another 100+ candidates) intentionally left
for a follow-up pass**, scoped out to keep Toronto's own insert
reviewable. No officeholder-dedup was possible or attempted — Ontario
officeholders have never been imported into `office_holders` in this
system, so every name is a fresh stub (name only; Toronto's list
doesn't carry bio/contact/photo for most candidates, matching the scope
of a first LECFA-stub-equivalent pass, not full enrichment).

**Generalized immediately into a reusable script** rather than staying
Toronto-specific, since the same ward-modeling decision applies to
every multi-ward city:
[`on_multiward_city.py`](../scripts/us_house_primary_fixes/on_multiward_city.py)
takes one JSON file (`city`, `mayor_seat_id`, `old_councillor_seat_id`,
`mayor: [names]`, `wards: [{ward, names}]`) and does the ward-creation +
stub-insert for any city — only the per-city data extraction (finding
the source, scraping it into that JSON shape) differs city to city.

**Continued top-down through 4 more cities the same session, each with
its own source-finding quirk worth noting for next time:**

| City (pop. rank) | Source | Notable |
|---|---|---|
| **Ottawa** (#2) | `ottawa.ca` — Mayor as one table, each of 24 wards its own sub-page (`.../certified-candidates-ward-N-name`) | Batch-`fetch`'d all 24 ward pages at once, same technique as Surrey/Burnaby |
| **Mississauga** (#3) | `mississaugavotes.ca`'s own "Who's running" page looked empty at first — the real candidate list is a `voterview.ca` accordion **embedded in an iframe** (`ovs.voterview.ca/candidatelist/2105`), not on the page's own DOM. Had to inspect `<iframe>` `src` to find it, then navigate there directly. |
| **Brampton** (#4) | `brampton.ca`'s own certified-candidates page | Two-tier government — voters elect a **City Councillor and a separate Regional Councillor** per ward pair (Region of Peel), a genuinely different elected body from the City. Only City Councillor + Mayor added this pass; Regional Councillor would need its own Peel Region election/seat modeling, scoped out same as Trustees. |
| **Hamilton** (#5) | `hamilton.ca`'s certified-candidates page (Mayor/Councillor/Trustee tabs, wards as accordion items) | **Real map_shapes name collision caught before inserting**: two different `Municipal`/Canada shapes are both named exactly "Hamilton" — the actual city (pop. 569,353, `code` `3525005`) and the unrelated Township of Hamilton in Northumberland County (pop. 11,059, `code` `3514019`). Disambiguated via `census_data`/`ST_Area(geom)`, not name alone — a name-only match here would have silently attached 76 councillor candidates to a township of 11,000 people. **Worth checking for on every remaining city**: `select name, count(*) from map_shapes where boundary_type='Municipal' and country='Canada' group by name having count(*)>1` before trusting a name match. Also filtered out several `- Withdrawn`/`- WITHDRAWN` suffixed names in the source data (candidates who dropped out after certification but are still listed with a status marker). |

Scripts:
[`on_sept9_ottawa_data.json`](../scripts/us_house_primary_fixes/on_sept9_ottawa_data.json),
[`on_sept9_mississauga_data.json`](../scripts/us_house_primary_fixes/on_sept9_mississauga_data.json),
[`on_sept9_brampton_data.json`](../scripts/us_house_primary_fixes/on_sept9_brampton_data.json),
[`on_sept9_hamilton_data.json`](../scripts/us_house_primary_fixes/on_sept9_hamilton_data.json)
— all run through `on_multiward_city.py`.

**Status, honestly**: **5 of 435 Ontario municipalities done — but they're
the 5 largest**, covering roughly 5.3M of Ontario's ~14.7M 2021
population (Toronto, Ottawa, Mississauga, Brampton, Hamilton). 430 to
go. Every remaining city from #6 (London) down is smaller than all 5
done so far; most below the top ~20-30 are single-ward (no ward-
modeling step needed, much faster per city, closer to the original BC
LECFA-stub pace) but there are a lot of them. Orphan-check and
`wall_slug`-uniqueness re-verified clean after every single city this
pass, not just at the end. This remains a genuinely multi-session
undertaking at population-ranked pace — continuing top-down (next:
London, Markham, Vaughan, Kitchener, Windsor, ...) is still the right
approach.

---

## US House + Senate — FEC, now with dropout detection

**Source**: unchanged from `adding-us-2026-midterm-candidates.md` — FEC's
OpenFEC API, `candidate_status == 'C'` and the target cycle present in
`election_years`.

**What was new this pass**: `start_us_2026_midterms.py` had run before and
populated 2,180 House + 300 Senate candidates, but **it has never had any way
to detect or remove someone who stopped being an active FEC filer** — it only
ever adds. Re-running it again would have picked up new filers, but a
candidate who withdrew or lost a primary and stopped filing would have stayed
in Choseno forever, silently wrong.

**`scripts/refresh_us_2026_candidates.py`** (new) closes that gap. It imports
`start_us_2026_midterms.py`'s own helpers directly (`fetch_candidates`,
`build_seat_and_candidates_sql`, `normalize_candidate_name`, etc.) rather than
reimplementing anything, and for every House/Senate seat:
1. Re-queries FEC fresh for that seat.
2. Adds anyone in the fresh result not already in Choseno (same idempotent
   insert path as the original script).
3. **New**: removes any candidate whose row this pipeline itself added
   (`added_by_election_admin_id = ADMIN_PROFILE_ID`) whose name is *not* in
   the fresh FEC result — i.e., actually deletes the `election_candidates`
   row. Deliberately scoped to only pipeline-added rows — never touches an
   officeholder-linked candidate, a self-registered politician's own
   application, or anything an admin added by hand.

Run 2026-09-03 (`--office both --cycle 2026`, full 435 House + 35 existing
Senate seats + a check of all 50 states in case a new one opened up, real
`FEC_API_KEY`, not `DEMO_KEY`). Took ~20 minutes end to end (0.3s FEC rate
limit × ~470 seats, plus per-seat DB round-trips).

**Real result — House**: 435 seats checked, 13 candidates added, **3 dropped
out**:
- FL-22 — Casey Brouwer
- FL-24 — Roderick Darrell Vereen
- LA-05 — Michael Edward Mebruer

**Real result — Senate**: 50 states checked, 4 candidates added (ME, SC ×2,
TX), 0 dropped out.

Every one of those numbers is a real, live diff against production data as
of 2026-09-03 — not a hypothetical. This was also the first time this
codebase has ever had a way to answer "who dropped out of a US House/Senate
race" at all; previously the only lifecycle event tracked was a candidate
being added.

**A seat that loses its only candidate is left as an empty seat, not
deleted** — a real seat can legitimately have zero declared candidates
early in a cycle (or after everyone drops out), same as it can before anyone
files in the first place.

---

## US Governor — per-state, only 3 of 36 states covered

**Source**: no single source — the FEC has zero Governor data (state office,
never federally filed). Each state's own regulator, per
`ELECTION_DATA_SOURCES.md`'s "USA — Governor + state legislature" research.

**`scripts/add_governor_candidates.py`** (new) — calls the already-deployed
`fetch-candidates` Edge Function directly (the same one the admin UI's "Fetch
candidates" button calls) for every Governor seat, then reuses
`build_seat_and_candidates_sql()` to write the result. No FEC involved at
all.

**Run 2026-09-03 against all 36 Governor seats**:
- **26 candidates added across 3 states via the live-fetch Edge Function** —
  Idaho (6, via `run.voteidaho.gov`), Connecticut (10, via `seec.ct.gov`),
  Hawaii (10, via `ags.hawaii.gov`). All three matched the live-fetch
  handlers `ELECTION_DATA_SOURCES.md` already documented as working — this
  was the first time they were actually invoked against these specific
  seats, since the seats didn't exist until this session.
- **Colorado errored** — confirmed live, matches the documented WAF block
  (`coloradosos.gov` returns 403 to Supabase Edge Function egress
  specifically).

**A second pass, same day, researched all 25 remaining states fresh** (no
existing `ELECTION_DATA_SOURCES.md` entry) — full per-state findings are in
that doc's new "Batch 2" section. Two more states cleared the same bar as
Idaho/CT/Hawaii — a real official source, confirmed general-election (not
primary) scope, fetched and verified directly:
- **Maryland — 4 candidates**: `elections.maryland.gov`'s static candidate-
  list HTML. Wes Moore (D, the sitting Governor, linked to his existing
  officeholder profile) / Dan Cox (R) / Andy Ellis (Green) / Cathy White
  (Working Class Party — a brand new US party, created on the fly).
- **South Dakota — 2 candidates**: `vip.sdsos.gov`'s candidate-list ASP.NET
  page. Dan Ahlers (D) / Larry Rhoden (R, the sitting Governor, linked
  likewise).

**23 states remain unadded.** A second pass the same day actually fetched
every one of the 15 "found but not yet tried" states from the first pass —
none converted to real candidates, but each now has a precise, confirmed
reason instead of a guess. Full per-state detail (exact URLs, exact error)
is in `ELECTION_DATA_SOURCES.md`'s Batch 2 section; summarized here:

- **Confirmed hard-blocked (HTTP 403, both plain and browser-UA)**:
  Tennessee, Oklahoma, Wisconsin, New York, Michigan, New Hampshire, Texas
  (7 states).
- **Needs a real browser session, not a plain HTTP request** — either a
  stateful app (Oregon's ORESTAR) or an ASP.NET cascading dropdown whose
  options only populate via client-side JS after a first selection
  (Illinois, South Carolina): Oregon, Illinois, South Carolina (3 states).
- **Real database confirmed to exist, but doesn't have a 2026 General
  Election list to serve yet** — not a blocker, a fact: **Kansas**
  (confirmed by enumerating its own election dropdown — newest entry is
  "2026 Primary", no general option exists as of 2026-09-03).
- **Site itself is down** (Ohio — its whole domain is serving a "Website
  Maintenance" page right now; simply retry later).
- **Wrong URL guessed, real one not found**: Iowa, Pennsylvania,
  Massachusetts (OCPF's numeric office-id guess came back empty), Nevada
  (loads but is a JS shell with no server-rendered content).
- **Source found and fetched, but it was the *primary* filing list, not the
  general-election ballot** — real names extracted, wrong scope, not added:
  Wyoming, Nebraska.
- **Requires an authenticated filer login**, unclear if a public read-only
  view exists separately: New Mexico (CFIS).
- **Exact download filename guessed and failed** (3 filename variants
  tried, all 403): Vermont — the SOS's own press release confirms a live
  database + Excel export exists, just not its real URL.
- **Not resolvable yet at all**: Rhode Island — its primary is Sept 8, 2026,
  5 days after this research, so there is no general-election field yet
  regardless of source quality.
- **Minnesota**: not re-attempted this pass — `sos.mn.gov`'s "Search
  Candidate Filings" tool was identified but not yet fetched.

---

## Ontario + Manitoba — searched for real, genuinely not found

Before concluding these were out of reach, searched specifically for a
BC-LECFA-style provincial campaign-financing registry for each:

- **Ontario**: Elections Ontario (`elections.on.ca`) administers *provincial*
  elections only — municipal elections are run entirely by each of the 436
  municipalities' own Clerk, with **no centralized pre-election candidate
  registry**. The province-wide financial disclosure that does exist is
  filed *after* the election (deadline March 30, 2027, well past voting day),
  so it can't answer "who's running" even in principle, let alone before
  nominations close.
- **Manitoba**: same shape — Manitoba Municipal Relations publishes
  guidebooks and forms, but confirmed **no single list of nominated
  candidates across municipalities**; each municipality's Senior Election
  Official posts to their own site.

**Conclusion: neither province has a BC-style shortcut.** Getting real
candidates for these 872 + 274 seats means the same per-municipality research
`ELECTION_DATA_SOURCES.md` already describes for individual US municipalities
— not attempted this pass, flagged as the next real gap rather than papered
over.

**Re-checked 2026-09-06** (prompted by "check all other seats with
nominations open" after the BC re-runs above) — see
`ELECTION_DATA_SOURCES.md`'s Ontario/Manitoba section for the full
writeup. Short version: **Ontario's nominations already closed Aug 21,
2026** (so it's not actually a "still open" case — the roster is final,
just not yet sourced), and Wikipedia has confirmed-real, final per-ward
candidate lists for Ontario's larger cities (Toronto verified live) that
follow the same pattern that worked for US House — a genuine, bounded next
step, not attempted yet. **Manitoba's candidate registration window is
genuinely open through Sept 22, 2026**, but still has no province-wide
registry to check (confirmed again) — nothing to periodically re-check
there yet. As of this pass, **BC remains the only jurisdiction in this
system with an actively-open, centrally-checkable nomination source.**

---

## US House/Senate primary contamination — a real, systemic bug found 2026-09-03

A user checking their own district live on the site (WA-02) found Tomas
Roberto Scheel still listed as a candidate — he'd been eliminated in
Washington's top-two primary weeks earlier, and the real Republican
opponent (Edwin Feller) wasn't in our system at all.

**Root cause, confirmed directly against the FEC API, including its
`/v1/elections/` endpoint which is specifically built to answer "who's
running in this election"**: FEC has zero concept of state primary
elimination. `candidate_status` reflects federal campaign-finance filing
activity only — a primary loser stays `'C'` indefinitely unless they
formally deactivate their committee, and a real general-election nominee
can sit at `'N'` if FEC hasn't flagged their filing "active" by its own
internal criteria (this is exactly what happened to Feller). This is not a
filter bug fixable by different FEC query parameters — `start_us_2026_
midterms.py`'s whole `candidate_status=='C'` foundation is the wrong tool
for "who's on the November ballot" in any district whose primary has
already happened.

**Scope, confirmed by querying the database directly**: 341 of 435 House
districts (78%) showed the tell-tale signal (2+ candidates from the same
party still listed on one seat). Also investigated and ruled out as a fix:
Google's Civic Information API / VIP (Voting Information Project) — real,
live, official (each state uploads its own data), tested directly against
two currently-active elections (Rhode Island's Sept 9 primary, Delaware's
Sept 15 primary) — **`contests` came back empty for both**, even days
before the election. VIP's candidate-roster data is a separately-optional
upload from polling-place data, and coverage is inconsistent. Kept the API
key (scoped only to `civicinfo.googleapis.com`, created in the `chosenoprod`
GCP project) for a re-check closer to November, but it isn't usable today.

**The only source that's actually worked so far: each state's own official
post-primary results, which name the winner.** Not a "general election
candidate list" (many states don't publish one as a distinct document) —
the **certified primary RESULTS page**, which exists precisely because the
primary already happened, and whose winner of each party primary *is* the
real general-election nominee (assuming no write-in/independent
complications, checked per-race). Fixed by hand this pass, seat by seat:

- **Washington-02**: removed Scheel, added Feller (the case that surfaced
  this whole bug) — [live seat](https://www.choseno.com/elections/seat/u-s-representative-congressional-district-2-7ce0c3).
- **South Dakota** (House + Senate): `vip.sdsos.gov/candidatelist.aspx?
  eid=774` — the same LECFA-style state candidate-list page found for
  Governor turned out to also cover the full ballot, U.S. House/Senate
  included, **and explicitly marks withdrawals** (Julian Beaudion, D,
  marked "Withdrawn 08/04/2026" — removed). Went from 9 candidates across
  2 seats down to the real 4.
- **Maryland**, all 8 congressional districts: no single "general candidate
  list" document exists for Congress specifically, but
  `elections.maryland.gov/elections/2026/primary_results/
  gen_results_2026_4_<district>.html` (1 through 8) gives real, certified
  primary winner-and-vote-count data per district. Removed 31 primary
  losers, added 3 real general-election nominees FEC had missed (George E.
  McDermott, Chris Chaffee, Scott M. Collier — all Republicans FEC hadn't
  marked `'C'`, same failure mode as Feller). Went from 44 candidates
  across 8 districts down to the real 16 (exactly 2 per district).

### California (all 52 districts) — 2026-09-04

**Source**: the official Statement of Vote,
`elections.cdn.sos.ca.gov/sov/2026-primary/sov/complete-sov.pdf` (13.5MB,
121 pages — found by searching for "California Secretary of State statement
of vote primary 2026"). One single PDF covers every office statewide;
"United States Representative" results run pages 76–92 (printed pages
73–89), one district per subsection, county-by-county vote counts with a
`District Totals` row per candidate.

**Why this one needed more than "take each party's nominee" (unlike
Maryland/South Dakota)**: California uses a **top-two primary** — the two
highest vote-getters advance regardless of party, so a heavily one-sided
district can send two candidates from the *same* party to the general
(confirmed for real: CD-11 is Wiener vs. Chan, both Democratic; CD-40 is
Calvert vs. Kim, both Republican). Read every district's full candidate
list and ranked by raw vote count (the `District Totals` row), not by
picking "the top Democrat + the top Republican."

**Pipeline**: read the PDF directly via 20-page-window image extraction
(`Read` tool's `pages` param — plain text extraction badly mangles this
PDF's multi-column vote tables; the rendered page image reads far more
reliably), by-hand ranking into a `district -> [last_name, ...]` truth
table (saved as
[`scripts/us_house_primary_fixes/ca_2026_primary_winners.py`](../scripts/us_house_primary_fixes/ca_2026_primary_winners.py)),
then reconciled against a DB export using the new, reusable
[`scripts/us_house_primary_fixes/reconcile_house_district.py`](../scripts/us_house_primary_fixes/reconcile_house_district.py)
— matches DB candidates to truth entries by normalized (accent/punctuation-
stripped) last name, flags non-matches for deletion, flags truth entries
with zero DB match as missing nominees to add.

**Result**: all 52 districts now show exactly 2 candidates.
- **147 primary-loser/phantom candidates removed** (including, same failure
  mode as WA-02: the actual sitting CD-1 incumbent, Doug Lamalfa, was in our
  DB via stale FEC status but isn't in the real 2026 primary field at all —
  redistricting/retirement, not something FEC's status flags).
- **16 real nominees added** that FEC had never marked `candidate_status='C'`
  — all 16 were Republican challengers in Democratic-leaning districts
  (Robin Littau CD-2, Zachariah Wooden CD-7, Jeff Frese CD-10, Charles
  Hoelter CD-15, Peter Sundin Soulé CD-16, April A. Verlato CD-28, Rudy
  Melendez CD-29, Stephanie M. Vargas CD-33, Calvin Lee CD-34, Baltazar
  Fedalizo CD-37, Pedro Antonio Casas CD-38, Steve Manos CD-39, Mitch
  Clemmons CD-41, Cristian Morales CD-43, Steve Cohen CD-50, Ricardo
  Cabrera CD-51) — same systematic gap as Edwin Feller in WA-02, just at
  scale.
- **One name-matching false positive caught and fixed by hand**: CD-45's
  truth token `"vo"` matched two different real DB rows (Chuong Vo AND
  Thomas Ky-Phong Vo — two unrelated candidates who happen to share a
  surname). Resolved by cross-checking actual vote totals from the PDF
  (Chuong Vo: 24,591 vs. Thomas Vo: 13,643) and force-deleting the loser
  by full name rather than trusting the surname match alone —
  `reconcile_house_district.py`'s `force_delete_names` param exists
  specifically for this case; **always spot-check districts with common
  surnames before trusting an automated last-name match.**

### All remaining states (Ohio through Alaska) — 2026-09-03/04, session completed

After California, the pipeline switched sources from state-by-state official
sites (many of which turned out to be JS-rendered SPAs — Illinois' ASP.NET
cascading dropdowns, Oregon's ORESTAR, Pennsylvania's
`electionreturns.pa.gov`, Virginia's Enhanced Voting system — none reliably
scrapable even via a real browser) to **Wikipedia's
`2026 United States House of Representatives elections in <State>` articles**,
which exist for every state and cite each state's own certified primary
results / FEC filings directly. Cross-checked against official sources on
every district touched during the PA/Wikipedia comparison (Fitzpatrick/
Harvie, Boyle/Arriaga, Rabb/Mahoney all matched exactly) — Wikipedia proved
reliable and vastly faster to extract than fighting each state's own site.

**Extraction method**: for a normal (party-primary) state, each district's
infobox table on the Wikipedia page has a `Nominee`/`Party` row pair giving
the exact general-election ballot. Pulled via a small `javascript_tool`
snippet run against the live page (not `get_page_text`, which returns the
whole article's endorsement/polling noise and is far more token-expensive):

```js
document.querySelectorAll('h2').forEach(h => {
  if (/^District \d/.test(h.textContent.trim())) {
    // find the infobox table following this heading, read its
    // "Nominee" / "Party" <th> rows
  }
});
```
(Full snippet history is in this session's transcript; the pattern is
reusable verbatim for any future state re-check.)

**Pipeline used for every state below** (the streamlined successor to
`reconcile_house_district.py` — same idea, single script instead of
library+call-site):
[`scripts/us_house_primary_fixes/apply_fix.py`](../scripts/us_house_primary_fixes/apply_fix.py).
Each state's truth dict is saved in
[`scripts/us_house_primary_fixes/state_truth_files/`](../scripts/us_house_primary_fixes/state_truth_files/)
(`<state>_truth.py`), each with a `# Source:` comment citing the exact
Wikipedia URL used. Usage:
```bash
python3 apply_fix.py <state>_truth.py <state>_db_current.txt <state>_fix.sql
# review the printed DEL/ADD summary, then:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <state>_fix.sql
```
where `<state>_db_current.txt` is a pipe-delimited psql export:
```sql
select ms.code, es.id, p.full_name, ec.id
from election_seats es
join map_shapes ms on ms.id = es.map_shape_id
join election_candidates ec on ec.seat_id = es.id
join profiles p on p.id = ec.politician_id
join elections e on e.id = es.election_id
where e.name = '2026 US Midterm Elections'
  and es.role_title = 'U.S. Representative'
  and ms.properties->>'statefp' = '<FIPS>'
order by ms.code;
```

**States fixed this pass** (party, FIPS, districts, net deletes/adds):
Ohio, Georgia, Illinois, New Jersey, Wisconsin, Virginia, Michigan,
Pennsylvania, Texas, Florida, New York, Missouri, Washington, Alabama,
Tennessee, Massachusetts, Indiana, Minnesota, Colorado, Connecticut,
Arizona, Utah, Nevada, Iowa, Kentucky, Oregon, South Carolina, Oklahoma,
Kansas, Louisiana, Mississippi, Nebraska, Montana, Idaho, West Virginia,
New Mexico, Arkansas, Maine, Wyoming, Hawaii, North Dakota, Alaska,
Vermont — **43 states, all now showing exactly the real general-election
field per district** (verified by a final national sweep, see below).

**Notable non-standard cases hit along the way**:
- **Utah** — court-ordered mid-cycle redistricting moved incumbents between
  district *numbers*, not just boundaries (Blake Moore 1st→2nd, Celeste
  Maloy 2nd→3rd, Mike Kennedy 3rd→4th). Handled by trusting Wikipedia's
  current district numbering directly rather than assuming "district N
  incumbent" carried over from 2024.
- **Louisiana** — uses an all-party "jungle primary": the Nov 3 election
  *is* the first round (runoff Dec 12 if nobody clears 50%), so there is no
  separate primary-elimination event yet. Every `Declared` (non-withdrawn)
  candidate per district is a legitimate general-ballot candidate — the
  truth dict lists all of them (up to 9 in one district), not just two, and
  only `Withdrawn`/`Declined` candidates were deleted. Net: 5 withdrawn
  candidates removed, 9 real declared candidates added across 6 districts.
- **Alaska, North Dakota, Wyoming, Vermont** — single at-large districts;
  `ms.code` has no real district suffix (`0200`/`3800`/`5600`/`5000`), so
  the truth dict uses key `0`.
- **Alaska** specifically uses a top-4 nonpartisan primary feeding a
  ranked-choice general — truth dict is the 4 candidates who *advanced*
  (Begich, Hafner, McDermott, Hill), not "the primary winner" singular.
- **North Dakota** and **Iowa (CD-2)** — a declared Independent
  (`Declared`, not just `Filed paperwork`, and shown with real
  fundraising numbers in the article) is a legitimate additional
  candidate alongside the two major-party nominees, not noise to drop.
  `Filed paperwork`-only independents (lower confidence, no confirmed
  ballot fundraising) were left out, matching the precedent set for
  Iowa's Jermaine Decker.
- **A recurring name-collision bug, caught 3 times**: when a truth entry's
  full name ends in a suffix (`"Stewart Cathey Jr."`, `"Jeffrey Hulum
  III"`, `"Nick Begich III"`), `apply_fix.py`'s last-token surname
  extraction grabs the suffix (`"Jr."`/`"III"`) instead of the real last
  name, causing a false "missing" + a false non-delete on the DB's version
  of the same name (which usually has the suffix in the middle, e.g. `"Jeffrey
  Iii Hulum"`). **Fix**: write truth names without the trailing suffix
  (`"Stewart Cathey"`, `"Jeffrey Hulum"`, `"Nick Begich"`) — the script
  matches by last-name token, so the suffix isn't needed for a correct
  match anyway.
- **Same-surname false-positive matches, caught by a post-fix national
  spot-check** (not by the per-state pipeline itself, which has no way to
  notice a *wrong* match, only a missing one): IL-04 (Jesus García, the
  withdrawn incumbent, silently matched against real nominee Patty Garcia's
  truth entry because they share a surname — needed `FORCE_DELETE`),
  MI-11 (Stu Baker vs. real nominee Ethan Baker), TX-22 (Troy Nehls, the
  retiring incumbent, vs. his brother and actual nominee Trever Nehls),
  TX-34 (Mayra Flores, a past officeholder, vs. real nominee Eric Flores).
  All four fixed via `apply_fix.py`'s `FORCE_DELETE = {district: {name}}`
  override. **Lesson for next time**: after applying a state, re-query
  `count(*) > 2` per district and manually eyeball any surname overlap
  before trusting a clean DEL/ADD summary — the matcher can silently
  produce a *false* match, which prints as "nothing to fix" rather than as
  an error.
- **NJ-08 duplicate profile** (not a primary-contamination case): two
  separate `profiles` rows existed for the same person — "Robert Menendez"
  (linked to his `office_holders` record) and "Robert J. Menendez" (an
  unlinked duplicate stub). Kept the officeholder-linked one, deleted the
  duplicate's `election_candidates` row directly (outside `apply_fix.py`,
  which has no profile-dedup logic).

**Deliberately left unfixed, not oversights**:
- **North Carolina** (12 districts) — the state board of elections has not
  certified results for these specific districts; no reliable "who won"
  source exists yet.
- **Rhode Island** (1 district) and **New Hampshire** (2 districts) — their
  2026 primaries have not happened yet (RI: Sept 9, 2026; NH: Sept 8,
  2026, i.e. both still in the future as of this write-up) — there is
  nothing to reconcile against until then. Re-run the same Wikipedia +
  `apply_fix.py` pipeline once each primary is certified.

### Final national verification — 2026-09-04

Ran a single query across every US House seat for `count(*) > 2` candidates
per district — the same contamination signal that started this whole
investigation. Result: only the expected, already-explained multi-candidate
cases remain (Louisiana's jungle-primary districts, Alaska/North
Dakota/Wyoming/Iowa/Idaho/Illinois-4's confirmed extra declared
independents, and the untouched NC/NH/RI seats). No unexplained district
remains anywhere in the 435-seat US House map.

---

## Follow-up: minor-party/independent candidate gap — 2026-09-04

A user-requested 10-race spot-check against live web search (not Wikipedia)
found 6 of 10 races matched exactly, but 4 had a **real, separate gap**: a
genuinely-qualified minor-party or independent candidate — Libertarian,
Socialist Workers, Independent American Party, American Independent Party
— missing from the district, even though the major-party nominee data was
100% correct in every case. Root cause: Wikipedia's per-state "elections
in `<State>`" infobox tables (the source used for the whole primary-
contamination fix above) only show the headline 2–3 "Nominee" candidates,
not the full certified ballot.

**Fix**: re-swept all 44 previously-fixed states (the full list in
`scripts/us_house_primary_fixes/state_truth_files/`) against
**Ballotpedia's** `United States House of Representatives elections in
<State>, 2026` pages instead, which list every candidate who actually
qualified for the general-election ballot (major party + Libertarian/
Green/Constitution/Working Families/Socialist Workers/Independent/write-in
— whatever a state's ballot-access rules produced), not just the top two.
Extracted per-district via a small `javascript_tool` DOM walk (walks
forward from each `District N` heading, collects the `General election
candidates` section, stops at the next `Primary candidates` heading) —
same reasoning as the original Wikipedia extractor, different site.
Reusable add-only tool:
[`scripts/us_house_primary_fixes/add_missing.py`](../scripts/us_house_primary_fixes/add_missing.py)
(takes a `MISSING = {district: [(name, party), ...]}` dict + an optional
`NEW_PARTIES` list, diffs against a seat-id export, and INSERTs stub
profiles — same shape as `apply_fix.py` but additive-only, since this pass
never needed to delete a genuine nominee). Per-state missing-candidate
files are in
[`scripts/us_house_primary_fixes/minor_party_sweep/`](../scripts/us_house_primary_fixes/minor_party_sweep/).

**Scale**: this was not a small gap. **~350 minor-party/independent/write-in
candidates added across 41 of the 44 states** (only NM, WA, AL were
already fully clean against Ballotpedia — a party's top-two/jungle-primary
or party-primary structure still only lets 2–3 names through in some
states). Michigan alone added 39 (nearly every district runs Green/
Libertarian/US Taxpayers/Working Class convention nominees by default
under state law); Colorado 28; Florida 30 (heavy "No Party Affiliation"
write-in tradition); New York 22 (fusion-voting minor lines: Working
Families, Conservative, and one-off ballot-line parties). **31 new minor
parties** were created in `political_parties` along the way (Working
Families Party, Conservative Party, Libertarian Party variants, U.S.
Taxpayers Party, Independent American Party, Socialist Workers Party,
Green Party, Constitution Party, and many single-state or single-candidate
ballot-line parties like New Jersey's "Hope for Tomorrow Party" or Georgia's
"Socialist Labor Party").

**Three same-surname false-positive corrections found and fixed during
this pass** (a person the original per-state fix deleted as a "primary
loser," who was actually a genuine independent/nonpartisan general-election
candidate with no primary to lose in the first place):
- **Oregon CD-6** — Jason Faler (Unaffiliated), wrongly deleted alongside
  real primary losers in the original Oregon fix.
- **Mississippi CD-4** — Carl Boyanton (Independent), same failure mode
  (DB had him as "Boyanton Lester Carl").
- **Nebraska CD-3** — Mark Cohen (Nonpartisan).
- **Montana CD-2** — Michael Eisenhauer (Independent).
**Lesson reinforced**: any per-state truth dict built only from a state's
*primary* results will never include independents (they don't run in
primaries), so a truth-dict-based delete pass will always risk deleting
them unless the truth dict is built from the *general* ballot, not the
primary. This sweep is what actually catches and repairs that class of
error — it's a second, independent pass built from full-ballot data.

**Two false-positive additions caught and corrected** (the reverse
problem — a name Wikipedia listed as "Declared" that turned out not to
have actually made the certified general-election ballot, confirmed absent
from Ballotpedia's page entirely):
- **Wyoming at-large** — "Shawn Johnson (Libertarian)" was added from
  Wikipedia's "Declared" independents section but does not appear
  anywhere on Ballotpedia's page; the real third candidate is **Daniel
  Workman (Independent)**. Swapped.
- **North Dakota at-large** — "Charles Tuttle (Independent)" likewise
  doesn't appear on Ballotpedia at all; removed, leaving the confirmed
  3-candidate field (Fedorchak, Hammer, Neville).

**Six real ranking errors found and fixed in California** (all 52
districts re-checked against Ballotpedia's top-two): the original
Statement-of-Vote-PDF read (done by-hand from a 20-page image extraction,
see the California section above) put the wrong candidate in second place
in CD-7, CD-14, CD-29, CD-34, CD-37, and CD-42 — likely a multi-column
table misread on a few pages out of the 92-page PDF. Corrected using
Ballotpedia's confirmed top-two list for each (Doris Matsui, Melissa
Hernandez, Angélica María Dueñas, Angela Gonzales-Torres, Samantha Mota,
Brian Burley replace the wrong second-place names). **Lesson**: a by-hand
read of a large multi-column PDF should be spot-checked against a second
independent source before being treated as final, even when the read
"looked" complete at the time.

**Final verification**: re-ran the national `count(*) < 2` query — only 3
districts remain, all genuinely uncontested (Ballotpedia-confirmed):
FL-10 (Frost, general election canceled/unopposed), MA-02 and WI-02 (no
Republican candidate filed in either state's primary).

**Not re-swept**: North Carolina (still uncertified), New Hampshire and
Rhode Island (primaries still not held as of 2026-09-04) — same exclusions
as the original fix; re-run this same Ballotpedia sweep alongside the
original primary-contamination pipeline once each is available.

## Re-running these

### ⚠️ US House + Senate: `refresh_us_2026_candidates.py` is superseded — do not treat it as the source of truth

This script is FEC-`candidate_status`-based, and the whole first half of
this document is the record of that basis being wrong: FEC's status field
has no concept of state primary elimination, and misses real
general-election nominees FEC hasn't flagged `'C'` yet. It still runs
without erroring and will pick up genuinely new FEC filers, but **it will
silently re-introduce primary-loser contamination for any district whose
primary happens after your last run**, and it has no idea about
minor-party/independent candidates who never file FEC paperwork the way it
expects. Do not rely on it alone once a district's primary has passed.

**The current source of truth for "who's really on the ballot" is
Ballotpedia's `United States House of Representatives elections in
<State>, 2026` page, per district** — it tracks primary winners,
withdrawals, and the full certified general-election candidate list
(major party + every minor party + qualifying independents) in one place,
and updates as candidates drop or are added. To re-check a state:

1. Open `https://ballotpedia.org/United_States_House_of_Representatives_elections_in_<State>,_2026`
   (at-large states use `_election_in_<State>` singular — Alaska, North
   Dakota, Vermont, Wyoming).
2. Read each district's **"General election candidates"** section (the
   top summary line/list before the primary breakdowns) — that is the
   current real ballot. A name that has moved into a **"Withdrawn"** or
   **"Did not make the ballot"** section is no longer running, even if it
   was a confirmed nominee before.
3. Export the district's current `election_candidates` rows (query in
   `apply_fix.py`'s docstring) and diff by hand against Ballotpedia's list.
4. For **removals** (someone on Ballotpedia's page has moved to
   Withdrawn/disqualified since your last check), delete their
   `election_candidates` row directly — there is no dedicated script for
   this yet (see "Known gap" below).
5. For **additions**, use
   [`scripts/us_house_primary_fixes/add_missing.py`](../scripts/us_house_primary_fixes/add_missing.py)
   (`MISSING = {district: [(name, party), ...]}`, optional `NEW_PARTIES`)
   — same pattern used for the 2026-09-04 minor-party sweep.

**Known gap, honestly**: nothing in this repo automates the removal side
of this yet. `add_missing.py` is intentionally add-only (this pass never
needed to delete a real, still-running nominee — only to restore ones
wrongly deleted earlier, see the false-positive corrections above). A
proper `scripts/refresh_us_2026_from_ballotpedia.py` — fetch every state's
page, diff both directions (add what's newly listed, remove what's moved
to Withdrawn) — is the natural next step if this needs to run routinely
rather than by hand each time; it hasn't been built. Until then, re-run
the manual district-page-read described above, especially in the weeks
before November 3 as more candidates withdraw and general-election ballots
finalize.

```bash
# US House + Senate: FEC-only — picks up new FEC filers, does NOT reliably
# catch primary dropouts or minor-party/independent candidates. Superseded
# by the Ballotpedia process above for anything post-primary. Still useful
# early in a cycle, before any state's primary has happened.
python3 scripts/refresh_us_2026_candidates.py run --office both --cycle 2026

# US Governor: re-check every state's live-fetch handler (harmless to re-run,
# picks up newly-wired states automatically once ELECTION_DATA_SOURCES.md's
# `hasFetch` list grows)
python3 scripts/add_governor_candidates.py run

# BC: no standing script yet -- re-fetch the LECFA PDF by hand and re-run
# the matching pipeline documented above (worth promoting to a real
# scripts/sync_bc_municipal_candidates.py if this becomes routine -- see
# ELECTION_DATA_SOURCES.md's BC Municipal section)
```

Both require `DATABASE_URL`; the FEC-based one also needs `FEC_API_KEY`; the
Governor one reads `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
straight out of `.env.local` if not set explicitly.
