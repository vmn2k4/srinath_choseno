# Adding India politicians (PM / CM / MP / MLA) — progress log

**Status: PM + all 31 Chief Ministers (32/32) AND 536 of 543 Lok Sabha MPs done, uploaded,
and verified live — all with linked Ghost Profile politician walls, 0 unmatched parties.
Vidhan Sabha (~4,122 MLAs): not yet started — see the dedicated section below.**

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

**Running total: 985 of ~4,122 MLAs done (23.9%).**

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

### Recommended next states (by size, for fastest coverage growth)

West Bengal (294), Bihar (243), Tamil Nadu (234), Madhya Pradesh (230), Karnataka (224),
Rajasthan (200) — continuing in this order. Each new state gets: fetch raw wikitext →
verify page-naming/table-structure against what the parser already handles → parse →
validate counts/no-regressions → match to `map_shapes` → run
`populate-india-vidhan-sabha-mlas.py`.

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
