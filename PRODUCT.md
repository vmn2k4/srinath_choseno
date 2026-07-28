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
- **Stack**: React 19, Vite, Tailwind CSS, Leaflet (`react-leaflet` + `@turf/turf`), Supabase (Postgres 17 + PostGIS, RLS, RPCs).
- **Architecture**: Layered design (`Routing -> Pages -> Components -> Context -> Services -> Utils -> Backend`). Pages and components never invoke Supabase directly; all data access is encapsulated in `src/services/`.
- **Identity Model**: Posts and comments are tied exclusively to rotatable `ghost_id` UUIDs rather than permanent profile IDs. Executing `burn_ghost_identity()` breaks identity linkage for future posts while retaining historical posts under orphaned ghost IDs.

## Brand Commitments
- Name: **Choseno**
- Core ethos: Privacy, anonymity, local civic empowerment, and authentic regional boundaries.

## Evidence on Hand
- Full codebase with layered React architecture, maps integration, and Supabase migrations.
- Detailed reference documentation in [ARCHITECTURE.md](file:///Users/vmn2k4/Coding/Choseno/ARCHITECTURE.md), [CLAUDE.md](file:///Users/vmn2k4/Coding/Choseno/CLAUDE.md), and `docs/`.

## Product Principles
1. **Privacy & Anonymity First**: Protect user identity with un-linkable ghost IDs and boundary-level spatial resolution.
2. **Authentic Regional Scoping**: Anchor civic conversations strictly to real, verified electoral and municipal boundaries.
3. **Low-Barrier Engagement**: Deliver a clean, responsive feed and map interface designed for rapid scanning and community participation.
4. **Architectural Discipline**: Maintain strict layer boundaries where services handle I/O and database RLS enforces security invariants.

## Accessibility & Inclusion
- Responsive web layout supporting varying viewport sizes (mobile & desktop).
- Accessible form controls, map controls, and readable typography contrast for civic information.
