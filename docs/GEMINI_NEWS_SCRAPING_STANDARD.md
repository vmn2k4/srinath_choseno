# Gemini News Scraping, Generation & Ingestion Standard Operating Procedure (SOP)

This document establishes the **authoritative standard** for fetching, scraping, researching, generating, and inserting civic and political news articles into Choseno. Every news article must meet strict editorial standards for depth, accuracy, statutory/financial figures, direct canonical source citations, and social discovery hooks.

---

## 1. Core Principles & Editorial Standards

### 1.1 Substantive Journalistic Depth (400–750 Words)
- **Zero Superficial Stubs**: Never generate 1–2 paragraph summaries. Every article must provide full background context, statutory mechanisms, and constituent impact.
- **Mandatory 4-Part Structure**:
  1. **The Core Action & Scene**: Journalistic opening dateline (`CITY, Prov./State — `) followed immediately by the verified executive order, appointment, bill signing, or municipal resolution.
  2. **Policy Mechanics & Concrete Numbers**: Dollar amounts (e.g. `$15,000 grant cap`, `$1.4B budget`), exact bill numbers (e.g. `SB 3925`), statutory citations (`55 ILCS 120`), and affected property/voter numbers (`4,200+ residential properties`).
  3. **Constituent & Regional Impact**: How residents, local small businesses, public health facilities, or specific ridings/neighborhoods are directly impacted.
  4. **Accountability & Actionable Timelines**: Specific dates for application windows, upcoming committee hearings, public comment periods, and opposition perspectives.

### 1.2 Direct Canonical Deep-Link Citations
- **No Generic Domain Homepages**: Sources like `https://apnews.com` or `https://cbc.ca` are **strictly banned**.
- **Exact Article Deep Links Only**: Always provide the full canonical URL to the specific published article, government docket, or legislative bill record:
  - *Example*: `https://gov.illinois.gov/news/press-release.30142.html`
  - *Example*: `https://news.gov.bc.ca/releases/2026PREM0045-001122`
  - *Example*: `https://www.ilga.gov/legislation/BillStatus.asp?DocNum=3925&DocTypeID=SB&LegId=154201&GAID=103`
- **Professional Outlet Labels**: Use formal titles (e.g., *"Office of the Governor of Illinois - Official Press Release"*, *"CBC British Columbia"*, *"Illinois General Assembly"*).

### 1.3 High-CTR, Captivating `tweet` Field
- **Stakes & Action Hook**: 1–2 sentences (~140–200 characters max) highlighting the civic impact and giving citizens a reason to click and explore.
- **Strict Cleanliness Rules**: Plain text only — **NO `#hashtags`, NO `@handles`, NO `http://` URLs, and NO emojis in the `tweet` string**.
- Choseno's sharing engine (`NewsArticleDetailClient.tsx`) automatically appends the canonical rich preview URL (`https://www.choseno.com/news/[slug]`) and formats all article topic tags into clean PascalCase hashtags (`#JBPritzker #Illinois #FloodRelief #SB3925 #Choseno`).

### 1.4 Strict `breakingNews` & Timestamp Rules
- `breakingNews: true` is **strictly reserved** for major, unexpected emergency or breaking governance events that occurred **within the past 1–3 hours**.
- If a story happened yesterday or several hours ago (e.g. `23 hours ago`), set `breakingNews: false`.
- **`event_date` vs. `published_at`**:
  - `event_date`: When the real-world event actually took place (e.g. `2026-08-14T18:00:00Z`).
  - `published_at`: When the article goes live on Choseno (e.g. `2026-08-15T20:30:00Z`).

---

## 2. Complete Step-by-Step Execution Workflow

When instructed to fetch, scrape, and publish news for a politician or jurisdiction:

```
┌──────────────────────────────────────────────────────────┐
│ 1. Search & Verification (Web Search / Source Scraping)  │
│ - Fetch latest verified developments                     │
│ - Extract deep canonical URLs, exact dates, quotes & data│
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Politician Profile UUID Lookup (Supabase)             │
│ - Query `office_holders` for `linked_profile_id`         │
│ - Ensure exact profile linking for wall & rating widgets │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Article Synthesis & Schema Construction (Full JSON)   │
│ - Enforce 400-750 words, ## headers, deep sources        │
│ - Generate captive ~180-char plain-text `tweet`          │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Supabase Database Insert (`news_articles`)            │
│ - Insert article record with complete JSONB `content`    │
│ - Link `news_article_politicians` via profile UUID       │
│ - Execute `admin_sync_news_article_tags()` RPC           │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Verification & Live URL Output                        │
│ - Verify layout, text-wrapping, and dynamic visual card  │
│ - Provide direct local link and canonical share URL      │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Standard JSON Schema Template

```json
{
  "slug": "pritzker-signs-sb3925-chicago-storm-flood-relief-2026",
  "headline": "Gov. Pritzker Signs SB 3925 Unlocking Municipal Flood Relief for South Suburbs",
  "summary": "Governor JB Pritzker enacts emergency legislation authorizing Chicago and Cook County home equity programs to deploy direct flood repair grants.",
  "category": "Policy",
  "country": "US",
  "province": "IL",
  "status": "published",
  "event_date": "2026-08-14T18:00:00Z",
  "published_at": "2026-08-15T20:30:00Z",
  "impact_area": "state",
  "latitude": 41.8781,
  "longitude": -87.6298,
  "content": {
    "seoTitle": "Gov Pritzker Signs SB 3925 Chicago Flood Relief | Choseno",
    "metaDescription": "Gov. JB Pritzker signs Senate Bill 3925 allowing municipal home equity programs to disburse disaster repair funds to flood-damaged Illinois homeowners.",
    "summary": "Governor JB Pritzker enacts emergency legislation authorizing Chicago and Cook County home equity programs to deploy direct flood repair grants.",
    "body": "SPRINGFIELD, Ill. — Governor JB Pritzker has signed Senate Bill 3925 into law, authorizing local home equity assurance programs across Chicago and Cook County to directly distribute financial disaster relief to residents recovering from severe summer storms and basement flooding.\n\nThe emergency statutory amendment expands the allowable expenditures of municipal Home Equity Assurance districts, enabling local governing commissions to disburse direct repair grants of up to $15,000 per household without requiring homeowners to take on secondary private debt.\n\n## Legislative Mechanics & Emergency Relief Expansion\n\nSenate Bill 3925 amends the Illinois Home Equity Assurance Act (55 ILCS 120), which was originally designed to guarantee regional property values. Under the modernized framework:\n\n* **Expanded Grant Authority**: Governing neighborhood commissions are now legally permitted to allocate reserve fund capital directly toward structural restoration, foundation waterproofing, and sewer backflow valve installations.\n* **Streamlined Claims Pipeline**: Impacted property owners can submit verified disaster damage estimates directly to their local district board, bypassing multi-month federal disaster claim backlogs.\n* **Coordination with IEMA**: The funding mechanism coordinates with the Illinois Emergency Management Agency (IEMA) to ensure state matching relief is not offset by municipal payouts.\n\n\"When torrential rains overwhelm municipal sewer infrastructure, families need immediate financial liquidity to secure their foundations and prevent toxic mold growth,\" Governor Pritzker stated following an on-site inspection of storm-impacted residential corridors in the south suburbs. \"SB 3925 removes outdated statutory red tape, putting local reserve dollars to work immediately where residents need them most.\"\n\n## Regional Impact & Cook County Rollout\n\nThe legislative action primarily targets residential zones in South and Southwest Chicago, as well as suburban Cook County municipalities that experienced over six inches of concentrated rainfall during recent storm fronts. Local home equity districts holding accumulated reserve funds from municipal tax levies can immediately activate emergency grant application portals.\n\nMunicipal engineers estimate that over 4,200 residential properties suffered severe water intrusion during the storm sequence. By allowing local boards to release existing capital reserves, the legislation delivers targeted fiscal stimulus without increasing statewide tax rates.\n\n## Accountability & Next Steps\n\nThe legislation takes effect immediately under an emergency enactment clause. The Illinois Department of Financial and Professional Regulation (IDFPR), in conjunction with Cook County municipal boards, will publish standardized grant application criteria by August 22, 2026.\n\nLocal neighborhood commissions in Chicago will hold public information sessions throughout the week to guide homeowners through the claim submission process and ensure transparent disbursement auditing.",
    "tags": ["JB Pritzker", "Illinois", "Chicago", "Flood Relief", "SB3925", "Infrastructure", "Cook County"],
    "breakingNews": false,
    "tweet": "Gov. JB Pritzker signs SB 3925 unlocking direct emergency flood repair grants for Chicago and Cook County homeowners — check if your neighborhood qualifies.",
    "author": {
      "name": "Choseno Civic News Desk",
      "bio": "State and municipal governance, infrastructure, and policy reporting"
    },
    "sources": [
      {
        "label": "Office of the Governor of Illinois - Official Press Release",
        "url": "https://gov.illinois.gov/news/press-release.30142.html"
      },
      {
        "label": "Illinois General Assembly - SB3925 Bill Status & Text",
        "url": "https://www.ilga.gov/legislation/BillStatus.asp?DocNum=3925&DocTypeID=SB&LegId=154201&GAID=103"
      }
    ]
  }
}
```

---

## 4. Node.js Ingestion Script

To programmatically insert or update articles in Supabase:

```javascript
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["\x27]|["\x27]$/g, '');
});

async function ingestArticle(articleData, politicianProfileId) {
  // 1. Authenticate Admin
  const authRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.admin_un, password: env.admin_pwd })
  });
  const auth = await authRes.json();

  // 2. Insert or Upsert Article
  const res = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles', {
    method: 'POST',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + auth.access_token,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(articleData)
  });
  const saved = await res.json();
  const articleId = saved[0]?.id;
  if (!articleId) throw new Error('Failed to insert article: ' + JSON.stringify(saved));

  // 3. Link Politician Tag
  if (politicianProfileId) {
    await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_article_politicians', {
      method: 'POST',
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + auth.access_token,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        news_article_id: articleId,
        politician_id: politicianProfileId
      })
    });
  }

  console.log(`Successfully published: https://www.choseno.com/news/${articleData.slug}`);
}
```

---

## 5. Quality Checklist Before Publishing

- [ ] **Word Count**: Body length is between **400 and 750 words**.
- [ ] **Structure**: Contains a dateline and at least 3 distinct `##` subheadings with bulleted points.
- [ ] **Specifics**: Includes concrete dollar figures, bill numbers, or statutory references.
- [ ] **Sources**: All source URLs are direct deep links to the specific article/docket, not generic homepages.
- [ ] **Tweet Hook**: 140–200 chars, captivating civic angle, strictly plain text (zero emojis, hashtags, or links).
- [ ] **Breaking Badge**: `breakingNews: false` unless the event occurred <3 hours ago.
- [ ] **Politician Profile**: Tagged with valid `profiles.id` UUID matching `office_holders.linked_profile_id`.
