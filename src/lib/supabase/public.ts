import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Anonymous, cookie-free Supabase client for reading already-public data
 * from routes that must stay static-cacheable — specifically the dynamic
 * opengraph-image.tsx files (news/[slug], candidacy/[candidateId],
 * wall/[ghostId], wall/[ghostId]/[slug], elections/seat/[seatId]).
 *
 * These routes were built with the regular server client (./server.ts),
 * which calls next/headers' cookies() to read the visitor's session. Next.js
 * treats cookies() as a "Request-time API" and forces the whole route into
 * fully dynamic rendering (see node_modules/next/dist/docs/01-app/03-api-
 * reference/03-file-conventions/01-metadata/opengraph-image.md: "generated
 * images are statically optimized... unless they use Request-time APIs") —
 * confirmed in prod via `cache-control: public, max-age=0, must-revalidate`
 * on every hit, i.e. zero caching, a full DB round trip + Satori render on
 * every single request including every retry from a social platform's
 * crawler. Every one of these image routes only ever reads rows that are
 * already public (published articles, public politician profiles) — no
 * session/auth context is needed, so pulling in cookies() at all was an
 * accidental opt-out of caching, not a deliberate one. This client never
 * touches cookies, so importing it doesn't trip that opt-out; combined with
 * each route's `export const revalidate`, Vercel's edge can now actually
 * cache the rendered PNG instead of cold-rendering it every time.
 *
 * RLS-equivalent to the server client for these queries: when nobody is
 * logged in, the cookie-based client already runs as the `anon` role under
 * RLS — the same privilege level this client always has. Switching doesn't
 * change what data these routes can see, only whether the route is dynamic.
 */
export function createPublicClient() {
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
}
