import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { Database } from "./types";

// Cookie-free Supabase client for server-rendered pages that only ever read
// data behind a `USING (true)`-style public RLS policy (or a policy whose
// condition doesn't depend on auth.uid() at all -- e.g. news_articles'
// `status = 'published' AND published_at <= now()`). ./server.ts's
// createClient() reads the request's cookies unconditionally before running
// a single query, and that's a Next.js request-time API -- touching it
// takes the whole route out of the caching `export const revalidate` relies
// on, even on pages that never check who's signed in.
//
// NEVER use this for a query whose RLS policy branches on auth.uid() (a
// user's own row, an admin-only branch like election_candidates' `status
// <> 'draft' OR is-admin`, anything scoped to "my own"). This client always
// presents an anonymous session, so an auth-gated branch will just silently
// return fewer rows instead of erroring -- confirm the exact RLS policy
// text for every table a page touches before switching it to this client
// (see the Query & Cost Audit report, "Caching" section, for the concrete
// case that motivated this rule: election_candidates lets an admin preview
// a draft election specifically because their session's auth.uid() passes
// that check).
export const createPublicClient = cache(async function createPublicClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://placeholder.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "placeholder-anon-key";

  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false },
  });
});
