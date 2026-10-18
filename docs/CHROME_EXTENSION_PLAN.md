# Choseno Companion — Voice of the Silent Majority (Chrome Extension) — Plan

> Status: draft plan, 2026-10-18. Nothing built yet.

## What it is

A Manifest V3 Chrome extension. On any web page (news article, tweet, council agenda, YouTube video) the user opens the Companion, writes their honest view, and it is posted to Choseno as a Ghost-ID post carrying that link, delivered to **all of the user's districts** (their `user_boundary_memberships`). This is the "give your view to a ballot box" input path described in [VISION.md](VISION.md): speak where you read, without a name attached.

## What already exists (reuse, don't rebuild)

| Need | Existing piece |
|---|---|
| Create a post + fan out to districts | `create_post` RPC (`20261015000000_create_post_target_boundaries.sql`). With `p_boundary_ids` NULL it copies **every** `user_boundary_memberships` row into `post_boundaries` — exactly "all districts of that profile". Ghost ID resolved server-side from `auth.uid()`. |
| Link card (title/desc/image/video) | `link-preview` Supabase edge function, wrapped by `fetchLinkPreview` in `src/lib/services/linkPreview.ts`; stored in `posts.link_metadata`. |
| Service wrapper | `createFeedPost` in `src/lib/services/feed.ts` (thin `supabase.rpc("create_post")`). |
| Ghost ID, anonymity, test flag | `profiles.current_ghost_id`; `is_test` via `isDevEnvironment()`. |
| Moderation, flags | `content_flags`, admin moderation ([COMMENTS_AND_MODERATION.md](COMMENTS_AND_MODERATION.md)) apply automatically since these are normal posts. |
| Auth backend | Supabase Auth, redirect allow-list in Supabase dashboard ([AUTHENTICATION_FLOWS.md](AUTHENTICATION_FLOWS.md)). |
| Mobile precedent | `mobile/` Flutter app is a second client of the same RPCs — the extension is a third. No new API server needed. |

Doc drift to be aware of: `CODE_LAYERS.md` / `CLAUDE.md` still describe the old Vite layout (`src/App.jsx`, `src/services/*.js`); the real app is Next.js with `src/lib/services/*.ts`. The extension lives outside `src/`, so it gets its own thin service module following the same rule: **UI never calls `supabase.*` directly; only `extension/src/services/*` does.**

## Architecture

```
extension/                       (new top-level dir, own package.json, Vite + @crxjs or WXT, TypeScript)
  manifest.json                  MV3
  src/
    background/service-worker.ts   auth session refresh, context-menu, message router
    sidepanel/ (React)             composer UI (primary surface)
    popup/                         tiny: sign-in state + "Open composer"
    content/capture.ts             injected on demand: selected text, canonical URL, og tags
    services/
      supabase.ts                  client w/ chrome.storage.local adapter (persistSession, no cookies)
      auth.ts                      sign-in / sign-out / getSession
      posts.ts                     createExtensionPost -> rpc create_post
      districts.ts                 list the user's districts (read-only preview)
      linkPreview.ts               invoke 'link-preview' edge fn
    utils/url.ts                   canonicalize (strip utm_*, fbclid, hash; honour <link rel=canonical>)
  store/                         icons, screenshots, privacy policy copy
```

Layering mirrors [CODE_LAYERS.md](CODE_LAYERS.md): UI → services → (Supabase RPC/edge fn) → utils; backend enforcement stays in migrations.

### Permissions (keep minimal — Chrome Web Store review and user trust)

`activeTab`, `scripting` (inject capture only when the user clicks), `storage`, `sidePanel`, `contextMenus`, `identity` (if OAuth). **No** `<all_urls>` host permission, no `tabs` history access, no background reading of pages. Host permission only for the Supabase project origin. This matters for the brand: a privacy product cannot ship a browse-history-reading extension.

### Auth

Extensions can't use the web app's cookie session. Options:
1. **Recommended:** `chrome.identity.launchWebAuthFlow` to Supabase OAuth (Google, whichever providers the web app already offers) + email/password form fallback; session stored in `chrome.storage.local`, refreshed in the service worker. Add `https://<extension-id>.chromiumapp.org/*` to Supabase redirect URLs.
2. Handoff from the web app (`/auth/extension` page postMessages a refresh token). Nicer for existing logged-in users but more surface to secure; do later if sign-in friction is high.

Users without a profile/location (onboarding incomplete → no districts) get a "Finish setup on choseno.com" state, since a post with zero `user_boundary_memberships` would reach nobody.

## User flows

1. **Compose:** click toolbar icon or right-click page/selection/link → "Share my view on Choseno". Side panel opens pre-filled with page title, favicon, link card, and any selected text as a quote (clearly marked, length-capped, quote not counted as the user's words).
2. **Review reach:** panel shows "Will be posted to: Ward 5, City Council, Riding X … (N districts)" fetched from the user's memberships. Optional later: deselect districts (the RPC already supports `p_boundary_ids`).
3. **Post:** `create_post(p_content, p_link_metadata = {url, title, description, image, source:'extension'}, p_boundary_ids = NULL)`. Success state links to `choseno.com/post/<id>`.
4. **Signed out / offline / rate-limited:** clear inline states; draft kept in `chrome.storage.local` per canonical URL.

## Backend changes (new numbered migrations only — never edit applied ones)

1. **Provenance + abuse control** — `posts.source text` (`'web' | 'mobile' | 'extension'`, default `'web'`) or carry it in `link_metadata`; cheaper and enough for v1: use `link_metadata.source`. Add a per-user daily cap for extension posts inside `create_post` (client checks are bypassable; follows the existing politician-daily-limit pattern).
2. **URL safety** — validate in the RPC that `link_metadata.url` is `http(s)` and ≤ 2 KB; reject `javascript:`/`data:`. Render links with `rel="noopener noreferrer nofollow"` (check existing post card).
3. **Optional (phase 2):** `get_link_opinion_summary(url_hash)` RPC so the extension can show "N residents in your districts have shared a view on this link" — requires a normalized `link_url_hash` column + index on `posts`. Do not build before demand is shown.

No new tables for v1. Edge function `link-preview` is already CORS-callable from the mobile app; confirm it accepts the extension's origin and the user's JWT.

## Product decisions to confirm (they change scope)

1. **One post per user per link?** VISION.md is "one opinion per person per thread". Recommend enforcing in the RPC: a second post by the same user on the same canonical URL is rejected (or edits the first) — stops the extension becoming a spam cannon.
2. **Is each opinion a separate feed post, or a comment on one shared thread per URL?** Request says "gets posted to all districts", and a thread-per-URL would live in only one set of districts. Plan assumes **separate post per user** (v1), with the shared per-URL summary as phase 2.
3. **Verification/brigading:** extension posts are low-friction, so they're the likeliest vector for out-of-area or bot spam. Plan: same account auth as web (no anonymous posts), daily cap, `content_flags` already works; weight/label by Verified Local later per VISION.md.
4. **Branding:** name "Choseno Companion — Voice of the Silent Majority"; Web Store title limit is 75 chars, short name "Choseno Companion". Needs 16/32/48/128 icons from the existing brand kit and a privacy-policy URL (`/privacy` exists — add an extension section: we read only the page URL/title/selection you choose to share).

## Phases

1. **Spike (1–2 days):** MV3 scaffold, Supabase client with storage adapter, sign-in, hard-coded post with `is_test=true` visible in dev feed. Verify `create_post` fan-out end to end against dev DB.
2. **v1 (≈1 week):** side panel composer, capture script, link preview, district preview, context menu, drafts, error states, theming via the same design tokens as [DESIGN.md](../DESIGN.md) (extract colors/fonts to CSS vars; no raw hex), migration for caps/URL validation, Playwright e2e of the composer against local app.
3. **Store release:** privacy-policy update, listing assets, review submission (expect days), unlisted/private-testers first. Release script alongside the Android one (build zip → upload).
4. **Phase 2:** per-link opinion summary, district deselect, Verified Local badge, Firefox/Edge build (WXT makes this cheap), keyboard shortcut.

## Risks

- **Chrome Web Store rejection** for broad permissions or unclear privacy disclosure → mitigated by activeTab-only design.
- **Token handling:** refresh token in `chrome.storage.local` is readable by the extension only, but any XSS in the side panel exposes it → strict CSP, no remote code, no `innerHTML` of page-derived text.
- **Spam/astroturf via scripted posting** → server-side caps + one-per-URL + existing moderation.
- **Untrusted page content:** page title/selection/OG data are user-facing text; escape on render in extension *and* web feed.
- **Anonymity leak:** the extension must never send the user's browsing context beyond the URL they explicitly share; no analytics beyond the existing `client_error_logs` pattern, and no page-content logging.
