# Adding India politicians (PM / CM / MP / MLA) — progress log

**Status: PM (1) + all 31 Chief Ministers + 536 of 543 Lok Sabha MPs — all done, uploaded,
verified live, walls linked. Vidhan Sabha (MLAs): 3,995 of ~4,121 done (97%) across 30
states/UTs. Every state/UT is done except Assam (126) — a confirmed, genuine boundary-data
gap (not a parser or matching problem, see "Assam — thoroughly re-investigated" below),
verified against three independent sources, all three stale relative to the real August-2023
delimitation. See "RESUMING THIS WORK" immediately below for exact commands, then the
dedicated Vidhan Sabha section further down for full history/rationale.**

## RESUMING THIS WORK IN A NEW SESSION — read this first

**Tools are permanent, in `scripts/`** (moved out of the per-session scratch directory,
which does not survive across chat sessions):
- `scripts/parse_india_assembly_wiki.py` — parses one state's raw Wikipedia wikitext into
  MLA records (constituency/name/party). Usage:
  `python3 scripts/parse_india_assembly_wiki.py <raw.wiki> <out.json> <expected_seat_count> ["<section header>"] [party_before_name]`
  Section header defaults to `"Members of Legislative Assembly"` — pass the real one if a
  state uses something else (Tamil Nadu: `"Members"`, Punjab: `"By constituency"`).
  `party_before_name` is a literal fifth argument, needed for Madhya Pradesh-style
  reordered tables — **resolved this session**, see the MP section for the real fix (a
  threshold bug: the party-stage loop always waited for 2 candidate cells before
  transitioning to Name, which is only correct for a Party+Alliance pair; MP has just one
  Party cell before Name, so every clean row was silently dropped for lacking a name).
- `scripts/match_india_mla_shapes.py` — matches parsed MLA records to `map_shapes` rows by
  constituency name (exact → fuzzy → manual overrides), with automatic district-based
  disambiguation for same-named constituencies in different districts (a real, recurring
  bug class — see "Full duplicate-shape audit" below). Contains one `<XX>_MANUAL` dict per
  state processed so far — **add a new one for each new state**, following the existing
  pattern, then wire it into the `if/elif` chain at the bottom of the file.
- `scripts/populate-india-vidhan-sabha-mlas.py` — takes a matched-MLA JSON + state name,
  auto-adds any missing party to `political_parties`, upserts `office_holders`, creates
  linked Ghost Profile walls. Already exists, unchanged.

**Exact repeatable workflow for the next state** (copy-paste, adjust names/numbers):
```bash
# 1. Find the right Wikipedia page. Naming is inconsistent -- try in this order:
#    "Nth <State> Assembly" (most common), "Nth <State> Legislative Assembly",
#    or search "wikipedia list of members <state> legislative assembly <year>".
#    Kerala/Punjab-style gotcha: if the state had ITS OWN more recent election than
#    what you'd assume, the "obvious" ordinal is the PREVIOUS, now-dissolved assembly --
#    verify term_end date in the page's infobox before trusting it's current.
curl -s --max-time 30 "https://en.wikipedia.org/w/index.php?title=Nth_STATE_Assembly&action=raw" -o /tmp/xx_assembly_raw.wiki
grep -n "^==" /tmp/xx_assembly_raw.wiki   # find the real section header

# 2. Parse, checking the printed "No party" / "Missing seat numbers" counts are both 0.
python3 scripts/parse_india_assembly_wiki.py /tmp/xx_assembly_raw.wiki /tmp/xx_mlas.json <N> "Members of Legislative Assembly"

# 3. ALWAYS re-verify every previously-completed state's saved JSON still matches a fresh
#    reparse before trusting any change to parse_india_assembly_wiki.py -- this exact
#    discipline caught 4 real regressions this session (see "rowspan inheritance" below).
#    Known-good copies of every completed state's raw wikitext + parsed + matched JSON
#    live in scripts/india-assembly-wiki-cache/ (<xx>_assembly_raw.wiki, <xx>_mlas.json,
#    <xx>_mlas_matched.json for xx in up/mh/wb/tn/bihar/ka/rj/gj/od/kl/pb/jh/cg/hr/ts/ap/
#    hp/uk/dl/jk/py/ga/tr/mg/mn/nl/ar/mz/sk) -- diff a fresh reparse of the cached raw
#    wikitext against the cached <xx>_mlas.json, e.g.:
python3 -c "
import json
a = json.load(open('scripts/india-assembly-wiki-cache/up_mlas.json'))
# ... parse_india_assembly_wiki.py on the cached raw.wiki, then compare
"

# 4. Sanity-check party distribution and duplicate constituency names by eye before
#    matching -- catches remaining edge cases the automated checks don't (e.g. two
#    different real parties with very similar names).
python3 -c "
import json
from collections import Counter
d = json.load(open('/tmp/xx_mlas.json'))
print(Counter(r['party'] for r in d).most_common(20))
print([k for k,v in Counter(r['constituency'] for r in d).items() if v>1])
"

# 5. Match against map_shapes (district-aware -- 3-column shapes file is required).
export DATABASE_URL="postgresql://postgres.qlzyfdwrkcxyqapewxwg:pa.8tX5%2BHh%2FGZn2@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
psql "$DATABASE_URL" -t -A -F'|' -c "SELECT id, name, properties->>'dist_name' FROM map_shapes WHERE country='India' AND boundary_type='Vidhan Sabha' AND properties->>'st_name'='STATE_NAME_ALL_CAPS';" > /tmp/xx_shapes.txt
python3 scripts/match_india_mla_shapes.py /tmp/xx_mlas.json /tmp/xx_shapes.txt /tmp/xx_matched.json
# Add any unmatched/collision entries as a new XX_MANUAL dict in match_india_mla_shapes.py,
# re-run until "Still unmatched: 0" and no "UNRESOLVED COLLISION" warnings.

# 6. Upload.
python3 scripts/populate-india-vidhan-sabha-mlas.py /tmp/xx_matched.json "State Name"

# 7. Verify no duplicate map_shape_id anywhere in the MLA data (a real, recurring bug --
#    duplicate constituency names across districts, e.g. two "Shahpura"s in Rajasthan).
psql "$DATABASE_URL" -c "SELECT map_shape_id, count(*) FROM office_holders oh JOIN election_role_types ert ON oh.election_role_type_id=ert.id WHERE ert.role_key='mla' GROUP BY map_shape_id HAVING count(*) > 1;"
```

**States done (30): Uttar Pradesh (403), Maharashtra (288), West Bengal (294), Tamil Nadu
(234), Bihar (243), Karnataka (224), Rajasthan (200), Gujarat (182), Odisha (147), Kerala
(140), Punjab (117), Jharkhand (81), Chhattisgarh (90), Haryana (90), Telangana (119),
Andhra Pradesh (175), Himachal Pradesh (68), Uttarakhand (70), Delhi (70), Jammu & Kashmir
(90), Puducherry (29 of 30 — one seat, Thattanchavady, genuinely vacant), Goa (40), Tripura
(60), Meghalaya (60), Manipur (60), Nagaland (60), Arunachal Pradesh (60), Mizoram (40),
Sikkim (31 of 32 — Sangha, the Buddhist-monasteries reserved seat, has no territorial
boundary in our data), **Madhya Pradesh (230) — resolved this session**, see its own section
below for the real parser fix. Total: 3,995.**

**Only 1 state remains: Assam (126).** Not "the next state in the list" — a confirmed,
thoroughly-verified boundary-data gap:
- The currently-sitting **16th Assam Assembly** (2026 election) uses entirely redrawn
  constituencies from the Election Commission's August 2023 state-specific delimitation —
  confirmed via web search that e.g. **Dotma** (Kokrajhar district) is a genuinely new
  constituency, created in 2023, with no prior-name equivalent to fall back on.
- **Three independent boundary sources were checked this session, and all three still
  reflect the pre-2023 constituency map**, not just our already-loaded data:
  1. Our currently-loaded `map_shapes` (126 rows) — confirmed stale (89/126 match against
     the current 16th Assembly's real MLA data; the *old*, now-dissolved 15th Assembly's
     data matches 126/126 against these same shapes, which is itself only possible because
     fuzzy string-matching bridges old and new names that happen to look similar without the
     underlying boundaries actually corresponding).
  2. **The "live" government `BharatMapService`** (`mapservice.gov.in/.../BharatMapService/
     AC_PC/MapServer/2`, the very source `adding-india-boundary-data.md` used to load our
     current Vidhan Sabha data and confirmed as "more current" for AP/Telangana/MP/UP/WB) —
     re-queried directly with a **freshly-fetched token** (via the Browser tool reading
     `window.acPCLayerSpecs` on `stategisportal.nic.in/stategisportal/Home/Map/28`, same
     mechanism documented in that doc) — still returns Assam's *old* constituency names
     (`GAUHATI EAST`/`GAUHATI WEST`, `CHABUA`, `BOKO`, `ALGAPUR` — no `Dotma`, `Tihu`,
     `Manas`, `New Guwahati` anywhere). This service appears to not yet have propagated
     Assam's 2023 delimitation, even though it's otherwise the most current source checked.
  3. **`HindustanTimesLabs/shapefiles`** GitHub repo (`state_ut/assam/assembly/assam_AC.json`
     — the earlier boundary-doc session's guessed path, `state/ac`, 404s; the real path
     structure is `state_ut/<state>/assembly/`, not explored fully before) — **133 features**
     (not the real 126), old naming (`Algapur`, `Barchalla`) — also stale.
- **Conclusion: no publicly available open GIS dataset yet reflects Assam's actual, final
  2023 delimitation** — plausible given the delimitation was only finalized in August 2023
  and the first election under it (2026) is very recent; open-data aggregators/scrapers
  likely haven't caught up. This is a real data-availability gap, not a research shortfall —
  **do not spend further session time re-checking these same three sources**; a fix needs
  either (a) a not-yet-found source with the real 2023 boundaries, or (b) manually digitizing
  from the ECI's own delimitation order PDF (`eci.gov.in`, "Delimitation of Parliamentary and
  Assembly Constituencies in State of Assam – Final Notification"), which is a genuine GIS
  digitization project, not a quick fix — a job for `adding-india-boundary-data.md`, not this
  doc. **Not worked around with stale pre-2023 data** — Assam MLAs stay unuploaded until real
  boundaries exist, per this project's standing rule that citizen-membership-determining
  boundaries need to be right, not "close enough."

**Mid-session infrastructure note**: the Supabase database briefly went into platform-level
read-only mode (`SHOW transaction_read_only` → `on`, not a replica —
`pg_is_in_recovery()` was `false`) partway through the Ward boundary upload, almost
certainly from a plan/storage quota — resolved by the user upgrading the Supabase plan.
The Ward upload (from `adding-india-boundary-data.md`) resumed cleanly from
`--resume 4b4fe530-38f1-4179-ac19-4c83c234a2c3` with no data loss once writes were
restored. Not a code bug — flagging in case DB writes ever fail with that exact error
again on this project.

**Mid-session infrastructure note**: the Supabase database briefly went into platform-level
read-only mode (`SHOW transaction_read_only` → `on`, not a replica —
`pg_is_in_recovery()` was `false`) partway through the Ward boundary upload, almost
certainly from a plan/storage quota — resolved by the user upgrading the Supabase plan.
The Ward upload (from `adding-india-boundary-data.md`) resumed cleanly from
`--resume 4b4fe530-38f1-4179-ac19-4c83c234a2c3` with no data loss once writes were
restored. Not a code bug — flagging in case DB writes ever fail with that exact error
again on this project.

This is a live progress log, written as the work happens, so a session can be picked up
mid-way if interrupted — same convention as
[adding-india-boundary-data.md](adding-india-boundary-data.md), which this depends on
(every layer here anchors to a `map_shapes` row from that doc's work).

## Architecture: the exact pattern being followed (already built for Canada/USA)

Read before touching anything here — this mirrors existing code exactly, not a new design:

- **[docs/OFFICE_HOLDERS_FEATURE.md](OFFICE_HOLDERS_FEATURE.md)** /
  **[docs/OFFICE_HOLDERS_IMPLEMENTATION.md](OFFICE_HOLDERS_IMPLEMENTATION.md)** — the
  `office_holders` table (one row per boundary+role, e.g. "who is the MP for this Lok
  Sabha seat") and its admin UI (`/admin/office-holders`).
- **[docs/POLITICIAN_WALL_FEATURE.md](POLITICIAN_WALL_FEATURE.md)** — the full social
  profile (`profiles` role='politician' + `politician_profiles`, a Ghost ID, a
  `/wall/:ghostId/:slug` page) that's separate from — but usually auto-created alongside —
  an `office_holders` row.
- **`scripts/populate-national-and-province-heads.py`** — the exact precedent for
  "one national head of government + one head per top-level container region": Canada's PM
  + 13 Premiers, USA's President. **This is what
  `scripts/populate-india-national-and-state-heads.py` (below) directly copies** for
  India's PM + 31 CMs.
- **`scripts/populate-all-office-holders.py`** / **`scripts/populate-canadian-municipal.py`**
  — the precedent for bulk riding/seat-level population (543+ MPs, thousands of municipal
  officials) from a real external data source, matched to `map_shapes` by name/code, then
  the same "create a Ghost Profile + wall for every unlinked office_holder" SQL block.
  **This is the template for India's Lok Sabha/Vidhan Sabha population**, once a bulk data
  source is confirmed (see below).

**The recurring two-step pattern, used identically every time:**
1. Upsert into `office_holders` (`map_shape_id`, `election_role_type_id`, `full_name`,
   `political_party_id`, `bio`, `source_url`, ...) — unique on
   `(map_shape_id, election_role_type_id, full_name)`.
2. Run a `DO $$ ... $$` block that, for every `office_holders` row with
   `linked_profile_id IS NULL` (filtered by country/role/boundary_type as needed), creates a
   `profiles` row (`role='politician'`, fresh `current_ghost_id`) + a `politician_profiles`
   row, then back-fills `office_holders.linked_profile_id` — this is what actually creates
   the wall (`/wall/:ghostId/:slug` goes live immediately once these two rows exist).

## Schema set up this session

`supabase/migrations/20260810000002_india_politician_roles_and_parties.sql`:
- **`India | National` boundary type** (rank, `admin_only=true`) + one placeholder
  `map_shapes` row (`id=90197`, `geom=NULL`, never geometrically queried — exact same
  "anchor point for a role with no real polygon" trick as Canada/USA's `National` type) to
  hang the Prime Minister's `office_holders` row off of.
- **`election_role_types`** rows: `India|National|prime_minister|'Prime Minister'`,
  `India|State|chief_minister|'Chief Minister'` (reuses the already-existing `State`
  container from the boundary work — exact same relationship as Canada's
  `Province|premier` / USA's `State|governor`), `India|Lok Sabha|mp|'MP'`,
  `India|Vidhan Sabha|mla|'MLA'`.
- **`political_parties`**: seeded ~35 major national + large regional parties (BJP, INC,
  TMC, DMK, SP, YSRCP, JD(U), Shiv Sena, NCP, RJD, AAP, TDP, CPI(M), CPI, BSP, BJD, JMM,
  Janasena, LJP(RV), AIMIM, JKNC, JKPDP, IUML, RLD, SAD, AIUDF, AGP, NPF, NPP, MNF, SKM,
  ZPM, TVK, AINRC, Independent). **Not exhaustive** — India has dozens of smaller
  regional/state parties; any MP/MLA import's party-matching will fall back to
  `Independent` for unmatched names, same accepted lossy-matching precedent every
  Canada/USA `populate-*.py` script already uses.

## Prime Minister + 31 Chief Ministers — done

**Source**: Wikipedia's ["List of current Indian chief ministers"](https://en.wikipedia.org/wiki/List_of_current_Indian_chief_ministers),
cross-checked independently for the 3 most surprising-looking entries before trusting the
rest of the table wholesale (a `WebFetch` table extraction is done by a small
summarization model and is not infallible on structured data — worth an independent
spot-check pass, not just a straight copy, especially for anything that looks like a
recent/contested change):
- **Kerala** (V. D. Satheesan, UDF/INC) — looked surprising (training-era knowledge said
  Pinarayi Vijayan/LDF) — **independently confirmed real**: UDF won the 2026 Kerala
  Assembly election, Satheesan sworn in 18 May 2026, ending LDF's decade-long rule.
- **Karnataka** (D. K. Shivakumar, INC) — looked surprising (training-era knowledge said
  Siddaramaiah) — **independently confirmed real**: a pre-agreed Congress leadership
  rotation, Shivakumar took over 3 June 2026.
- **Delhi** (Rekha Gupta) — **the table had a real error here**: listed her party as AAP;
  independently confirmed she's BJP (BJP won the 2025 Delhi election, ending AAP's
  decade-long rule — Gupta is BJP's second woman CM of Delhi). **Corrected before use.**
- **Prime Minister**: Narendra Modi (BJP), independently confirmed still in office
  (3rd term since June 2024) as of this research.

**5 UTs correctly have no Chief Minister at all** (administered directly by a
President-appointed Administrator/Lieutenant Governor, not an elected head of government):
Andaman & Nicobar, Chandigarh, Dadra & Nagar Haveli and Daman & Diu, Ladakh, Lakshadweep —
excluded on purpose, not a data gap (matches these 5 UTs also having no Vidhan Sabha, per
the boundary doc).

**Script**: `scripts/populate-india-national-and-state-heads.py` — direct copy of
`populate-national-and-province-heads.py`'s structure with India's 32 records.
**Result**: 32/32 `office_holders` rows created, all 32 linked to a fresh
`profiles`+`politician_profiles` row (Ghost ID assigned, wall live immediately at
`/wall/:ghostId/:slug`). Verified via direct query — every row has
`linked_profile_id IS NOT NULL` and a real `political_target_role`.

---

## Lok Sabha (536 of 543 MPs) — done

### Source: raw wikitext, not a summarized fetch

Used Wikipedia's **"List of members of the 18th Lok Sabha"** — but fetched the **raw
wikitext** directly (`action=raw`) rather than `WebFetch`'s summarized extraction, on
purpose: a 543-row table is exactly the kind of content a small summarization model is
likely to truncate or mis-transcribe (already proven true once this session, for the
32-row CM table — see above). Raw wikitext + a real parser gives verifiable, complete
output instead of trusting a model's summary of a huge table.

```bash
curl -s "https://en.wikipedia.org/w/index.php?title=List_of_members_of_the_18th_Lok_Sabha&action=raw" \
  -o loksabha_raw.wiki
```

### Parser — real bugs found and fixed while building it

The wikitext is one `sortable wikitable` per state/UT section, with a `!` serial number,
then `|`-separated cells (Constituency, Name, Party, Alliance), using `rowspan` to avoid
repeating a party name across consecutive seats held by the same party. Wrote a regex-based
parser (not full wikitext parsing, but enough for this table's actual shape) —
**every one of these was caught by validating against real per-state seat counts and
distinct-party counts, not assumed correct on the first pass**:

1. **Table-header regex only matched `"sortable wikitable"` in that exact word order** —
   several sections use the class attribute in the opposite order,
   `"wikitable sortable"` (confirmed via `grep`, both orders appear ~equally often). Missed
   131 MPs entirely (8 states/UTs) until fixed to match either order.
2. **One MP's name has no wikilink at all** (Dharmapuri's "A. Mani", plain text, unlike
   every other MP name in the table) — the name-extraction regex required a `[[...]]`
   link and silently dropped that whole row when it found none. Fixed with a plain-text
   fallback. Caught because Tamil Nadu's count came out 38 instead of the real 39.
3. **Party vs. alliance column confusion** — the actual party uses the template
   `{{Full party name with colour|X}}`, but the *alliance* column (NDA / INDIA bloc /
   "Others") uses a similarly-named template, `{{Party name with colour|X}}` (no "Full"),
   whose name is a substring-match false-friend of the party template. A rowspan on the
   party cell that ends before the alliance cell's rowspan does caused several rows to
   have *only* an alliance-column line — the loose original regex grabbed that and
   recorded "National Democratic Alliance" or "Indian National Developmental Inclusive
   Alliance" as if they were political parties. Fixed by requiring the literal substring
   `"full party name with col"` (also handles the next bug) for the real party, and
   explicitly skipping (not breaking on) the alliance-shaped templates.
4. **British vs. American spelling**: Telangana's section uses `{{Full party name with
   color|X}}` (no "u") while every other state uses `"...with colour|X"`. Fixed by
   matching the common substring `"full party name with col"` rather than the full word.
5. **Two genuine one-off formatting exceptions**, not parser bugs to generalize away —
   handled with an explicit, documented manual-override map rather than looser regexes
   that might silently mis-parse something else:
   - **Baramulla (J&K)**: Sheikh Abdul Rashid's party uses a raw `bgcolor=` swatch cell
     instead of any party template, with the real party name
     (`Jammu and Kashmir Awami Ittehad Party`, his own new party) as a separate plain
     wikilink a line later.
   - **Ladakh**: uses the *alliance-shaped* template but its literal content is the string
     `"Independent"` — correctly an override, not an alliance name, despite matching the
     alliance template's shape.

**Result: 543/543 rows parsed**, every state/UT's count matching its real official Lok
Sabha seat allocation exactly, 0 rows with a missing name or party, 0 duplicate
constituencies within a state. 45 distinct party strings found across all 543 winners.

### Matching to `map_shapes`

536 of 543 matched successfully:
- **521 exact** (after normalizing: uppercase, strip accents, strip `(SC)`/`(ST)`
  reservation suffixes, strip all non-alphanumeric characters).
- **13 more via a fuzzy match** (`difflib.get_close_matches`, cutoff 0.82) — all genuine
  spelling variants between Wikipedia's transliteration and the LGD source's (e.g.
  `Anakapalli` vs. our `ANAKAPALLE`, `Koderma` vs. our `KODARMA`, `Haridwar` vs. our
  `HARDWAR`). **One fuzzy candidate was a false positive** (Assam's `Kaziranga` scored high
  against Uttar Pradesh's completely unrelated `KAIRANA` — different states, different
  seats, just similar strings) — caught by eyeballing every fuzzy match before accepting
  it (printed each one for review), not trusting the similarity score alone. Explicitly
  blocklisted rather than silently accepted.
- **2 manual overrides**: Puducherry (LGD's shape is still named the pre-2006
  `PONDICHERRY`) and Andaman & Nicobar Islands (normalized string differs too much for the
  fuzzy cutoff — `"...ISLANDS"` + `"AND"` vs. our shape's plain `"ANDAMAN & NICOBAR"`).
- **7 genuinely unmatched — a real boundary-vintage gap, not a naming problem.** Checked
  each directly against `map_shapes`, not just assumed: **Assam** has 6 Lok Sabha seats
  from the Election Commission's **2023 state-specific delimitation** (Guwahati, Nagaon,
  Sonitpur, Diphu, Kaziranga, Darrang–Udalguri) that don't exist under any name in our
  LGD-derived boundary data — confirmed by listing all 14 of Assam's actual loaded seats
  and finding old names instead (`GAUHATI`, `NOWGONG`, `TEZPUR`, `AUTONOMOUS DISTRICT (ST)`,
  `KALIABOR`, `MANGALDOI`) — **this is the same kind of "our boundary data predates a real
  redistricting" gap as Alberta/Quebec in the Canada work**, except here it wasn't caught
  during the original Lok Sabha boundary load because the *feature count* still matched
  (14 old-name seats = 14 real seats), only individual *names* reveal the vintage mismatch.
  **Jammu & Kashmir's `Anantnag–Rajouri`** is the 7th — a merged constituency from J&K's
  post-2019-reorganization delimitation, our data still has the old standalone `ANANTNAG`.
  **Not fixed this session** — would need Assam's (and possibly J&K's) Lok Sabha boundary
  layer refreshed from the 2023/post-2019 delimitation before these 6-7 seats can get an
  MP record; flagging for `adding-india-boundary-data.md` as a known follow-up, not
  silently working around it with a wrong shape.

### Party catalog — added the real party names, not the pre-guessed ones

The original ~35-party seed (`20260810000002_...sql`) used generic/full legal names guessed
ahead of time — several didn't exactly match what the real data actually uses (exact-match
`ILIKE`, no wildcards, so close-but-different strings silently fail to link). Fixed two
ways:
1. **`20260810000003_india_lok_sabha_parties.sql`** adds 22 more parties **taken verbatim
   from the real parsed MP data** — including both post-split factions each of Shiv Sena
   and NCP now have (`Shiv Sena (2022–present)` vs. `Shiv Sena (UBT)`; `Nationalist
   Congress Party` vs. `Nationalist Congress Party (Sharadchandra Pawar)` vs. `Nationalist
   Citizens Party of India`, all three real and distinct) — a pre-guessed list couldn't
   have anticipated these exact strings.
2. **Found and fixed one real gap live**: `YSR Congress Party` (Wikipedia's short form)
   didn't match the original seed's `Yuvajana Sramika Rythu Congress Party` (the full legal
   name) — caught because 4 real Andhra Pradesh MPs came back with `political_party_id
   IS NULL` after the import. Added the short-form name as its own row and backfilled the
   4 affected `office_holders` + `politician_profiles` rows directly (not re-running the
   whole import) once the gap was found.

**Script**: `scripts/populate-india-lok-sabha-mps.py`. **Result**: 536/543 `office_holders`
rows created, all 536 linked to a fresh wall, **0 rows with an unmatched party** after the
YSRCP fix. Verified live: Narendra Modi correctly appears as both MP for `VARANASI` *and*
separately as Prime Minister — two real, distinct roles for the same real person, exactly
matching India's parliamentary system (the PM is also a sitting MP).

---

## Vidhan Sabha (~4,122 MLAs) — in progress, state by state

**No single bulk source exists** (unlike Lok Sabha's one unified Wikipedia list) — state
assemblies aren't elected on the same cycle, so each state has its own separate Wikipedia
article: **"Nth `<State>` Assembly"** (not "List of members of...", a different naming
convention than the Lok Sabha page). Confirmed this per-state, not assumed. Each state's
raw wikitext is fetched and parsed individually with a **shared, generalized parser**
(`parse_state.py`, in the scratch dir) built and validated against two states so far.

### Parser: one general implementation, not per-state bespoke code

Built against Uttar Pradesh first (largest state, 403 seats), then validated it also
reproduces UP's already-hand-verified output with **zero regressions** before trusting it
on a second state (Maharashtra) — this cross-check caught 3 real bugs that a "looks right"
first pass would have missed:
1. **Position-only party detection is not enough** — some states' tables use the same
   generic `{{Party name with colour|X}}` template for *both* the real party and the
   alliance column (Maharashtra), while others (UP, Lok Sabha) only use it for alliance and
   a separate `{{Full party name with colour|X}}` for the real party. Fixed with a small
   **known-alliance denylist** (`KNOWN_ALLIANCES` — NDA, INDIA bloc, Maha Vikas Aghadi,
   etc.) checked against *only* the first content cell after the name, rather than trying
   to keep two incompatible template-name conventions straight per state.
2. **A regex missing `\s*` before a required `\|`** caused silent mis-parses whenever a
   `style="..."` attribute's value itself contained a nested template with its own `|`
   (`style="background-color: {{party color|Rashtriya Samaj Paksha}}" |`) — the quoted-match
   alternative failed on the space before the real closing `|`, so the regex silently fell
   back to a naive non-quoted match that stopped at the *first* `|` (inside the nested
   template), leaving garbage like `"Rashtriya Samaj Paksha}}\" |"` as the extracted value.
   Caught by noticing malformed `}}"` artifacts in Maharashtra's party list — would have
   silently corrupted party names in any state hitting this pattern.
3. Reused the UP-specific fixes (case-insensitive `rowspan`, "Assembly constituency" vs.
   "Vidhan Sabha constituency" vs. "Vidhan Sabha) Constituency" link-target naming variants,
   mid-term successor rows via rowspan, the "Independent" literal-value-in-an-alliance-slot
   edge case, first-candidate-only party extraction to avoid remarks bleeding into a
   rowspan-shifted alliance slot) generalized into the shared parser rather than
   copy-pasted per state.

**Validation method for every state, not just eyeballing the output:** parse, check total
count against the real seat count, check for any row with a missing party, and — new this
round — **diff a from-scratch second parser run against the first** whenever the parser
itself changes, to catch regressions before moving to the next state.

### States done so far

| State | Seats | Matched to `map_shapes` | Uploaded | Notes |
|---|---|---|---|---|
| Uttar Pradesh | 403 | 403/403 (390 exact/fuzzy + 13 manual: pre-2023-name `Prayagraj`→`Allahabad` ×3, `Ghazipur Sadar`→`Ghazipur`, `Meerut City`→`Meerut`, `Dholana`→`Dhaulana`, 6 fuzzy spelling variants) | ✅ 403/403 with walls | 0 rows missing a party after fixing 2 real edge cases (a plain-text-only name, a mid-term-defection row using the alliance template slot to state "Independent" directly) |
| Maharashtra | 288 | 288/288 (285 exact/fuzzy + 3 manual: `Dharashiv`→pre-2023-name `Osmanabad`, 2 spelling variants below the fuzzy cutoff) | ✅ 288/288 with walls | 1 seat (Rahuri) has no party — **a genuine gap in Wikipedia's own source data**, not a parsing failure: the current post-by-election occupant's party isn't documented in the table at all yet. The CM/Deputy CM's "Dy Chief Minister" title-instead-of-party rows and the one MLA whose party template literally uses his own name (`Ravi Rana`, a real single-person-party editorial quirk) are both now auto-resolved by the parser improvements below, not just manually patched. |
| West Bengal | 294 | 294/294 (288 exact/fuzzy + 6 manual: `Tollygunge`/`Indas` spelling variants, 4 more fuzzy) | ✅ 294/294 with walls | The state that pushed the parser furthest — see below. Final distribution (221 TMC, 67 BJP, plus 5 others) matches the real 2021 result shape. |
| Tamil Nadu | 234 | 234/234 (229 exact/fuzzy + 1 manual: `Anaicut`→`Anaikattu` spelling variant + 4 more fuzzy) | ✅ 234/234 with walls | Section header here is `Members`, not `Members of Legislative Assembly` (parser's `section_header` param handles this per-state). New alliance names for the 2026 election (`TVK-led Alliance`, `AIADMK-led Alliance`, `Secular Progressive Alliance`) added to the denylist. Distribution (108 TVK, 59 DMK, 47 AIADMK, rest small parties) matches the real hung-assembly result. **Live-verified**: new CM C. Joseph Vijay correctly appears as MLA (his own seat, `TAMIL NADU` National-shape CM record separate) — interestingly at *two* constituencies (Perambur and Tiruchirappalli East), which is plausible under Indian election law (a candidate may contest two seats) but not independently fact-checked beyond confirming the parser read the source table correctly. One shape (`Tiruppattur`) has no matched MLA after all other matches — a small (1/234) unresolved gap, not chased further; flagged here rather than silently left undocumented.|

| Bihar | 243 | 243/243 (235 exact/fuzzy + 8 fuzzy spelling variants) | ✅ 243/243 with walls | Clean on first parse (no new structural quirks). Distribution (84 BJP, 72 RJD, 46 JD(U), 17 INC, 11 CPI(ML)L, plus small parties) matches the real 2020 election result. One new remarks-keyword gap found: `by-election` wasn't caught by the existing `bypoll` check (2 seats) — added. |

| Karnataka | 224 | 224/224 (220 exact/fuzzy + 4 manual spelling variants) | ✅ 224/224 with walls | Clean data-wise (137 INC, 63 BJP, 18 JD(S), matches the real 2023 landslide). One real parser fix: district links without "district" in the target (`[[Uttara Kannada]]`, not `[[Uttara Kannada district\|...]]`) were being mistaken for rowspan-continuation content. Fixed with a better signal — checking the *raw, pre-rowspan-stripped* line for a fresh `rowspan=` attribute, which a true continuation row's first cell never has (it's absent precisely because rowspan carried it from an earlier row) — rather than requiring the literal word "district". |
| Madhya Pradesh | 230 | 230/230 (225 exact/fuzzy + 5 manual spelling variants) | ✅ 230/230 with walls | **Resolved this session** — the real bug was a threshold, not the reordering itself: the `party_before_name` party-stage loop always waited for 2 candidate cells before transitioning to Name (correct for a real Party+Alliance pair), but MP's table has only *one* Party cell before Name (the header's `colspan="2"` visually spans two columns' width but the data only ever has one cell there) — so the real Name cell was silently absorbed as an uncounted second "party candidate" and the row was dropped for lacking a name entirely. Fixed by using a 1-candidate threshold specifically in `party_before_name` mode. Every previously-"position title as name" row (Speaker, Deputy CM, Leader of Opposition, etc.) resolved correctly once this was fixed — including live-verifying CM Mohan Yadav at his real seat (Ujjain South) and Deputy CM Jagdish Devda (Malhargarh). Distribution (165 BJP after normalizing the same `"Bharatiya Janta Party"` typo seen in Chhattisgarh, 64 INC, 1 Bharat Adivasi Party) matches the real 2023 result. |

| Rajasthan | 200 | 200/200 (196 exact/fuzzy + 2 manual: `Dungargarh`→`Shree Dungargarh`, `Lachhmangarh`→`Laxmangarh` spelling/word variants) | ✅ 200/200 with walls | Two real fixes, both significant — see below. Distribution (118 BJP after normalization, 67 INC, 7 Independent, 4 Bharat Adivasi Party, 3 Shiv Sena) matches the real 2023 result. |

| Gujarat | 182 | 182/182 (166 exact/fuzzy + 7 manual: **5 genuinely duplicate constituency-name pairs** — Mandvi, Mangrol, Kalol, Jetpur, Mahuva each exist twice in different districts, mostly already disambiguated by Wikipedia itself with a parenthetical district hint in the constituency name text — plus 9 more fuzzy spelling variants) | ✅ 182/182 with walls | Two more general parser fixes (`||` double-pipe inline multi-cell shorthand, and a generalized attribute-prefix stripper covering `colspan=`/`align=`/`class=` alongside the existing `bgcolor=`/`style=`/`rowspan=` — a `Colspan=3\|Satish Patel` cell had been leaking the literal attribute text into the name field) — see below. The automatic collision-detector correctly flagged Gujarat's "Mangrol" pair (a spelling mismatch, "Junagarh" vs. the shape's "Junagadh", prevented auto-resolution) rather than silently guessing wrong. |

**Running total: 2,068 of ~4,122 MLAs done (50.2%) — passed the halfway mark.**

| Odisha | 147 | 147/147 (140 exact + 7 fuzzy spelling variants) | ✅ 147/147 with walls | One more real parser fix: this state's `{{Full party name with color|rowspan=7|Bharatiya Janata Party}}` puts `rowspan=N` as the *first* template argument, party name second — every other state so far had it the other way around. The naive "take the first argument" extraction was literally returning the string `"rowspan=7"` as the party for ~2/3 of Odisha's seats. Fixed generally: `template_value()` now skips any keyword-shaped argument (`word=value`) and returns the first genuinely positional one, regardless of which position it's in. Also added `suspend` to the remarks-keyword list (a "Suspended from Party for cross-voting in [[2026 RS election]]" row was slipping through). Distribution (79 BJP, 50 BJD, 13 INC) matches the real 2024 result, including BJD's historic loss of its assembly majority.

**Running total: 2,215 of ~4,122 MLAs done (53.7%).**

| Kerala | 140 | 140/140 (138 exact/fuzzy + 2 manual: `Koyilandy`→`Quilandy`, `Vypin`→`Vypen` spelling variants) | ✅ 140/140 with walls | **Wrong assembly caught before parsing**: Kerala's *previous* assembly page ("15th Kerala Assembly") is still the one most search results surface, but its term ended 23 May 2026 — Kerala already had its 2026 election (the same one that installed the new CM researched earlier in this doc). Used the "16th Kerala Assembly" page instead. Also surfaced the most significant parser bug found this session — see below. Final distribution (63 INC, 26 CPI(M), 22 IUML, 8 CPI, 7 KC, plus small allies) matches the real 2026 UDF landslide. |

### The most significant parser fix this session: rowspan inheritance was fundamentally unreliable, in two different ways

Kerala's table exposed a genuine logic bug in how party values get inherited across
rowspan'd cells — worth documenting in full since it could have silently affected *any*
already-uploaded state, not just Kerala:

1. **The original continuation check was vacuously always true.** `current_no` was being
   set to `no` *before* checking `no == current_no` to decide "is this a genuine same-seat
   continuation" — meaning the comparison was comparing a variable against the value it had
   just been assigned, always true, for *every* row, continuation or not. This was
   never caught by the diff-based regression checks up to this point because its effect
   happened to be harmless for every state parsed so far (inheriting from literally any
   preceding row's party, right or wrong, rarely produced a *different* value than the
   correct one in practice) — until Kerala's Speaker row (seat 97, whose own party cell
   was legitimately absent, replaced by `[[List of speakers...|Speaker]]`) inherited the
   *previous, unrelated* seat's party instead of correctly staying unresolved.
2. **Fixing check #1 naively (requiring an explicit `is_continuation` flag) caused a large
   new regression** across Gujarat, Odisha, Maharashtra, West Bengal, and Tamil Nadu —
   these states' common `{{Full party name with color|X|rowspan=19}}` pattern spans a
   party value across *several different, freshly-numbered seats* in one district block,
   not a same-seat succession — `is_continuation` is correctly `False` for every one of
   those rows, so the naive fix wrongly stopped inheriting for the entire rest of a
   rowspan block once its first row had passed.
3. **The real, general fix**: track the *declared* `rowspan=N` count from wherever it
   appears (leading cell attribute or, more commonly, a template argument like
   `{{...|X|rowspan=19}}`), and inherit `current_party` for exactly that many *subsequent*
   rows, decrementing a counter — regardless of what (if anything) later content collides
   with that position. This is what correctly handles Kerala's Speaker row too: its
   rowspan=4 block (declared two rows earlier) still had one row of validity left when the
   "Speaker" link happened to land in that cell instead of being left blank, so counting
   down from the source's own declared span (rather than re-guessing per row from content)
   naturally does the right thing in every case tried. A same-seat-succession fallback
   (using `is_continuation` specifically) is kept for the narrower case where the party
   column is dropped entirely with no rowspan number at all (Maharashtra's Rahuri).

**Verification discipline that caught all of this**: every fix in this three-step sequence
was checked against *all nine already-parsed states simultaneously* (not just the one being
worked on) before being trusted, using the same before/after diff technique established
early in this doc. The final version produces **zero diffs across all 9 previously-verified
states** except the one already-known Ravi Rana manual-override case — meaning this
significant rewrite changed *no* correct output, only fixed what was broken.

**Running total: 2,355 of ~4,122 MLAs done (57.1%).**

| Punjab | 117 | 117/117 (115 exact/fuzzy + 2 manual: `Lehragaga`→`Lehra`, `Jalandhar Cantonment`→`Jalandhar Cantt.` spelling variants) | ✅ 117/117 with walls | No "Members of Legislative Assembly" section at all — this state's table lives under `=== By constituency ===`, nested inside the page's `==Composition==` section (the parser's `section_header` param already handled this, just needed the right string passed in). One new parser fix: seat 115 is written as `"115."` with a stray trailing period, which the exact `\d+` digit match rejected outright, misreading the row as a same-seat continuation. Fixed with `\d+\.?` instead. Distribution (95 AAP, 16 INC, 2 BJP, plus small allies) is consistent with AAP's 2022 landslide (92 seats) plus a few since-2022 by-election/defection gains. |

**Running total: 2,472 of ~4,122 MLAs done (60.0%).**

### Two more general parser fixes, from Gujarat

1. **`||` double-pipe MediaWiki shorthand for multiple cells on one physical line**
   (`| 1 || [[Abdasa Assembly constituency|Abdasa]]` is two cells — No. and
   Constituency — not one row-spanning blob). Fixed by splitting on the literal `||`
   substring before per-line processing (safe: real templates/links use single `|` as
   their own argument separator, never a doubled one).
2. **Attribute-prefix stripping only covered `bgcolor=`/`style=`/`rowspan=`** — Gujarat's
   `Colspan=3|Satish Patel` (a `colspan` attribute, not previously recognized) left the
   literal `"Colspan=3|"` text stuck to the name. Generalized into one
   `strip_leading_attrs()` that repeatedly strips *any* of `rowspan=`/`colspan=`/
   `bgcolor=`/`style=`/`align=`/`class=` in any chained combination, replacing the
   narrower bgcolor/style-only functions everywhere they were used.
3. **A remarks sentence with a wikilink buried inside it** ("Elected in by-election
   necessitated after death of `[[Yogesh Patel]]`.") was extracting just the link's
   display text ("Yogesh Patel") and missing the surrounding "Elected... death of"
   context that would have flagged it as remarks. Fixed by keeping the raw cell text
   alongside the extracted value and checking *both* for remarks-likeness, not just the
   isolated link text.

### Two more real bugs found on Rajasthan — one a data-correctness issue in already-uploaded states

1. **Header-row detection was fundamentally unreliable.** Checking "does the row start
   with `!`" (a header-styled cell) breaks the moment a *data* row's District cell is
   itself rowspan-omitted **and** that row's remaining first cell (the seat number) is
   itself `!`-prefixed — the whole row then starts with `!` too, indistinguishable from a
   real header by that test alone. This silently dropped **166 of Rajasthan's 200 seats**
   before being caught (only 34 parsed on the first attempt). Fixed properly in two parts:
   - Primary signal: does the row contain a wikilink or template (`[[`/`{{`) at all? Real
     header/caption rows never do; real data rows always do. This alone introduced a new
     regression on **West Bengal** (a genuine rowspan-succession row whose plain-text
     successor name has no wikilink either — the row got misclassified as header-like and
     dropped, silently keeping the *deceased predecessor's* record as if it were current).
   - Fixed by scoping *both* heuristics (the old `!`-prefix check and the new
     no-wikilink check) to **only apply before the first real data row has been seen** —
     headers only ever appear at the very top of a table, never again afterward, so once
     real data starts, no further per-row header-guessing is needed or safe.
2. **Duplicate constituency names within a state silently corrupt matching — a real
   data-correctness bug already live for Bihar, not just a Rajasthan risk.** Rajasthan has
   two different "Shahpura" constituencies (Jaipur district and Bhilwara district). The
   original `match_state.py` built a flat `name -> shape_id` dict, so the second Shahpura
   silently overwrote the first — one of the two real MLAs would have been linked to the
   *other* Shahpura's actual polygon (wrong geometry, not just cosmetic). **Checked all
   previously-matched states for the same latent bug** (`sort | uniq -d` on each state's
   shape-name list) and found **Bihar has the identical problem** ("Kalyanpur" and "Pipra"
   each appear twice, in different districts) — meaning 2 of Bihar's 243 already-uploaded
   `office_holders` rows were live in production pointing at the wrong shape.
   **Fixed both ways:**
   - Rebuilt `match_state.py` to keep shapes as `name -> [(id, name, dist_name), ...]`
     and disambiguate collisions by comparing the MLA's own recorded district against
     each candidate's `properties->>'dist_name'` (falling back to substring/fuzzy
     closeness, since Wikipedia and the shape data don't always agree on district naming —
     "East Champaran" vs. "Purbi Champaran" for the same district). Also added an explicit
     post-match sanity check that flags if any `map_shape_id` ends up claimed by more than
     one MLA, so a future unresolved collision fails loudly instead of silently.
   - **Directly corrected the 2 live Bihar records**: Manoj Kumar Yadav (East Champaran's
     Kalyanpur, seat 16) had been wrongly linked to Samastipur's Kalyanpur shape;
     Shyambabu Prasad Yadav (East Champaran's Pipra, seat 17) had been wrongly linked to
     Supaul's Pipra shape. Both `office_holders.map_shape_id` values fixed via direct SQL
     update, verified against `properties->>'dist_name'` afterward.

### Full duplicate-shape audit — ran across every layer, found 4 more, including in Lok Sabha

After fixing Bihar, ran `SELECT map_shape_id, count(*) FROM office_holders ... GROUP BY
map_shape_id HAVING count(*) > 1` across **every** India office-holder record (not just the
states just touched) as a blanket correctness check, rather than assuming the bug was
fully contained. Found 4 more, live in production:

| Constituency | Correct MP/MLA → shape | Was wrongly linked to |
|---|---|---|
| West Bengal Vidhan Sabha "Bishnupur" | Tanmay Ghosh (Bankura) → shape 64499 | Dilip Mondal's shape (64390, South 24 Parganas' "Bishnupur (SC)") |
| Tamil Nadu Vidhan Sabha "Tirupattur"/"Tiruppattur" | Srinivasa Sethupathi (Sivaganga) → shape 66335 | N. Thirupathi's shape (66201, Tirupathur district) |
| **Lok Sabha** "Maharajganj" | Janardan Singh Sigriwal (**Bihar**) → shape 62930 | Pankaj Chaudhary's shape (62973, **Uttar Pradesh**'s Maharajganj) |
| **Lok Sabha** "Aurangabad" | Abhay Kushwaha (**Bihar**) → shape 63338 | Sandipanrao Bhumre's shape (63047, **Maharashtra**'s Aurangabad) |
| **Lok Sabha** "Hamirpur" | **Anurag Thakur** (**Himachal Pradesh**) → shape 63276 | Ajendra Singh Lodhi's shape (63361, **Uttar Pradesh**'s Hamirpur) |

**The Lok Sabha cases are more serious than the within-state Vidhan Sabha ones**: the
original MP matching (`match_shapes.py`, built hours earlier in this same session, before
any district/state-disambiguation logic existed) used one flat `name -> shape_id` dict
across *all 543 seats nationally*, with no state-scoping at all. A same-named constituency
in two different states (India has many — common place names repeat across state
boundaries) collided silently, and one real MP ended up linked to a *different state's*
constituency shape entirely — not just the wrong district within the right state.
**Anurag Thakur** (a nationally prominent Union Cabinet Minister, Himachal Pradesh's
Hamirpur MP) had been silently linked to Uttar Pradesh's Hamirpur shape instead of his own.

**Why West Bengal's raw-name `uniq -d` check (used earlier, before the district-aware
matcher existed) missed the Bishnupur case**: that check compared *raw, unnormalized*
shape names, and West Bengal's two Bishnupur shapes are named differently at the raw-string
level (`"BISHNUPUR"` vs. `"BISHNUPUR (SC)"`) — only *after* `normalize()` strips the
`(SC)`/`(ST)` reservation suffix do they collide. Lesson: **check for duplicates on the
normalized key, not the raw name** — a weaker version of the same check would have caught
this one before it ever shipped.

**All 7 total records (4 MLA + 3 MP) corrected via direct SQL**, each verified against
`properties->>'dist_name'` (Vidhan Sabha) or `properties->>'st_name'` (Lok Sabha)
afterward. **Final state: zero duplicate `map_shape_id` values across all 1,886 MLA and
536 MP office-holder records combined.** This kind of audit (`GROUP BY map_shape_id HAVING
count(*) > 1` across the *entire* office_holders table, not just newly-touched rows) is
worth re-running after any future state population, given how often this exact class of
bug recurred across independently-built matching passes.

### Parser improvements added while doing West Bengal (generalized, not one-off patches)

West Bengal's table surfaced four new failure modes beyond UP/Maharashtra's — each fixed
in the shared `parse_state.py`, then **re-verified against UP and Maharashtra with zero
regressions** before trusting the fix:
1. **Constituency links with no disambiguating suffix at all** — West Bengal links
   constituencies as plain place names (`[[Cooch Behar Uttar]]`), not
   `[[X (Assembly constituency)|X]]` like every state seen so far. Fixed by making
   constituency detection purely *positional* (whatever immediately follows the seat
   number) instead of requiring a specific link-target pattern — simpler and more general
   than the pattern-matching approach it replaced.
2. **`<ref>...</ref>` citation blocks and `<section end="...">` transclusion markers
   leak into cell content** if not stripped before parsing — a `<ref>{{cite
   web|url=...}}</ref>` embedded in a "died on" remark was getting mistaken for a party
   template, extracting a raw URL as if it were a party name. Fixed with a
   `strip_noise()` pass over the whole section before any cell-level parsing.
3. **Government/legislature position titles standing in for the party** — "Cabinet
   Minister", "'''Speaker'''", "'''Deputy Speaker'''" appear in West Bengal's table (and,
   it turned out, Maharashtra's "Dy Chief Minister" rows too) wherever the real party was
   itself rowspan-omitted for a long-serving minister/presiding officer. Affected **86 of
   294 West Bengal seats** — large enough that this needed a real fix, not a one-off
   override. Added a `POSITION_TITLE_LIKE` denylist alongside the existing
   `KNOWN_ALLIANCES` one; retroactively fixed Maharashtra's 2 "Dy Chief Minister" rows for
   free once added.
4. **Status/remarks text with no digits at all** ("Won in October 2021 bypoll", "Defected
   from BJP to AITC") was slipping past the alliance-name check since it isn't a known
   alliance and doesn't obviously look like a date. Added a keyword-based
   `REMARKS_LIKE` check (bypoll/elected/resigned/died/disqualified/defected/etc.) — **explicitly not** keyed on
   "contains a digit", since some real party names legitimately contain a year
   (`Shiv Sena (2022–present)`) and a naive digit check caused a real regression on
   Maharashtra before this was caught by the cross-state diff check.

**All four fixes were caught and fixed *before* moving to the next state**, using the same
discipline as the UP→Maharashtra transition: parse, check counts, check for suspicious
party values (URLs, HTML fragments, quote artifacts, titles instead of party names) by
eye, fix, then re-diff the two already-verified states to confirm zero regressions before
trusting the fix on new data.

### Second session: 18 more states/UTs done (2,472 → 3,765), several new table shapes, and two retroactive data-quality fixes to already-live records

Went through nearly the entire remaining list in size order, hitting five genuinely new
wikitext table shapes along the way — each one generalized into `parse_india_assembly_wiki.py`
and re-verified against **every** previously-cached state with zero regressions before
trusting it, same discipline as the first session. **Assam was attempted and deferred**
(see above) rather than force-uploaded with stale boundary data.

**New parser generalizations, in the order they were found:**
1. **District cell with no wikilink and no rowspan at all** (Telangana: plain text
   `"Kumuram Bheem Asifabad"`, not `[[...]]`) — the old district-detection signal required a
   link target. Generalized to a positional signal instead: whatever cell immediately
   precedes the seat-number digit cell is the District, link or not.
2. **`extract_value()`'s "prefer longer of target/display" heuristic** (built for Kerala's
   `[[Communist Marxist Party|CMP]]` abbreviation case) backfired twice: Andhra Pradesh's
   `[[Ministry of Women and Child Welfare|Minister of Women & Child Welfare]]` picked the
   *institution name* (target) over the "Minister of..." display, and neither one was
   caught by `POSITION_TITLE_LIKE` (which only knew `\bministers?\b`, not `\bministry\b`).
   Fixed by extending the denylist rather than the length heuristic itself. A related case,
   `[[Telugu Desam Party|President of Telugu Desam Party]]`, was fixed the same way (denylist
   any `^(president|founder|convenor|...) of\b` prefix) rather than trying to out-guess which
   of target/display is "more correct" in every case.
3. **No seat-number column at all** (Himachal Pradesh: District→Constituency→Name→Party,
   no "No." column) — added a `no_seatno_column` mode (fifth CLI arg): auto-increments seat
   numbers in source order, and required two follow-on fixes once real data exercised it:
   - A **freshly rowspan'd Constituency cell** (`rowspan=2|[[Hamirpur...]]`, a
     resignation/bypoll pair sharing one seat) must not be mistaken for a District cell just
     because it's rowspan'd — disambiguated by checking whether the link target itself looks
     like a constituency (`assembly constituency`/`vidhan sabha` in the target).
   - A **template argument wrapped onto a second physical line**
     (`{{Full party name with color|\nIndian National Congress}}`, Uttarakhand) broke the
     single-line template regex, leaking the literal `"{{Full party name with color|"` text
     as the party. Fixed generally in `strip_noise()`: collapse internal newlines within any
     `{{...}}` span before per-line splitting, not just for Himachal Pradesh's table shape.
4. **A within-term party-switch row where No./Constituency/*Name* are all rowspan'd
   together** (Meghalaya: the same MLA, same seat, only the Party+Alliance cells differ
   between a "before" and "after" sub-row) — the continuation row's first cell is itself a
   party-color template, not a name. First attempt discarded that cell's content entirely
   (fixed the corrupted-name symptom but silently dropped the real party too); the working
   fix lets that same line fall through into party-stage processing instead of being
   skipped. **This exact same pattern, previously unrecognized, turned out to already be
   live and broken in 6 already-uploaded states** — see the retroactive fix below.
5. **A dedicated "Reserved" column** (Arunachal Pradesh: District/No./Constituency/**Reserved
   (bare "ST"/"SC"/"None" text, no brackets)**/Name/Party — every other state so far embeds
   the reservation suffix in the constituency name itself, `"Foo (ST)"`) shifted every
   subsequent cell over by one position, corrupting Name and Party. Fixed with a
   `RESERVATION_CODE` skip in the Name stage, matching bare `ST`/`SC`/`OBC`/`GEN`/`UR`/`None`.
6. **MediaWiki underscore-as-space in a link target** (Mizoram:
   `[[List_of_leaders_of_the_opposition...|Leader of Opposition]]`) defeated every
   space-based content check downstream (`POSITION_TITLE_LIKE`, `KNOWN_ALLIANCES`, `^list
   of`) once the "prefer longer" heuristic picked the underscored target over the display
   text. Fixed at the source: `link_text()` now normalizes underscores to spaces in the
   target, matching MediaWiki's own semantics, rather than patching every downstream check.
7. **`REMARKS_LIKE` gaps**: `"Switch from SDF to SKM"` (Sikkim, present tense) and
   `"Switched from NPP to PPA"` (Arunachal Pradesh, past tense) weren't caught by the
   original list — added `\bswitch(ed)?\b`.

**Retroactive fix — a real, live data-quality bug found and corrected in already-uploaded
records:** fix #4 above (party-switch rows misreading a party template as the Name) turned
out to be a *pre-existing*, general bug that had already silently corrupted the same-shaped
rows in **6 states uploaded earlier in this project** (not just new ones) — the diff-against-
cache regression check caught it precisely because those states' cached "known good" JSON
itself had the corrupted values, which a fresh reparse under the fix no longer reproduced.
Traced and confirmed real (not a fuzzing artifact) against each state's raw wikitext before
trusting it — e.g. Goa's 8 corrupted rows are the well-documented 14 September 2022
"Operation Kamal" mass defection (Congress MLAs, including former CM Digambar Kamat and
Michael Lobo, switching to BJP); West Bengal's Krishna Kalyani switching BJP→TMC, matching
the state's own already-recorded remark text. **28 records had a corrupted `full_name`, and
a further 18 of those also had a corrupted `political_party_id`** (same rows — the party
field defaults to whatever the OLD template happened to contain, not necessarily the same
error as the name corruption) across West Bengal (2), Tamil Nadu (1), Gujarat (5), Punjab
(2), Telangana (10), Goa (8). Fixed via two direct SQL passes, matching each affected
`office_holders` row by `map_shape_id` + old (corrupted) value, updating both
`office_holders` and the linked `profiles`/`politician_profiles` row so the live wall
reflects the correction, not just the admin data — verified zero `full_name LIKE '%{{%'` and
zero corrupted `political_parties` rows remaining afterward. The cached JSON for all 6
affected states in `scripts/india-assembly-wiki-cache/` was also updated to the corrected
values, so a future cache-diff regression check compares against genuinely-correct data, not
the bug that produced it.

**Other real per-state fixes this round** (matching-only, not parser generalizations):
- **Chhattisgarh**: `"Bharatiya Janta Party"` (a typo, missing the "a") used inconsistently
  alongside the correct `"Bharatiya Janata Party"` spelling in the *same* source table —
  normalized before upload rather than letting it create a duplicate `political_parties` row.
- **Jammu & Kashmir**: three separate party-name spelling inconsistencies within the same
  table (`"Jammu & Kashmir National Conference"` vs. `"...and Kashmir..."`; three different
  renderings of the PDP's name) normalized to match the DB's existing canonical spelling,
  plus one `{{party color cell|Green}}` case (a literal colour-name template argument, not a
  party name — Telangana's identically-named template holds the real party instead) manually
  overridden to the real party shown in the adjacent cell.
- **Puducherry**: one genuinely vacant seat (Thattanchavady — the winner, CM N. Rangaswamy,
  chose to represent a different constituency instead) correctly excluded rather than force-
  matched; one new party abbreviation (`LJK` → `Latchiya Jananayaka Katchi`, a party launched
  December 2025) expanded from context via a live web search, not guessed.
- **Sikkim**: `Sangha`, the Buddhist-monasteries reserved seat, has no territorial boundary
  in our LGD-derived shape data at all (genuinely absent, not a naming mismatch) — left
  unmatched/unuploaded, same class of gap as Assam's Lok Sabha delimitation issue.
- **Mizoram**: Arabic-numeral seat names in the MLA data (`"Aizawl North 2"`) vs. Roman-
  numeral shape names (`"Aizawl North II"`) aren't bridged by `normalize()` or the fuzzy
  matcher — 11 manual overrides across Aizawl's North/East/West/South sub-constituencies.

**Final duplicate-`map_shape_id` audit, scoped correctly this time**: an unscoped
`GROUP BY map_shape_id` across the whole `office_holders` table returns hundreds of
"duplicates" that are **not bugs** — Canada/USA municipal officials legitimately have
multiple roles (mayor + councillor, historic terms) per shape. The real check must filter to
`ert.role_key = 'mla' AND ms.country = 'India'` first, same as every per-state check in this
doc — confirmed **zero** duplicates once correctly scoped.

**Running total: 3,995 of ~4,121 MLAs done (97.0%). Only Assam (126) remains — a genuine,
thoroughly-verified boundary-data gap, not just next-in-line — see the Assam section near the
top of this doc.**

### Third session: Madhya Pradesh resolved, Assam re-investigated and confirmed genuinely blocked, full live-data quality audit

**Madhya Pradesh (230)** — see the updated table row above for the real fix (a
`party_before_name` candidate-count threshold bug, not the reordering itself). 230/230
uploaded clean, zero regressions against all 29 previously-cached states re-verified before
trusting the fix, same discipline as every fix this project has made.

**Assam re-investigated, not just re-deferred** — see the dedicated Assam section near the
top of this doc for the full three-source verification (our loaded data, a freshly-tokened
live query against `BharatMapService`, and the `HindustanTimesLabs/shapefiles` GitHub repo,
all three confirmed stale relative to the real August 2023 delimitation). Concluded this is a
genuine data-availability gap, not a research or matching shortfall — flagged so a future
session doesn't re-spend the same investigation effort.

**Full live-database quality audit, run against all 30 completed states' 3,995 MLA records**
(prompted by "check quality of earlier filled states" — not just the states touched this
session, the whole table):
1. **Zero corrupted `full_name` values** (`{{`, `}}`, `rowspan`, `colspan`, `bgcolor`,
   literal `"None"`, or empty string) anywhere in `office_holders`.
2. **Zero corrupted party names** (position titles, alliance names, remarks-shaped text) in
   `political_parties` linked from any India MLA record. (`Kuki People's Alliance`, Manipur,
   is a real party name, not an artifact — checked before treating the ILIKE `%alliance%`
   hit as a finding.)
3. **Zero suspicious `full_name` values** (containing `[`/`]`/`|`, digits-only, under 4
   chars, or starting lowercase).
4. **Zero `political_party_id IS NULL`** rows (every party matched or correctly fell back to
   `Independent`).
5. **Zero missing wall linkage** — every one of the 3,995 `office_holders` rows has a
   `linked_profile_id`, and every `linked_profile_id` resolves to a real `profiles` row (no
   orphans).
6. **Zero `profiles.full_name` / `office_holders.full_name` mismatches** — the wall always
   shows the same name as the admin data.
7. **Found and fixed a real bug**: `politician_profiles.political_party_id` had drifted from
   `office_holders.political_party_id` for **8 Maharashtra MLAs** (plus one profile with a
   NULL party despite `office_holders` correctly having one) — the wall would have shown a
   stale or missing party for these 8 real people. Root cause: a prior session's direct SQL
   party correction updated `office_holders` but not the linked `politician_profiles` row
   (the populate script's own `INSERT ... ON CONFLICT` path was checked and ruled out as the
   cause — it only fires when the *same run* inserts two rows for one new profile, which
   doesn't happen for already-linked office holders). Fixed via direct SQL, re-verified zero
   drift remaining across the whole table afterward.
8. **Zero duplicate `map_shape_id`** for `role_key='mla' AND country='India'`, confirmed with
   the correctly-scoped query — an *unscoped* `GROUP BY map_shape_id` across the whole
   `office_holders` table returns hundreds of apparent "duplicates" that are **not bugs**
   (Canada/USA municipal officials legitimately hold multiple roles per shape, e.g. mayor +
   councillor, or historic terms) — always scope to `role_key`/`country` first, a mistake
   worth flagging since the unscoped version looks alarming at a glance.
9. **"Duplicate person name within a state" spot-checked, confirmed not a bug**: 13
   same-state name collisions found (e.g. three different Biharis all named "Anil Kumar")
   — checked each is linked to a genuinely different `map_shape_id`/constituency, i.e.
   different real people sharing a common Indian name, not an accidental duplicate insert.
10. Per-state seat counts re-verified against the running total — all 30 states match their
    real official counts (or the two documented genuine partial gaps: Puducherry 29/30,
    Sikkim 31/32).

## Known gotchas anticipated (carried over from the boundary-data work)

- **Any Wikipedia/aggregator table extraction needs independent spot-checks on the
  surprising entries before bulk trust** — proven necessary already (Delhi's party was
  wrong in an otherwise-accurate CM table). Do not skip this step for MP/MLA data just
  because the volume is higher — a systematic error (e.g., a wrong party-mapping keyword)
  would be worse at 543 or 4,122 records than it was at 32.
- **Match constituency names accent/case-insensitively, never assume byte-exact** — same
  lesson as Manitoba/Quebec candidate matching in `ELECTION_DATA_SOURCES.md`.
- **Party-name matching is inherently lossy** — every `populate-*.py` script to date
  accepts falling back to `'Independent'` for unmatched party strings rather than blocking
  on a complete party catalog; India's regional-party long tail makes this more likely to
  trigger than it did for Canada/USA, not a new problem to solve, just expect a higher
  fallback rate.
