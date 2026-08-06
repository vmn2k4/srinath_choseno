import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";
import { getGa4Overview, isGa4ReportingConfigured } from "@/lib/analytics/ga4Reporting";
import { GA4_DATE_RANGES, DEFAULT_GA4_DATE_RANGE_DAYS, type Ga4DateRangeDays } from "@/lib/constants/ga4";

// Admin-only. There's no RLS to lean on here (see CLAUDE.md's layered
// architecture doc) since this doesn't touch Supabase at all -- it's a
// direct call to the GA4 Data API with a service-account credential -- so
// the role check has to happen in this route handler itself.
export async function GET(request: NextRequest) {
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

  const requestedDays = Number(request.nextUrl.searchParams.get("days"));
  const days: Ga4DateRangeDays = GA4_DATE_RANGES.includes(requestedDays as Ga4DateRangeDays)
    ? (requestedDays as Ga4DateRangeDays)
    : DEFAULT_GA4_DATE_RANGE_DAYS;

  const result = await getGa4Overview(days);
  if (!result.success) {
    return NextResponse.json({ configured: true, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ configured: true, data: result.data });
}
