# Documentation Index

Complete guide to all Choseno documentation — architecture, features, data pipelines, and developer guides.

**Last Updated**: August 17, 2026 | **Status**: Current & Comprehensive

---

## 🆕 Recent Updates (August 2026)

**See [RECENT_UPDATES_2026_08_17.md](RECENT_UPDATES_2026_08_17.md)** for comprehensive documentation of:
- ✅ Site-wide search bar with full-text indexing
- ✅ Enhanced content reporting system
- ✅ Multi-platform social sharing with dynamic OG images
- ✅ 4x faster image generation pipeline
- ✅ News master ingestion cycle (50+ stories/batch)
- ✅ Office holder syncs (6 Canadian jurisdictions, 2,000+ officials)
- ✅ SEO infrastructure (Vercel Analytics, IndexNow, sitemap)

---

## Getting Started

**New to the project?** Start here:

1. **[README.md](../README.md)** — Project overview, quick start, key links (START HERE)
2. **[CHOSENO_ARCHITECTURE_GUIDE.md](CHOSENO_ARCHITECTURE_GUIDE.md)** — Complete system overview (44 tables, services, data flows) [UPDATED 2026-08-17]
3. **[CODE_LAYERS.md](CODE_LAYERS.md)** — How the codebase is organized (routing → pages → components → services → utils)
4. **[RECENT_UPDATES_2026_08_17.md](RECENT_UPDATES_2026_08_17.md)** — All latest features with architecture details [NEW 2026-08-17]

---

## Core Concepts

### Authentication & Users

- **[AUTHENTICATION_FLOWS.md](AUTHENTICATION_FLOWS.md)** — Sign up, login, role switching, session management
- **Three roles**: Citizen (`normal`), Politician (`politician`), Admin (`admin`)

### Boundaries & Geography

- **[SCHEMA_QUICK_START.md](SCHEMA_QUICK_START.md)** — Quick reference for boundary types, map shapes, jurisdictions
- **[adding-boundary-data.md](adding-boundary-data.md)** — How to find, download, upload GIS boundary data (shapefiles → PostGIS)
- **Key concept**: Every user belongs to multiple boundaries (federal, provincial, municipal); elections are per-boundary

### Elections & Candidacies

- **[ELECTION_DATA_SOURCES.md](ELECTION_DATA_SOURCES.md)** — Where candidate data comes from, how verified candidates are listed
- **[adding-us-2026-midterm-candidates.md](adding-us-2026-midterm-candidates.md)** — How the 2026 US Midterms election + its House/Senate races + confirmed candidates were bulk-loaded from the FEC; repeatable recipe for future cycles
- **Flow**: User registers as politician → applies for election seat → creates campaign wall → voters ask questions/show support

### Officeholder Wall Claims

- **[OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md](OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md)** — Complete implementation status, admin workflow, conditions & constraints, service layer API reference, maintenance tasks
- **[OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md](OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md)** — Design rationale, schema decisions, merge rules, safety checklist, future enhancements

### Politician & Office Holders

- **[ROLES_AND_RESPONSIBILITIES_GUIDE.md](ROLES_AND_RESPONSIBILITIES_GUIDE.md)** — Guide for `election_role_types`, province-specific localized roles, rich descriptions, and tree rendering
- **[OFFICE_HOLDERS_FEATURE.md](OFFICE_HOLDERS_FEATURE.md)** — Auto-populated elected officials (MPs, Senators, Mayors, etc.)
- **[OFFICE_HOLDERS_IMPLEMENTATION.md](OFFICE_HOLDERS_IMPLEMENTATION.md)** — Technical details of office holder syncing
- **[POLITICIAN_WALL_FEATURE.md](POLITICIAN_WALL_FEATURE.md)** — Politician's public profile, engagement, support tracking
- **[RATINGS_SYSTEM.md](RATINGS_SYSTEM.md)** — 1-5 star ratings with 6-month cooldown, engagement summaries

---

## Features & Systems

### Content & Moderation

- **[COMMENTS_AND_MODERATION.md](COMMENTS_AND_MODERATION.md)** — Threaded posts/comments, user flags, admin content review, hidden content log
- **[ADDING_AND_TAGGING_NEWS_ARTICLES.md](ADDING_AND_TAGGING_NEWS_ARTICLES.md)** — Editorial news workflow, deduplication rules, electoral boundary mapping, and live wall syncing
- **[NEWS_TAGGING.md](NEWS_TAGGING.md)** — Editorial news articles, tagging to politicians/parties, scheduling
- **[NEWS_GENERATION_GUIDE.md](NEWS_GENERATION_GUIDE.md)** — Automated news generation, schema validation, batch scripts
- **[GEMINI_NEWS_SCRAPING_STANDARD.md](GEMINI_NEWS_SCRAPING_STANDARD.md)** — Definitive operational standard & SOP for scraping, research, 400-750 word depth, statutory/dollar numbers, exact canonical deep links, high-CTR `tweet` hooks, and direct Supabase insertion
- **[SOCIAL_SHARING_AND_IMAGE_GENERATION.md](SOCIAL_SHARING_AND_IMAGE_GENERATION.md)** — Dynamic Edge OpenGraph card generation (`@vercel/og`), right-floated editorial text wrap, 1-click social sharing (X, WhatsApp, LinkedIn), and smart topic hashtag extraction

### News Directives Suite (`NewsPrompts/`)

- **[`NewsPrompts/MasterNewsCollectionPrompt.md`](../NewsPrompts/MasterNewsCollectionPrompt.md)** — Master execution directive combining Wire discovery, 30 Key Leaders, and Universal Google searches in a unified pipeline
- **[`NewsPrompts/NewsCollectionPrompt.md`](../NewsPrompts/NewsCollectionPrompt.md)** — Standard high-impact civic & political news collection directive across all Canadian & U.S. jurisdictions (up to 100 stories/batch)
- **[`NewsPrompts/KeyLeadersNewsCollectionPrompt.md`](../NewsPrompts/KeyLeadersNewsCollectionPrompt.md)** — Targeted news collection directive for the 30 Key Political Leaders in the U.S. and Canada with pre-mapped UUIDs for instant wall mirroring
- **[`NewsPrompts/UniversalWebNewsCollectionPrompt.md`](../NewsPrompts/UniversalWebNewsCollectionPrompt.md)** — Broad-spectrum Google and deep web search directive covering all 50 states, 10 provinces, 100+ cities, and court dockets with dynamic politician profile tagging
- **[`NewsPrompts/README.md`](../NewsPrompts/README.md)** — Overview and comparison of all 4 news collection directives and unified ingestion pipeline

### Engagement & Analytics

- **[API_CACHING_STRATEGY.md](API_CACHING_STRATEGY.md)** — Client-side + database caching, TTL strategies, invalidation patterns
- **[GA4_DASHBOARD_SETUP.md](GA4_DASHBOARD_SETUP.md)** — Google Analytics 4 integration, traffic metrics, user signup tracking

### Media

- **[VIDEO_SUPPORT.md](VIDEO_SUPPORT.md)** — In-browser video recording, upload to Supabase storage, playback on walls/campaigns/feed

### Administration

- **[ADMIN_FEATURES.md](ADMIN_FEATURES.md)** — Seven admin panels: Boundaries, Analytics, Elections, Election Admins, Visualizer, Theme, News, Moderation, Office Holders

---

## Testing & Verification

- **[TEST_RESULTS_OFFICEHOLDER_CLAIM.md](TEST_RESULTS_OFFICEHOLDER_CLAIM.md)** — End-to-end test results, duplicate prevention verification, test environment details, next steps for QA
- **[DEV_EMAIL_VERIFICATION_BYPASS.md](DEV_EMAIL_VERIFICATION_BYPASS.md)** — Auto-confirm emails in dev-only mode (for testing without email clicks), security guards, setup instructions

---

## Technical Guides

### Backend & Data

- **[SERVICES.md](SERVICES.md)** — Service layer architecture (every Supabase call lives in `src/lib/services/`)
- **[SCHEMA_RELATIONSHIPS.md](SCHEMA_RELATIONSHIPS.md)** — Foreign key diagrams, cardinality, join patterns
- **[SCHEMA_TABLE_INDEX.md](SCHEMA_TABLE_INDEX.md)** — Alphabetical table listing with column counts, row counts
- **[SUPABASE_CONFIGURATION.md](SUPABASE_CONFIGURATION.md)** — Local dev setup (CLI, Docker), migrations, production deployment, RLS, storage

### Frontend

- **[CODE_LAYERS.md](CODE_LAYERS.md)** — Component organization, context, utilities, naming conventions

---

## Data Pipelines & Ingestion

### Boundaries

```
Electoral boundary shapefiles (government sources)
  ↓ (download + validate)
  ↓ ogr2ogr (convert to GeoJSON)
  ↓ scripts/upload_boundary.py (analyze, upload)
  ↓ Supabase PostGIS table (map_shapes)
  ↓ Live map display, user location resolution
```

**Reference**: [adding-boundary-data.md](adding-boundary-data.md)

### Office Holders

```
Government websites + OpenNorth/OpenStates APIs
  ↓ (scripts: populate-*.py)
  ↓ Fetch + parse current MPs/MLAs/Mayors/Governors/Senators
  ↓ Fuzzy match to boundaries
  ↓ Supabase office_holders table + auto-create politician walls
  ↓ Politician profiles appear on election pages + politician directory
```

**References**:
- [OFFICE_HOLDERS_DATA_GUIDE.md](../OFFICE_HOLDERS_DATA_GUIDE.md)
- [OFFICE_HOLDERS_FEATURE.md](OFFICE_HOLDERS_FEATURE.md)

### Elections & Candidates

```
Admin creates election (boundary + role + dates) → candidates register
  ↓ Onboarding: users become politicians, join boundaries
  ↓ Politicians apply for open seats (video intro + questionnaire)
  ↓ Election admin approves/rejects nominations
  ↓ Live campaign pages, voter questions, support tracking
```

**Reference**: [ELECTION_DATA_SOURCES.md](ELECTION_DATA_SOURCES.md)

---

## Glossary

| Term | Definition |
|---|---|
| **Boundary** | Electoral or administrative region (federal riding, province, municipality, etc.). Users belong to multiple boundaries. |
| **Ghost ID** | Anonymous, rotating identity for posts/comments. One per user, changes on "burn identity." Politicians have one static Ghost ID. |
| **Map Shape** | PostGIS geometry record in `map_shapes` table. One per boundary. Powers location resolution ("what boundaries am I in?"). |
| **Constituency** / **Boundary Membership** | The set of boundaries a user belongs to. Set at onboarding, updated when location changes. |
| **Seat** (election) | A specific electoral position (e.g., "House Rep for CA-13"). One seat per role per boundary per election. |
| **Candidacy** | A politician's application to run for a specific seat. One per politician per seat. Includes campaign wall, video intro, questionnaire answers. |
| **Profile** | User account record. Extended by `politician_profiles` (politicians only), `email_subscriptions`, etc. |
| **Wall** | Politician's public profile page. Distinct from campaign pages. Shows engagement (ratings, support), posts, news articles. |
| **Engagement Score** | Civic Impact Score. Points for posting, commenting, upvotes. Used to rank politicians/citizens by activity. |
| **RLS** | Row-Level Security. PostgreSQL policies that filter data per user. Enforces privacy without app logic. |

---

## Key Files by Role

### Product Manager / Designer
- [SCREENS_AND_FEATURES.md](SCREENS_AND_FEATURES.md)
- [PLATFORM_SPEC.md](PLATFORM_SPEC.md)
- [ADMIN_FEATURES.md](ADMIN_FEATURES.md)

### Backend / Database Engineer
- [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md)
- [SCHEMA_RELATIONSHIPS.md](SCHEMA_RELATIONSHIPS.md)
- [SUPABASE_CONFIGURATION.md](SUPABASE_CONFIGURATION.md)
- [SERVICES.md](SERVICES.md)

### Frontend / Full-Stack Engineer
- [CODE_LAYERS.md](CODE_LAYERS.md)
- [AUTHENTICATION_FLOWS.md](AUTHENTICATION_FLOWS.md)
- [API_CACHING_STRATEGY.md](API_CACHING_STRATEGY.md)
- [COMMENTS_AND_MODERATION.md](COMMENTS_AND_MODERATION.md)

### Data / Integration Engineer
- [adding-boundary-data.md](adding-boundary-data.md)
- [OFFICE_HOLDERS_DATA_GUIDE.md](../OFFICE_HOLDERS_DATA_GUIDE.md)
- [ELECTION_DATA_SOURCES.md](ELECTION_DATA_SOURCES.md)

### Admin / Support
- [ADMIN_FEATURES.md](ADMIN_FEATURES.md)
- [SUPABASE_CONFIGURATION.md](SUPABASE_CONFIGURATION.md) (troubleshooting section)

---

## Recent Features (Added Aug 2026)

| Feature | Doc | Status |
|---|---|---|
| **Politician Ratings** | [RATINGS_SYSTEM.md](RATINGS_SYSTEM.md) | Live |
| **News Tagging** | [NEWS_TAGGING.md](NEWS_TAGGING.md) | Live |
| **National/Provincial Heads** | [OFFICE_HOLDERS_FEATURE.md](OFFICE_HOLDERS_FEATURE.md) | Live (PM, Premiers, President auto-populated) |
| **Politician Walls** | [POLITICIAN_WALL_FEATURE.md](POLITICIAN_WALL_FEATURE.md) | Live (separate from campaign pages) |
| **Engagement Summaries** | [RATINGS_SYSTEM.md](RATINGS_SYSTEM.md) | Live (materialized view on ratings) |
| **Enhanced Admin UI** | Integrated InvitationHistoryPanel | Live (shows past invitations, wall link, resend/**merge/reverse with preview**) |
| **Officeholder claim signup-time prefill** | [OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md](OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md) §4.5 | Live (profile prefilled from the officeholder record the moment a claim is redeemed, not just at merge) |
| **Officeholder claim dual-link invite** | [OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md](OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md) §4.1 | Live (one email, two links — sign up fresh or merge into an existing account; completing either invalidates both) |
| **Unified wall claim eligibility + self-service requests** | [OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md](OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md) §4.6 | Live (one eligibility check for both officeholder and generic politician walls; "Claim This Wall" now also works self-service on officeholder walls with no admin invite needed; fixed a bug where the claim button showed on walls that already had a real owner) |

---

## Running & Deployment

### Local Development

```bash
# Install dependencies
npm install

# Start local Supabase (see SUPABASE_CONFIGURATION.md)
supabase start

# Set up .env.local with local keys
# (See SUPABASE_CONFIGURATION.md)

# Start dev server
npm run dev
# → http://localhost:3000
```

### Production Deployment

**Prerequisites**:
- Supabase project created (https://supabase.com)
- Migrations applied to prod database
- `.env.production.local` configured with prod keys

**Deploy**:
```bash
# Push migrations to production
supabase db push --project-id {project-id}

# Deploy app to hosting (Vercel, etc.)
git push  # Auto-deploy on push, or manual deploy via hosting dashboard
```

**Reference**: [SUPABASE_CONFIGURATION.md](SUPABASE_CONFIGURATION.md) → Production Setup

---

## Troubleshooting Quick Links

| Issue | Doc |
|---|---|
| "How do I add a new boundary type?" | [SCHEMA_QUICK_START.md](SCHEMA_QUICK_START.md), [ADMIN_FEATURES.md](ADMIN_FEATURES.md) |
| "How do I update politician data?" | [OFFICE_HOLDERS_DATA_GUIDE.md](../OFFICE_HOLDERS_DATA_GUIDE.md) |
| "User can't log in" | [AUTHENTICATION_FLOWS.md](AUTHENTICATION_FLOWS.md) |
| "Election seats not showing" | [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md) (elections table), [ADMIN_FEATURES.md](ADMIN_FEATURES.md) |
| "Database locked / migrations won't apply" | [SUPABASE_CONFIGURATION.md](SUPABASE_CONFIGURATION.md) → Troubleshooting |
| "Video upload failing" | [VIDEO_SUPPORT.md](VIDEO_SUPPORT.md) → Performance |
| "Content moderation questions" | [COMMENTS_AND_MODERATION.md](COMMENTS_AND_MODERATION.md) |

---

## Contributing

When adding a new feature:
1. Update relevant schema docs (SUPABASE_SCHEMA.md, SCHEMA_RELATIONSHIPS.md)
2. If a new service, add to SERVICES.md
3. Add a new doc file for the feature (follow naming: FEATURE_NAME.md)
4. Link it here in DOCUMENTATION_INDEX.md
5. Update README or PLATFORM_SPEC.md if user-facing

**Documentation checklist**:
- [ ] Schema changes documented
- [ ] RLS policies explained
- [ ] Service functions listed
- [ ] Components/UI behavior described
- [ ] Example usage shown
- [ ] Related files/links added
- [ ] Future enhancements noted

---

## Document History

| Date | Added | Author |
|---|---|---|
| 2026-08-11 | Updated CHOSENO_ARCHITECTURE_GUIDE.md, OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md, OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md — manual audit fixes (missing merge/reverse UI, reversal data-integrity bug, unreachable-wall-after-merge bug, unrelated Claim Profile FK bug) + signup-time profile prefill feature | Claude |
| 2026-08-11 | CHOSENO_ARCHITECTURE_GUIDE.md, OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md, TEST_RESULTS_OFFICEHOLDER_CLAIM.md | Claude |
| 2026-08-11 | Updated OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md, OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md — unified claim eligibility across officeholder and generic politician walls, self-service claim requests (no admin invite needed), admin discoverability panel; fixed "Claim Profile" button showing on already-owned walls and a related FK-violation bug | Claude |
| 2026-08-09 | RATINGS_SYSTEM.md, NEWS_TAGGING.md, POLITICIAN_WALL_FEATURE.md | Claude |
| 2026-08-09 | AUTHENTICATION_FLOWS.md, COMMENTS_AND_MODERATION.md | Claude |
| 2026-08-09 | API_CACHING_STRATEGY.md, ADMIN_FEATURES.md | Claude |
| 2026-08-09 | VIDEO_SUPPORT.md, SUPABASE_CONFIGURATION.md | Claude |
| Earlier | SUPABASE_SCHEMA.md, CODE_LAYERS.md, SERVICES.md, etc. | (prior work) |

---

## Questions?

- **Codebase questions**: Check CODE_LAYERS.md (architecture) and SERVICES.md (data flow)
- **Feature questions**: Search this index for the feature name
- **Data/schema questions**: Start with SUPABASE_SCHEMA.md, then SCHEMA_RELATIONSHIPS.md
- **Deployment questions**: See SUPABASE_CONFIGURATION.md
