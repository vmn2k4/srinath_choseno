import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

// Refresh Supabase auth cookies before Server Components run. Otherwise an
// expired access token can make the server render /admin as signed out while
// the browser still has a refresh token, causing an auth redirect loop.
//
// NOTE: do NOT add a www <-> apex redirect here. It was added once (see git
// blame) to enforce canonical-domain consistency and instead caused an
// infinite redirect loop on www.choseno.com in production -- the hosting
// platform's own Domain settings almost certainly already redirect one
// direction (apex<->www) at the DNS/edge level, and an app-level redirect
// going the other way ping-pongs against it forever. Canonicalization
// belongs in exactly one place; keep it in the platform's Domain settings,
// not here.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
