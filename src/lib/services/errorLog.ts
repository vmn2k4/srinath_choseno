import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

// Client-side error logging -- see 20260826000000_client_error_logs.sql for
// the full rationale. GA4's error_occurred event (src/lib/analytics/events.ts)
// stays as the aggregate volume/trend view; this table is where the actual
// message/stack/page detail needed to diagnose and fix a specific error
// lives, queryable directly (SQL, or via getRecentClientErrors below) with
// none of GA4's truncation or unregistered-custom-dimension blind spots.
//
// `as any` on the table name / RPC name below: types.ts is generated via
// `supabase gen types`, which needs Docker locally and hasn't been re-run
// since this migration landed. Drop the casts once it has.

export type ClientErrorType = "uncaught_exception" | "unhandled_rejection" | "render_exception";

export type LogClientErrorParams = {
  errorType: ClientErrorType;
  message: string;
  page: string;
  stack?: string | null;
  digest?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  viewport?: string | null;
  isTest: boolean;
};

// Fire-and-forget from the caller's side (see trackError in
// src/lib/analytics/events.ts) -- this function itself still awaits the
// insert and reports success/failure so a caller *can* await it if it wants
// to, but never throws: error-reporting code that can itself throw risks a
// reporting loop (a failed report firing onunhandledrejection, which tries
// to report itself, forever).
export async function logClientError(
  supabase: Client,
  params: LogClientErrorParams
): Promise<{ success: boolean; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet, see file header
    const { error } = await supabase.rpc("log_client_error" as any, {
      p_error_type: params.errorType,
      p_message: params.message,
      p_page: params.page,
      p_stack: params.stack ?? null,
      p_digest: params.digest ?? null,
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

export type ClientErrorLogRow = {
  id: string;
  error_type: ClientErrorType;
  message: string;
  stack: string | null;
  digest: string | null;
  page: string;
  referrer: string | null;
  user_agent: string | null;
  viewport: string | null;
  is_test: boolean;
  resolved: boolean;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type ClientErrorFilters = {
  days?: number;
  page?: string;
  errorType?: ClientErrorType;
  resolved?: boolean;
  includeTest?: boolean;
  limit?: number;
};

// The admin-facing read side -- filterable enough to answer "what broke
// this week", "everything on this page", or "everything still open" without
// hand-writing SQL each time. Straight .from() select works here (no RPC
// needed) because the admin-role RLS policy on the table already covers
// SELECT for an authenticated admin session.
export async function getRecentClientErrors(
  supabase: Client,
  filters: ClientErrorFilters = {}
): Promise<{ success: boolean; data: ClientErrorLogRow[]; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet, see file header
    let query = (supabase.from("client_error_logs" as any) as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(filters.limit ?? 100);

    if (filters.days) {
      const since = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", since);
    }
    if (filters.page) query = query.eq("page", filters.page);
    if (filters.errorType) query = query.eq("error_type", filters.errorType);
    if (filters.resolved !== undefined) query = query.eq("resolved", filters.resolved);
    if (!filters.includeTest) query = query.eq("is_test", false);

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: (data as ClientErrorLogRow[]) || [] };
  } catch (err) {
    return { success: false, data: [], error: err instanceof Error ? err.message : String(err) };
  }
}

// Marks a diagnosed error resolved with a note on what the fix was (or why
// it was a false positive/dismissed) -- so the next "were there any errors"
// query doesn't re-surface something already handled as if it were new.
export async function resolveClientError(
  supabase: Client,
  id: string,
  resolutionNote: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet, see file header
    const { error } = await (supabase.from("client_error_logs" as any) as any)
      .update({ resolved: true, resolution_note: resolutionNote, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
