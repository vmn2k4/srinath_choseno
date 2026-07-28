# Official election-candidate data sources — research notes

How to get "who's nominated / running" for an election, per jurisdiction, and how
Choseno pulls and stores it. This is the research record; see
[`docs/adding-boundary-data.md`](adding-boundary-data.md) for how the *boundaries*
(map_shapes) themselves were sourced and loaded — this doc is about the *candidates*
that get matched onto those boundaries.

## ⚠️ Start here if you're picking this up in a new session

**Scope, as directed:** Canada federal + all Canadian provinces/territories (except
Nunavut, no boundary data exists), plus US federal (House + Senate). **US Governor
and state legislature research is now underway too** (scope widened — see "USA —
Governor + state legislature" below; 12 of 50 states researched so far, batched
~10-12 at a time). US municipal elections remain out of scope (thousands of
independent systems, research one specific municipality when it matters instead).

**Two parallel delivery mechanisms exist and BOTH need updating for every new
jurisdiction — don't add one and forget the other:**
1. `scripts/sync_<jurisdiction>_candidates.py` — standalone CLI tools (stdlib
   Python + `psql`, run by hand with `DATABASE_URL` set) for manual bulk
   backfills. One exists per *already-fully-wired* jurisdiction (see table below).
2. `supabase/functions/fetch-candidates/index.ts` — the single deployed Edge
   Function every jurisdiction's live logic lives in (a `fetch<Jurisdiction>`
   function + a `HANDLERS` dispatch entry + a `CA_PROVINCIAL_PROPERTY_SIGNATURE`
   entry). This is what the admin UI (`ElectionsAdmin.jsx`'s "Fetch candidates"
   button) actually calls. **`src/services/candidateSync.js`'s
   `CA_PROVINCIAL_PROPERTY_SIGNATURE` / `JURISDICTION_LABELS` must be kept in sync
   with the Edge Function's copy of the same map** — the JS service builds the
   "view official source" link client-side without calling the function; if the
   two maps disagree, the link and the fetch button can disagree about whether a
   jurisdiction is supported.

### Exact code state as of this handoff

| Jurisdiction | Researched? | `sync_*.py` script? | Edge Function handler wired? | `candidateSync.js` updated? |
|---|---|---|---|---|
| Canada Federal | ✅ | ✅ `sync_federal_candidates.py` | ✅ `fetchCaFederal` | ✅ |
| BC | ✅ | ✅ `sync_bc_candidates.py` | ✅ `fetchBc` | ✅ |
| Manitoba | ✅ live | ✅ `sync_manitoba_candidates.py` | ✅ `fetchMb` | ✅ |
| Ontario | ✅ | ✅ `sync_ontario_candidates.py` | ✅ `fetchOn` | ✅ |
| Quebec | ✅ | ✅ `sync_quebec_candidates.py` | ✅ `fetchQc` | ✅ |
| US Federal (House + Senate) | ✅ | ✅ `sync_us_federal_candidates.py` | ✅ `fetchUsFederal` + `fetchUsSenate` (President still not wired — see note) | ✅ |
| **Alberta** | ✅ **found & verified** | ❌ not written | ❌ still no `fetchAb`/`HANDLERS` entry — button correctly stays hidden (`manual_only` gating, not the old silent-`unsupported` bug) | ✅ manual link only (`CA_PROVINCIAL_PROPERTY_SIGNATURE` + a seeded `provincial_election_events` row — see below) |
| **Saskatchewan** | ✅ **found & verified** | ❌ | ❌ not started | ✅ manual link only (same as Alberta) |
| **PEI** | ✅ **found & verified** | ❌ | ❌ not started | ✅ manual link only (points at the main site, not a per-district URL — see below) |
| New Brunswick | 🔍 researched, **not found** | ❌ | ❌ | ❌ |
| Nova Scotia | 🔍 researched, **partially found** (real system located, blocked on ASP.NET postback) | ❌ | ❌ | ❌ |
| Newfoundland & Labrador | 🔍 researched, **not found** (interrupted mid-search) | ❌ | ❌ | ❌ |
| Yukon | ❌ not attempted this pass (only a quick-pass 403 from an earlier session) | ❌ | ❌ | ❌ |
| Northwest Territories | ❌ not attempted this pass (only a quick-pass from an earlier session) | ❌ | ❌ | ❌ |
| Nunavut | N/A — no boundary data exists, out of reach regardless | — | — | — |

**US Federal note:** both House and Senate are now wired into the Edge Function
(`fetchUsFederal` / `fetchUsSenate`, sharing a `fetchFecCandidates(office, state,
district?)` helper) and into `candidateSync.js`'s `detectJurisdiction`/
`JURISDICTION_LABELS`, so the admin-UI "Fetch candidates" button renders and
works for both. Both query the FEC's OpenFEC API directly, no event/discovery
step needed (self-describing by `(cycle, office, state[, district])`; `cycle` is
computed as the next even year at-or-after today) — no DB event row exists for
this jurisdiction (unlike every Canadian one above), so the client builds the
"view official source" link the same way, without calling the function.

- **House** (`boundary_type='Federal'`): `state` comes from `properties->>'statefp'`
  via a static FIPS→USPS table, `district` from the last 2 digits of
  `map_shapes.code` (the GEOID).
- **Senate** (`boundary_type='State'`): `state` is `map_shapes.code` directly (per
  `sync_us_federal_candidates.py`, already the 2-letter USPS abbreviation, no FIPS
  conversion needed). **Only reachable via the seat's `role_title`** — `'State'` is
  also where Governor seats live (a non-federal office with no data source at
  all), and the two are otherwise indistinguishable from the map_shape alone.
  `detectJurisdiction(mapShape, roleTitle)` only returns `'us-senate'` when
  `roleTitle === 'U.S. Senator'`; a `'Governor'` seat on the same shape correctly
  falls through to `unsupported`. The Edge Function now selects `role_title`
  alongside `map_shapes` for exactly this reason.

**Not done:** President — no `map_shape_id` at all (nationwide race), so it
doesn't fit this seat→map_shape-keyed function's model; `sync_us_federal_candidates.py`
still covers it for manual backfills, just not this one-click path.

**New: `manual_only` status tier.** Found while auditing whether every researched
jurisdiction actually surfaces a "view official source" link in the admin UI —
Alberta/Saskatchewan/PEI didn't, despite being fully researched, because
`getCandidateSourceInfoForSeats`'s event-lookup path requires an actual
`provincial_election_events` row to exist before it builds a link, and none had
ever been seeded for these three. Fixed two ways:
1. **`20260729000015_seed_ab_sk_pe_events.sql`** seeds one event row each (real
   source URLs from research — Alberta's is a search *form*, not direct results,
   same caveat as Ontario/Quebec's API-root links; PEI's points at the main site
   since there's no single whole-province page, only per-district ones).
2. **`JURISDICTIONS_WITH_FETCH`** (a `Set` in both `candidateSync.js` and the Edge
   Function) now gates whether a jurisdiction gets `status: 'active'` (link +
   working "Fetch candidates" button) or `status: 'manual_only'` (link only, no
   button) — replacing the old behavior where *any* jurisdiction with an event
   row got `'active'` regardless of whether a real `HANDLERS` entry backed it
   (the exact bug the old Alberta write-up flagged: "makes Alberta seats silently
   report `unsupported`" was actually worse than that description — once an
   event existed, the *button would render* and then fail, not stay hidden).
   `ElectionsAdmin.jsx` needed zero changes: it already only renders the button
   when `status === 'active'`, and always renders the link whenever `url` is
   truthy, independent of status.

This same `manual_only` tier is what every unimplemented US state below uses too
(`US_STATE_SOURCES` in `candidateSync.js`, `hasFetch: false`) — every researched
state gets a real, clickable admin link immediately, whether or not its live-fetch
handler is built yet.

### Recommended order for the next session

1. **Wire Alberta, Saskatchewan, PEI's live fetch** — all three are fully
   researched and verified with real data, and now have a working manual link
   (see above). What's left is "just" the `fetchAb`/`fetchSk`/`fetchPe` handlers
   + `HANDLERS` entries + adding them to `JURISDICTIONS_WITH_FETCH` in both files
   (see their sections below for exact URLs/params/parsing notes). Should be
   fast — no more research needed, purely implementation.
2. **Resume Newfoundland & Labrador** — was mid-search when interrupted; last
   known state: found only generic "how to become a candidate" info pages on
   `elections.gov.nl.ca`, hadn't yet tried the Wayback-Machine-CDX-search trick
   that worked for Ontario/Quebec, or a domain-confusion check like the one that
   unlocked Alberta (`electionsalberta.ab.ca` vs the real `elections.ab.ca` —
   always verify you have the *actual* domain via a fresh web search, don't
   trust the first "official site" link).
3. **Crack Nova Scotia's ASP.NET postback** (or decide it's not worth the effort)
   — the real system is found (`results.electionsns.ca`), just needs
   `__VIEWSTATE`/`__EVENTVALIDATION` handling. Also note: NS is mid-redistricting
   (2025 Electoral Boundaries Commission), so `map_shapes` may need a boundary
   refresh before this is even useful — check `ARCHITECTURE.md` §11 for current
   NS boundary vintage before investing more time here.
4. **New Brunswick** — genuinely stuck after real effort; the site
   (`electionsnb.ca`, Adobe AEM) only exposes "how to become a candidate" pages.
   Untried ideas: AEM's `.model.json`/`.infinity.json` content-export suffixes
   (works on many AEM sites to get structured JSON instead of rendered HTML);
   check `legnb.ca` (the Legislature's own site, hosts NB election reports as
   PDFs — see the "Forty-First Provincial General Election" PDF found during
   research); check whether a separate results domain exists (Nova Scotia's
   pattern of `electionsns.ca` being separate from `electionsnovascotia.ca`
   suggests checking for e.g. `resultsnb.ca` or similar before giving up.
5. **Yukon, NWT** — not attempted with real effort yet this pass (only quick,
   shallow checks from an earlier session). Yukon showed the same "blocked
   client" symptom Alberta did — **check for a domain-confusion issue first**
   (Alberta's fix was realizing `electionsalberta.ab.ca` was simply the wrong
   domain) before concluding it's genuinely inaccessible.

---

## How this fits together

- `map_shapes` already has the districts for every jurisdiction below (see
  `ARCHITECTURE.md` §11/§14 for how those were loaded).
- Each jurisdiction below gets candidate data into one of three tables (schema:
  `supabase/migrations/20260729000011_federal_election_candidates.sql` and
  `20260729000012_provincial_and_us_federal_candidates.sql`):
  - `federal_election_events` / `federal_election_candidates` — Canada federal only
    (keyed by Elections Canada's own opaque `EV`/`EV_TYPE` ids).
  - `provincial_election_events` / `provincial_election_candidates` — any Canadian
    province, discriminated by a `province` column (`'BC'`, `'MB'`, ...).
  - `us_federal_election_candidates` — US federal (House/Senate/President), no
    separate events table needed since `(cycle, office)` is already a full key.
- All three are public-read (official government data), write-only via the scripts
  below connecting directly with `DATABASE_URL` (service role, bypasses RLS) — see
  each migration file for the exact RLS policies.
- Every script in `scripts/sync_*_candidates.py` follows the same two-command shape:
  `discover` (find/register the current election event(s)) and `sync` (pull and
  upsert candidates for one registered event). All are stdlib-only Python + `psql`,
  matching `scripts/upload_boundary.py`'s existing convention. **Rate limit
  everything** — see the "Lessons learned" section below before writing a new one.

---

## Canada — Federal ✅ built

**Source:** Elections Canada's Voter Information Service (VIS),
`elections.ca/Scripts/vis/Candidates`.

**Mechanism:** per-riding URL:
```
https://www.elections.ca/Scripts/vis/Candidates?L=e&ED={ED}&EV={EV}&EV_TYPE={EV_TYPE}&PROV={PROV}&PROVID={PROVID}&QID=-1&PAGEID=17
```
- `ED` = the riding's federal electoral district number = `map_shapes.code` directly
  for `country='Canada' AND boundary_type='Federal'` (also in
  `properties->>'FED_NUM'`).
- `PROV`/`PROVID` are fully derivable from `ED`'s 2-digit province prefix (static
  13-entry table — see `PROVINCE_BY_PREFIX` in the script). Never need to be stored.
- `EV`/`EV_TYPE` are Elections Canada's own opaque ids for *that specific election
  event* (general election or by-election) — shared by every riding voting in it,
  but not derivable from the riding. `EV_TYPE` has only ever been observed as `6`
  for this view, regardless of whether the event is a general election or a
  by-election — it looks like it selects the *view type* (riding candidate list),
  not the election type.
- **`EV` must be discovered.** While an election is upcoming/current, Elections
  Canada embeds the correct VIS link on that riding's own page, at
  `content.aspx?section=ele&dir=<year>/<ED>&document=index&lang=e`. That's what
  `discover` scrapes.
- **`EV` goes stale.** By-election `EV`s stopped resolving on the live site a few
  months after the event concluded (confirmed: both the Aug 2025 and Apr 2026
  by-elections' `EV`s are dead as of this writing). The 45th General Election's
  `EV=99` has stayed live over a year. **Practical implication: run `discover`
  regularly (weekly is plenty) — this can't be backfilled indefinitely.** If one
  does go stale before you catch it, the Wayback Machine
  (`web.archive.org/web/<ts>/<url>`) usually still has a snapshot of the riding's
  page from while it was live, which recovers the `EV` for the historical record
  (candidates won't be re-fetchable live, but you at least know what happened).

**Known events** (seeded in the migration): 45th General Election (`EV=99`, still
live), Aug 2025 + Apr 2026 by-elections (dead, recovered via Wayback for the
record), Aug 31, 2026 by-election (`EV=65`, live — nominations close Aug 10, 2026).

**Script:** `scripts/sync_federal_candidates.py` — `discover`, `sync --ev N --ed ...
| --all-ridings`.

---

## Canada — British Columbia (provincial) ✅ built

**Source:** Elections BC, `elections.bc.ca`.

**Mechanism:** completely different shape from Canada federal — **one page per
election** listing every riding's candidates in a single HTML table
(`id="candidates_table"`, columns: Electoral District | Candidate Ballot Name |
Affiliation), filterable client-side by a JS dropdown that we ignore (just parse
the underlying table). URL:
```
https://elections.bc.ca/<election-slug>/candidate-list/
```
e.g. `2024-provincial-election`.

- No opaque id to discover — but the page only exists while Elections BC has
  published it (mid-campaign through some time after). The 2024 election's page is
  already gone (404) as of this writing.
- **The slug is predictable ahead of time**: BC has a fixed election-date law, so
  the next general election's year is known well in advance (next: Oct 2028 →
  `2028-provincial-election`). By-elections don't follow this and need `--slug`
  passed explicitly once known.
- District names match `map_shapes` exactly (verified: all 93, byte-for-byte) —
  BC's `Provincial` rows are the ones with `properties ? 'ed_abbreviation'` (that
  key is what distinguishes them from other provinces' rows under the same
  `boundary_type='Provincial'`).

**Verified against:** archived 2024 general election (via Wayback, since the live
URL is gone) — 322 candidates, all 93 ridings matched.

**Script:** `scripts/sync_bc_candidates.py` — `discover [--slug ...]`, `sync
--event-id <uuid>`.

---

## Canada — Manitoba (provincial) ✅ built, verified live

**Source:** Elections Manitoba, `electionsmanitoba.ca`. **The best provincial
source found so far** — genuinely live right now, and keeps every past event
permanently queryable (not election-period-only like the others below).

**Mechanism:**
1. `GET https://www.electionsmanitoba.ca/en/Voting/Candidates/<any-valid-slug>`
   — the page's `<select id="EventShortName">` dropdown lists **every** election
   Elections Manitoba has ever tracked, by human-readable slug (`"43rdGE"`, `"The
   Pas-Kameesak"`, ...). No guessing needed — `discover` just reads this dropdown
   directly.
2. `POST https://www.electionsmanitoba.ca/en/Voting/_FilterCandidates` with form
   body `EventShortName=<slug>&edid=&ptid=&status=&sortby=1` — **must be POST**
   (the static `<form method="get">` markup is misleading; the page's JS actually
   submits via POST — confirmed by watching real network requests in a browser,
   plain `curl -X POST` with no cookies/headers reproduces it exactly). A blank
   `edid` returns **every division's candidates for that event in one request** —
   no need to loop per-district.
3. Response is server-rendered HTML with candidate blocks:
   `<span class="name">...`, `<span class="party">...`, `<span
   class="division">...`, `<span class="status">...` (Official/Prospective/
   Withdrawn — no "elected" indicator on this page; that's on a separate Results
   section, not fetched here since this is about nominations, not results).
4. District matching: `map_shapes.code` for Manitoba's `Provincial` rows (57 of
   them, `properties ? 'ednameen'`) is already Manitoba's own numeric electoral
   division id, but the candidates response only gives the division *name*, so
   matching is by name. **Match accent-insensitively** — Manitoba's English-locale
   page inconsistently strips accents from French names (`"La Verendrye"` vs. our
   `"La Vérendrye"`, `"Lagimodiere"` vs. `"Lagimodière"`); the script folds accents
   via `unicodedata` on both sides rather than trying to special-case those two.
5. Names come back `"LAST, First"` — reformatted to `"First Last"` to match the
   convention the rest of the app/other jurisdictions use.

**Verified live:** "The Pas-Kameesak" is a **currently open by-election** with 4
real confirmed candidates as of this writing. Also pulled the complete 43rd General
Election (2023): 201 candidates across all 57 divisions, zero unmatched after the
accent fix.

**Script:** `scripts/sync_manitoba_candidates.py` — `discover`, `sync --event-id
<uuid>`.

---

## Canada — Ontario (provincial) ✅ built, election-period-only

**Source:** Elections Ontario's Voter Information Service,
`voterinformationservice.elections.on.ca` — a real JSON API (found via Wayback
Machine snapshots from Ontario's Feb 27, 2025 general election, since it 404s
outside an active election).

**Mechanism:**
- `GET /api/electoral-district-search/en/all-with-election` — **always live**
  (200 right now, even with no election running). Lists every riding; each entry
  gets an `"election"` key (electionId/name/pollingDay/isByElection) *only* while
  an election is actually running. **This is the discovery step** — no guessing,
  just poll it.
- `GET /api/election/{electionId}/electoral-district/{districtId}` — full
  candidate list (firstName, lastName, partyNameEnglish, sometimes websiteUrl) for
  one riding. Only resolves while that `electionId` is the live one.
- `map_shapes.code` for Ontario's `Provincial` rows (124 of them, `properties ?
  'ed_id'`) is already Ontario's own numeric district id — direct numeric match,
  confirmed (`code=1` is Ajax).

**Verified:** live `discover` correctly reports "no active election right now";
candidate-parsing logic verified against real archived Feb 2025 data (Ajax's 6
real candidates, including the actual winner).

**Script:** `scripts/sync_ontario_candidates.py` — `discover`, `sync --event-id
<uuid>`.

---

## Canada — Quebec (provincial) ✅ built, election-period-only

**Source:** two real APIs behind Élections Québec's site (found the same way, via
their frontend's own embedded config on `electionsquebec.qc.ca/voter/
personnes-candidates/`, from the Oct 3, 2022 general election period):
- `api.electionsquebec.qc.ca/provincial/recherche/circonscriptions` — lists every
  riding as `{code_circonscription, nom_circonscription, date_fin_eve_scrutin}`.
  **This is the discovery step.**
- `dgeq.org/{code_circonscription}.json` — per-riding data with a `candidats[]`
  array (`nom`, `prenom`, `abreviationPartiPolitique`), doubling as the
  election-night results feed.

**Important — codes are not stable across redistrictings.** Confirmed directly:
the archived 2022 list has Bonaventure at code 850; our current `map_shapes`
(loaded from Quebec's new map, effective July 15, 2026) has Bonaventure at code
837. **The script always re-fetches `circonscriptions` at sync time and matches by
name (accent-insensitive), never trusts a previously-seen code.**

**Verified:** live `discover` correctly reports the API as unavailable (403 —
dormant outside an election, confirmed even the "just list ridings" endpoint 403s,
not just the candidates one); candidate-parsing logic verified against real
archived 2018 data (Mégantic's 6 real candidates).

**Script:** `scripts/sync_quebec_candidates.py` — `discover`, `sync --event-id
<uuid>`.

---

## Canada — Alberta (provincial) 🔍 found & verified, ❌ not yet wired into code

**Source:** `efpublic.elections.ab.ca` — a ColdFusion (`.cfm`) system, part of
Elections Alberta's official site.

**⚠️ Domain trap:** `electionsalberta.ab.ca` (what search engines and even
Elections Canada's own province-directory list as the "official" URL) is **wrong /
blocked** — every request to it gets TLS-connection-reset by `curl` and denied by
the Browser tool. **The real domain is `elections.ab.ca`** (`www.elections.ab.ca`
for the WordPress-based info site, `efpublic.elections.ab.ca` for the actual
candidate/finance data system). Found this only by web-searching for the specific
`efpublic.elections.ab.ca` subdomain rather than trusting the "official site" link
— **always double-check the domain independently before concluding a site is
inaccessible.**

**Mechanism:**
1. `GET https://efpublic.elections.ab.ca/efCandidatesPGE.cfm?MID=FC_2023&OFSFID=101&EDS=ALL`
   loads a search *form* (not results directly) — but that same page's global nav
   menu lists **every election since 2004** with its own `MID`/`OFSFID`, e.g.:
   - `FC_2023` / `OFSFID=101` — 2023 general election (`efCandidatesPGE.cfm`)
   - `FC_2025BE` / `OFSFID=114` / `EDS=31` — a 2025 by-election (`efCandidatesBE.cfm`)
   - `FC_2024BE` / `OFSFID=109` / `EDS=72` — a 2024 by-election (`efCandidatesBE.cfm`)
   - Older ones (2016BE/2017BE) use yet another script name, `efCandidates.cfm`,
     and 2018BE/2019 use `efCandidatesOFS.cfm` — **general elections since 2023
     use `efCandidatesPGE.cfm`; by-elections since ~2022 use `efCandidatesBE.cfm`**;
     don't need the older script names unless backfilling very old history.
   - Menu order is newest-first, same discovery pattern as Manitoba's dropdown.
2. **Real results come from POSTing**, not GETing, to
   `https://efpublic.elections.ab.ca/{script}.cfm?MODE=BROWSE&MID={mid}&OFSFID={ofsfid}`
   with form body `cboEDs=<ED#|ALL>&cboParties=ALL&txtName=&Sort=EDS&btnSubmit=Search`
   (confirmed via the page's own `<FORM Id="frmContent" ... METHOD="POST">`).
   `cboEDs=ALL` returns every candidate in one request; `cboEDs=24` filters to one
   district.
3. Response is an HTML table:
   `<TD class="ListCellW\d">NAME &emsp;<BR>CFO name &emsp;</TD><TD ...>ED# ED_NAME &emsp;<BR>PARTY &emsp;<BR><BR></TD>`
   — regex on that shape, decode `&emsp;` as whitespace (extend `decodeEntities`).
4. **This system does NOT tear down old elections** — unlike Ontario/Quebec, the
   2023 general election's full candidate list is still fetchable live today (July
   2026), same as Manitoba/Canada-federal's permanent-archive behavior. No
   election-period-only caveat here.
5. District matching: `map_shapes.code` for Alberta's `Provincial` rows (87 of
   them, `properties ? 'edname2017'`) is Alberta's own numeric ED number — direct
   match confirmed (`code=24` is "Calgary-South East", matches "24 -
   CALGARY-SOUTH EAST" in the real response).

**Verified against:** real, live 2023 general election data — e.g. Calgary-South
East (ED 24): Catriona Wright (Green), Heinrich Friesen (Solidarity Movement),
Justin Huseby (NDP), Matthew Jones (UCP) — all real, checkable candidates.

**Not yet built:** no `fetchAb` in the Edge Function, no `sync_ab_candidates.py`,
no seed migration row. See the handoff table above for exact status.

---

## Canada — Saskatchewan (provincial) 🔍 found & verified, ❌ not yet wired into code

**Source:** `elections.sk.ca` — a Gatsby static site. The "Candidates" page in the
main nav (`/candidates-political-parties/candidates/`) is just generic
"how to become a candidate" info — the real per-election data lives at a
different, election-specific URL.

**Mechanism:**
1. Real page: `https://www.elections.sk.ca/electoralevents/<election-slug>/candidates/`
   — e.g. `october-2024-provincial-election` for the Oct 2024 general election
   (found via web search, not site navigation — the site doesn't link to it
   prominently from the generic candidates page).
2. **Gatsby's static JSON export has the full data already embedded** — no
   client-side fetch/AJAX needed:
   `https://www.elections.sk.ca/page-data/electoralevents/<election-slug>/candidates/page-data.json`
   → `result.pageContext.content` is an HTML string containing a full data table
   (constituency, first name, last name, party) for **every candidate in the
   election, all in one file**. This pattern generalizes to any Gatsby-built
   government site — worth checking for on other provinces before assuming a
   scrape is needed.
3. **Data stays live indefinitely** — the Oct 2024 page-data.json still resolved
   correctly when checked (unlike BC's torn-down 2024 page). No
   election-period-only caveat.
4. Constituency names in the data are **ALL CAPS** (e.g. `"ATHABASCA"`) — match
   case-insensitively against `map_shapes.name`.
5. District matching: `map_shapes.code` for Saskatchewan's `Provincial` rows (61
   of them, `properties ? 'con_num'`) — not yet confirmed whether this numeric
   code matches Elections Saskatchewan's own numbering (the page-data.json
   content doesn't include a numeric ED code, only the constituency *name* — so
   **matching will need to be by name**, uppercase-normalized, same approach as
   Manitoba/Quebec).

**Verified against:** real, live Oct 2024 general election data — 243 candidates
across all 61 constituencies (e.g. Athabasca: Leroy Laliberte/NDP, Jim
Lemaigre/Sask Party, Raven Reid/Green — all real).

**Not yet built:** no `fetchSk` in the Edge Function, no `sync_sk_candidates.py`,
no seed migration row.

---

## Canada — PEI (provincial) 🔍 found & verified, ❌ not yet wired into code

**Source:** `electionspei.ca`.

**Mechanism:**
1. Clean, predictable per-district-per-year URL:
   `https://www.electionspei.ca/district-<N>-<year>` — e.g. `district-2-2023` for
   District 2 (Georgetown-Pownal) in the 2023 general election. Found via web
   search (a specific district's results page ranked in results), not site nav.
2. Site has bot-mitigation scripts loaded (Imperva/`perfdrive.com`,
   `stormcaster.js`) but **a plain `curl` GET still returns full real content** —
   the protection doesn't appear to hard-block simple requests in practice
   (verified — no CAPTCHA/challenge page encountered).
3. Page content is really an **election-night results page** (not a pure
   "nominated candidates" list) — format is `NAME (PARTY)` for each candidate,
   followed by a vote/poll breakdown table. Useful for post-election "who ran and
   who won" but note it's results-shaped, not a pre-election nomination list;
   whether PEI publishes a separate pure-nomination list before results come in
   wasn't checked.
4. By-elections use a **different URL pattern**:
   `/provincial-election-by-elections/district-<N>-by-election-official-results`
   (confirmed via nav: "DISTRICT 16 BY-ELECTION OFFICIAL RESULTS" was live in the
   nav when this was checked — a by-election likely more recent than the 2023 GE;
   not dated/confirmed).
5. District matching: `map_shapes.code` for PEI's `Provincial` rows (27 of them,
   `properties ? 'dist_no'`) — not yet confirmed against PEI's own numbering; the
   URL pattern uses a plain integer (`district-2-2023`) which *may* match
   `dist_no` directly, but verify before trusting it (same caution as Quebec:
   redistricting can change codes).

**Verified against:** real 2023 general election data — District 2
(Georgetown-Pownal): Patrick Brothers (PC), Steven Myers (NDP), Edith Perry
(Island), Lucy Robbins (Liberal), Allister Veinot (Green) — all real, matches
actual 2023 PEI election results.

**Not yet built:** no `fetchPe` in the Edge Function, no `sync_pei_candidates.py`,
no seed migration row.

---

## Canada — the remaining provinces/territories 🔍 researched, not fully found

Boundary data is already loaded for all of these except Nunavut (`ARCHITECTURE.md`
§11) — what's missing is a verified candidate-data mechanism.

### New Brunswick — not found

Real domain: `electionsnb.ca` (`gnb.ca/elections` redirects here). Adobe AEM-based
site (`/content/enb/en/...html` URL structure). The "Provincial candidates" nav
link (`/representatives/provincial-candidates.html`) is only nomination-process
info (forms, kits, rules) — not a live list. Guessed a `.../candidates.html`
sub-page pattern (works for the *municipal* candidates section:
`/representatives/municipal-candidates/candidates.html`) but the equivalent
provincial URL 404s. An older legacy system exists at `www1.gnb.ca/elections`
(referenced as "Provincial Election" in nav) — appears to be an address/street-key
lookup tool, not explored fully. **Untried:** AEM's `.model.json`/`.infinity.json`
content-export suffixes; checking `legnb.ca` (the Legislature's site hosts a PDF,
"Forty-First Provincial General Election OCTOBER 21, 2024", found during search,
not opened); checking for a separate results-only domain the way Nova Scotia has
one (try `resultsnb.ca` or similar).

### Nova Scotia — partially found, blocked on implementation

Main site `electionsnovascotia.ca` is explicitly labelled "a temporary website" —
a bare-bones React SPA (create-react-app) with narrative content but no visible
structured candidate API for its own pages. **However**, it links out to a
**separate results domain**, `results.electionsns.ca` (ASP.NET WebForms +
FusionCharts) — confirmed real and current (was showing the
Chéticamp-Margarees-Pleasant Bay by-election, concluded June 23, 2026, i.e. about
a month before this research). Two relevant pages found:
`by-election_multi.aspx` (per-district chart) and the root (province-wide map).
Both use `ScriptManager`/`UpdatePanel` with `__doPostBack` — **the actual
chart/candidate data loads via an ASP.NET postback, not a plain GET**; a bare
`curl` GET gets an empty `dataSource`. To get real data, need to: GET the page
once to capture `__VIEWSTATE`/`__EVENTVALIDATION` hidden-field values, then POST
those back with whatever triggers the data load (not yet identified which
control/event). **Also note:** Chéticamp-Margarees-Pleasant Bay is a brand-new
"exceptional" riding carved out of Inverness by a 2025 Electoral Boundaries
Commission — it won't match our current `map_shapes` (56 NS ridings, pre-dating
this redistricting) until that boundary data is refreshed (check
`ARCHITECTURE.md` §11 for NS's loaded vintage before investing more time here).

### Newfoundland & Labrador — not found (search interrupted)

Real domain: `elections.gov.nl.ca`. Same WordPress-family "info hub" pattern as
several others — the "Candidates" nav section is entirely nomination-process
pages (Nomination Process, CFO Information, Political Contributions, etc.), no
live list surfaced yet. **Correction to earlier assumption:** NL's most recent
general election was **2025**, not Feb 2024 as originally assumed (Feb 2024 was
just when it was called/anticipated — double check the actual date before
searching for "2024" results, search "2025" instead). Was about to try the
Wayback-Machine-CDX-search trick that worked for Ontario/Quebec
(`http://web.archive.org/cdx/search/cdx?url=elections.gov.nl.ca&matchType=domain&from=<2025-election-dates>&output=json&filter=urlkey:.*(cand|api|json).*`)
when this research pass was paused — that's the next concrete step.

### Yukon — not attempted with real effort

`electionsyukon.ca` returned 403 on an earlier quick pass (same curl-blocked
symptom as Alberta originally showed). **Given Alberta's blocked-domain turned out
to be a wrong-domain issue, not a real block, verify the actual official domain
independently (fresh web search, don't trust the first result) before concluding
Yukon is inaccessible.** `electionsyukon.gov.yk.ca` (the other candidate domain)
didn't resolve at all on the quick pass.

### Northwest Territories — not attempted with real effort

`electionsnwt.ca` has a dedicated `/en/candidates` page referencing a "2023
Candidates List" (their last territorial general election) as one of several
linked "bubbles" on that page, but the link's actual `href` wasn't present/parseable
in the markup on a quick grep — needs the Browser tool to find the real target (the
bubble link may be JS-driven). NWT runs **consensus government** — candidates run
as independents, no party affiliation — so any list here is names-by-district
only, no party field to parse.

### Nunavut — out of reach

No digital boundary data exists at all (`ARCHITECTURE.md` §11 — Elections
Nunavut's district map is a static image with clickable hotspots, not a real GIS
layer) — moot for candidate data until that's solved first, which would require
hand-digitizing from PDF maps.

---

## USA — Federal ✅ built

**Source:** the FEC's OpenFEC API, `api.open.fec.gov` — a real, documented,
stable REST API. **The best source of all** — no scraping, no URL/id discovery,
queried directly by `(cycle, office, state, district)`.

- `office=H` (House) needs `state` + `district`; `office=S` (Senate) needs `state`;
  `office=P` (President) is nationwide, no state/district.
- `map_shapes.code` for `USA/Federal` rows is the 4-digit GEOID (2-digit state FIPS
  + 2-digit district, e.g. `"0601"` = California's 1st). `STATE_FIPS` in the script
  is a static 50+DC+territories table converting FIPS → USPS abbreviation.
  President has no associated `map_shapes` row (nationwide race) — those rows get
  `map_shape_id = NULL`.
- Filter to `candidate_status == 'C'` (currently active filer) — otherwise the API
  returns every candidate who's ever filed for that office/district going back
  decades.

**Verified live:** real 2024 House (CA-12, an open-seat race) and Senate (CA, 95
candidates) results, matching what actually happened.

**Rate limit — the actual blocker for bulk use:** `DEMO_KEY` is limited to **10
requests/hour** (confirmed via response headers: `x-ratelimit-limit: 10`), not the
~30/hour I'd assumed — hit a 429 after 5 House districts in one run. **A full
435-district House sync needs a real free key** from
[api.data.gov/signup](https://api.data.gov/signup/), passed via `--api-key` or
`FEC_API_KEY`.

**Script:** `scripts/sync_us_federal_candidates.py` — `sync --cycle YYYY --office
H|S|P`.

---

## USA — Governor + state legislature 🔍 research in progress (12 of 50 done)

Checked whether Open States (`openstates.org`, the one project that unifies all 50
states' legislative data in one API) covers this — **it doesn't**. Its API
(`v3.openstates.org`) only has currently-serving legislators (`/people`), not
candidates in an upcoming race — no `/candidates` or `/elections` endpoint exists.
No unified national source exists for either Governor or state legislature (unlike
FEC for US federal) — each state runs its own independent system, so this is the
same kind of per-jurisdiction research BC/Manitoba/Alberta/etc. got, ×50, done in
batches.

**Boundaries/seats already work today** regardless of this research — `State`
(Governor/Senator) and `State Senate`/`State House` (legislature) are all normal,
non-`admin_only` `map_shapes` boundary types (see `ARCHITECTURE.md` §14/§23), so
seats can already be created and candidates added manually; what's missing (for
most states) is only the one-click "Fetch candidates" official-source lookup.

**Implementation status: every researched state gets a manual "view official
source" link (`US_STATE_SOURCES` in `candidateSync.js`); 4 states (Idaho,
Connecticut, Colorado, Hawaii) got a live-fetch handler built and **verified
end-to-end against the real deployed Edge Function** (a temporary test
`election_seats` row was created, invoked over HTTP, checked against real
candidate names, then deleted — not just tested locally). Of those 4, only
**3 actually work in production** — see the Colorado note below for why one
verified-working handler still isn't live-enabled.**

**Strong pattern across every state researched so far: Governor and the state
legislature (both chambers) are published by the exact same system** — one state
election authority, one candidate-filing database/document, differentiated only by
an office/district column or filter. No state so far needed two separate
mechanisms. Also recurring: several states' real portal sits behind Cloudflare/AWS
WAF bot-detection (Alaska, Arizona, Idaho's front-end, Georgia) — per this
project's operating rules, no bypass/CAPTCHA-solving was attempted; where a
website was blocked, the same official data was instead recovered either via a
Wayback Machine snapshot (Alaska, Arizona) or, in Idaho's case, by finding that the
*underlying data API* (not the SPA front-end) had no such protection at all and
answered a plain unauthenticated `curl` normally.

### Batch 1 (12 states) — summary

| State | Mechanism | Format | Event/ID discovery | Verified live? |
|---|---|---|---|---|
| Alabama | `fcpa.alabamavotes.gov` campaign-finance system | Real JSON API | `election`/`office`/`jurisdiction` ids from dropdowns (stable-ish) | ✅ real 2026 candidates |
| Alaska | `elections.alaska.gov/candidates/?election={slug}` | HTML, one page per election | Slug pattern `{yy}{prim\|gen}`, predictable | ✅ via Wayback (site is AWS-WAF-gated) |
| Arizona | `azsos.gov` "Candidate Nominations and Petitions Filed" | Downloadable PDF | Stable canonical pointer (`azsos.gov/media/666`) | ✅ via Wayback (site is Cloudflare-gated) |
| Arkansas | `candidates.arkansas.gov/wp-json/metl/v1/all` | Real JSON API | `postID` embedded in page HTML, re-extract per cycle | ✅ real 2026 candidates |
| California | `elections.cdn.sos.ca.gov/statewide-elections/{year}-primary/cert-list-candidates.pdf` | Downloadable PDF | Predictable path per year/cycle-type (general-election path unconfirmed) | ✅ real 2026 candidates |
| Colorado | `coloradosos.gov/pubs/elections/vote/...` | Static HTML + XLSX | Descriptive static pages per cycle-type, no ids | ✅ real 2026 candidates |
| Connecticut | `seec.ct.gov/ecrisreporting/CandidateListDownLoad.aspx?key={year}CANCSV` | Static CSV export | Predictable, just the year | ✅ real 2026 candidates |
| Delaware | `elections.delaware.gov/candidates/candidatelist/{genl\|prim}_fcddt_{year}.html` (+ `.xlsx`) | HTML + Excel export | Predictable, year + genl/prim prefix | ✅ real (2024 general — no Governor race in 2026) |
| Florida | `dos.elections.myflorida.com/candidates/CanList.asp?elecid={yyyymmdd}-GEN` | Plain HTML (classic ASP, no postback) | General-election id predictable; primary id format + bulk-download form action not yet traced | ✅ real 2026 candidates |
| Georgia | `mvp.sos.ga.gov/s/qualifying-candidate-information` (Salesforce LWC) | Cascading-dropdown SPA + reCAPTCHA, shadow-DOM | Opaque, needs real browser automation to drive | ❌ not pulled live — existence cross-checked via news coverage only |
| Hawaii | `ags.hawaii.gov/campaign/ballot-legal-name/` (Campaign Spending Commission mirror) | Static HTML table, one page, every office | None — always-current single page | ✅ real 2026 candidates |
| Idaho | `api-run.voteidaho.gov/api/FiledCandidates/SearchCandidates` | Real JSON REST API | Election GUID via a sibling `GetAllElections` endpoint | ✅ real candidates, plain `curl` POST, no auth |

### Implementation: 4 states wired, only 3 actually live

**Wired into `fetch-candidates/index.ts` + `candidateSync.js`, `hasFetch: true`:**
Idaho (`fetchIdaho`), Connecticut (`fetchConnecticut`), Hawaii (`fetchHawaii`) —
each covering Governor + State Senate + State House via one shared per-state
function (dispatched by a `UsStateOffice` param), matching the "same system
covers every office" pattern found in every state researched so far. All three
**confirmed working against the live deployed Edge Function** (not just
research-verified) — e.g. Idaho Senate District 1 returned the real Steve
Johnson/Jim Woodward/Scott Herndon race, Connecticut Governor returned the real
2026 field (Lamont, McCaughey, Fazio, etc.), Hawaii Governor returned the real
field including incumbent Josh Green.

**Colorado (`fetchColorado`) is wired and its parsing logic is verified correct**
(tested against real cached HTML: 246 rows matched, split correctly into 8
Governor / 46 Senate / 136 House candidates) — **but `coloradosos.gov` returns
HTTP 403 specifically to requests from Supabase's Edge Function egress**,
confirmed by adding a temporary debug line and redeploying: the *identical*
request (same URL, same `User-Agent`) succeeds every time from a plain local
`curl`, but fails every time through the deployed function. This points at a WAF
blocking known cloud/datacenter IP ranges (a common posture for `.gov` sites)
rather than anything wrong with the request itself. `US_STATE_SOURCES` in
`candidateSync.js` sets `co: { hasFetch: false }` so the admin UI only offers the
manual link for Colorado, not a "Fetch candidates" button that would always fail
— but the working handler code is left in place (clearly commented) for whenever
this gets a workaround (a proxy, or if Colorado's WAF posture changes).

**Arkansas: downgrade from the initial research call.** The first research pass
reported a clean, working JSON API with no bot-protection. Direct verification in
this session found otherwise: repeated requests to `candidates.arkansas.gov`
returned an empty `200` body, and the bare endpoint eventually returned a hard
Cloudflare 403 block page. Since this contradicts the optimistic first read,
Arkansas is listed as `hasFetch: false` (manual link only) pending a future
session actually solving the block (worth investigating — this may be the same
"blocked cloud IP range" pattern found for Colorado, or something request-shape
specific, e.g. the exact DataTables server-side param set a real browser sends).

### Alabama — found & verified

**Source:** Alabama FCPA (Fair Campaign Practices Act) reporting system, `fcpa.alabamavotes.gov` — covers Governor and State Legislature together.

**Mechanism:** real JSON API: `GET fcpa.alabamavotes.gov/page.request.do?page=com.acf.common.page.politicalracesearchresults&election={id}&office={id}&jurisdiction={id}&...`. `office` ids are stable/enumerable (Governor=23, State Senator=41, State Representative=40). `election` ids are opaque, discovered from a `<select>` dropdown (`160` = "2026 ELECTION CYCLE" — one umbrella id per cycle, not per office). District filtering needs a `jurisdiction` id, itself looked up per office via `page.request.do?page=com.acf.committee.page.getofficedata&officeId={id}`.

**Secondary source, also confirmed:** the Secretary of State publishes signed PDF "qualified candidate" certifications per party per cycle at `sos.alabama.gov/sites/default/files/election-{year}/{Party}Certification...pdf` — matches the API data.

**Verified against:** real 2026 Governor race (Doug Jones, Ken McFeeters) and State House District 1 (Phillip J. Pettus, Maurice McCaney) pulled live.

**Note:** both `sos.alabama.gov` and `fcpa.alabamavotes.gov` have a broken TLS certificate chain (not bot-detection) — `curl -k` works fine.

### Alaska — found & verified (via Wayback — live site is bot-gated)

**Source:** Alaska Division of Elections, `elections.alaska.gov/candidates/?election={slug}` — one page lists Governor/Lt. Governor and every Senate (A–T) and House (1–40) district together, anchored by section (`#governor`, `#senate-a`, `#house-01`).

**Mechanism:** HTML (WordPress + Formidable Forms). Slug pattern `{2-digit year}{prim|gen}` (e.g. `26prim`) is predictable directly from the page's own dropdown.

**Obstacle:** `elections.alaska.gov` sits behind AWS WAF with a CAPTCHA/JS challenge — direct requests get a "Human Verification" page, not content. No bypass was attempted (per this project's rules). Data was instead recovered from a Wayback Machine snapshot of the same URL, which mirrors already-published HTML.

**Verified against:** real 2026 primary data via Wayback — Governor (Tom Begich/Julia Hnilicka), Senate District A (Bert K. Stedman, incumbent), House District 01 (Jeremy T. Bynum incumbent, Grant EchoHawk).

**Next step:** either a scheduled Wayback-polling strategy, or contact the Division of Elections about legitimate bulk/API access — not a scraping workaround.

### Arizona — found & verified (via Wayback — live site is bot-gated)

**Source:** Arizona Secretary of State's "Candidate Nominations and Petitions Filed" — one consolidated statewide PDF covering Governor and every State Senate/State Representative district (30 legislative districts, 1 Senator + 2 Representatives each) together.

**Mechanism:** downloadable PDF. Versioned direct file (`azsos.gov/sites/default/files/docs/{year}-Candidate-Nominations-and-Petitions-Filed-{date}.pdf`) plus a stable canonical Drupal media pointer that always resolves to the current version: `azsos.gov/media/666`.

**Obstacle:** `azsos.gov` sits behind Cloudflare bot-management (`cf-mitigated: challenge`, HTTP 403 to plain requests). No bypass attempted. Recovered via Wayback Machine snapshot of the PDF.

**Verified against:** real 2026 data via Wayback — Governor (Katie Hobbs incumbent, Andy Biggs, David Schweikert, Scott Neely, Teri Ann Hourihan), State Senate District 1 (Mark Finchem, Christine Ellen Dargon), State Representative District 4 (Matt Gress, Tammy Caputi).

**Secondary, earlier-stage signal:** `azsos.gov/elections/candidates/statements-interest` lists individual "Statement of Interest" PDFs filed before petition signatures are collected — not the primary source, just an earlier signal.

### Arkansas — found & verified

**Source:** `candidates.arkansas.gov` (Arkansas Secretary of State, WordPress + a custom "metl" filing plugin) — one system for Governor, other statewide offices, US Congress, State Senate, and State House together.

**Mechanism:** real JSON REST API, `GET candidates.arkansas.gov/wp-json/metl/v1/all` — DataTables-style endpoint. Key params: `postID` (identifies the election cycle), `Descript` (office text filter, e.g. `"Governor"`), plus standard `start`/`length`/`draw` paging.

**Event discovery:** `postID` (e.g. `2941`) is embedded directly in the page's rendered HTML (`<div id="metl-2941">`) — fetch the page once, regex it out, re-extract per cycle (not a hunt).

**Verified against:** real live data — Colt Shelby (Libertarian, Governor), State Representative District 70 (Alex Holladay D, Bo Renshaw R), State Senate District 13 (Allison Grigsby Sweatman D). Cross-checked against Ballotpedia.

**Note:** hosted behind Cloudflare (caching, not bot-blocking) — vary a cache-busting param on repeated identical queries.

### California — found & verified

**Source:** California Secretary of State's Certified List of Candidates — one signed PDF covering Governor, other statewide offices, all US House districts, all State Senate districts, and all State Assembly districts together.

**Mechanism:** downloadable PDF, `elections.cdn.sos.ca.gov/statewide-elections/{year}-primary/cert-list-candidates.pdf` (path pattern confirmed for the 2026 primary; the general-election equivalent path is a reasonable but **unconfirmed** guess — flagged as a follow-up). Well-structured for parsing: office-name headers, then indented candidate/ballot-designation/party rows.

**Verified against:** real 2026 primary data, extracted directly from the PDF — 61 Governor candidates (Xavier Becerra, Katie Porter, Tom Steyer, Steve Hilton, Chad Bianco, etc.), State Senate District 8 (Angelique Ashby incumbent, Susan A Mason, Linda "LR" Roberts), State Assembly District 17 (Matt Haney incumbent, unopposed).

**Terminology note:** California's lower chamber is the **Assembly**, not "House."

### Colorado — found & verified

**Source:** Colorado Secretary of State, `coloradosos.gov/pubs/elections/vote/` — descriptively-named static pages per cycle-type (`primaryCandidates.html`, `generalPetitionCandidates.html`), each covering US Senate/House, Governor, other statewide offices, State Senate, and State House together.

**Mechanism:** plain server-rendered HTML table (no JS framework, no postback) plus a downloadable Excel export at a predictable year-versioned path: `coloradosos.gov/pubs/elections/vote/files/{year}/{year}PrimaryCandidateListOfficial.xlsx`.

**Verified against:** real 2026 data — Governor (Phil Weiser, Michael Bennet, Scott Bottoms, Barb Kirkmeyer), State Senate District 8 (Dylan Roberts vs. Corey Marshall) and District 16 (Melissa Hurtado incumbent), State House of Representatives districts 1–4.

**Terminology note:** the page labels it "State House of Representatives" specifically to disambiguate from the US House rows in the same table.

### Connecticut — found & verified

**Source:** Connecticut State Elections Enforcement Commission (SEEC), `seec.ct.gov/ecrisreporting/CandidateListDownLoad.aspx?key={year}CANCSV` — one file for Governor and every state office (Attorney General, Secretary of State, State Senator, State Representative, judicial, etc.) together.

**Mechanism:** static CSV export (a PDF variant also exists via `{year}CANPDF`). URL pattern is fully predictable — just the calendar year, confirmed working for both 2024 and 2026.

**Verified against:** real 2026 data — Governor (Edward Lamont, Ryan Fazio), State Senator District 001 (John Fonfara), State Representative District 001 (Matthew Ritter). A historical archive also exists at `portal.ct.gov/sots/election-services/candidate-lists-for-office/list-of-candidates-archives` if the live key format ever changes.

### Delaware — found & verified

**Source:** Delaware Department of Elections, `elections.delaware.gov/candidates/candidatelist/{genl|prim}_fcddt_{year}.html` (+ sibling `.xlsx` export) — Governor and State Senator/State Representative (by county: New Castle/Kent/Sussex) together.

**Mechanism:** HTML page + downloadable Excel export. URL pattern fully predictable — year + `genl`/`prim` prefix, no opaque ids.

**Note:** Delaware only elects Governor every 4 years (2024, 2028, ...) — no gubernatorial race in the 2026 cycle, so Governor was verified against the 2024 page instead.

**Verified against:** real data — 2024 Governor (Matt Meyer D vs. Mike Ramone R); 2026 down-ballot including State Senator District 2 (Darius Brown) and State Representative District 1 (Nnamdi O. Chukwuocha) from the 2024 page, plus real statewide 2026 races confirming the page format still works.

### Florida — found & verified

**Source:** Florida Division of Elections "Candidate Tracking System," `dos.elections.myflorida.com/candidates/CanList.asp?elecid={yyyymmdd}-GEN&OfficeCode=GOV` — dropping `OfficeCode` returns *every* office (Governor, Cabinet, State Senate, State House, federal, judicial) on one page.

**Mechanism:** plain HTML, classic ASP (`.asp`, not `.aspx`) — plain `GET` works, no `__VIEWSTATE`/postback trap despite the old-school stack.

**Event discovery:** the general-election `elecid` format `{yyyymmdd}-GEN` is confirmed predictable. The **primary election's exact id suffix wasn't nailed down** (a guessed `20260818-PRI` returned no results) — needs one more fetch of the year-index page at `dos.elections.myflorida.com/candidates/` to read off the real primary id. A bulk tab-delimited full-state export also exists (`downloadcanlist.asp`, filterable by year/office-category/status) but its exact resulting download URL/action wasn't traced — likely a form POST, needs the raw page source or a form submission to capture.

**Verified against:** real 2026 data — Governor (Jay Collins, Byron Donalds, David Jolly, Evelyn Castillo-Bach), State Senate District 2 (Lauren Donahoo vs. Jay Trumbull incumbent) and District 6, State Representative District 1 (Michelle Salzman incumbent vs. Francesca Yabraian) and District 8 (Gallop P. Franklin incumbent).

### Georgia — mechanism identified, not yet automated

**Source:** Georgia Secretary of State's "Qualifying Candidate Information" tool, `mvp.sos.ga.gov/s/qualifying-candidate-information` — a Salesforce Experience Cloud / Lightning Web Components app (component `c-vr-wi-qualify-candidates-info`).

**Mechanism:** cascading dropdowns (Election Year → Election → Party → Contest Type → Contest), each rendered in **closed shadow DOM**, gated by a visible reCAPTCHA on final submit — the whole form is invisible to a plain accessibility-tree read, similar in spirit to the ASP.NET-postback trap but shadow-DOM-flavored. Direct requests to `sos.ga.gov/*` also return HTTP 403 (bot-blocked) regardless of user-agent.

**Not automated this session** — no live pull was completed; consistent with this project's rule against CAPTCHA-solving/bypass. Real candidate existence was cross-checked only via news coverage (e.g. 2026 Governor: Burt Jones, Chris Carr, Brad Raffensperger, Rick Jackson (R); Michael Thurmond, Keisha Lance Bottoms, Jason Esteves, Derrick Jackson (D)), not pulled from the official source directly.

**Next step:** a real headless-browser session with shadow-DOM-aware automation (e.g. Playwright piercing shadow roots) to drive the dropdowns — flagged as needed, not attempted.

### Hawaii — found & verified (via a secondary official mirror)

**Primary system** (harder): `olvr.hawaii.gov/Controls/CandidateFiling.aspx?elid={id}` — ASP.NET WebForms + Telerik RadGrid, real `__VIEWSTATE`/`__doPostBack`. Page 1 unusually renders on a plain GET, but Governor/Senate/House rows are sorted by insertion order and sit on later pages, which need a genuine Telerik AJAX postback to reach (attempted, returned 200 but didn't advance — not solved this session). Has built-in CSV/PDF export buttons in the grid toolbar, an untried alternate route.

**Recommended instead:** Hawaii Campaign Spending Commission's mirror, `ags.hawaii.gov/campaign/ballot-legal-name/` ("Candidates Running in the {year} Election with their Ballot and Legal Names") — explicitly published per HRS §11-115.5, citing the Office of Elections as source. Plain static HTML table (296 rows for 2026), no JS framework, no postback, no CAPTCHA, covers every office including Governor and both chambers in one page.

**Verified against:** real 2026 data from the recommended mirror — Governor (Josh Green incumbent, Ken Fujiyama, Duke Bourgoin, Gary Cordery), State Senator (~14 districts up in 2026, staggered terms — e.g. Carol Fukunaga), State Representative (all 51 seats — e.g. Nicole Lowen).

### Idaho — found & verified, cleanest result of the batch

**Source:** Idaho's candidate-filing system, front-end at `run.voteidaho.gov/search` (Angular SPA), real data via `api-run.voteidaho.gov/api/FiledCandidates/SearchCandidates` — Governor and both chambers in one endpoint.

**Mechanism:** genuine JSON REST API. `POST .../api/FiledCandidates/SearchCandidates` with `{electionId, pageNumber, pageSize}` (server caps at 1000/page). Election GUIDs discovered via `POST .../api/PublicLookup/GetAllElections`. District-type lookups via `POST .../api/Filing/GetAllDistrictTypes` (`Statewide`, `State Legislature`, `County`, `Judicial`, etc.).

**Bypass note:** the SPA front-end sits behind a Cloudflare challenge, but the **underlying data API has no such protection** — confirmed working with plain `curl` (no browser, no cookies), just `User-Agent`/`Origin`/`Referer` headers, HTTP 200 with full real JSON.

**Verified against:** real 2026 data, 2,545 candidates statewide across 3 paginated requests — Governor (Terri Pickens, Chanelle Torrez, Jill C. Kirkham, Maxine Durand), State Senator District 1 (Jim Woodward, Scott Herndon, Steve Johnson), State Representative District 1 Seat A/B (Jane Sauter, Mark Sauter, Karen Matthee).

**Built and live: Idaho, Connecticut, Hawaii** (see "Implementation" above).
**Wired but not live: Colorado** (blocked by a WAF at the Edge Function egress
level, not a code problem). **Manual-link-only, no live-fetch handler yet:**
Alabama, Alaska, Arizona, Arkansas, California, Delaware, Florida, Georgia — no
`sync_*_candidates.py` scripts exist for any US state yet either (only
`sync_us_federal_candidates.py`, House/Senate/President). Next candidates to wire
if continuing: Alabama (needs one extra network round-trip to resolve a
`jurisdiction` id per district, otherwise clean) and Delaware (predictable
URL, plain HTML+Excel, no bot-detection observed) are the next-cleanest
unimplemented states.

## Municipal — Canada and US 🔍 not centrally solvable

Thousands of independent municipalities, most with no structured/API data source at
all (often just a PDF, or nothing online). Not something to build ahead of time —
realistically "research the one specific municipality you need, when you need it,"
not a system to pre-build.

---

## Lessons learned (apply to every new jurisdiction)

1. **Rate limit aggressively and check response headers for real limits before
   assuming a number** — FEC's actual `DEMO_KEY` limit (10/hr) was a third of what
   general knowledge suggested. `REQUEST_DELAY_SECONDS` in every script is a
   starting point, not a guarantee.
2. **"It works" ≠ "it'll keep working."** Elections Canada's by-election `EV`s and
   (presumably) Ontario/Quebec/Saskatchewan's live-only tools all stop being
   queryable once the campaign period ends. Treat every `discover` step as
   something to run on a schedule, not once.
3. **The Wayback Machine is a legitimate recovery tool** for already-expired
   sources — recovered Elections Canada's dead by-election `EV`s this way, and it's
   the next thing to try for Ontario/Quebec once their live period passes again.
   `http://archive.org/wayback/available?url=...` for a quick check;
   `http://web.archive.org/web/<timestamp>/<url>` to fetch the actual snapshot.
   Rate-limited itself — don't hammer it either.
4. **Verify with real browser network inspection before assuming an endpoint's
   HTTP method/shape from static HTML.** Manitoba's form markup said
   `method="get"`; the real JS submitted via `POST`. Cost real time
   reverse-engineering blind via `curl` before just loading it in a browser and
   watching the actual request.
5. **Match district names accent/case-insensitively, never assume byte-exact.**
   Cost a silent partial failure on Manitoba (2 divisions) before normalizing.
6. **A "blocked" site may just be the wrong domain — verify independently before
   giving up.** What looked like Alberta actively blocking all non-browser clients
   (TLS resets from `curl`, denied navigation from the Browser tool) turned out to
   be `electionsalberta.ab.ca` simply being the *wrong domain* — the real one,
   `elections.ab.ca`, worked immediately with plain `curl`, no blocking at all.
   The wrong domain came from trusting a "Chief Electoral Officer" directory
   listing (even Elections Canada's own province-directory page had it) instead
   of a fresh, targeted web search. **Always re-verify the domain with a specific
   search (e.g. "efpublic.elections.ab.ca candidates") before concluding a site
   is genuinely inaccessible** — this exact mistake is likely why Yukon looked
   blocked too; re-check its real domain before assuming otherwise.
7. **Static-site generators often expose their full dataset as plain JSON, even
   when the rendered page looks scrape-only.** Saskatchewan's Gatsby-built site
   serves every route's complete data at
   `/page-data/<route>/page-data.json` — the *entire* candidate table for the
   whole province came back in one file, no HTML table parsing needed. Worth
   checking for on any government site before writing an HTML scraper: look at
   the page's `<script>` tags for a bundler fingerprint (Gatsby, Next.js, etc.)
   and try that framework's known static-data-export path.
8. **A results page and a nominations page are not always the same page, and not
   always on the same domain.** PEI and Nova Scotia's sites both eventually
   revealed their real candidate/results data lived somewhere the main site's
   navigation didn't directly point to — PEI's via a URL only found in *search
   results* for a specific district (not site nav), Nova Scotia's on an entirely
   separate results-only subdomain (`results.electionsns.ca` vs.
   `electionsnovascotia.ca`). When the main site's obvious "Candidates" nav link
   is just process/nomination info, search for a specific past election + a
   specific district/riding name rather than continuing to click around the main
   nav — that's what surfaced the real URLs in both cases.
9. **ASP.NET WebForms sites (`__doPostBack`, `ScriptManager`/`UpdatePanel`) don't
   return real data on a plain GET** — Nova Scotia's results system loads its
   actual chart/candidate data via a postback that needs `__VIEWSTATE`/
   `__EVENTVALIDATION` tokens captured from an initial GET, then POSTed back with
   whatever control/event actually triggers the data load. Not yet cracked; flag
   this pattern early if a new site turns out to be built the same way, since it's
   meaningfully more work than a plain form POST (like Alberta's ColdFusion form,
   which — despite looking similarly old-school — turned out to be a plain,
   ordinary POST with no token dance required).
10. **Some sites actively block non-browser clients for real** (this remains
    possible even after lesson 6 — don't assume every blocked site is a wrong
    domain) — have the Browser tool as a fallback, not just `curl`.
11. **Always clean up test/exploratory data from the actual database** before
    moving on — every script run against the real DB during verification in this
    research was deleted afterward once confirmed working, to avoid leaving
    half-populated jurisdictions that look "done" but aren't.
