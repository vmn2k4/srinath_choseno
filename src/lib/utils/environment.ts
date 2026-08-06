// The app has a single Supabase project shared by dev and prod (no separate
// staging DB) -- test/production visibility is decided by which build is
// running, not by which database is queried. Every content row carries an
// is_test flag (see 20260806000006_test_content_flag.sql); this is the one
// place that decides which side of that flag the running app is on.
export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== "production";
}
