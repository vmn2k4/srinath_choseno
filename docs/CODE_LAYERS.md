# Code Layers

This describes the layers the frontend codebase is built from — what each one owns, what it's allowed to depend on, and where new code belongs. It's the map to consult before adding anything.

Related docs:
- [ARCHITECTURE.md](../ARCHITECTURE.md) — product/system design: data model, RLS, features.
- [docs/SERVICES.md](SERVICES.md) — internal conventions for the service layer specifically (naming, pagination, intentional divergences).

## The layers, top to bottom

```
Routing & Shell   src/App.jsx, src/layouts/
      ↓
Pages             src/pages/**
      ↓
Components        src/components/**
      ↓        ↘
Context          Services (data access)
src/contexts/**   src/services/**
                       ↓
                  Utils              src/utils/**
                       ↓
                  Backend            supabase/migrations/**
```

Dependency direction only flows downward. A lower layer never imports from a higher one — `src/services/*.js` never imports a page or component, `src/utils/*.js` never imports a service.

### 1. Routing & Shell — `src/App.jsx`, `src/layouts/MainLayout.jsx`

Owns the route table (`<Routes>`) and `ProtectedRoute`'s auth/onboarding/admin gating, plus the persistent nav chrome. Doesn't fetch data or hold business state itself.

**New code here when:** adding a new route, changing what gates access to a route, changing the persistent nav shell.

### 2. Pages — `src/pages/**`

One file per screen. Owns that screen's local UI state (`useState`), composes components, and calls the service layer for data — never `supabase` directly. Registered as a route in `App.jsx`.

**New code here when:** adding a new screen. Keep it to layout + local state + calling services/components — if a chunk of a page's JSX or logic would be useful on another page, that's a signal it belongs in `src/components/` instead.

### 3. Components — `src/components/**`

Reusable UI pieces used by more than one page (or complex enough to deserve their own file even if only used once), e.g. `BoundaryPicker`, `VideoRecorder`, `LinkPreview`, `wall/WallPostFeed` (shared between `PoliticianWall` and `CandidacyWall` so they're actually the same wall, not two lookalikes). Same rule as pages: call services for data, never `supabase` directly — see `docs/SERVICES.md`'s "Known layering violations" for the handful of pre-existing spots that don't yet follow this.

**New code here when:** a piece of UI is (or will be) reused across pages, or a page file is getting large and a self-contained chunk of it can be extracted.

### 4. Context — `src/contexts/**`

Cross-cutting global state that many unrelated parts of the tree need — currently just `AuthContext` (session + profile). This layer is intentionally small.

**New code here when:** state is genuinely global (needed by the router, multiple unrelated pages, etc.) — not just "state I don't want to pass through two levels of props." Most state should stay local to the page or component that owns it.

### 5. Services (data access) — `src/services/**`

Every Supabase call in the app, domain-organized (`elections.js`, `boundaries.js`, `feed.js`, `profile.js`, `auth.js`, ...). Thin wrappers only — same query the caller would have written, `{ data, error }` passed straight through, no reshaping or business logic. Full conventions in [docs/SERVICES.md](SERVICES.md).

**New code here when:** anything talks to Supabase. This is the only layer allowed to import `src/services/supabase.js`'s `supabase` client directly (aside from `supabase.js` itself).

### 6. Utils — `src/utils/**`

Pure, stateless helpers with no I/O — `fetchAllPages`, `countVertices`. Not for anything that touches the network or Supabase; that's a service function.

**New code here when:** you need a small pure function (formatting, math, pagination plumbing) reusable across services, components, or pages.

### 7. Backend — `supabase/migrations/**`

Postgres schema, RLS policies, and `SECURITY DEFINER` RPC functions. This is where trust boundaries actually get enforced — anything security- or correctness-critical (ownership checks, cross-table invariants, "can this user do this") belongs here, not in client-side JS, because client-side checks can always be bypassed.

**New code here when:** adding/changing a table, RLS policy, or RPC. Ship it as a new numbered `.sql` file under `supabase/migrations/`, applied via `psql`. Never edit an already-applied migration file in place.

## Adding new code — check first

Before writing a new function, component, or file: search for something that already does it, or could with a small parameter added.

- Adding a Supabase call? Check the relevant `src/services/*.js` file for an existing function first — a near-identical query likely already exists (see [docs/SERVICES.md](SERVICES.md)'s duplication notes for the pattern of collapsing near-duplicates into one parameterized function).
- Adding UI? Check `src/components/` for something already close to what you need.
- Adding a helper? Check `src/utils/`.

Extend or parameterize existing code before adding a new function with a new name that does almost the same thing. Only write genuinely new code when nothing existing covers it — including partially.
