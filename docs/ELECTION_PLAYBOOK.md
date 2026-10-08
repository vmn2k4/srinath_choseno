# Election Launch Playbook

The repeatable six-step sequence we ran for **BC 2026** (municipal general local election 2026-10-17, plus the snap provincial election 2026-10-24). Use it for the next jurisdiction (another province, a US state, an Indian state assembly). Each step lists what we did, the files that did it, and what we'd do differently.

Read alongside: [ELECTION_DATA_SOURCES.md](ELECTION_DATA_SOURCES.md) (per-jurisdiction source research), [CANDIDATE_DATA_PULL_LOG.md](CANDIDATE_DATA_PULL_LOG.md) (dated pull history and bugs), [VIRTUAL_INTERVIEW_SYSTEM.md](VIRTUAL_INTERVIEW_SYSTEM.md), [VOTING_PLACES.md](VOTING_PLACES.md), [adding-boundary-data.md](adding-boundary-data.md).

## Timeline template (T = election day)

| When | Step |
|---|---|
| T-8 weeks or earlier | 0. Boundaries exist in `map_shapes`. 1. Election + seats created. 2. First candidate pull. |
| T-6 to T-3 weeks | 2. Re-pull candidates as nominations roll in. 4. Questionnaire seeded; outreach starts. |
| T-4 to T-2 weeks | 3. Leader/party/issue articles. 5. Share and support features live. |
| T-3 to T-1 weeks | 6. Voting places loaded (cities publish late). Re-verify hours. |
| T-0 | Freeze candidate edits; keep results sync ready ([sync-*-election-results.py](../scripts)). |

Step 0 prerequisite: the jurisdiction's districts or wards must already be in `map_shapes` (see [adding-boundary-data.md](adding-boundary-data.md)). Everything below keys off `map_shape_id`.

---

## 1. Find the election dates

**What we did.** Took dates from the regulator, not news coverage.
- Municipal: Elections BC fixed-date law, general local election 2026-10-17. Nomination window 2026-05-01 to 2026-09-11, advance voting dates set per city.
- Provincial: Premier called a snap election on 2026-09-22 for 2026-10-24. Nominations closed 2026-10-03.

**Where it lives.** One `elections` row per election with `election_date`, `nomination_open_date`, `nomination_close_date`, `status`, plus one `election_seats` row per `map_shape` and role.
- Municipal rows: created per jurisdiction and role (Mayor, Councillor, School Trustee). See [ELECTION_DATA_SOURCES.md](ELECTION_DATA_SOURCES.md) "Municipal — Canada".
- Provincial: [scripts/create_bc_provincial_election.py](../scripts/create_bc_provincial_election.py). It is idempotent (existence-checked by name, seats upserted on `(election_id, map_shape_id, role_title)`), and scopes seats through `shape_containers` so it does not pick up other provinces' ridings.
- Voting-place dates are separate: `voting_place_schedules` rows per place per day (see step 6). They differ from the election date because of advance voting.

**Lessons.**
- Fixed-date jurisdictions let you guess the regulator's URL slug in advance. Re-run discovery until it resolves.
- Snap elections shrink every window. Seed seats the same day the writ drops.
- Surface the date everywhere: race cards got a countdown and a stronger date line (commit `89c6cec`).

## 2. Find the candidates for each constituency

**What we did.** Layered sources, authoritative last, and re-ran as nominations arrived.

Municipal (mayor, councillor, school trustee):
1. **Elections BC LECFA PDF** (`elections.bc.ca/docs/lecfa/Registered-Candidates-LEGE-2026-10-17.pdf`). Province-wide, one file, but it lags real filings because it lists financial-agent registrations.
2. **City's own nomination pages**. For large cities these run ahead of LECFA. Fetch every race-type page (Mayor, Councillor, School Trustee, Park Board), not only the first. Pages also carry bio, phone, email, party and photo.
3. **CivicInfo BC / localelections.ca**. Became the primary source (about 2x LECFA's count). Script: [sync_bc_civicinfo_candidates.py](../scripts/sync_bc_civicinfo_candidates.py).
4. Dated one-off scripts in [scripts/us_house_primary_fixes/](../scripts/us_house_primary_fixes) (`bc_refresh_sept*.py`, `bc_official_pages_supplement.py`, `bc_sept9_*`).

Provincial (MLA):
1. **Elections BC candidate list** ([sync_bc_candidates.py](../scripts/sync_bc_candidates.py)). Authoritative but only lists accepted nominations.
2. **BCPoliTracker aggregator** ([sync_bc_provincial_bcpolitracker.py](../scripts/sync_bc_provincial_bcpolitracker.py)). Ahead of Elections BC by days. Spot-checked 10 of 10 against independent sources first.
3. **Candidate spreadsheet with a "withdrawn" sheet** ([apply_bc_2026_candidates_sheet.py](../scripts/apply_bc_2026_candidates_sheet.py)). Dry run by default, `--apply` to write.
4. **Party-site bios and socials** (bcndp.ca, conservativebc.ca, 1bc.ca) written into `politician_profiles.bio`. Log entry: CANDIDATE_DATA_PULL_LOG.md "2026-09-29".

**Profile creation rules (each one was learned the hard way).**
- Match every new name against existing `office_holders` and profiles before inserting. A systemic duplicate-profile bug hit sitting councillors (Rob Stutt in Surrey). Dedup per city, even when a province-wide pass already ran.
- Set `wall_slug` on every inserted `politician_profiles` row, or `/wall/<slug>` 404s.
- Fill bio, phone, email, party, `source_url`, **and photo in one pass** (`avatar_url` is what the seat page renders; set `photo_url` too). Use `COALESCE(new, existing)` so you never overwrite a better value. Splitting this across passes caused two separate "you missed something" corrections.
- Decode Cloudflare-obfuscated emails (`data-cfemail` XOR) when fetching without a browser.
- Never delete a candidate because they are absent from one source. Treat absence as a lead and confirm. Withdrawals need a named source.
- Third-party aggregators (VoteMate) were wrong on party labels and candidate counts. Use as a lead list only.
- Log counts per pass in CANDIDATE_DATA_PULL_LOG.md. Final municipal count reached 450 verified candidates across the three BC elections by 2026-09-09.

**Exports for outreach.** [bc_municipal_candidates_2026.csv](../scripts/bc_municipal_candidates_2026.csv) and [bc_provincial_candidates_2026.csv](../scripts/bc_provincial_candidates_2026.csv) carry name, role, area, party, contact and the candidate's Choseno page URL.

## 3. Create articles on where party leaders stand (and individuals where possible)

**What we did.** A research-article set with a hub, linked from election and party pages.
- **Hub explainer**: `bc-provincial-snap-election-2026-informed-vote` with a key-dates block and the find-your-district tool.
- **Where each party stands**: [bc-election-2026-party-standings.json](../scripts/bc-election-2026-party-standings.json).
- **Leader pairs** ("why people support" / "why people oppose"), one pair per leader: Eby and Doerkson done. Built by [build-bc-2026-leader-articles.py](../scripts/build-bc-2026-leader-articles.py), which writes the JSON source of truth and, with `--sql`, inserts **draft** rows into `news_articles` with politician tags and polls.
- **Wiring**: [src/lib/constants/electionResearch.ts](../src/lib/constants/electionResearch.ts) maps slugs to titles and blurbs and to party ids; `ElectionResearchLinks` renders them on the election hub, party pages and the explainer; sitemap priority raised.

**Method and guardrails.**
- Source: public Reddit, X and YouTube commentary, aggregated, no handles named. Each article carries a "How we gathered this" box saying it is qualitative, not a poll, and that online commenters skew louder and more partisan.
- Fact-check pass before publishing (commits `bc54231`, `dc990ba`): corrected tax details, added the subject's response, removed unverified claims, showed cited sources in the body.
- Articles go in as drafts, get checked, then publish.
- Individuals: do leaders first. For individual candidates, only the notable ones (incumbents, party leaders, high-profile independents). The general per-candidate content is the profile, bio and interview, not an article. The per-person "Generate News Article" flow exists for this; see the news-event-geo memory and [NEWS_GENERATION_GUIDE.md](NEWS_GENERATION_GUIDE.md).

**To repeat.** Copy the build script, swap leader ids, slugs and sources; add the pair to `electionResearch.ts`; add party ids to the party map.

## 4. Get interviews using a standard set of questions

**What we did.** Reused the existing questionnaire and video-interview system rather than building anything new.
- **Standard questions**: `election_questions` and `election_question_options`, seeded per election. Provincial seeding: [add_bc_provincial_questions.py](../scripts/add_bc_provincial_questions.py). Idempotent (skips identical `question_text`), `--dry-run` rolls back. Not required, because a 3-week window cannot afford a hard gate. `allow_video` on, 30-second cap.
- **Question mix** (11 for MLAs): one open credentials question, then a spread of forced-choice issue questions (housing, DRIPA, health care, treatment, pipelines) and open-text accountability questions (what would you cut, which local issue would you break ranks on). The same questions go to every candidate in the race so voters can compare side by side. Hold the question set constant across all seats of one election.
- A downloadable questionnaire also exists: [candidate-outreach/Choseno_MLA_Candidate_Questionnaire.pdf](candidate-outreach/Choseno_MLA_Candidate_Questionnaire.pdf).
- **Candidate access**: claim invite email, `/claim/[token]`, then `/apply` ([POLITICIAN_INVITES_GUIDE.md](POLITICIAN_INVITES_GUIDE.md)). No account needed beforehand.
- **Video**: candidates record answers; they become wall posts (`answer_pitch`). Voters get a swipeable cross-candidate carousel and a "play all" reel ([VIRTUAL_INTERVIEW_SYSTEM.md](VIRTUAL_INTERVIEW_SYSTEM.md)). Question videos are generated by the HyperFrames template.
- **Outreach channels**: email campaigns ([CAMPAIGN_EMAIL_TEMPLATES.md](CAMPAIGN_EMAIL_TEMPLATES.md), including the "Civic Parties" and "New Candidate Nominees" presets) and AI-voice calls ([CANDIDATE_OUTREACH_CALLING.md](CANDIDATE_OUTREACH_CALLING.md), [CALL_AGENT_SCRIPT.md](CALL_AGENT_SCRIPT.md)). Calls are recorded and need the disclosure line. Status of the calling system was "built, not yet live" when last documented, so confirm before relying on it.
- Outreach lists: `bc-municipal-outreach.csv`, `bc-mayors-with-email.csv`, `bc-councillors-with-email.csv`, `bc-civic-parties-contacts.csv`, plus the missing-email variants.

**Lesson.** Interview uptake depends on contact data from step 2. Pull emails and phones with the candidate list, not afterward.

## 5. Encourage people to share and support candidates

**What we did.**
- **Support button** on every candidate in race results (shared hook, commit `38ffadd`) and in Community Support rows.
- **Share my picks**: a voter picks one candidate per race and gets a `/p/[code]` page plus a generated OG card (commits `b2bfb10`, `9e6eeae`, `fd20729`, `2a7a7fa`).
  - Tables: `race_pick_shares`, `race_pick_share_picks`, `race_pick_share_reports`, `race_pick_share_rate_limits` (migrations `20261008000000` to `…04`).
  - OG image is rendered once and stored in Supabase Storage, not re-rendered per crawl. Per-candidate notes and quotes appear on the card.
  - Share-sheet icons, WhatsApp preview in the dialog; long-form X options are admin-only.
  - Admin "Pick Shares" analytics card: links generated, signed-in vs logged-out, top races.
- **Race share button** and a **Share my picks** call to action on the race page.
- **Find-my-district banner** (auto-locate, then approximate fallback) on seat pages, candidate pages and politician walls, with click and support tracking after a district is found. This is the entry point that turns a visitor into a supporter.
- **Per-party election pages** with support button and bio hover, so party-affiliated sharing has a landing page.
- **Funnel attribution**: signup source tracking (first touch, click trigger, page trail) with an admin report (commit `b9ec9d6`).

**Guardrails.**
- Never request GPS on page load. Only on an explicit button or a location the visitor already shared.
- OG routes get hammered by crawlers. Cache aggressively (ISR revalidate 7 days) and avoid `auth.uid()` work on public reads. Serve stored images.
- Watch real-user analytics only (exclude admin, test, news bot, imported profiles).

## 6. Find polling booths and the dates

**What we did.** Built a dedicated schema and loader because no province-wide dataset exists; each local government publishes its own. Full detail in [VOTING_PLACES.md](VOTING_PLACES.md).
- Tables `voting_places` (tagged by `election_name` and `election_date`, keyed to `map_shape_id`) and `voting_place_schedules` (one row per place per day: `advance` | `general` | `special`, with open and close times). Migration `20261008000005_voting_places.sql`. Public read, writes via service role.
- Data per municipality in `scripts/voting_places/data_*.py` using `helpers.build` and `save`; each record stores its `source_url`. Loader `load_voting_places.py` geocodes via Nominatim, accepts a hit only within 60 km of the municipality centroid, replaces that municipality's rows, applies with `supabase db query --linked`.
- UI: `VotingPlacesSection` under the candidate list on `/elections/seat/[seatId]`, via `getVotingPlacesForShape`. Nearest-first with "Find closest to me", past days hidden in the local time zone, renders nothing when a city has no rows.
- Coverage at 2026-10-08: about 58 of 160 BC municipalities, including all the large cities. Remaining names are in `scripts/voting_places/missing.txt`.

**How to add a municipality.** Open its official election page (`<site>/election` often works; Kelowna, Vancouver and North Vancouver need the browser pane for JS). Record every location, address, and the advance and general-day hours. Add a `data_*.py`, run the loader.

**Rules.**
- Never invent an address. Leave it null and let the geocoder use the name.
- Do not run two loaders at once on the same files.
- Small towns publish late and some pages move. Re-check `source_url` close to the election, since locations and hours change.
- Some cities assign the election-day place by home address (Richmond). Show advance sites only and say so.

---

## Reusable checklist for the next jurisdiction

1. [ ] Boundaries in `map_shapes`; role types in `election_role_types`.
2. [ ] Regulator's dates recorded; `elections` and `election_seats` created (idempotent script).
3. [ ] Candidate sources ranked: regulator list, local pages, aggregator. Dry-run diff script for each.
4. [ ] Dedup against office holders; `wall_slug`, photo and bio set in the same pass.
5. [ ] Questionnaire seeded (same questions for every seat), non-required, video on.
6. [ ] Outreach CSVs exported; claim-invite emails sent in waves.
7. [ ] Hub explainer, party-stance article and leader pairs drafted, fact-checked, linked via `electionResearch.ts`.
8. [ ] Support and Share-my-picks live for the new election; OG images stored; analytics card checked.
9. [ ] Voting places loaded for the biggest cities first, then by population; `missing.txt` kept current.
10. [ ] Final sweep at T-3 days: new candidates, withdrawals, hours, then freeze.

## Known gaps after BC 2026

- Voting places cover about a third of BC municipalities.
- No automated "new nominations" watcher. Candidate pulls were manual and dated.
- Leader articles cover Eby and Doerkson only. Green, OneBC and CentreBC leaders are open.
- Calling system was built but not confirmed live.
- Individual-candidate articles exist only through the per-person generator, not as a campaign.
