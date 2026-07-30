import { supabase } from './supabase';

// user_boundary_memberships — ids-only, hot path for elections seat filtering.
export async function getUserBoundaryShapeIds(profileId) {
  return supabase.from('user_boundary_memberships').select('map_shape_id').eq('profile_id', profileId);
}

// user_boundary_memberships — full join with map_shapes (FeedPage, ProfilePage).
export async function getUserBoundaryMemberships(profileId) {
  return supabase.from('user_boundary_memberships').select('map_shape_id, map_shapes(id, name, country, boundary_type)').eq('profile_id', profileId);
}

// profiles — full row by default; pass columns for a narrower select (ProfilePage).
export async function getOwnProfile(userId, { columns = '*' } = {}) {
  return supabase.from('profiles').select(columns).eq('id', userId).single();
}

// politician_profiles — directory of politicians/candidates matching a set of
// boundary ids (or Country-level, always included) — PoliticianSidebar's feed.
export async function getInterestedPoliticians(boundaryIds = []) {
  let query = supabase
    .from('politician_profiles')
    .select(`
      id,
      political_target_role,
      target_boundary_name,
      target_boundary_type,
      profiles!inner (
        current_ghost_id,
        full_name,
        country
      )
    `);

  if (boundaryIds.length > 0) {
    query = query.or(`target_boundary_id.in.(${boundaryIds.join(',')}),target_boundary_type.eq.Country`);
  } else {
    query = query.eq('target_boundary_type', 'Country');
  }

  return query;
}

// profiles — select('*'), missing-row self-heal (create default profile) +
// admin-email role correction. Used by AuthContext on session init and auth
// state changes. Returns the profile row directly (not {data,error}), same
// as the original inline logic it replaces.
export async function fetchOrHealProfile(userId, userEmail) {
  let { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  const isAdminEmail = userEmail?.toLowerCase() === 'vmn2k4@gmail.com';

  if (!data) {
    const { data: created } = await supabase
      .from('profiles')
      .upsert({ id: userId, role: isAdminEmail ? 'admin' : 'normal' })
      .select()
      .maybeSingle();
    data = created;
  } else if (isAdminEmail && data.role !== 'admin') {
    await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId);
    data.role = 'admin';
  }

  return data;
}

// profiles — role/full_name/country/constituency upsert, shared by
// OnboardingFlow (passes onboardingCompleted:true) and EditProfileFlow (omits it).
export async function upsertProfileCore(userId, { role, fullName, country, constituency }, { onboardingCompleted } = {}) {
  const row = {
    id: userId,
    role,
    full_name: fullName || null,
    country,
    constituency,
    updated_at: new Date()
  };
  if (onboardingCompleted !== undefined) row.onboarding_completed = onboardingCompleted;
  return supabase.from('profiles').upsert(row);
}

// politician_profiles — upsert, shared by OnboardingFlow/EditProfileFlow.
// fallbackBoundaryId: what to use for target_boundary_id when there's no
// primary matched boundary (OnboardingFlow passes null, EditProfileFlow
// passes the previous initialData.target_boundary_id).
export async function upsertPoliticianProfile(userId, { targetBoundaryId, targetBoundaryName, politicalPartyId, education, hometown, bio }, fallbackBoundaryId) {
  return supabase.from('politician_profiles').upsert({
    id: userId,
    target_boundary_id: targetBoundaryId ?? fallbackBoundaryId,
    target_boundary_name: targetBoundaryName,
    political_party_id: politicalPartyId || null,
    education: education || null,
    hometown: hometown || null,
    bio,
    updated_at: new Date()
  });
}

// civic score — banked profiles.civic_score plus the current ghost's
// live (not-yet-banked) activity. See 20260730000001_civic_score.sql for
// why this is a single running total rather than a stored post/comment list.
export async function calculateMyScore() {
  return supabase.rpc('calculate_my_score');
}

// user_locations — most recent lat/lng for a profile.
export async function getLatestUserLocation(profileId) {
  return supabase.from('user_locations').select('latitude, longitude').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(1);
}

// profiles — role only (ElectionsPage's "show Become a Politician CTA" check).
export async function getProfileRole(userId) {
  return supabase.from('profiles').select('role').eq('id', userId).single();
}

// politician_profiles — public campaign-page fields (CandidacyWall).
export async function getPoliticianProfile(politicianId) {
  return supabase.from('politician_profiles').select('education, hometown, bio, political_parties(name)').eq('id', politicianId).maybeSingle();
}

// politician_profiles — full self-view including target_boundary + party id (ProfilePage).
export async function getPoliticianProfileFull(userId) {
  return supabase.from('politician_profiles').select('target_boundary_id, target_boundary_name, political_party_id, political_parties(name), education, hometown, bio').eq('id', userId).maybeSingle();
}
