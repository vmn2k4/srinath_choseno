# Choseno Product Overview

**Choseno** is an anonymous civic social platform that empowers citizens and communities to engage with local government and elected officials, while preserving privacy and authenticity through boundary-verified anonymous identities.

## Core Purpose

Enable constituents in electoral/administrative boundaries (federal ridings, municipalities, provinces, states) to:
- **Discuss** local civic issues anonymously under rotating "ghost IDs"
- **Rate & Review** elected officials with transparent community feedback (5-star ratings + comments)
- **Discover Candidates** during active elections with candidate walls and live engagement metrics
- **Track Engagement** with civic impact scores and politician/candidate performance analytics
- **Protect Privacy** via un-linkable ghost IDs that can be "burned" and regenerated anytime, with zero data leakage between identities

Every post, comment, and rating is automatically scoped to the poster's real-world electoral boundaries — no manual region selection needed, no doxxing risk.

---

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Citizens, community members, local political representatives, and voters engaging in civic discourse within specific electoral and administrative boundaries (e.g. federal ridings, municipalities).

## Product Purpose
An anonymous civic social platform that allows users to share posts, participate in local discussions, and vote on community topics without exposing their real identity or physical home address. Every post is automatically verified and scoped to the user's real electoral/administrative boundaries.

## Positioning
Location-aware, boundary-verified anonymous civic engagement powered by rotatable "Ghost IDs" and PostGIS spatial queries. Provides authentic, localized community context without doxxing or persistent profile targeting.

## Operating Context
Web application evaluated on modern mobile and desktop web browsers. Features continuous feed scanning, interactive map exploration, boundary-scoped voting, civic posts, and identity management ("burn ghost ID").

## Capabilities and Constraints
- **Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Leaflet (`react-leaflet` + `@turf/turf`), Supabase (Postgres 17 + PostGIS, RLS, RPCs).
- **Architecture**: Layered App Router design (`App Routes -> Feature Components -> Service Layer -> Backend RPCs/RLS`). Data access is encapsulated in `src/lib/services/`. All avatar/photo rendering centralized in a single `Avatar` primitive component with graceful fallback to user initials on broken/missing images.
- **Identity & Representative Model**: Posts and comments are tied exclusively to rotatable `ghost_id` UUIDs. Every elected official across 10,661 North American boundaries automatically receives a dedicated **Politician Wall** (`/wall/[ghostId]/[slug]`), linkable to verified accounts when claimed.
- **Office Holder Coverage**: Complete multi-tier coverage for US Representatives, US Senators, State Governors, 50-State Legislators, US Municipal Mayors & Council Members, Canadian MPs, Provincial MLAs/MPPs/MHAs, and Canadian Municipal Mayors & Councillors. **Current office holders displayed on election seat pages in compact sidebar format**, showing engagement stats and profile links.
- **Ratings & Engagement**: Community members can rate elected officials and politicians on a 5-star scale with optional comments. All ratings are public and aggregated by politician. Engagement metrics (supporter count, average rating, total ratings, comment count) are displayed throughout the app.

## Brand Commitments
- Name: **Choseno**
- Core ethos: Privacy, anonymity, local civic empowerment, authentic regional boundaries, and transparent representative accountability.

## Evidence on Hand
- Full codebase with Next.js App Router architecture, maps integration, Supabase migrations, and automated office holder data pipelines.
- Detailed reference documentation in [ARCHITECTURE.md](file:///Users/vmn2k4/Coding/Choseno/ARCHITECTURE.md), [OFFICE_HOLDERS_DATA_GUIDE.md](file:///Users/vmn2k4/Coding/Choseno/OFFICE_HOLDERS_DATA_GUIDE.md), and `docs/`.

## Product Principles
1. **Privacy & Anonymity First**: Protect user identity with un-linkable ghost IDs and boundary-level spatial resolution.
2. **Authentic Regional Scoping**: Anchor civic conversations strictly to real, verified electoral and municipal boundaries.
3. **Low-Barrier Engagement**: Deliver a clean, responsive feed and map interface designed for rapid scanning and community participation.
4. **Architectural Discipline**: Maintain strict layer boundaries where services handle I/O and database RLS enforces security invariants.

## Feature Highlights

### Ratings & Reviews System
- Community members can submit star ratings (1-5 stars) and optional written reviews for any politician or office holder
- 6-month cooldown per user per politician (server-enforced via RPC)
- All feedback is public and aggregated to show average rating, total ratings, and comment count
- Ratings modal displays politician name, engagement stats, individual reviews, and rating composer
- Integrated throughout app: politician walls, election candidates, office holder sidebars
- Modal properly styled with theme-level color variables for contrast and readability

### Office Holder Directory
- Current elected officials are fetched automatically from the office_holders table
- Displayed in election seat pages as a compact, scrollable sidebar
- Each office holder shows: avatar (with graceful fallback to initials), name, "On Choseno" badge if linked to a profile, engagement stats (supporters, rating, comments), role/title, and political party
- Engagement stats are batch-fetched for efficiency across all displayed office holders
- Links navigate to politician wall pages (via current_ghost_id, not raw profile id)
- "View Full Office Holder Directory" link provides additional context for the boundary

### Avatar System
- Centralized `Avatar` component used across entire app for person photos
- Gracefully falls back to colored initial-letter circle when:
  - No image URL is provided
  - Image URL is broken/404s (detected via onError handler)
  - Image fails to load for any reason
- Consistent styling across all surfaces (walls, sidebar, candidate cards, feed profile summary)
- Prevents "broken image" glyphs and overflowing text in constrained spaces
- Theme-aware gradient background for initial circles

## Accessibility & Inclusion
- Responsive web layout supporting varying viewport sizes (mobile & desktop).
- Accessible form controls, map controls, and readable typography contrast for civic information.
- Consistent avatar rendering with high-contrast initial circles for visibility.
- Modal interactions properly focused and keyboard-navigable.
