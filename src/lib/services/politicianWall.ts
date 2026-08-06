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

// ── wall posts ───────────────────────────────────────────────────────────
export async function getWallPosts(supabase: Client, ghostId: string) {
  return supabase
    .from("posts")
    .select(`*, comments (*)`)
    .or(`ghost_id.eq.${ghostId},wall_ghost_id.eq.${ghostId}`)
    .order("created_at", { ascending: false });
}

// Goes through the create_wall_post RPC (resolves ghost_id from auth.uid()
// server-side, and sets is_country/is_international/post_boundaries so the
// post also shows up in the main feed) — exempt from the politician
// daily-post-limit create_post() enforces, since Wall posting is meant to
// stay unlimited.
export async function createWallPost(
  supabase: Client,
  {
    content,
    imageUrl,
    videoUrl,
    linkMetadata,
    wallGhostId,
  }: { content: string; imageUrl?: string | null; videoUrl?: string | null; linkMetadata?: Database["public"]["Tables"]["posts"]["Row"]["link_metadata"]; wallGhostId?: string | null }
) {
  return supabase.rpc("create_wall_post", {
    p_content: content,
    p_image_url: imageUrl ?? undefined,
    p_video_url: videoUrl ?? undefined,
    p_link_metadata: linkMetadata ?? undefined,
    p_wall_ghost_id: wallGhostId ?? undefined,
  });
}

export async function getWallPostBySlugOrId(supabase: Client, ghostId: string, slug: string) {
  const { data: exactPost } = await supabase
    .from("posts")
    .select(`*, comments (*)`)
    .eq("id", slug)
    .maybeSingle();

  if (exactPost) {
    return { data: exactPost };
  }

  const { data: posts } = await getWallPosts(supabase, ghostId);
  if (!posts || posts.length === 0) {
    return { data: null };
  }

  const slugifiedMatch = posts.find((p) => {
    const postSlug = (p.content || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      .slice(0, 60);
    return postSlug === slug || p.id === slug;
  });

  return { data: slugifiedMatch || posts[0] };
}

export async function getActiveCandidacies(supabase: Client, profileId: string) {
  return supabase
    .from("election_candidates")
    .select(
      `id, seat_id, status,
       election_seats(
         id, role_title,
         map_shapes(name, boundary_type),
         elections(id, name, status, election_date)
       )`
    )
    .eq("politician_id", profileId)
    .order("created_at", { ascending: false });
}

