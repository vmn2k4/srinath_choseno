import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";
import { getAdminAnalyticsMetrics } from "@/lib/services/analytics";

/**
 * GET /api/admin/analytics
 * Returns platform analytics metrics: user counts, engagement rates, content velocity.
 * Admin-only endpoint.
 */
export async function GET(request: NextRequest) {
  try {
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

    const result = await getAdminAnalyticsMetrics(supabase);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      metrics: result.metrics,
    });
  } catch (err) {
    console.error("Analytics API error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
