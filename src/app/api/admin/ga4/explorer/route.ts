import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";
import { getGa4RegionExplorer, isGa4ReportingConfigured } from "@/lib/analytics/ga4Reporting";
import { GA4_DATE_RANGES, DEFAULT_GA4_DATE_RANGE_DAYS, type Ga4DateRangeDays } from "@/lib/constants/ga4";
import { GA4_GRANULARITIES, DEFAULT_GA4_GRANULARITY, type Ga4Granularity } from "@/lib/constants/ga4";

// Admin-only. Pages viewed + engagement time + landing pages + CTA/event
// breakdown + day/week/month trend, optionally scoped to one country/region/
// city. Same auth pattern as the other /api/admin/ga4/* routes.
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

  const params = request.nextUrl.searchParams;

  const requestedDays = Number(params.get("days"));
  const days: Ga4DateRangeDays = GA4_DATE_RANGES.includes(requestedDays as Ga4DateRangeDays)
    ? (requestedDays as Ga4DateRangeDays)
    : DEFAULT_GA4_DATE_RANGE_DAYS;

  const requestedGranularity = params.get("granularity");
  const granularity: Ga4Granularity = GA4_GRANULARITIES.includes(requestedGranularity as Ga4Granularity)
    ? (requestedGranularity as Ga4Granularity)
    : DEFAULT_GA4_GRANULARITY;

  // Empty string / missing param both mean "no filter on this dimension".
  const country = params.get("country") || undefined;
  const region = params.get("region") || undefined;
  const city = params.get("city") || undefined;

  const result = await getGa4RegionExplorer(days, { country, region, city }, granularity);
  if (!result.success) {
    return NextResponse.json({ configured: true, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ configured: true, data: result.data });
}
