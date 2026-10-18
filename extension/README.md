# Choseno Companion (Chrome extension)

Popup composer that mirrors the website's post modal and auto-attaches the current page's link. See [docs/CHROME_EXTENSION_PLAN.md](../docs/CHROME_EXTENSION_PLAN.md).

```bash
node extension/build.mjs --dev   # dev build: posts flagged is_test (like `next dev`)
node extension/build.mjs         # production build
```
Then chrome://extensions → Developer mode → Load unpacked → `extension/dist`.

Reuses `src/lib/services/*` directly (esbuild alias `@` → `src`). Google sign-in needs the redirect URL from `chrome.identity.getRedirectURL()` (`https://<extension-id>.chromiumapp.org/`) added in Supabase → Auth → URL Configuration.
