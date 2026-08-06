// The app has a single Supabase project shared by dev and prod (no separate
// staging DB) -- test/production visibility is decided by which build is
// running, not by which database is queried. Every content row carries an
// is_test flag (see 20260806000006_test_content_flag.sql); this is the one
// place that decides which side of that flag the running app is on.
//
// FAKE_PROD_STORAGE_KEY below is an intentional exception to the "utils are
// pure, no I/O" rule -- it's a dev-only manual QA toggle (see
// components/dev/FakeProductionToggle.tsx), not a domain concern. It reads
// localStorage, so it can only flip client-side; a page that hasn't
// hydrated yet (initial SSR HTML) still reflects real dev data until the
// client-fetching components on that page re-run their effects.
const FAKE_PROD_STORAGE_KEY = "choseno:fake-production";

export function isDevEnvironment(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return !isFakeProductionActive();
}

export function isFakeProductionActive(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(FAKE_PROD_STORAGE_KEY) === "true";
}

export function setFakeProductionMode(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) window.localStorage.setItem(FAKE_PROD_STORAGE_KEY, "true");
  else window.localStorage.removeItem(FAKE_PROD_STORAGE_KEY);
}
