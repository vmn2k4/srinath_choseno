import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";
import { pingIndexNow } from "@/lib/services/indexnow";

// Admin-only bridge so AdminNewsPageClient (a client component, per the
// layered architecture) can trigger a server-side IndexNow push right after
// a publish/update instead of waiting for the next sitemap crawl. Mirrors
// the auth pattern in api/admin/news-import/generate/route.ts.

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await getProfileRole(supabase, user.id);
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { urls?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const urls = (body.urls || []).filter((u) => typeof u === "string" && u.length > 0);
  if (urls.length === 0) {
    return NextResponse.json({ error: "urls is required and must be non-empty" }, { status: 400 });
  }

  const result = await pingIndexNow(urls);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
