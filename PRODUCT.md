# Product

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
- **Architecture**: Layered App Router design (`App Routes -> Feature Components -> Service Layer -> Backend RPCs/RLS`). Data access is encapsulated in `src/lib/services/`.
- **Identity & Representative Model**: Posts and comments are tied exclusively to rotatable `ghost_id` UUIDs. Every elected official across 10,661 North American boundaries automatically receives a dedicated **Politician Wall** (`/wall/[ghostId]/[slug]`), linkable to verified accounts when claimed.
- **Office Holder Coverage**: Complete multi-tier coverage for US Representatives, US Senators, State Governors, 50-State Legislators, US Municipal Mayors & Council Members, Canadian MPs, Provincial MLAs/MPPs/MHAs, and Canadian Municipal Mayors & Councillors.

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

## Accessibility & Inclusion
- Responsive web layout supporting varying viewport sizes (mobile & desktop).
- Accessible form controls, map controls, and readable typography contrast for civic information.
