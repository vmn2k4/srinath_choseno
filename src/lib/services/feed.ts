import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

// ── posts — master feed (3 independently-fetched sections, merged by the caller) ──
export async function getMembershipScopedPosts(supabase: Client, shapeIds: number[]) {
  return supabase
    .from("posts")
    .select("*, comments(*), post_boundaries!inner(map_shape_id, map_shapes(id, name))")
    .in("post_boundaries.map_shape_id", shapeIds);
}

export async function getCountryScopedPosts(supabase: Client, country: string) {
  return supabase.from("posts").select("*, comments(*)").eq("is_country", true).eq("country", country);
}

export async function getInternationalScopedPosts(supabase: Client) {
  return supabase.from("posts").select("*, comments(*)").eq("is_international", true);
}

// ── post creation / voting ───────────────────────────────────────────────
// Feed posts go through the create_post RPC — DO NOT merge with
// politicianWall.ts's createWallPost, which goes through a separate
// create_wall_post RPC instead (it also sets wall_ghost_id and is exempt
// from the politician daily-post-limit create_post enforces).
export async function createFeedPost(
  supabase: Client,
  {
    content,
    imageUrl,
    videoUrl,
    linkMetadata,
  }: { content: string; imageUrl?: string | null; videoUrl?: string | null; linkMetadata?: Json | null }
) {
  const args: {
    p_content: string;
    p_image_url?: string;
    p_video_url?: string;
    p_link_metadata?: Json;
  } = { p_content: content };

  if (imageUrl) args.p_image_url = imageUrl;
  if (videoUrl) args.p_video_url = videoUrl;
  if (linkMetadata) args.p_link_metadata = linkMetadata;

  return supabase.rpc("create_post", args);
}

export async function voteOnPost(supabase: Client, postId: string, voteType: 1 | -1) {
  return supabase.rpc("vote_on_post", { p_post_id: postId, p_vote_type: voteType });
}

// comments — shared by FeedPage, PoliticianWall, and CandidacyWall (identical
// shape). Goes through the create_comment RPC, which resolves the ghost_id
// server-side and enforces a 7-day per-(user, post) rate limit — direct
// inserts are no longer permitted by RLS.
export async function createComment(supabase: Client, postId: string, content: string) {
  return supabase.rpc("create_comment", { p_post_id: postId, p_content: content });
}

// politician attribution — for feed posts authored by a politician, resolve
// their real name + wall link so PostCard can show it instead of the
// anonymous ghost label. Politicians never burn their identity (see rule 4),
// so current_ghost_id is stable for them long-term, making this join safe.
export async function hydratePoliticianAuthors(
  supabase: Client,
  posts: { ghost_id: string }[]
): Promise<Map<string, { fullName: string; wallHref: string }>> {
  const ghostIds = [...new Set(posts.map((p) => p.ghost_id))];
  if (ghostIds.length === 0) return new Map();

  const { data } = await supabase
    .from("profiles")
    .select("current_ghost_id, full_name")
    .eq("role", "politician")
    .in("current_ghost_id", ghostIds);

  const map = new Map<string, { fullName: string; wallHref: string }>();
  for (const row of data || []) {
    if (row.current_ghost_id) {
      map.set(row.current_ghost_id, {
        fullName: row.full_name || "Politician",
        wallHref: `/wall/${row.current_ghost_id}`,
      });
    }
  }
  return map;
}

// storage — post image upload, shared path pattern (posts/{ghostId}-{ts}.{ext}).
export async function uploadPostImage(supabase: Client, file: File, ghostId: string) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${ghostId}-${Date.now()}.${fileExt}`;
  const filePath = `posts/${fileName}`;
  const { error: uploadError } = await supabase.storage.from("post-images").upload(filePath, file);
  if (uploadError) return { publicUrl: null, error: uploadError };
  const {
    data: { publicUrl },
  } = supabase.storage.from("post-images").getPublicUrl(filePath);
  return { publicUrl, error: null };
}

// ── active elections for user ──────────────────────────────────────────────
export async function getActiveElectionsForUser(supabase: Client) {
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_active_elections_for_user");
  if (!rpcError && rpcData && rpcData.length > 0) {
    return { data: rpcData, error: null };
  }

  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) return { data: [], error: null };

  const { data: memberships } = await supabase
    .from("user_boundary_memberships")
    .select("map_shape_id")
    .eq("profile_id", authUser.user.id);

  if (!memberships || memberships.length === 0) return { data: [], error: null };

  const shapeIds = memberships.map((m: any) => m.map_shape_id);

  const { data: seats, error } = await supabase
    .from("election_seats")
    .select("id, role_title, election_id, map_shape_id, map_shapes(name), elections!inner(id, name, election_date, status)")
    .in("map_shape_id", shapeIds)
    .in("elections.status", ["nominations_open", "active"]);

  if (error || !seats) return { data: [], error };

  const result = seats.map((s: any) => ({
    seat_id: s.id,
    election_id: s.election_id,
    election_name: s.elections?.name,
    election_date: s.elections?.election_date,
    role_title: s.role_title,
    boundary_name: s.map_shapes?.name,
  }));

  return { data: result, error: null };
}

// ── ghost identity ───────────────────────────────────────────────────────
// Shared by FeedPage and ProfilePage — the only burn path. Banks the
// outgoing ghost's civic_score contribution server-side before rotating.
export async function burnGhostIdentityViaRpc(supabase: Client) {
  return supabase.rpc("burn_ghost_identity");
}
