# Choseno Master News Collection, Verification & Ingestion Directive


> [!IMPORTANT]
> **MANDATORY ZERO-HALLUCINATION & FACTUAL INTEGRITY RULES**:
> 1. **Machine-Extracted Ground Truth**: Ingest solely from verified machine RSS wire feeds. Never type or fabricate source URLs.
> 2. **Current Canadian Leadership Roster**:
>    - Prime Minister of Canada: **Mark Carney** (`mark-carney`)
>    - ⚠️ **STRICT BAN**: In Canada, there is **NO Deputy Prime Minister** under Mark Carney's administration. NEVER mention or fabricate a "Deputy Prime Minister".
>    - Leader of the Official Opposition: **Pierre Poilievre** (`pierre-poilievre`)
> 3. **Quote Gatekeeper**: Verbatim quotes are permitted ONLY if present in source text (Tier-1). Tier-2 outlets must be paraphrased in reported speech with attribution.
> 4. **Strict US & Canada Only**: Only cover US & Canada governance (Federal, State/Provincial, Municipal).

---

## 0. THE SHAPE OF THE SYSTEM — ONE ENGINE, A PERSISTENT QUEUE, TWO SYNTHESIS MODES

> [!IMPORTANT]
> **There is a single content engine: [`scripts/rss-verified-pipeline.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/rss-verified-pipeline.js), backed by a persistent candidate queue the script alone owns.** The one real architectural principle here: **the script decides which candidates exist and which of them have been published; nothing else — not a cron flavor, not an agent — gets to make that call.**

### Two synthesis modes, one script

```bash
# Default (collect-only) — discovers/filters/dedupes, writes the candidate
# queue, and STOPS. This is the mode for Antigravity-driven synthesis.
node scripts/rss-verified-pipeline.js

# Full API-driven run — same discovery, then also calls the Gemini API
# directly for every queued candidate and ingests the result.
node scripts/rss-verified-pipeline.js --use-api-key

# Explicit lookback override (rare — see auto-window below for why you
# normally don't need this):
node scripts/rss-verified-pipeline.js --max-hours 6
```

`collectOnly` is the default specifically because `--use-api-key` costs real Gemini quota per candidate, and Antigravity-driven synthesis is free within its own plan — **cost, not capability, is why the split exists.** Both modes share 100% of discovery, filtering, dedup, and queue logic; only what happens *after* the queue is written differs.

### Antigravity's role is bounded, and now enforced, not just requested

> [!IMPORTANT]
> **Antigravity's ONLY job is synthesizing prose for candidates the script already selected. It does not decide which candidates exist, which are duplicates, which are in-jurisdiction, or which get published.** All of that is 100% script-owned, upstream of anything Antigravity ever sees:
>
> 1. Run `node scripts/rss-verified-pipeline.js` (collect-only/default). It writes/merges [`scripts/latest-verified-rss-candidates.json`](file:///Users/vmn2k4/Coding/Choseno/scripts/latest-verified-rss-candidates.json) — the **persistent candidate queue** (see §3a).
> 2. Read that file. For every candidate in it, search the internet for verified detail and write a full article (§4-6 below) into [`scripts/bulk-news-batch.json`](file:///Users/vmn2k4/Coding/Choseno/scripts/bulk-news-batch.json). Synthesize as many as your own budget allows in one pass — you do not have to finish the whole queue in one run.
> 3. Run `node scripts/insert-news-batch.js` to ingest.
>
> **What used to be a trust problem is now a structural one.** A prior version of this workflow let an agent silently synthesize 4 of 225 queued candidates and report it as a clean "0 skipped" success — the queue file was overwritten every run, so anything not processed simply vanished, which meant *Antigravity's inaction was the de facto publish decision*. Fixed two ways, both script-side:
> - **The queue is now persistent** (`mergeCandidatesIntoQueue`, lives in `rss-feed-collector.js`): whatever you don't get to this run stays queued for next time. It only leaves the queue two ways — confirmed published, or aged out past 48h unsynthesized (an objective, script-checked rule, not a judgment call). You genuinely cannot make a candidate disappear by ignoring it.
> - **`insert-news-batch.js` reconciles coverage on every ingest** (§7): it names every candidate from the queue that isn't in your batch, warns loudly if coverage is under 50%, and still publishes whatever you did produce — no reason to withhold real, verified articles just because the rest of the queue wasn't gotten to yet.

### Auto-window: no manual lookback math

`--max-hours` is almost never needed. Omit it and [`scripts/get-last-publish-window.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/get-last-publish-window.js) computes the lookback from time-since-last-published, with a floor of **24 hours** and a 1-hour overlap buffer — wide enough that the 116-feed registry (below) is always fully re-scanned, never so narrow that a missed run or a slow news morning loses coverage. (This floor was raised from a tighter "just the actual gap" design specifically because the persistent queue now absorbs the redundancy safely — scanning wide and then deduping against the queue/DB is cheap; missing a candidate because the window was too tight is not.) Falls back to 24h if the lookup itself errors.

### What's inside the discovery step

[`scripts/rss-feed-collector.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/rss-feed-collector.js) is 100% deterministic code — no LLM anywhere in it:
- **116 feeds**: 6 national wires, ~31 named key-leader queries (role + name, split federal/state-provincial pools — see §2), one feed per US state (10 highest-volume states split into municipal-only + state-only feeds), one feed per Canadian province/territory (territories paired with their capital city — see §1). Pooled and interleaved national:local at a fixed 1:2 ratio so national wires structurally cannot crowd out local coverage.
- **Jurisdiction & relevance filtering** (§1a) — sports/entertainment, viral/human-interest framing, and foreign-primary-subject stories are hard-rejected; only candidates about a real accountable individual survive.
- **Dedup against the published DB** (time-windowed, ordered by recency) and **against siblings collected in the same run** (syndication across outlets).
- **HTTP Status Gatekeeper** — 404/410/root landing pages rejected; 401/403 allowlisted paywalls accepted as Tier-2; thin/failed body extraction downgrades to Tier-2 rather than falsely claiming verbatim-quote-grade source text (§1b).
- Pulls same-window **trending topics** ([`scripts/fetch-trending-topics.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/fetch-trending-topics.js)) and prioritizes matching candidates so nothing genuinely trending gets buried.

**The one thing this can't do**: a story with zero RSS/Google News footprint at all — a raw court docket, a hyper-local outlet with no feed. See §7 for how that's handled without reopening the "agent decides what's published" problem.

---

### 1. WHAT THE PIPELINE COVERS

Governance-tier concerns are covered by feed design, not by agent judgment call each run:

1. **Wire & Civic Discovery** — national wires (The Hill, Politico, CBC, Globe and Mail, Global News, Google News US Politics) via `NATIONAL_FEEDS` in `rss-feed-collector.js`.
2. **~31 Key Political Leaders** — one Google News feed per leader, by name (see roster in §2), split into federal (pooled as "national") vs. state/premier (pooled as "local") so this can't quietly re-inflate the Trump/national skew the per-region feeds below were built to fix. Query pattern is `"Full Name" (announcement OR bill OR policy OR "executive order" OR statement OR legislation) when:24h` — exactly 2 term groups (see the query-limit note below on why a 3rd breaks this).
3. **Municipal, State & Provincial Coverage** — one feed per US state and Canadian province/territory, built by role/office terms (governor, mayor, councillor, MLA, MPP, MNA, "county commission", "state legislature") plus the region's name — **never a specific incumbent's name**, so it keeps working across elections. The 10 highest-volume US states (CA, TX, NY, FL, PA, IL, OH, GA, NC, MI) get **two** feeds each — municipal-only terms and state-level-only terms — since one combined query undersamples both sides of their volume. The 3 Canadian territories (Yukon, NWT, Nunavut) are queried by **territory name OR capital city** (Whitehorse, Yellowknife, Iqaluit) since the territory name alone barely indexes on its own. Two curated catch-all feeds (US and Canada) supplement this with decision-oriented terms (budget, zoning, referendum, "voted to", bylaw).

A dedicated opposition/caucus-politics feed exists for exactly the gap a premier-name-locked query can't catch: a story about the *opposition* losing MLAs to defection, not the sitting government.

> [!NOTE]
> If you're extending feed coverage, keep queries to **at most 2 top-level
> term groups** (one bracketed OR-group + one quoted phrase, or two
> bracketed groups — never three). Verified by hand: a 3rd clause silently
> makes Google News RSS stop honoring the quoted region/leader name and
> every feed collapses to the same generic top result regardless of region.
> An OR'd alias group inside one bracket (e.g. `("Yukon" OR "Whitehorse")`)
> still counts as one group and is safe.

#### 1a. Jurisdiction & relevance filtering (`isStrictlyUsOrCanada` + `mentionsOfficeholderOrKnownPolitician`)

Every candidate must clear both of these before it's even considered for HTTP verification:

- **Sports/entertainment** (`SPORTS_ENTERTAINMENT_REGEX`) — hard-rejected. Includes generic sports-roundup language (roundup, snaps skid, matinee, "Saturday slate", varsity, high school football) specifically because several US high schools are named after colonial governors (Governor Livingston HS, Governor Mifflin) and a bare office-title match can't otherwise tell a football score from an actual governor.
- **Human-interest/viral framing** (`VIRAL_ENTERTAINMENT_REGEX`) — hard-rejected even when a real office holder is named. Catches "goes viral", "fans react hilariously", wedding/engagement announcements ("ties the knot", "best wishes"), and "legacy obituary" (added after a private citizen's obituary matched on a shared surname with a sitting governor).
- **Foreign outlets** (`FOREIGN_OUTLET_REGEX`) — hard-rejected (Al Jazeera, NDTV, France 24, and similar non-US/CA press).
- **Foreign-primary-subject stories** (`NON_US_CA_DOMESTIC_REGEX` + `US_CA_EXECUTIVE_KEYWORDS`) — a story that mentions a foreign country/leader is only allowed through if a genuine US/CA signal appears in the **first half of the headline** (a proxy for "primary subject"), not just anywhere in the text. `US_CA_EXECUTIVE_KEYWORDS` deliberately **excludes bare office titles** (governor, premier, mayor, senator...) — Mexico, Nigeria, and plenty of other countries also call their subnational leaders "governor," so a bare title proves nothing about jurisdiction. Only a named US/CA individual, an unambiguous institution (White House, Congress, PMO), or a specific place name (a state/province/city) counts. (Concrete case this fixed: "...expose logic of Sheinbaum's endless concessions to Trump" — a story about Mexican politics that only name-drops Trump in its last clause — is correctly rejected even though "Trump" appears in the text.)
- **Office-holder/relevance filter** (`mentionsOfficeholderOrKnownPolitician`) — only kept if it names an office-holder title, one of the ~31 curated key leaders, or a capitalized name-phrase matching a real Choseno politician profile (`profiles` table, `role = 'politician'`, paginated — tens of thousands of rows). This runs before HTTP verification and synthesis, cutting cost on candidates that would fail politician-tagging anyway.

#### 1b. Tier assignment (`verifyAndFetchUrl`)

- **200 + >200 chars of extracted body text** → Tier-1 (verbatim quotes allowed, verified against the extracted text).
- **200 + ≤200 chars extracted** (JS-rendered page, non-standard `.gov` markup, etc.) → **Tier-2**, regardless of allowlist status. This was previously a bug: a thin/failed extraction on a non-allowlisted domain fell through to Tier-1 anyway, meaning Gemini was told "verbatim quotes OK" against source text that was really just the headline repeated — and it filled the gap with plausible-sounding invented quotes. Fixed: thin extraction always downgrades to Tier-2 (paraphrase-only, no verbatim-quote claim).
- **401/403 on an allowlisted paywall domain** (WSJ, Reuters, Bloomberg, NYT, etc.) → Tier-2.
- **401/403 on a non-allowlisted domain, 404/410/500+, bare root/category landing page, malformed URL** → rejected outright.

---

### 2. KEY LEADERS ROSTER (baked into `rss-feed-collector.js`)

> [!IMPORTANT]
> **MANDATORY POLITICIAN TAGGING & PROFILE RESOLUTION RULES:**
> 1. **Auto-Resolution against `profiles` table**: Ingestion scripts MUST query the `profiles` table using `role = 'politician'` and `full_name.ilike.*[Name]*` (do NOT query `politician_slug` on `profiles`, as `profiles` only contains `id`, `full_name`, `designation`, `constituency`, `role`).
> 2. **Dual-Property Requirement**: Every article referencing a politician must include BOTH:
>    - `taggedPoliticians`: `["Full Name"]` (e.g. `["David Eby"]`, `["Doug Ford"]`, `["Mark Carney"]`).
>    - `taggedPoliticianIds`: `["uuid"]` (populated directly from the table below or dynamically resolved before insert).
> 3. **Automatic Wall Mirroring**: The ingestion engine will execute `admin_sync_news_article_tags()` for each resolved `taggedPoliticianIds` to ensure live ratings, politician cards, and wall mirrors (`/wall/[slug]`) are instantly linked under the article.

#### 🇺🇸 United States
| Official | Position | Database Profile ID (`taggedPoliticianIds`) | Wall Slug |
| :--- | :--- | :--- | :--- |
| **Donald Trump** | President of the United States | *(Pending Seed — use empty array `[]`)* | `donald-trump` |
| **JD Vance** | Vice President of the United States | *(Pending Seed — use empty array `[]`)* | `jd-vance` |
| **Mike Johnson** | Speaker of the U.S. House | `a655066e-0fc6-42d8-9334-8329acb6d80d` | `mike-johnson` |
| **Hakeem Jeffries** | House Democratic / Minority Leader | `0bfc7974-d5a5-4740-bc6f-213d09b5cd90` | `hakeem-jeffries` |
| **Chuck Schumer** | Senate Democratic / Minority Leader | *(Pending Seed — use empty array `[]`)* | `chuck-schumer` |
| **John Thune** | Senate Majority Leader | `225f93a9-1ff0-4ccb-b8db-a4ff0e506873` | `john-thune` |
| **Gavin Newsom** | Governor of California | `400a040b-ee2a-448e-b2e2-1faeea46b718` | `gavin-newsom` |
| **Ron DeSantis** | Governor of Florida | `fc437e5a-1d25-4904-959e-88add7928b50` | `ron-desantis` |
| **Greg Abbott** | Governor of Texas | `82d5f358-a471-4b4d-b052-843ef9934ad3` | `greg-abbott` |
| **JB Pritzker** | Governor of Illinois | `8f5b5344-ef1b-46cb-99bc-5ce45a84bfe9` | `jb-pritzker` |
| **Josh Shapiro** | Governor of Pennsylvania | `b79d61e5-8476-45f0-9eed-a7d6304f6eac` | `josh-shapiro` |
| **Gretchen Whitmer** | Governor of Michigan | `f7575c12-2971-4504-b654-bffde2bbf8d5` | `gretchen-whitmer` |
| **Spencer Cox** | Governor of Utah | `6564d6fb-ceeb-4c6a-b7bf-de269f88275e` | `spencer-cox` |
| **Bernie Sanders** | U.S. Senator for Vermont | *(Pending Seed — use empty array `[]`)* | `bernie-sanders` |
| **Ted Cruz** | U.S. Senator for Texas | *(Pending Seed — use empty array `[]`)* | `ted-cruz` |
| **Elizabeth Warren** | U.S. Senator for Massachusetts | *(Pending Seed — use empty array `[]`)* | `elizabeth-warren` |

#### 🇨🇦 Canada
| Official | Position | Database Profile ID (`taggedPoliticianIds`) | Wall Slug |
| :--- | :--- | :--- | :--- |
| **Mark Carney** | Prime Minister of Canada | `3ec78351-9bec-46b8-afea-45931f29646e` | `mark-carney` |
| **Pierre Poilievre** | Leader of Official Opposition (CPC) | `a0d8ee32-8927-48bc-9a98-fee27dd02d51` | `pierre-poilievre` |
| **Jagmeet Singh** | Leader of the NDP | *(Pending Seed — use empty array `[]`)* | `jagmeet-singh` |
| **Yves-François Blanchet** | Leader of the Bloc Québécois | `2dffb263-e217-4ded-8c2a-26befa6a5a65` | `yves-francois-blanchet` |
| **Chrystia Freeland** | MP for University—Rosedale (⚠️ NO Deputy PM) | `4674a6d5-d9c0-4ec8-95ab-9a12cc27b5fa` | `chrystia-freeland` |
| **Dominic LeBlanc** | Senior Cabinet Minister (Trade) | `885e12f5-33d9-42a1-8dc9-b276069da88d` | `dominic-leblanc` |
| **Mélanie Joly** | Cabinet Minister (Foreign Affairs) | `9d4b37d7-06e7-4df1-b9a5-e068a776ba86` | `melanie-joly` |
| **Doug Ford** | Premier of Ontario | `12ed841a-877b-4c7d-984b-85716b2f2757` | `doug-ford` |
| **François Legault** | Premier of Quebec | `19f76830-8288-487c-8ce7-0d6f64b0bb4a` | `francois-legault` |
| **Danielle Smith** | Premier of Alberta | `7daa1546-4225-4854-9bf7-90797ce5482d` | `danielle-smith` |
| **David Eby** | Premier of British Columbia | `22251c1e-a7b6-4f60-b951-1da7b00c3323` | `david-eby` |
| **Wab Kinew** | Premier of Manitoba | `cf2d272e-ffa7-4918-a94b-182212c41b68` | `wab-kinew` |
| **Tim Houston** | Premier of Nova Scotia | `948faecc-432a-41a7-a3da-b4d12e328b5f` | `tim-houston` |
| **Elizabeth May** | Leader of the Green Party | `50d60646-a942-415e-aea1-94d8293e888c` | `elizabeth-may` |
| **Ravi Kahlon** | Senior B.C. Cabinet Minister | `472949c0-825a-498c-8a8e-33b6d292286e` | `ravi-kahlon` |

To add a leader: add `{ name, country }` to `KEY_LEADERS_FEDERAL` or
`KEY_LEADERS_STATE_PROVINCIAL` in `rss-feed-collector.js` (federal vs.
state/premier decides which pool it's interleaved into), and add their
row here plus their `taggedPoliticianIds` resolution in
`insert-news-batch.js` if not already covered by the dynamic `profiles`
lookup.

---

### 3. DEDUPLICATION — TWO SEPARATE MECHANISMS, DON'T CONFLATE THEM

**(a) Against already-published articles** (`fetchExistingHeadlines` in `rss-feed-collector.js`, `insert-news-batch.js`'s own slug check): prevents re-publishing the same story.
1. **Slug match**: Exact slug match will update (`PATCH`) the existing article.
2. **Canonical source URL match**: Shared source URLs will update rather than duplicate.
3. **Headline token overlap**: ≥45% Jaccard token overlap against recent published headlines (queried with an explicit `ORDER BY published_at DESC` and a time floor — a flat `LIMIT 2000` with no `ORDER BY` isn't "the most recent 2000," it's an arbitrary scan-order slice, which was a real bug: a story published an hour ago could be entirely absent from the sample) is treated as a duplicate and skipped before synthesis even runs. **Within-run syndication dedup** also applies — the same event picked up by multiple outlets/feeds in one collection pass collapses to one candidate before it ever reaches this DB check.

**(b) The persistent candidate queue** (`mergeCandidatesIntoQueue`, in `rss-feed-collector.js`, shared by the collector's own CLI entry point and by `rss-verified-pipeline.js`): this is **not** duplicate-detection — it's queue *retention*. Every collection run merges freshly-discovered candidates (deduped against the queue by `sourceUrl`) into [`scripts/latest-verified-rss-candidates.json`](file:///Users/vmn2k4/Coding/Choseno/scripts/latest-verified-rss-candidates.json) rather than overwriting it. A candidate leaves the queue only two ways:
- `insert-news-batch.js` confirms it made it into a published/skipped batch (matched by source URL) and prunes it out.
- It sits unsynthesized for more than **48 hours** and is dropped as no longer "breaking" — an objective, script-enforced age check, logged by name when it happens.

This is the mechanism that makes "the script decides what's published" actually true rather than aspirational — see §0.

---

### 4. JOURNALISTIC HEADLINE & EDITORIAL INTEGRITY (ANTI-SCALED CONTENT ABUSE)

Google Search Essentials and Google News Publisher Guidelines strictly penalize templated or formulaic writing ("Scaled Content Abuse"). The Gemini synthesis prompt in `rss-verified-pipeline.js` enforces this per-article; it's documented in full here for anyone auditing or extending that prompt — and for Antigravity, since it's writing the same articles by hand and should hold itself to the identical bar.

#### 🚫 STRICTLY BANNED HEADLINE PATTERNS & CRUTCH WORDS:
- ❌ **NO formulaic slots:** `[Name] Advances [Topic] [Initiative/Expansion] for [City]`
- ❌ **NO repetitive announcements:** `[Name] Unveils [Topic] Plan for [City]`
- ❌ **NO crutch verbs:** Banned as primary headline verbs: *"Advances"*, *"Champions"*, *"Spearheads"*, *"Unveils"*, *"Rolls Out"*, *"Pushes for"*, *"Highlights"*.
- ❌ **NO repetitive prepositional tails:** Avoid ending headlines with `"...for [City]"` or `"...for [State]"`. Integrate the location naturally into the subject or action.

#### ✅ MANDATORY HEADLINE DIVERSITY (Rotate across 6 Journalistic Archetypes):
1. **Outcome / Fiscal Impact Lead**: Start with the hard dollar amount, public consequence, or measurable result:
   - *"Henderson Secures $14M Regional Emergency Care Expansion as ER Volume Climbs"*
2. **Institutional & Council Action**: Focus on council votes, agency rulings, or court decisions:
   - *"Bakersfield City Council Restructures Community Patrols in $3.2M Safety Overhaul"*
3. **Conflict, Debate & Oversight**: Highlight legislative debate, committee friction, or audit findings:
   - *"Manhattan Council Hearing Sparks Clash Over Transit Safety and Mental Health Deployments"*
4. **Regulatory & Statutory Specifics**: Cite the bill number, capacity threshold, or standard:
   - *"Alberta Institutes 2% Grid Levy on Data Centers Exceeding 75 Megawatts"*
5. **Direct Quote / Stance**: Highlight a decisive quote or trade stance:
   - *"'Quite Firm': Canadian Negotiators Meet in Final Push to Avert 14% Softwood Lumber Tariffs"*
6. **Electoral & Regional Context**: Emphasize district boundaries, primary stakes, or succession:
   - *"Florida Primary Eve: High-Stakes Race to Decide Gubernatorial and U.S. Senate Succession"*

#### 📐 BATCH DIVERSITY RATIO (aspirational — not yet enforced programmatically across a batch, only per-article):
- **Maximum 20% Name-Led**: At least 8 out of 10 stories in a batch should lead with the city, agency, policy outcome, or bill—NOT the politician's personal name.
- **Zero Shared Verbs**: Every headline in a batch should use a distinct, active verb (e.g. *Secures, Imposes, Restructures, Petitions, Tightens, Enforces, Voids, Clashes*).
- **Varied Ledes**: Never open articles with the formula `"[CITY], [ST] — [Official] on [Day] announced..."`. Lead with the hard numbers, community consequence, or legislative vote first.

#### WRITE LIKE AN EDITOR, NOT A TEMPLATE:

> [!IMPORTANT]
> The body used to render as literal labeled sections ("Dateline Lead" /
> "Policy & Taxpayer Impact" / "The Debate" / ...). Removing the visible
> headers alone still left every article marching through the identical
> four beats in the identical order — a template with the labels hidden is
> still a template. There is now no fixed structure at all: make an
> editorial judgment call on how each specific story should be told, the
> way a real newsroom writes different stories differently (some lead with
> a number, some with a quote, some with the human stakes; some have real
> back-and-forth between sides, some don't have a debate to report and
> shouldn't be given a manufactured one). The only hard rules: one
> continuous narrative, plain paragraphs (`\n\n` for pacing) — never
> markdown headers, never labeled sections, never a checklist answered one
> item at a time.
>
> The things a civic story *can* draw on, entirely at the writer's
> discretion per story — not a mandatory list to complete every time:
> - The concrete event, dateline, key stakeholders, public consequence
> - Hard figures: dollar amounts, percentages, bill numbers, vote tallies, statutory citations, implementation dates
> - Constituent/regional impact: taxpayers, businesses, renters, commuters, specific ridings/districts
> - Accountability angle: hearings, deadlines, committee reviews, opposition response, outstanding questions
>
> Use what this story actually needs. Leave out what it doesn't have.

#### LENGTH: 500-WORD MINIMUM, ENFORCED WITH SEARCH-GROUNDED ENRICHMENT — NEVER PADDING

> [!IMPORTANT]
> The API-driven path (`synthesizeCivicStory`) enforces a **hard 500-word
> floor**, checked on the actual output, not assumed from input length:
> 1. If the source wire text is thin (<300 chars), skip straight to search-
>    grounded synthesis rather than writing from almost nothing.
> 2. Otherwise, try the primary structured-JSON prompt. If the result comes
>    back under 500 words for any reason, that's the trigger — not just an
>    outright API failure.
> 3. **Search-grounded enrichment**: search the live internet for real
>    information on the topic and write a fuller piece from that (target
>    500-750 words), handing the model whatever short draft already exists
>    as a starting point to substantiate and extend. This tries every
>    fallback model in turn (not just one hardcoded model — see below).
> 4. If the story genuinely doesn't support 500 words even after
>    searching, say less rather than pad with invented detail — a true
>    200-word piece beats a padded 600-word one. The enriched version is
>    only accepted if it's genuinely fuller than what came before; the
>    bare "According to reporting by..." template is the true last resort,
>    used only when nothing else produced anything at all.
>
> **Antigravity should hold itself to the same 500-word floor and the same
> "search rather than pad" discipline** when writing into `bulk-news-batch.json` —
> this isn't just a Gemini-prompt rule, it's the actual editorial bar for
> every article regardless of which path wrote it.
>
> One infrastructure note if you're extending the API-driven path: Gemini's
> free tier enforces **per-model daily quotas** (observed: 20 requests/day
> on `gemini-2.5-flash`) — and that model is tried first for literally
> every article, so it exhausts early on any real-volume day. Both the
> primary synthesis loop and the search-enrichment fallback try multiple
> models in turn for exactly this reason; a single hardcoded model anywhere
> in this path will go dark mid-day once its quota is gone.

---

### 5. SOCIAL HOOK & TWEET SPECIFICATION
- 120–220 characters.
- Must clearly explain public significance and civic stakes.
- **Strict Rule: NO hashtags, NO @handles, NO URLs, and NO emojis.**

This is what goes in the article's `tweet` field. Separately,
`insert-news-batch.js` also generates a longer-form `tweetarticle` field
(a "what changed & taxpayer impact" summary plus a Choseno.com CTA link) at
ingestion time for every article regardless of which path synthesized it —
that field is NOT something the synthesis step needs to produce itself.

---

### 6. ARTICLE JSON SCHEMA (what synthesis produces and `insert-news-batch.js` ingests)

```json
{
  "slug": "jurisdiction-subject-key-action-YYYY-MM-DD",
  "headline": "Clear, Fact-Dense Headline Highlighting Key Official and Action",
  "summary": "A concise factual summary of the development and why it matters to citizens.",
  "category": "Policy",
  "country": "CA",
  "province": "ON",
  "status": "published",
  "eventDate": "2026-08-17T14:00:00Z",
  "published_at": "2026-08-17T14:30:00Z",
  "impactArea": "country",
  "latitude": 45.4215,
  "longitude": -75.6972,
  "body": "OTTAWA, ON — one continuous narrative, plain paragraphs separated by \\n\\n only — NO markdown headers, NO labeled sections. The lead, the hard figures, the impact, and the accountability angle all flow together as a single story a reader can read start to finish. 500+ words.",
  "seoTitle": "Descriptive Search-Friendly Title | Choseno",
  "metaDescription": "140-170 character meta description summarizing the key facts and civic impact.",
  "tags": [
    "Official Name",
    "Jurisdiction",
    "Topic Area"
  ],
  "tweet": "A punchy, factual 120-220 character social hook explaining the public impact without hashtags handles URLs or emojis.",
  "breakingNews": false,
  "author": {
    "name": "Choseno Civic News Desk",
    "bio": "Provincial, federal and municipal political affairs reporting"
  },
  "sources": [
    {
      "label": "Primary Source or Outlet Name",
      "url": "https://specific-canonical-deep-link-url.com/releases/2026/08/17/article-slug"
    }
  ],
  "taggedPoliticianIds": [
    "verified-profile-uuid"
  ],
  "taggedPoliticians": [
    "Official Name"
  ]
}
```

---

### 7. INGESTION & COVERAGE RECONCILIATION (`insert-news-batch.js`)

Every article — whether it came from the API-driven path or from Antigravity's `bulk-news-batch.json` — funnels through this one script, which does all of the following on every run:

1. **Candidate-coverage reconciliation** (checked first, before anything touches Supabase): if a fresh `latest-verified-rss-candidates.json` exists (written within the last 2 hours — a stale file from an unrelated earlier run is ignored so it can't cause a false alarm), it matches every candidate against this batch by source URL (falling back to title similarity for cases where a redirect URL got rewritten during synthesis) and:
   - Logs `[COVERAGE] X/Y candidates synthesized (Z%)`.
   - **Names every candidate that didn't make it in** — headline, source, URL — not just a count. This is the closest thing to "why was this one skipped" the script can give; it can't see an agent's internal reasoning, but it can always say exactly *which* ones to hand back for a retry.
   - Warns loudly (`⚠️ LOW CANDIDATE COVERAGE`) below 50% coverage, but **still publishes** whatever's genuinely ready — there's no reason to withhold real, verified articles because the rest of the queue wasn't finished. Pass `--require-full-coverage` to opt into hard-blocking a partial batch instead, for a context where that's genuinely the right call.
   - After a successful run, **prunes the queue file** to just the still-missing candidates — this is the other half of the persistent-queue mechanism in §3b.
2. **Politician-ID resolution** (`resolvePoliticianIds`) against the `profiles` table for anything not already carrying a `taggedPoliticianIds` array.
3. **Virality scoring** (`calculateViralityScore`) — used to rank `batch-ranked-news.csv`.
4. **`admin_sync_news_article_tags()`** — wall mirroring for every resolved politician ID.
5. **`admin_sync_news_article_boundaries()`** — electoral/municipal GIS polygon sync from lat/lng.
6. **`tweetarticle` + `batch_number` generation** — added at ingestion time for every article regardless of synthesis path; not something the synthesis step needs to produce.
7. **`batch-ranked-news.csv` update** (top 100 by virality score) and overflow archiving to `scripts/overflow-news-batch.json`.
8. **Optional Twitter posting** (`post-to-twitter.js`) per newly-inserted article.

#### The one case that still needs a manual, occasional exception

A story with genuinely zero RSS/Google News footprint — a raw court docket, a hyper-local outlet with no feed, a specific follow-up question ("did this official actually resign yet?"). For that, and only that:

1. Research and write the article JSON by hand, following §4-6 above exactly (500-word floor included).
2. Place it into `scripts/insert-news-batch.js`'s `articles` array (or a batch JSON file) and run `node scripts/insert-news-batch.js` — it still runs the full reconciliation/scoring/sync pipeline above, so a manually-authored story gets identical treatment to a pipeline-discovered one.
3. Verify (`npx tsc --noEmit`) and commit. *(Do not push without permission.)*

This should be rare. If you're reaching for it often for a category of story, that's a signal to add a feed to `rss-feed-collector.js` instead — see the §1 note on the 2-term-group query limit before doing so. This is also explicitly **not** something to run unattended on a schedule — unlike the main pipeline, there's no script-owned filter standing between "someone typed this" and "it's live."
