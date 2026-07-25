import { supabase } from './supabase';

// profiles — wall owner lookup by ghost_id, with nested politician_profiles.
export async function getWallOwnerProfile(ghostId) {
  return supabase
    .from('profiles')
    .select(`
       id,
       current_ghost_id,
       full_name,
       role,
       constituency,
       politician_profiles (
         political_target_role,
         target_boundary_name
       )
    `)
    .eq('current_ghost_id', ghostId)
    .single();
}

// ── politician_supporters ────────────────────────────────────────────────
export async function getSupportStatus(politicianId, supporterId) {
  return supabase.from('politician_supporters').select('supporter_id').eq('politician_id', politicianId).eq('supporter_id', supporterId).maybeSingle();
}

export async function getSupporterCount(politicianId) {
  return supabase.from('politician_supporters').select('*', { count: 'exact', head: true }).eq('politician_id', politicianId);
}

export async function withdrawSupport(politicianId, supporterId) {
  return supabase.from('politician_supporters').delete().eq('politician_id', politicianId).eq('supporter_id', supporterId);
}

export async function addSupport(politicianId, supporterId) {
  return supabase.from('politician_supporters').insert({ politician_id: politicianId, supporter_id: supporterId });
}

export async function getSupportersList(politicianId) {
  return supabase
    .from('politician_supporters')
    .select(`
      created_at,
      profiles!politician_supporters_supporter_id_fkey (
        full_name,
        current_ghost_id
      )
    `)
    .eq('politician_id', politicianId)
    .order('created_at', { ascending: false });
}

// ── wall posts (direct insert — intentional divergence from feed.js's
// createFeedPost, which goes through the create_post RPC instead) ────────
export async function getWallPosts(ghostId) {
  return supabase.from('posts').select(`*, comments (*)`).or(`ghost_id.eq.${ghostId},wall_ghost_id.eq.${ghostId}`).order('created_at', { ascending: false });
}

export async function createWallPost(fields) {
  return supabase.from('posts').insert(fields);
}
