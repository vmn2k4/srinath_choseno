import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type ReportTargetType = "post" | "comment" | "politician_profile";

// ── reporting (any authenticated user) ──────────────────────────────────
export async function reportContent(
  supabase: Client,
  targetType: ReportTargetType,
  targetId: string,
  abuseType: string
) {
  return supabase.rpc("report_content", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_abuse_type: abuseType,
  });
}

export async function getModerationRules(supabase: Client, { includeDisabled = false }: { includeDisabled?: boolean } = {}) {
  const q = supabase.from("moderation_rules").select("*").order("abuse_type");
  return includeDisabled ? q : q.eq("enabled", true);
}

// ── admin-only ───────────────────────────────────────────────────────────
export async function getModerationQueue(supabase: Client) {
  return supabase.rpc("get_moderation_queue");
}

export async function adminRemoveContent(
  supabase: Client,
  targetType: ReportTargetType,
  targetId: string,
  abuseType: string,
  reason?: string | null
) {
  return supabase.rpc("admin_remove_content", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_abuse_type: abuseType,
    p_reason: reason ?? undefined,
  });
}

export async function adminDismissReports(
  supabase: Client,
  targetType: ReportTargetType,
  targetId: string,
  abuseType?: string | null
) {
  return supabase.rpc("admin_dismiss_reports", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_abuse_type: abuseType ?? undefined,
  });
}

export async function adminUpdateModerationRule(
  supabase: Client,
  abuseType: string,
  autoRemoveThreshold: number,
  scorePenalty: number,
  enabled: boolean
) {
  return supabase.rpc("admin_update_moderation_rule", {
    p_abuse_type: abuseType,
    p_auto_remove_threshold: autoRemoveThreshold,
    p_score_penalty: scorePenalty,
    p_enabled: enabled,
  });
}
