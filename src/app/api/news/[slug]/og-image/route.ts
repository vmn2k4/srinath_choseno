import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";
import { generateNewsArticleOgImage } from "@/lib/services/newsOgImage";
import type { Database } from "@/lib/supabase/types";

// Generates (once) and stores the branded share-card PNG for one article,
// then saves its URL to news_articles.hero_image_url -- see
// generateNewsArticleOgImage in src/lib/services/news.ts for why. Called
// automatically right after publish, never as a manual step, from two
// places:
//   1. AdminNewsPageClient's publish action (browser, cookie session).
//   2. The scripts/*.js ingestion scripts, immediately after an insert with
//      status: "published" (no browser session -- see getAuthHeaders() in
//      scripts/insert-news-batch.js, which already sends either the
//      Supabase service-role key or a password-grant admin JWT as a Bearer
//      token for exactly this reason).
//
// Auth accepts either: a logged-in admin's cookie session (mirrors the
// pattern in api/admin/news-import/generate/route.ts), or an
// Authorization: Bearer token that's either the Supabase service-role key
// (full RLS bypass -- only usable if SUPABASE_SERVICE_ROLE_KEY is also set
// in this app's own server env, not just the scripts' .env.local) or a
// normal Supabase access token for a user whose profiles.role is "admin".
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

  // 1. Cookie session (admin UI)
  const cookieClient = await createClient();
  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  if (user) {
    const { data: profile } = await getProfileRole(cookieClient, user.id);
    if (profile?.role === "admin") {
      const { url: imageUrl, error } = await generateNewsArticleOgImage(cookieClient, slug);
      if (error) return NextResponse.json({ error }, { status: 502 });
      return NextResponse.json({ url: imageUrl });
    }
  }

  // 2. Bearer token (ingestion scripts -- no cookie session available)
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer) {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && bearer === process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const serviceClient = createSupabaseClient<Database>(url, bearer, { auth: { persistSession: false } });
      const { url: imageUrl, error } = await generateNewsArticleOgImage(serviceClient, slug);
      if (error) return NextResponse.json({ error }, { status: 502 });
      return NextResponse.json({ url: imageUrl });
    }

    const tokenClient = createSupabaseClient<Database>(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const {
      data: { user: tokenUser },
    } = await tokenClient.auth.getUser(bearer);
    if (tokenUser) {
      const { data: profile } = await getProfileRole(tokenClient, tokenUser.id);
      if (profile?.role === "admin") {
        const { url: imageUrl, error } = await generateNewsArticleOgImage(tokenClient, slug);
        if (error) return NextResponse.json({ error }, { status: 502 });
        return NextResponse.json({ url: imageUrl });
      }
    }
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
