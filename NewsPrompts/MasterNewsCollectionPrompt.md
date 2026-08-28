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

## 0. THIS IS ONE ENGINE, NOT TWO PATHS

> [!IMPORTANT]
> **There is a single content engine: [`scripts/rss-verified-pipeline.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/rss-verified-pipeline.js). Cron and an on-demand/manual run execute the exact same code, so there is no separate set of discovery, tagging, scoring, or writing rules to keep in sync.**
>
> The **only** difference between a scheduled run and an on-demand one is how the lookback window is chosen:
>
> ```bash
> # Cron: fixed, explicit lookback
> node scripts/rss-verified-pipeline.js --max-hours 6
>
> # On-demand, no window given: auto-computed from time-since-last-published
> # (internally calls scripts/get-last-publish-window.js) — never re-scans
> # already-covered hours, never leaves a gap.
> node scripts/rss-verified-pipeline.js
>
> # On-demand with an explicit custom window ("just check the last 3 hours"):
> node scripts/rss-verified-pipeline.js --max-hours 3
> ```
>
> What used to require a live agent doing ad-hoc Google searches (the old
> "3 Discovery Tracks" below) is now handled entirely inside
> [`scripts/rss-feed-collector.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/rss-feed-collector.js):
> ~100 registered feeds spanning federal wires, 30 named key-leader queries,
> and one dedicated feed per US state and Canadian province/territory —
> pooled and interleaved national:local at a fixed 1:2 ratio so national
> wires can never crowd out local coverage the way they used to. The
> pipeline also pulls the same-window trending topics
> ([`scripts/fetch-trending-topics.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/fetch-trending-topics.js))
> automatically and prioritizes any candidate that matches, so a genuinely
> trending story never gets truncated out by the synthesis limit.
>
> **The one thing this can't do**: a story with zero RSS/Google News
> footprint at all — a raw court docket, a hyper-local outlet with no feed.
> That's the one legitimate case for a manual, occasional deep-dive outside
> this pipeline (live web search, hand-authoring a JSON object into
> [`scripts/insert-news-batch.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/insert-news-batch.js)'s
> `articles` array, then running it directly) — not the default way news
> gets in, and not something to run unattended on a schedule.

Everything below this point is **reference material**: the editorial rules
the pipeline's Gemini synthesis prompt already encodes (so you can audit or
extend it), the key-leader roster it already queries, and the JSON shape it
already produces. Treat it as documentation of what the code does, not as a
separate set of steps to execute by hand.

---

### 1. WHAT THE PIPELINE COVERS

Three governance-tier concerns are covered by feed design, not by agent
judgment call each run:

1. **Wire & Civic Discovery** — national wires (AP, Reuters, The Canadian
   Press, CBC, The Hill, Politico, Globe and Mail) via
   `NATIONAL_FEEDS` in `rss-feed-collector.js`.
2. **30 Key Political Leaders** — one Google News feed per leader, by name
   (see roster in §2), split into federal (pooled as "national") vs.
   state/premier (pooled as "local") so this can't quietly re-inflate the
   Trump/national skew the per-region feeds below were built to fix.
3. **Municipal, State & Provincial Coverage** — one feed per US state and
   Canadian province/territory, built by role/office terms (governor,
   mayor, councillor, MLA, MPP, MNA, "county commission", "state
   legislature") plus the region's name — **never a specific incumbent's
   name**, so it keeps working across elections. Two curated catch-all
   feeds (US and Canada) supplement this with decision-oriented terms
   (budget, zoning, referendum, "voted to", bylaw).

A dedicated opposition/caucus-politics feed exists for exactly the gap a
premier-name-locked query can't catch: a story about the *opposition*
losing MLAs to defection, not the sitting government.

> [!NOTE]
> If you're extending feed coverage, keep queries to **at most 2 top-level
> term groups** (one bracketed OR-group + one quoted phrase, or two
> bracketed groups — never three). Verified by hand: a 3rd clause silently
> makes Google News RSS stop honoring the quoted region/leader name and
> every feed collapses to the same generic top result.

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

### 3. DEDUPLICATION RULES (enforced in `rss-feed-collector.js` / `insert-news-batch.js`)
1. **Slug match**: Exact slug match will update (`PATCH`) the existing article.
2. **Canonical source URL match**: Shared source URLs will update rather than duplicate.
3. **Headline token overlap**: ≥45% token overlap against the last 2000 published headlines is treated as a duplicate and skipped before synthesis even runs.

---

### 4. JOURNALISTIC HEADLINE & EDITORIAL INTEGRITY (ANTI-SCALED CONTENT ABUSE)

Google Search Essentials and Google News Publisher Guidelines strictly penalize templated or formulaic writing ("Scaled Content Abuse"). The Gemini synthesis prompt in `rss-verified-pipeline.js` enforces this per-article; it's documented in full here for anyone auditing or extending that prompt.

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

#### 4-PART / 5-SECTION JOURNALISTIC BODY STRUCTURE (350–750 WORDS):
1. **Dateline & Lead**: Start with `CITY, Province/State — ` followed immediately by the concrete news event, key stakeholders, and public consequence.
2. **Mechanics & Hard Figures**: Specific dollar amounts ($M/$B), percentages, bill numbers (e.g. `Bill 185`, `SB 3925`), vote tallies, statutory citations, and implementation dates.
3. **Constituent & Regional Impact**: Direct consequences for taxpayers, businesses, renters, commuters, or specific ridings/districts.
4. **Accountability & Next Steps**: Upcoming hearings, application deadlines, committee reviews, opposition responses, and outstanding questions.

---

### 5. SOCIAL HOOK & TWEET SPECIFICATION
- 120–220 characters.
- Must clearly explain public significance and civic stakes.
- **Strict Rule: NO hashtags, NO @handles, NO URLs, and NO emojis.**

---

### 6. ARTICLE JSON SCHEMA (what `rss-verified-pipeline.js` synthesizes and `insert-news-batch.js` ingests)

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
  "body": "OTTAWA, ON — ...\n\n## Statutory Framework and Funding\n\n...\n\n## Impact on Residents and Businesses\n\n...\n\n## Next Steps and Accountability\n\n...",
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

### 7. THE ONE CASE THAT STILL NEEDS A MANUAL RUN

A story that has genuinely zero RSS/Google News footprint — a raw court
docket, a hyper-local outlet with no feed, a specific follow-up question
("did this official actually resign yet?"). For that, and only that:

1. Research and write the article JSON by hand, following §4-6 above exactly.
2. Place it into `scripts/insert-news-batch.js`'s `articles` array and run:
   ```bash
   node scripts/insert-news-batch.js
   ```
   This still runs the shared ingestion engine — dedup, politician-ID
   resolution, virality scoring, Supabase insert, wall/boundary sync, and
   the `batch-ranked-news.csv` update — so a manually-authored story gets
   identical treatment to a pipeline-discovered one downstream.
3. Verify (`npx tsc --noEmit`) and commit. *(Do not push without permission.)*

This should be rare. If you're reaching for it often for a category of
story, that's a signal to add a feed to `rss-feed-collector.js` instead —
see the §1 note on the 2-term-group query limit before doing so.
