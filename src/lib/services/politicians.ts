import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

// ── search_politicians_and_officeholders ────────────────────────────────
// Global nav-bar search across office_holders (currently-serving officials)
// and politician_profiles (registered candidates without a current office).
// Ranking — key political leaders first, then name-match quality, then
// proximity to the searcher (their own jurisdiction, then province/state,
// then country, then everywhere else) — all happens inside the RPC; see
// supabase/migrations/20260817000000_search_politicians.sql.
//
// p_lat/p_lng are optional (e.g. from browser geolocation); when omitted the
// RPC falls back to the signed-in user's own saved location.
export async function searchPoliticians(
  supabase: Client,
  query: string,
  options: { lat?: number; lng?: number; limit?: number } = {}
) {
  return supabase.rpc("search_politicians_and_officeholders", {
    p_query: query,
    p_lat: options.lat,
    p_lng: options.lng,
    p_limit: options.limit ?? 20,
  });
}

// ── key_political_leaders (admin) ────────────────────────────────────────
// Always-top-of-search allowlist (heads of state/government, cabinet
// ministers, opposition/party leaders, premiers/governors) — see
// supabase/migrations/20260817000000_search_politicians.sql for the seeded
// 30-leader roster mirroring NewsPrompts/KeyLeadersNewsCollectionPrompt.md.
export async function listKeyPoliticalLeaders(supabase: Client) {
  return supabase
    .from("key_political_leaders")
    .select("id, full_name, role_title, priority, notes, politician_profile_id, office_holder_id, created_at")
    .order("priority", { ascending: true })
    .order("full_name", { ascending: true });
}

export async function createKeyPoliticalLeader(
  supabase: Client,
  leader: {
    fullName: string;
    roleTitle?: string | null;
    priority?: number;
    notes?: string | null;
    politicianProfileId?: string | null;
    officeHolderId?: string | null;
  }
) {
  const { data: auth } = await supabase.auth.getUser();
  return supabase.from("key_political_leaders").insert({
    full_name: leader.fullName,
    role_title: leader.roleTitle || null,
    priority: leader.priority ?? 2,
    notes: leader.notes || null,
    politician_profile_id: leader.politicianProfileId || null,
    office_holder_id: leader.officeHolderId || null,
    created_by: auth?.user?.id || null,
  });
}

export async function updateKeyPoliticalLeader(
  supabase: Client,
  id: string,
  updates: { priority?: number; roleTitle?: string | null; notes?: string | null }
) {
  const patch: Database["public"]["Tables"]["key_political_leaders"]["Update"] = {};
  if (updates.priority !== undefined) patch.priority = updates.priority;
  if (updates.roleTitle !== undefined) patch.role_title = updates.roleTitle;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  return supabase.from("key_political_leaders").update(patch).eq("id", id);
}

export async function deleteKeyPoliticalLeader(supabase: Client, id: string) {
  return supabase.from("key_political_leaders").delete().eq("id", id);
}
