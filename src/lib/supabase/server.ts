import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

// Server-side Supabase client — must be created fresh per request (it reads
// the incoming request's cookies via next/headers), never module-level
// singleton like the browser client in ./client.ts. Use in Server
// Components, Route Handlers, and Server Actions. The setAll try/catch below
// is the documented @supabase/ssr pattern: writing cookies from a Server
// Component throws (cookies can't be set during render, see cookies.md) and
// is safe to ignore there as long as a proxy/middleware refreshes the
// session — Server Components in this app only ever read the session, they
// don't mutate it.
export async function createClient() {
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
}
