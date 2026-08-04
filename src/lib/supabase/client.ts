import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// Browser-side Supabase client — one per module load, safe to import
// directly into any Client Component. Every src/lib/services/** function
// takes a client as its first argument (see docs/SERVICES.md's port notes);
// Client Components pass this one, Server Components pass createServerClient
// from ./server.ts instead. Never share a browser client across requests on
// the server — it holds no per-request state to leak, but the server client
// below exists specifically because this one can't read Next's cookies.
export function createClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://placeholder.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "placeholder-anon-key";
  return createBrowserClient<Database>(url, key);
}
