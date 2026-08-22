import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";
import { getGa4GeoBreakdown, isGa4ReportingConfigured } from "@/lib/analytics/ga4Reporting";
import { GA4_DATE_RANGES, DEFAULT_GA4_DATE_RANGE_DAYS, type Ga4DateRangeDays } from "@/lib/constants/ga4";

// Admin-only. Full country x region x city session breakdown -- powers the
// Region Explorer's cascading geography filters. Same auth pattern as
// /api/admin/ga4 (see that route's comment): no RLS applies since this never
// touches Supabase, it's a direct GA4 Data API call, so the role check lives
// in the route handler itself.
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

  const result = await getGa4GeoBreakdown(days);
  if (!result.success) {
    return NextResponse.json({ configured: true, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ configured: true, data: result.data });
}
