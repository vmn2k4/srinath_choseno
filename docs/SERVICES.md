# Service Layer

## Purpose

Every Supabase call (`.from()`, `.rpc()`, `.storage`, `.auth`) lives in `src/services/`, one file per domain, one small named function per backend operation. Components never call `supabase` directly — they import and call a service function instead. This keeps each page's own code focused on UI/state, and gives the whole app one place that documents exactly what backend operations exist.

## File map

| File | Domain | Used by |
|---|---|---|
| `supabase.js` | Client init only | (imported by every other service file) |
| `elections.js` | elections, election_seats, election_candidates, election_administrators, questions/options, candidate answers, election RPCs | `ElectionsAdmin`, `ElectionAdminApplications`, `PoliticianElections`, `CandidateApplication`, `CandidacyWall`, `ElectionsPage`, `ElectionSeatPage` |
| `boundaries.js` | countries, country_boundary_types, map_shapes, boundary_uploads, boundary RPCs (geojson, containers, redistricting, shape insert) | `BoundaryVisualizer`, `BoundaryUploadsPanel`, `RedistrictingPanel`, `BoundaryPicker`, `AdminPage`, `UserPage`, `StepLocation`, plus `ElectionsAdmin`/`PoliticianElections` for country/type/shape lookups |
| `politicalParties.js` | political_parties CRUD | `AdminPage`, `StepPolitician` |
| `feed.js` | posts (main feed), comments, post-image storage, ghost-identity RPC, election notifications, silent data export | `FeedPage`, plus `PoliticianWall`/`CandidacyWall` for the shared `createComment`/`uploadPostImage` helpers |
| `politicianWall.js` | politician_supporters, wall-scoped profile/posts lookups, wall post creation (direct insert) | `PoliticianWall` |
| `profile.js` | profiles, user_locations, user_boundary_memberships, politician_profiles, the AuthContext self-healing profile fetch | `ProfilePage`, `EditProfileFlow`, `OnboardingFlow`, `AuthContext`, plus `FeedPage`/`PoliticianWall`/`CandidacyWall`/`ElectionsPage` for profile/membership lookups |
| `auth.js` | auth.signUp / signInWithPassword / signOut / getSession / onAuthStateChange | `AuthPage`, `AuthContext` |
| `video.js` | storage upload/getPublicUrl for video (bucket-parameterized) | `VideoRecorder` |

## Conventions

- Naming: `getX` (read), `createX` (insert), `updateX` (update), `deleteX` (delete), `upsertX` (upsert). RPC-backed functions keep the RPC's own name in spirit (e.g. `findShapesInContainers` wraps `find_shapes_in_containers`).
- Every function returns whatever the underlying Supabase call returns — normally `{ data, error }`, passed straight through. No added error handling, no thrown exceptions, no reshaping — that stays in the component.
- Paginated queries (result sets that can exceed Supabase/PostgREST's 1000-row default cap) go through `src/utils/fetchAllPages.js`, called from inside the service function.
- A handful of functions accept an options object (`{ columns, orderBy, paginated }` etc.) instead of being split into near-duplicate variants, when multiple call sites need the same base query with minor differences. Where two call sites look similar but are *not* the same operation, they stay as two separate functions — see below.

## Known intentional divergences

Two near-identical-looking operations are deliberately **not** unified, because they are not actually the same operation:

- **Ghost-ID burn**: `feed.js`'s `burnGhostIdentityViaRpc()` (used by `FeedPage`) calls the `burn_ghost_identity` RPC. `profile.js`'s `burnGhostIdRaw()` (used by `ProfilePage`) does a raw `profiles.current_ghost_id` update instead, bypassing whatever server-side logic the RPC runs. This was already the case before the service-layer extraction — do not merge these into one function.
- **Post creation**: `feed.js`'s `createFeedPost()` (used by `FeedPage`) calls the `create_post` RPC. `politicianWall.js`'s `createWallPost()` (used by `PoliticianWall`) does a direct `posts.insert()` with `wall_ghost_id` set instead. Do not merge these either.

If you're about to "clean up" one of these into the other, check with whoever owns that RPC first — the divergence may be load-bearing.

## Known layering violations

A full-codebase audit (2026-07-25, prompted by a direct request to check compliance) found three spots where `src/pages/**`/`src/components/**` imported `supabase` directly, bypassing this layer. The two real violations were fixed during the app-wide design-centralization pass (since both files were already being opened for that pass anyway):

- **`src/components/PoliticianSidebar.jsx`** — **Fixed.** Its direct `supabase.from('politician_profiles').select(...)` query is now `getInterestedPoliticians()` in `profile.js`.
- **`src/pages/PoliticianWall.jsx`** — **Fixed.** Its direct `supabase.channel(...)`/`removeChannel(...)` realtime subscription is now `subscribeToSupportChanges()`/`unsubscribeFromSupportChanges()` in `politicianWall.js`.
- **`src/components/map/MapComponent.jsx`** — imports `supabase` but never calls it. Dead code, not a functional violation; still not fixed, cheap to delete whenever this file is next edited.

Full context: `ARCHITECTURE.md` §20.

## Flutter-port framing

This service layer is not itself portable to a future Flutter/Dart client — Dart can't import JavaScript. The actual shared surface between a web client and a Flutter client is the Supabase schema, RLS policies, and RPC functions, which already exist and are already shared regardless of this refactor. What this layer is useful for when writing a Dart equivalent later is that it's now a single, accurate map of every backend operation the app performs — table names, RPC names, parameter shapes — worth reading as a reference, not copying as code.

## Rollout status

- [x] Elections domain
- [x] Boundaries/Admin domain
- [x] Feed domain
- [x] Profile/Auth/Onboarding domain
