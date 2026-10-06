import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getOrCreateAnonSupporterId } from "@/lib/utils/anonSupporter";
import { isDevEnvironment } from "@/lib/utils/environment";

type Client = SupabaseClient<Database>;

// District lookup tracking -- see 20261005000001_district_lookups.sql for the
// full rationale. `as any` on the RPC names: types.ts hasn't been regenerated
// since the migration landed (same situation as signupFunnel.ts).

export type DistrictLookupSource = "district_banner" | "home_widget" | "find_my_district";

export type LogDistrictLookupParams = {
  source: DistrictLookupSource;
  method: "gps" | "address" | "unknown";
  found: boolean;
  boundaryCount: number;
  visitorId?: string | null;
  page?: string | null;
  isTest: boolean;
};

// Fire-and-forget: never throws, since it runs right after a successful
// lookup and a logging failure must never degrade the visitor's results.
export async function logDistrictLookup(
  supabase: Client,
  params: LogDistrictLookupParams
): Promise<{ success: boolean; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet
    const { error } = await supabase.rpc("log_district_lookup" as any, {
      p_source: params.source,
      p_method: params.method,
      p_found: params.found,
      p_boundary_count: params.boundaryCount,
      p_visitor_id: params.visitorId ?? null,
      p_page: params.page ?? null,
      p_is_test: params.isTest,
    });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Client-side convenience over logDistrictLookup: fills in the visitor id,
// current page and test flag so each surface only says what it resolved.
export function recordDistrictLookup(
  supabase: Client,
  params: { source: DistrictLookupSource; method: LogDistrictLookupParams["method"]; boundaryCount: number }
): void {
  if (typeof window === "undefined") return;
  void logDistrictLookup(supabase, {
    source: params.source,
    method: params.method,
    found: params.boundaryCount > 0,
    boundaryCount: params.boundaryCount,
    visitorId: getOrCreateAnonSupporterId(),
    page: window.location.pathname,
    isTest: isDevEnvironment(),
  });
}

// Click on a race card / district chip in the auto-locate banner -- the
// "did they engage after finding their district" signal. Fire-and-forget.
export function recordDistrictBannerClick(
  supabase: Client,
  params: { targetType: "seat" | "boundary"; targetId: string | number }
): void {
  if (typeof window === "undefined") return;
  // The PostgREST builder is lazy -- the request only goes out once it's
  // awaited/.then()'d, so a bare `void supabase.rpc(...)` silently sends nothing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet
  void Promise.resolve(supabase.rpc("log_district_banner_click" as any, {
    p_target_type: params.targetType,
    p_target_id: String(params.targetId),
    p_visitor_id: getOrCreateAnonSupporterId(),
    p_page: window.location.pathname,
    p_is_test: isDevEnvironment(),
  })).catch(() => {});
}

export type DistrictLookupWindow = { lookups: number; people: number; notFound: number };

export type DistrictLookupMetrics = {
  windows: { today: DistrictLookupWindow; d7: DistrictLookupWindow; d30: DistrictLookupWindow; allTime: DistrictLookupWindow };
  bySource: Array<{ source: DistrictLookupSource; lookups: number; people: number }>;
  // Counted only for activity AFTER a visitor's first found district.
  engagement: { peopleFound: number; peopleClicked: number; raceClicks: number; districtClicks: number; peopleSupported: number };
};

const EMPTY_WINDOW: DistrictLookupWindow = { lookups: 0, people: 0, notFound: 0 };

// Admin-only (the RPC checks role itself).
export async function getAdminDistrictLookupMetrics(
  supabase: Client
): Promise<{ success: boolean; metrics: DistrictLookupMetrics; error?: string }> {
  const empty: DistrictLookupMetrics = {
    windows: { today: EMPTY_WINDOW, d7: EMPTY_WINDOW, d30: EMPTY_WINDOW, allTime: EMPTY_WINDOW },
    bySource: [],
    engagement: { peopleFound: 0, peopleClicked: 0, raceClicks: 0, districtClicks: 0, peopleSupported: 0 },
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet
    const { data, error } = await supabase.rpc("get_admin_district_lookup_metrics" as any);
    if (error) throw error;
    const d = (data || {}) as Partial<DistrictLookupMetrics>;
    return {
      success: true,
      metrics: {
        windows: { ...empty.windows, ...(d.windows || {}) },
        bySource: d.bySource || [],
        engagement: { ...empty.engagement, ...(d.engagement || {}) },
      },
    };
  } catch (err) {
    console.error("Failed to fetch district lookup metrics:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err), metrics: empty };
  }
}
