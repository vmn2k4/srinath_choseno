import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";
import { getGa4Overview, isGa4ReportingConfigured } from "@/lib/analytics/ga4Reporting";

// Admin-only. There's no RLS to lean on here (see CLAUDE.md's layered
// architecture doc) since this doesn't touch Supabase at all -- it's a
// direct call to the GA4 Data API with a service-account credential -- so
// the role check has to happen in this route handler itself.
export async function GET() {
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

  if (!isGa4ReportingConfigured()) {
    return NextResponse.json({ configured: false }, { status: 200 });
  }

  const result = await getGa4Overview();
  if (!result.success) {
    return NextResponse.json({ configured: true, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ configured: true, data: result.data });
}
