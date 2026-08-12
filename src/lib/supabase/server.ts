import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "./types";

// Server-side Supabase client — must be created fresh per *request* (it
// reads the incoming request's cookies via next/headers), never a
// module-level singleton like the browser client in ./client.ts. Use in
// Server Components, Route Handlers, and Server Actions. The setAll
// try/catch below is the documented @supabase/ssr pattern: writing cookies
// from a Server Component throws (cookies can't be set during render, see
// cookies.md) and is safe to ignore there as long as a proxy/middleware
// refreshes the session — Server Components in this app only ever read the
// session, they don't mutate it.
//
// Wrapped in React's cache() so every call *within the same request* (e.g.
// generateMetadata and the page component both calling createClient())
// gets back the same client instance instead of constructing a fresh one
// each time. React resets this cache per request, so it never leaks across
// users/requests. This also makes it possible for cache()-wrapped data
// fetchers elsewhere to actually dedupe: their cache key includes this
// client by reference, so it only matches when callers share one instance.
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://placeholder.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "placeholder-anon-key";

  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component during render — no-op.
          }
        },
      },
    }
  );
});
