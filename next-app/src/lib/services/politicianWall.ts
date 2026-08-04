import type { SupabaseClient, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

// profiles — wall owner lookup by ghost_id, with nested politician_profiles.
export async function getWallOwnerProfile(supabase: Client, ghostId: string) {
  return supabase
    .from("profiles")
    .select(
      `
       id,
       current_ghost_id,
       full_name,
       role,
       constituency,
       politician_profiles (
         political_target_role,
         target_boundary_name,
         avatar_url
       )
    `
    )
    .eq("current_ghost_id", ghostId)
    .single();
}

// ── politician_supporters ────────────────────────────────────────────────
export async function getSupportStatus(supabase: Client, politicianId: string, supporterId: string) {
  return supabase
    .from("politician_supporters")
    .select("supporter_id")
    .eq("politician_id", politicianId)
    .eq("supporter_id", supporterId)
    .maybeSingle();
}

export async function getSupporterCount(supabase: Client, politicianId: string) {
  return supabase
    .from("politician_supporters")
    .select("*", { count: "exact", head: true })
    .eq("politician_id", politicianId);
}

export async function withdrawSupport(supabase: Client, politicianId: string, supporterId: string) {
  return supabase
    .from("politician_supporters")
    .delete()
    .eq("politician_id", politicianId)
    .eq("supporter_id", supporterId);
}

export async function addSupport(supabase: Client, politicianId: string, supporterId: string) {
  return supabase.from("politician_supporters").insert({ politician_id: politicianId, supporter_id: supporterId });
}

// Realtime subscription wrapper — keeps the raw supabase.channel()/
// removeChannel() calls out of page components, matching the Services-layer
// rule that all supabase.* calls live here. Returns the channel so the
// caller can pass it straight to unsubscribeFromSupportChanges on cleanup.
export function subscribeToSupportChanges(
  supabase: Client,
  politicianId: string,
  onChange: (payload: RealtimePostgresChangesPayload<Database["public"]["Tables"]["politician_supporters"]["Row"]>) => void
) {
  const channel = supabase
    .channel(`support-${politicianId}-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "politician_supporters",
        filter: `politician_id=eq.${politicianId}`,
      },
      onChange
    )
    .subscribe();

  return channel;
}

export function unsubscribeFromSupportChanges(
  supabase: Client,
  channel: ReturnType<typeof subscribeToSupportChanges> | null
) {
  if (channel) supabase.removeChannel(channel);
}

export async function getSupportersList(supabase: Client, politicianId: string) {
  return supabase
    .from("politician_supporters")
    .select(
      `
      created_at,
      profiles!politician_supporters_supporter_id_fkey (
        full_name,
        current_ghost_id
      )
    `
    )
    .eq("politician_id", politicianId)
    .order("created_at", { ascending: false });
}

// ── wall posts (direct insert — intentional divergence from feed.ts's
// createFeedPost, which goes through the create_post RPC instead) ────────
export async function getWallPosts(supabase: Client, ghostId: string) {
  return supabase
    .from("posts")
    .select(`*, comments (*)`)
    .or(`ghost_id.eq.${ghostId},wall_ghost_id.eq.${ghostId}`)
    .order("created_at", { ascending: false });
}

export async function createWallPost(
  supabase: Client,
  fields: Database["public"]["Tables"]["posts"]["Insert"]
) {
  return supabase.from("posts").insert(fields);
}
