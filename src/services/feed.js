import { supabase } from './supabase';

// ── posts — master feed (3 independently-fetched sections, merged by the caller) ──
export async function getMembershipScopedPosts(shapeIds) {
  return supabase.from('posts').select('*, comments(*), post_boundaries!inner(map_shape_id)').in('post_boundaries.map_shape_id', shapeIds);
}

export async function getCountryScopedPosts(country) {
  return supabase.from('posts').select('*, comments(*)').eq('is_country', true).eq('country', country);
}

export async function getInternationalScopedPosts() {
  return supabase.from('posts').select('*, comments(*)').eq('is_international', true);
}

// posts — single-tab feed view. tab: 'country' | 'international' | 'membership'.
export async function getFeedPostsForTab({ tab, country, shapeId }) {
  const isMembership = tab === 'membership';
  const selectStr = isMembership ? '*, comments (*), post_boundaries!inner(map_shape_id)' : '*, comments (*)';
  let q = supabase.from('posts').select(selectStr).order('created_at', { ascending: false });
  if (tab === 'country') q = q.eq('is_country', true).eq('country', country);
  else if (tab === 'international') q = q.eq('is_international', true);
  else if (isMembership) q = q.eq('post_boundaries.map_shape_id', shapeId);
  return q;
}

// ── post creation / voting ───────────────────────────────────────────────
// Feed posts go through the create_post RPC — DO NOT merge with
// politicianWall.js's createWallPost, which does a direct insert instead
// (intentional divergence — the wall needs wall_ghost_id set).
export async function createFeedPost({ content, imageUrl, videoUrl, linkMetadata }) {
  return supabase.rpc('create_post', { p_content: content, p_image_url: imageUrl, p_video_url: videoUrl, p_link_metadata: linkMetadata });
}

export async function voteOnPost(postId, voteType) {
  return supabase.rpc('vote_on_post', { p_post_id: postId, p_vote_type: voteType });
}

// comments — shared by FeedPage and PoliticianWall (identical shape).
export async function createComment(postId, ghostId, content) {
  return supabase.from('comments').insert({ post_id: postId, ghost_id: ghostId, content });
}

// storage — post image upload, shared path pattern (posts/{ghostId}-{ts}.{ext}).
export async function uploadPostImage(file, ghostId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${ghostId}-${Date.now()}.${fileExt}`;
  const filePath = `posts/${fileName}`;
  const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, file);
  if (uploadError) return { publicUrl: null, error: uploadError };
  const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(filePath);
  return { publicUrl, error: null };
}

// ── election notifications ──────────────────────────────────────────────
export async function getActiveElectionsForUser() {
  return supabase.rpc('get_active_elections_for_user');
}

export async function dismissElectionNotification(profileId, electionId) {
  return supabase.from('election_notification_dismissals').insert({ profile_id: profileId, election_id: electionId });
}

// ── ghost identity ───────────────────────────────────────────────────────
// FeedPage's burn path goes through this RPC — DO NOT merge with
// profile.js's burnGhostIdRaw, which ProfilePage uses instead (raw column
// update, bypasses whatever server-side logic this RPC runs).
export async function burnGhostIdentityViaRpc() {
  return supabase.rpc('burn_ghost_identity');
}

// ── silent data export ───────────────────────────────────────────────────
export async function getPostsForExport(ghostId) {
  return supabase.from('posts').select('id, content, created_at, likes_count, dislikes_count, comments(id)').eq('ghost_id', ghostId);
}

export async function getCommentsForExport(ghostId) {
  return supabase.from('comments').select('id, post_id, content, created_at').eq('ghost_id', ghostId);
}

export async function uploadUserExport(fileName, jsonString) {
  return supabase.storage.from('user_exports').upload(fileName, jsonString, { upsert: true, contentType: 'application/json' });
}
