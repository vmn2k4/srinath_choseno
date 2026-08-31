# Choseno Autonomous Newsroom Pipeline: Comprehensive Architecture & Operations

> For the editorial rules (headline craft, word-count floor, jurisdiction/relevance filtering detail, the article JSON schema) see [`NewsPrompts/MasterNewsCollectionPrompt.md`](../NewsPrompts/MasterNewsCollectionPrompt.md) — that document is the source of truth for *what gets written*; this one is the source of truth for *how the system runs it*. Keep both in sync with the actual code, not with each other's prose — verify against the scripts before editing either.

## 1. Executive Summary & Design Principles

The Choseno Newsroom Pipeline is a production-grade, autonomous civic intelligence system. It discovers, verifies, deduplicates, synthesizes, and publishes federal, state/provincial, and municipal news across the **United States and Canada**.

### Core Architecture Principles

1. **Strict Machine vs. LLM Division of Labor**:
   - **Machine Scripts** (`rss-feed-collector.js`, `rss-verified-pipeline.js`, `insert-news-batch.js`, `sequential-pipeline-runner.js`): control 100% of candidate discovery, HTTP status checks, paywall gating, geographic/relevance filtering, deduplication, queue lifecycle, and Supabase ingestion.
   - **LLM synthesis** (Gemini API directly, or Antigravity/an external agent reading the queue): dedicated *exclusively* to writing the prose for a candidate the scripts already selected. It never decides which candidates exist, which are duplicates, which are in-jurisdiction, or which get published — see the "queue" section below for why that boundary is enforced structurally, not just requested.
2. **Strict Geographic Mandate**: 100% of stories are bound to the United States (all 50 states + DC) and Canada (all 10 provinces + 3 territories). Non-US/CA wires, sports/entertainment, and human-interest/viral framing are filtered before HTTP verification or synthesis ever runs.
3. **Zero-Hallucination Grounding**: every synthesized report is grounded in machine-extracted source text (Tier-1) or paraphrased with attribution from an allowlisted paywalled source (Tier-2) — never invented. A thin or failed extraction downgrades to Tier-2 rather than falsely claiming quote-grade source text.
4. **Sequential execution is the default operating mode, not a fallback**: [`scripts/sequential-pipeline-runner.js`](../scripts/sequential-pipeline-runner.js) processes exactly one candidate at a time — synthesize, verify, ingest, prune — before moving to the next. This was a deliberate choice over concurrent/parallel subagent waves: parallel workers hit API rate limits unevenly, produce inconsistent quality, and (in an earlier version of this pipeline) made it possible for a wave of workers to silently under-process a large queue while still reporting a clean result. There is no parallel-worker mode in this codebase — an earlier `queue-manager.js` script that split the queue into chunks for concurrent workers was removed for exactly this reason; do not reintroduce that pattern.

---

## 2. End-to-End Pipeline Data Flow

```mermaid
flowchart TD
    A[RSS Feed Registry<br/>116 feeds: Federal, 50 States, 13 CA Provinces/Territories, ~31 Key Leaders] --> B[rss-feed-collector.js<br/>Machine Harvesting & Paywall Gatekeeper]
    B --> C[Jurisdiction & Relevance Filter<br/>isStrictlyUsOrCanada + mentionsOfficeholderOrKnownPolitician]
    C --> D[Deduplication<br/>Jaccard token overlap ≥ 0.45 against published DB<br/>+ within-run syndication collapse]
    D --> E[Trending Topics Matcher<br/>fetch-trending-topics.js]
    E --> F[Persistent Candidate Queue<br/>latest-verified-rss-candidates.json<br/>mergeCandidatesIntoQueue — survives across runs, 48h expiry]
    F --> G{Synthesis mode}
    G -- sequential-pipeline-runner.js --> H[Pop ONE candidate]
    H --> I[synthesizeCivicStory<br/>500-word floor + search-grounded enrichment]
    I --> J[verifyArticleQuotesAndFacts]
    J --> K[insert-news-batch.js<br/>single-article batch]
    K --> L[Prunes this candidate from the queue]
    L --> H
    G -- rss-verified-pipeline.js --use-api-key --> M[Synthesize entire queue concurrently]
    M --> N[insert-news-batch.js<br/>full batch]
    N --> O[Coverage reconciliation:<br/>names anything missing, prunes what published]
```

Both synthesis modes converge on the same `insert-news-batch.js`, which is the one place politician-ID resolution, virality scoring, wall/GIS sync, and queue pruning happen — regardless of which path produced the article.

---

## 3. Detailed Component Breakdown

### Stage 1: Feed Harvesting & Ingestion (`scripts/rss-feed-collector.js`)

100% deterministic — no LLM anywhere in this file.

- **Feed Registry (116 feeds)**: 6 national wires (The Hill, Politico Congress, CBC News Politics, The Globe and Mail, Global News, Google News US Politics); ~31 named key-leader queries (role + name, split federal vs. state/provincial pools); one feed per US state (10 highest-volume states split into municipal-only + state-only feeds); one feed per Canadian province/territory (the 3 territories paired with their capital city). Pooled and interleaved national:local at a fixed 1:2 ratio so national wires structurally cannot crowd out local coverage.
- **Lookback Window (`scripts/get-last-publish-window.js`)**: computes the lookback from time-since-last-published, floored at 24 hours with a 1-hour overlap buffer. Wide overlap is intentional and cheap now that the persistent queue (Stage 2 below) absorbs redundancy safely via dedup — missing a candidate because the window was too tight is the failure mode this is designed against.
- **Jurisdiction & relevance filtering**: `isStrictlyUsOrCanada` hard-rejects sports/entertainment framing, human-interest/viral framing (weddings, "goes viral," obituaries of unrelated namesakes), foreign outlets, and foreign-primary-subject stories (a foreign country mention only survives if a genuine US/CA signal — a named leader, institution, or place, never a bare office title — appears in the first half of the headline). `mentionsOfficeholderOrKnownPolitician` then requires the candidate to actually name an office holder, a curated key leader, or someone matching a real Choseno politician profile (~31k rows, paginated).
- **HTTP Status & Paywall Gatekeeper**:
  - **Tier-1**: full body text extracted (>200 chars) — verbatim quotes permitted, verified against the extracted text.
  - **Tier-2**: 401/403 on an allowlisted paywall domain (WSJ, Reuters, Bloomberg, NYT, Washington Post, Globe and Mail, etc.), OR a thin/failed extraction (≤200 chars) on *any* domain — paraphrase only, zero verbatim-quote claims.
  - **Rejected**: 404/410/500+, non-allowlisted 401/403, bare root/category landing pages, malformed URLs.

---

### Stage 2: The Persistent Candidate Queue

`latest-verified-rss-candidates.json` is **not** a per-run snapshot — it's state the script alone owns, via `mergeCandidatesIntoQueue` (lives in `rss-feed-collector.js`, imported by both `rss-verified-pipeline.js` and `sequential-pipeline-runner.js` so there is exactly one implementation).

- Every collection run **merges** freshly-discovered candidates into the queue (deduped against it by `sourceUrl`) rather than overwriting it.
- A candidate leaves the queue only two ways: **confirmed published** (`insert-news-batch.js` matches it into a batch and prunes it), or **aged out past 48 hours** unsynthesized — an objective, script-checked rule, logged by name when it fires.

This is the mechanism that makes "the script decides what's published" structurally true. It was added after a real incident: an agent given the full queue and told to synthesize everything silently processed 4 of 225 candidates and reported it as a clean success, because the queue file was overwritten every run and anything not processed simply vanished. With a persistent queue, an agent's inaction can no longer make a candidate disappear — it just stays queued for the next pass.

#### Deduplication (the actual formula — verify against `calculateSimilarity` in `rss-feed-collector.js` before trusting any other description of this)

```javascript
function calculateSimilarity(str1, str2) {
  const tokens1 = new Set(str1.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3));
  const tokens2 = new Set(str2.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  let intersection = 0;
  for (const t of tokens1) if (tokens2.has(t)) intersection++;
  return intersection / (tokens1.size + tokens2.size - intersection); // Jaccard index — union in the denominator
}
```

This is the **Jaccard index** (intersection over *union*), threshold **≥ 0.45**, checked against published headlines/slugs fetched with an explicit `ORDER BY published_at DESC` and a time floor (an earlier version had no `ORDER BY` on a `LIMIT`-only query, which on a table with no natural order isn't "the most recent N" — it's an arbitrary scan-order slice, and a story published an hour ago could be entirely absent from it). Do not confuse this with the *Overlap Coefficient* (`intersection / min(size)`) — a different formula that appeared in an earlier, divergent reimplementation of this same check; the two produce different results on the same input, and the Overlap Coefficient is more prone to false-positive "duplicate" matches.

Within-run syndication dedup (the same event picked up by multiple outlets/feeds in one collection pass) uses the identical function before candidates ever reach the persistent queue.

---

### Stage 3: Synthesis — Two Modes, One Set of Rules

Both modes call the same `synthesizeCivicStory` (in `rss-verified-pipeline.js`) and the same `verifyArticleQuotesAndFacts` (`quote-and-fact-verifier.js`). See `NewsPrompts/MasterNewsCollectionPrompt.md` §4 for the full editorial rules (500-word floor with search-grounded enrichment, headline craft, "write like an editor not a template").

**A. Sequential (`scripts/sequential-pipeline-runner.js`) — the default:**
1. Runs the same discovery + queue-merge as `rss-verified-pipeline.js`.
2. Pops the front of the queue, synthesizes, verifies, ingests via `insert-news-batch.js` (which prunes it on success), then repeats until the queue is empty or `--max-stories` is reached.
3. Because progress is committed and pruned after every single item, an interruption mid-run loses nothing — whatever wasn't reached simply stays queued.

**B. Concurrent batch (`node scripts/rss-verified-pipeline.js --use-api-key`):** synthesizes the whole queue with bounded concurrency, writes one `bulk-news-batch.json`, and ingests it in one call. Costs more Gemini quota per run (many parallel API calls) but finishes a large backlog faster when quota allows.

**When an external agent (e.g., Antigravity) does the synthesis instead of the API-driven path**: it reads the queue via the default `node scripts/rss-verified-pipeline.js` (collect-only — writes/merges the queue and stops) and writes `bulk-news-batch.json` itself. `insert-news-batch.js`'s coverage-reconciliation (Stage 4) is what keeps that path honest.

---

### Stage 4: Database Ingestion & Coverage Reconciliation (`scripts/insert-news-batch.js`)

Every article — sequential, batch-API, or agent-written — funnels through this one script.

1. **Candidate-coverage reconciliation** (first, before touching Supabase): if a fresh queue file exists (written within 2 hours), matches this batch against it by source URL (title-similarity fallback for rewritten redirect URLs), logs `[COVERAGE] X/Y synthesized`, and — **only for genuinely multi-item batches** (a single-item batch is the sequential runner working as designed, not under-delivery, so it's exempted from this check) — names every candidate that didn't make it in and warns loudly below 50% coverage. Still publishes whatever's ready either way; `--require-full-coverage` opts into hard-blocking a partial batch instead.
2. **Queue pruning**: after a successful run, rewrites the queue file to just the still-missing candidates.
3. **Politician-ID resolution** (`resolvePoliticianIds`) against the `profiles` table (role = `politician`) for anything not already carrying `taggedPoliticianIds`.
4. **Virality scoring** (`calculateViralityScore`) — feeds `batch-ranked-news.csv` ranking.
5. **`admin_sync_news_article_tags()`** — wall mirroring (`/wall/[slug]`) for every resolved politician ID.
6. **`admin_sync_news_article_boundaries()`** — electoral/municipal GIS polygon sync from lat/lng.
7. **`tweetarticle` + `batch_number` generation** — added here for every article, regardless of synthesis path.
8. **Hero image**: the article's image is stored in the `hero_image_url` column (**not** `og_image_url` — that column does not exist on `news_articles`; verify against the schema before citing a column name here again).
9. **`batch-ranked-news.csv`** update (top 100 by virality score) + overflow to `scripts/overflow-news-batch.json`.
10. **Optional Twitter posting** (`post-to-twitter.js`) per newly-inserted article.

---

## 4. Autonomous Scheduling

There should be exactly **one** scheduled trigger. This pipeline has repeatedly ended up with multiple schedulers stacked on top of each other across sessions (a macOS `launchd` job and one or more agent-managed cron tasks simultaneously, each unaware of the other) — each time, the symptom was the same: candidate counts and publish volume that don't add up, because two processes were racing on the same queue file. Before trusting any single number this pipeline reports, check for more than one active scheduler.

The one trigger should run either:
```bash
node scripts/sequential-pipeline-runner.js   # default — quality-first, one at a time
# or
node scripts/rss-verified-pipeline.js --use-api-key   # concurrent batch, when you want a faster pass and have quota for it
```
Do not schedule a second task running the other mode, or a task that duplicates discovery/synthesis logic outside these two entry points — that reintroduces exactly the race and drift this section warns about.

---

## 5. Operational Invariants & Verification Checklist

| Invariant | Specification | Verification Method |
| :--- | :--- | :--- |
| **Geographic Scope** | Strictly US & Canada only | `isStrictlyUsOrCanada` in `rss-feed-collector.js` |
| **Candidate relevance** | Must name an office holder, key leader, or known politician profile | `mentionsOfficeholderOrKnownPolitician` |
| **Article Body Length** | 500-word floor, target 500-750 (search-enrichment retries below 500; never padded) | `wordCount()` check in `synthesizeCivicStory` |
| **Deduplication** | Jaccard token overlap ≥ 0.45 against published DB, ordered by recency | `calculateSimilarity` in `rss-feed-collector.js` |
| **Queue integrity** | Nothing leaves the queue except confirmed-published or 48h-expired | `mergeCandidatesIntoQueue` + `insert-news-batch.js` pruning |
| **Single execution mode** | Sequential or concurrent-batch — never a third, parallel-worker path | No `queue-manager.js`-style chunk-splitting script should exist in `scripts/` |
| **Single scheduler** | Exactly one active cron/task triggers the pipeline | Check both `launchctl list` and the agent scheduler before trusting reported counts |
| **Git Push Rule** | Local commits only | `git push` is blocked without explicit user approval |
