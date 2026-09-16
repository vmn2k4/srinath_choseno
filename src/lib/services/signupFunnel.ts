import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

// Signup funnel logging -- see 20260916000000_signup_funnel_events.sql for
// the full rationale. GA4's sign_up event (src/lib/analytics/events.ts)
// stays as a lightweight trend signal; this table is where the actual
// reason/message detail needed to diagnose a stalled signup lives, and it's
// the reliable side after GA4's sign_up event was directly observed missing
// real signups (see analytics-live-data-pull-howto memory).
//
// `as any` on the table name / RPC name below: types.ts is generated via
// `supabase gen types`, which needs Docker locally and hasn't been re-run
// since this migration landed -- same situation as errorLog.ts. Drop the
// casts once it has.

export type SignupFunnelEventType = "failed" | "abandoned";
export type SignupFunnelReason =
  | "email_already_exists"
  | "validation_error"
  | "google_oauth_error"
  | "unknown_error";

export type LogSignupFunnelEventParams = {
  eventType: SignupFunnelEventType;
  method: "email" | "google";
  page: string;
  reason?: SignupFunnelReason | null;
  message?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  viewport?: string | null;
  isTest: boolean;
};

// Fire-and-forget, same shape as logClientError -- never throws, since this
// runs from inside a form's catch block and an unload/pagehide handler,
// neither of which should ever surface a secondary error to the visitor.
export async function logSignupFunnelEvent(
  supabase: Client,
  params: LogSignupFunnelEventParams
): Promise<{ success: boolean; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet, see file header
    const { error } = await supabase.rpc("log_signup_funnel_event" as any, {
      p_event_type: params.eventType,
      p_method: params.method,
      p_page: params.page,
      p_reason: params.reason ?? null,
      p_message: params.message ?? null,
      p_referrer: params.referrer ?? null,
      p_user_agent: params.userAgent ?? null,
      p_viewport: params.viewport ?? null,
      p_is_test: params.isTest,
    });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type SignupFunnelEventRow = {
  id: string;
  event_type: SignupFunnelEventType;
  reason: SignupFunnelReason | null;
  message: string | null;
  method: "email" | "google";
  page: string;
  referrer: string | null;
  user_agent: string | null;
  viewport: string | null;
  is_test: boolean;
  created_at: string;
};

export type SignupFunnelFilters = {
  days?: number;
  eventType?: SignupFunnelEventType;
  includeTest?: boolean;
  limit?: number;
};

// Admin-facing read side -- answers "how many people started signing up
// this week and didn't finish, and why" without hand-writing SQL each time.
export async function getRecentSignupFunnelEvents(
  supabase: Client,
  filters: SignupFunnelFilters = {}
): Promise<{ success: boolean; data: SignupFunnelEventRow[]; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet, see file header
    let query = (supabase.from("signup_funnel_events" as any) as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(filters.limit ?? 200);

    if (filters.days) {
      const since = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", since);
    }
    if (filters.eventType) query = query.eq("event_type", filters.eventType);
    if (!filters.includeTest) query = query.eq("is_test", false);

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: (data as SignupFunnelEventRow[]) || [] };
  } catch (err) {
    return { success: false, data: [], error: err instanceof Error ? err.message : String(err) };
  }
}
