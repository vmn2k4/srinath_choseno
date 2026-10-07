import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";
import { getGa4DailyTrend, getGa4HourlyByDay, isGa4ReportingConfigured } from "@/lib/analytics/ga4Reporting";
import { GA4_TREND_RANGES, type Ga4TrendRangeDays } from "@/lib/constants/ga4";

// Admin-only, same role check as the sibling /api/admin/ga4 routes. Backs the
// per-chart range pickers on /admin/traffic: ?kind=hourly|daily&days=N, where
// N is the last N days ending today.
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

  const kind = request.nextUrl.searchParams.get("kind");
  const requestedDays = Number(request.nextUrl.searchParams.get("days"));
  if ((kind !== "hourly" && kind !== "daily") || !GA4_TREND_RANGES.includes(requestedDays as Ga4TrendRangeDays)) {
    return NextResponse.json({ error: "Invalid kind or days" }, { status: 400 });
  }
  const days = requestedDays as Ga4TrendRangeDays;

  if (kind === "hourly") {
    const result = await getGa4HourlyByDay(days);
    if (!result.success) return NextResponse.json({ configured: true, error: result.error }, { status: 502 });
    return NextResponse.json({ configured: true, kind, days, hourlyByDay: result.data });
  }

  const result = await getGa4DailyTrend(days);
  if (!result.success) return NextResponse.json({ configured: true, error: result.error }, { status: 502 });
  return NextResponse.json({ configured: true, kind, days, dailyTrend: result.data });
}
