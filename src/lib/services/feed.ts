import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { isDevEnvironment } from "@/lib/utils/environment";
import { buildPoliticianWallSlug } from "@/lib/utils/slugs";

type Client = SupabaseClient<Database>;

// ── posts — master feed (3 independently-fetched sections, merged by the caller) ──
// All three carry an explicit .order() -- without one Postgres/PostgREST
// makes no ordering guarantee at all, so a fresh post could land anywhere in
// the result set instead of near the top. Found while verifying @mentions:
// a brand-new post was functionally correct (mention attached fine) but
// invisible in practice, sorted behind an older, equally-0-engagement post
// purely because the DB happened to return it that way.
// Default page size for the three feed sections below. None of these had
// any limit before -- each fetched every matching post (plus every nested
// comment) platform-wide, forever. A default cap here protects every
// existing caller immediately without needing a "Load More" UI first;
// {offset} is already threaded through so pager UI can layer on top later.
const FEED_PAGE_SIZE = 50;

export async function getMembershipScopedPosts(
  supabase: Client,
  shapeIds: number[],
  opts: { limit?: number; offset?: number } = {}
) {
  const limit = opts.limit ?? FEED_PAGE_SIZE;
  let query = supabase
    .from("posts")
    .select("*, comments(*), post_boundaries!inner(map_shape_id, map_shapes(id, name)), news_articles(slug, event_date, published_at)")
    .in("post_boundaries.map_shape_id", shapeIds)
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + limit - 1);
  if (!isDevEnvironment()) query = query.eq("is_test", false).eq("comments.is_test", false);
  return query;
}

export async function getCountryScopedPosts(
  supabase: Client,
  country: string,
  opts: { limit?: number; offset?: number } = {}
) {
  const limit = opts.limit ?? FEED_PAGE_SIZE;
  let query = supabase
    .from("posts")
    .select("*, comments(*), news_articles(slug, event_date, published_at)")
    .eq("is_country", true)
    .eq("country", country)
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + limit - 1);
  if (!isDevEnvironment()) query = query.eq("is_test", false).eq("comments.is_test", false);
  return query;
}

export async function getInternationalScopedPosts(
  supabase: Client,
  opts: { limit?: number; offset?: number } = {}
) {
  const limit = opts.limit ?? FEED_PAGE_SIZE;
  let query = supabase
    .from("posts")
    .select("*, comments(*), news_articles(slug, event_date, published_at)")
    .eq("is_international", true)
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + limit - 1);
  if (!isDevEnvironment()) query = query.eq("is_test", false).eq("comments.is_test", false);
  return query;
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
    mentionedPoliticianIds,
  }: {
    content: string;
    imageUrl?: string | null;
    videoUrl?: string | null;
    linkMetadata?: Json | null;
    mentionedPoliticianIds?: string[] | null;
  }
) {
  const args: {
    p_content: string;
    p_image_url?: string;
    p_video_url?: string;
    p_link_metadata?: Json;
    p_is_test: boolean;
    p_mentioned_politician_ids?: string[];
  } = { p_content: content, p_is_test: isDevEnvironment() };

  if (imageUrl) args.p_image_url = imageUrl;
  if (videoUrl) args.p_video_url = videoUrl;
  if (linkMetadata) args.p_link_metadata = linkMetadata;
  if (mentionedPoliticianIds && mentionedPoliticianIds.length > 0) args.p_mentioned_politician_ids = mentionedPoliticianIds;

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
  return supabase.rpc("create_comment", { p_post_id: postId, p_content: content, p_is_test: isDevEnvironment() });
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

  let query = supabase
    .from("profiles")
    .select("current_ghost_id, full_name, politician_profiles(wall_slug)")
    .eq("role", "politician")
    .in("current_ghost_id", ghostIds);
  if (!isDevEnvironment()) query = query.eq("is_test", false);
  const { data } = await query;

  const map = new Map<string, { fullName: string; wallHref: string }>();
  for (const row of data || []) {
    if (row.current_ghost_id) {
      map.set(row.current_ghost_id, {
        fullName: row.full_name || "Politician",
        wallHref: row.politician_profiles?.wall_slug
          ? `/wall/${row.politician_profiles.wall_slug}`
          : `/wall/${buildPoliticianWallSlug(row.full_name)}`,
      });
    }
  }
  return map;
}

// @mention hydration — resolve each post's tagged politicians (post_mentions)
// into display info so PostCard can linkify "@Full Name" to their wall.
// Same shape/pattern as hydratePoliticianAuthors above, keyed by post id
// instead of ghost_id since a mention targets a specific profile, not the
// (anonymous) poster.
export async function hydratePostMentions(
  supabase: Client,
  posts: { id: string }[]
): Promise<Map<string, { politicianId: string; fullName: string; wallHref: string }[]>> {
  const postIds = [...new Set(posts.map((p) => p.id))];
  const map = new Map<string, { politicianId: string; fullName: string; wallHref: string }[]>();
  if (postIds.length === 0) return map;

  const { data } = await supabase
    .from("post_mentions")
    .select("post_id, politician_id, profiles(full_name, politician_profiles(wall_slug))")
    .in("post_id", postIds);

  for (const row of data || []) {
    const prof = row.profiles as { full_name: string | null; politician_profiles: { wall_slug: string | null } | null } | null;
    if (!prof) continue;
    const fullName = prof.full_name || "Politician";
    const wallHref = prof.politician_profiles?.wall_slug
      ? `/wall/${prof.politician_profiles.wall_slug}`
      : `/wall/${buildPoliticianWallSlug(fullName)}`;
    const existing = map.get(row.post_id) || [];
    existing.push({ politicianId: row.politician_id, fullName, wallHref });
    map.set(row.post_id, existing);
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
