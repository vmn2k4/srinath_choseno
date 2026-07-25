# Choseno — Rules for AI-assisted coding sessions

## Before writing any code

Search first. Before adding a new function, component, or file, check whether existing code already does what you need, or could with a small change:

- A Supabase call → check the matching domain file in `src/services/` for an existing function.
- A UI element → check `src/components/` for something already close.
- A helper → check `src/utils/`.

Reuse or extend what exists — parameterize an existing function rather than adding a near-duplicate with a new name. Only write new code once you've confirmed nothing existing covers it, even partially.

## Layered architecture

Full write-up: [docs/CODE_LAYERS.md](docs/CODE_LAYERS.md). Service-layer conventions specifically: [docs/SERVICES.md](docs/SERVICES.md).

Dependency direction is one-way, top to bottom — a layer never imports from the layer above it:

1. **Routing & Shell** (`src/App.jsx`, `src/layouts/`) — routes, auth/onboarding gating, nav chrome.
2. **Pages** (`src/pages/**`) — one file per screen; local UI state; composes components; calls services.
3. **Components** (`src/components/**`) — reusable UI; calls services for its own data.
4. **Context** (`src/contexts/**`) — global cross-cutting state only (currently just auth). Keep this layer small — most state belongs local to the page/component that owns it.
5. **Services** (`src/services/**`) — every Supabase call in the app lives here, domain-organized (`elections.js`, `boundaries.js`, `feed.js`, `profile.js`, `auth.js`, ...). Thin wrappers: same query the caller would've written, `{ data, error }` passed straight through.
6. **Utils** (`src/utils/**`) — pure, stateless helpers, no I/O.
7. **Backend** (`supabase/migrations/**`) — Postgres schema, RLS, `SECURITY DEFINER` RPCs. Anything security- or correctness-critical (ownership checks, invariants) enforces here, not in client JS, since client checks can be bypassed.

**Hard rule:** pages and components never call `supabase.from/.rpc/.storage/.auth` directly — only files under `src/services/` do. If you're about to write `supabase.` in a page or component file, stop and add/extend a service function instead.

New schema/RLS/RPC changes are new numbered `.sql` files under `supabase/migrations/`, applied via `psql` — never edit an already-applied migration in place.
