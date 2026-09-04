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
`scripts/*.py` file — see "Next steps" below):
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
