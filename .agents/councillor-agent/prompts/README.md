# Choseno News Prompts & Directives Suite

This directory contains the standardized, modular news collection, verification, and ingestion directives for the **Choseno** platform.

---

## Directives Index

| Directive File | Focus Area | Primary Discovery Vectors | Target Output |
| :--- | :--- | :--- | :--- |
| **[`MasterNewsCollectionPrompt.md`](file:///Users/vmn2k4/Coding/Choseno/NewsPrompts/MasterNewsCollectionPrompt.md)** | **Unified 3-Track Master Execution Directive** | Orchestrates Tracks A, B, and C simultaneously (Wires + 30 Key Leaders + Universal Google Search). | Single comprehensive batch (up to 100 stories) covering all levels of government and key officials. |
| **[`NewsCollectionPrompt.md`](file:///Users/vmn2k4/Coding/Choseno/NewsPrompts/NewsCollectionPrompt.md)** | **Track A: General Civic & Political News** | Wires (AP, Reuters, CP), Google Trends, RSS feeds, executive councils, provincial & federal portals. | Up to 100 verified stories per batch across all civic domains. |
| **[`KeyLeadersNewsCollectionPrompt.md`](file:///Users/vmn2k4/Coding/Choseno/NewsPrompts/KeyLeadersNewsCollectionPrompt.md)** | **Track B: 30 Key Political Leaders (US & Canada)** | Executive orders, legislative floor votes, bilateral negotiations, statements from the 30 designated key leaders. | Targeted stories pre-mapped to verified database UUIDs for instant profile wall mirroring. |
| **[`UniversalWebNewsCollectionPrompt.md`](file:///Users/vmn2k4/Coding/Choseno/NewsPrompts/UniversalWebNewsCollectionPrompt.md)** | **Track C: Universal Google Search with Dynamic Tagging** | Broad-spectrum Google search operators across 50 states, 10 provinces, 100+ cities, municipal councils, and court dockets. | Broad localized & municipal coverage with live database lookup & dynamic tagging for any official mentioned. |

---

## Universal Ingestion Workflow

Regardless of which directive is executed, all workflows adhere to the exact same execution pipeline:

1. **Calculate Dynamic Lookback Window**:
   ```bash
   node scripts/get-last-publish-window.js
   ```
   This retrieves the exact timestamp of the last published article in Supabase, calculates the elapsed hours (`lookbackHours`), and provides the exact parameter to pass to trending scripts and search queries.

2. **Scoped Discovery & Trend Extraction**:
   ```bash
   node scripts/fetch-trending-topics.js --max-hours <lookbackHours>
   ```
   All Google and web queries incorporate `(past <lookbackHours> hours OR "<today's date>")` to ensure strictly new developments are analyzed.

3. **Deduplication**: Compare candidate topics against existing database records (by slug, canonical source URL, and headline tokens).
4. **4-Part Journalistic Format**: Substantive articles (350–750 words) with Dateline, Hard Figures, Constituent Impact, and Accountability.
5. **Database Ingestion**: Hand-authored article objects are placed into `scripts/insert-news-batch.js` and executed via:
   ```bash
   node scripts/insert-news-batch.js
   ```
6. **Automated Tagging**:
   - `admin_sync_news_article_tags()` mirrors stories directly to politician profile walls (`/wall/[slug]`).
   - `admin_sync_news_article_boundaries()` uses `latitude`/`longitude` to map articles into electoral boundaries.
7. **Distribution Tracking**: Top-100 ranked stories are saved in `batch-ranked-news.csv`; overflow is stored in `scripts/overflow-news-batch.json`.
