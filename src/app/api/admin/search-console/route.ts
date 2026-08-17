import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";
import { getSearchConsoleData, isSearchConsoleConfigured } from "@/lib/analytics/searchConsole";
import { GA4_DATE_RANGES, DEFAULT_GA4_DATE_RANGE_DAYS, type Ga4DateRangeDays } from "@/lib/constants/ga4";

// Admin-only. Uses Google Search Console API with a service-account credential.
// Role check happens here since this doesn't use Supabase RLS directly.
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

  if (!isSearchConsoleConfigured()) {
    return NextResponse.json({ configured: false }, { status: 200 });
  }

  const requestedDays = Number(request.nextUrl.searchParams.get("days"));
  const days: Ga4DateRangeDays = GA4_DATE_RANGES.includes(requestedDays as Ga4DateRangeDays)
    ? (requestedDays as Ga4DateRangeDays)
    : DEFAULT_GA4_DATE_RANGE_DAYS;

  const result = await getSearchConsoleData(days);
  if (!result.success) {
    return NextResponse.json({ configured: true, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ configured: true, data: result.data });
}
