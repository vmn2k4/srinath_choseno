import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

// getOwnProfile/fetchOrHealProfile below were ported early (Phase 1) as
// AuthContext dependencies. The rest of the original src/services/profile.js
// (used by ProfilePage, EditProfileFlow, OnboardingFlow, etc.) is appended
// here in Phase 4 alongside the other service files, same client-param
// signature.

// profiles — full row by default; pass columns for a narrower select.
export async function getOwnProfile(
  supabase: Client,
  userId: string,
  { columns = "*" }: { columns?: string } = {}
) {
  return supabase.from("profiles").select(columns).eq("id", userId).single();
}

// profiles — select('*'), missing-row self-heal (create default profile) +
// admin-email role correction. Used by AuthContext on session init and auth
// state changes. Returns the profile row directly (not {data,error}), same
// as the Vite version's behavior.
export async function fetchOrHealProfile(
  supabase: Client,
  userId: string,
  userEmail?: string | null
) {
  let { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  const isAdminEmail = userEmail?.toLowerCase() === "vmn2k4@gmail.com";

  if (!data) {
    const { data: created } = await supabase
      .from("profiles")
      .upsert({ id: userId, role: isAdminEmail ? "admin" : "normal" })
      .select()
      .maybeSingle();
    data = created;
  } else if (isAdminEmail && data.role !== "admin") {
    await supabase.from("profiles").update({ role: "admin" }).eq("id", userId);
    data.role = "admin";
  }

  return data;
}

// user_boundary_memberships — ids-only, hot path for elections seat filtering.
export async function getUserBoundaryShapeIds(supabase: Client, profileId: string) {
  return supabase.from("user_boundary_memberships").select("map_shape_id").eq("profile_id", profileId);
}

// user_boundary_memberships — full join with map_shapes (FeedPage, ProfilePage).
export async function getUserBoundaryMemberships(supabase: Client, profileId: string) {
  return supabase
    .from("user_boundary_memberships")
    .select("map_shape_id, map_shapes(id, name, country, boundary_type)")
    .eq("profile_id", profileId);
}

// politician_profiles — directory of politicians/candidates matching a set of
// boundary ids (or Country-level, always included) — PoliticianSidebar's feed.
export async function getInterestedPoliticians(supabase: Client, boundaryIds: number[] = []) {
  let query = supabase.from("politician_profiles").select(`
      id,
      political_target_role,
      target_boundary_name,
      target_boundary_type,
      avatar_url,
      profiles!inner (
        current_ghost_id,
        full_name,
        country
      )
    `);

  if (boundaryIds.length > 0) {
    query = query.or(`target_boundary_id.in.(${boundaryIds.join(",")}),target_boundary_type.eq.Country`);
  } else {
    query = query.eq("target_boundary_type", "Country");
  }

  return query;
}

// profiles — role/full_name/country/constituency upsert, shared by
// OnboardingFlow (passes onboardingCompleted:true) and EditProfileFlow (omits it).
export async function upsertProfileCore(
  supabase: Client,
  userId: string,
  { role, fullName, country, constituency }: { role: string; fullName?: string | null; country?: string | null; constituency?: string | null },
  { onboardingCompleted }: { onboardingCompleted?: boolean } = {}
) {
  const row: Database["public"]["Tables"]["profiles"]["Insert"] = {
    id: userId,
    role,
    full_name: fullName || null,
    country,
    constituency,
    updated_at: new Date().toISOString(),
  };
  if (onboardingCompleted !== undefined) row.onboarding_completed = onboardingCompleted;
  return supabase.from("profiles").upsert(row);
}

// politician_profiles — upsert, shared by OnboardingFlow/EditProfileFlow.
// fallbackBoundaryId: what to use for target_boundary_id when there's no
// primary matched boundary (OnboardingFlow passes null, EditProfileFlow
// passes the previous initialData.target_boundary_id).
export async function upsertPoliticianProfile(
  supabase: Client,
  userId: string,
  {
    targetBoundaryId,
    targetBoundaryName,
    politicalPartyId,
    education,
    hometown,
    bio,
    avatarUrl,
  }: {
    targetBoundaryId?: string | null;
    targetBoundaryName?: string | null;
    politicalPartyId?: number | null;
    education?: string | null;
    hometown?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
  },
  fallbackBoundaryId?: string | null
) {
  return supabase.from("politician_profiles").upsert({
    id: userId,
    target_boundary_id: targetBoundaryId ?? fallbackBoundaryId,
    target_boundary_name: targetBoundaryName,
    political_party_id: politicalPartyId || null,
    education: education || null,
    hometown: hometown || null,
    bio,
    avatar_url: avatarUrl || null,
    updated_at: new Date().toISOString(),
  });
}

// storage — optional politician profile photo upload, mirrors feed.ts's
// uploadPostImage (same bucket-then-getPublicUrl shape, own bucket).
export async function uploadAvatarImage(supabase: Client, file: File, userId: string) {
  const fileExt = file.name.split(".").pop();
  const filePath = `${userId}-${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage.from("politician-avatars").upload(filePath, file);
  if (uploadError) return { publicUrl: null, error: uploadError };
  const {
    data: { publicUrl },
  } = supabase.storage.from("politician-avatars").getPublicUrl(filePath);
  return { publicUrl, error: null };
}

// civic score — banked profiles.civic_score plus the current ghost's
// live (not-yet-banked) activity, re-cached into profiles.cached_total_score
// on every call. See 20260730000001_civic_score.sql and
// 20260731000000_score_persistence_and_burn_tracking.sql for why this is a
// single running total rather than a stored post/comment list.
export async function calculateMyScore(supabase: Client) {
  return supabase.rpc("calculate_my_score");
}

// user_locations — most recent lat/lng for a profile.
export async function getLatestUserLocation(supabase: Client, profileId: string) {
  return supabase
    .from("user_locations")
    .select("latitude, longitude")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1);
}

// profiles — role only (ElectionsPage's "show Become a Politician CTA" check).
export async function getProfileRole(supabase: Client, userId: string) {
  return supabase.from("profiles").select("role").eq("id", userId).single();
}

// politician_profiles — public campaign-page fields (CandidacyWall).
export async function getPoliticianProfile(supabase: Client, politicianId: string) {
  return supabase
    .from("politician_profiles")
    .select("education, hometown, bio, avatar_url, political_parties(name)")
    .eq("id", politicianId)
    .maybeSingle();
}

// politician_profiles — full self-view including target_boundary + party id (ProfilePage).
export async function getPoliticianProfileFull(supabase: Client, userId: string) {
  return supabase
    .from("politician_profiles")
    .select("target_boundary_id, target_boundary_name, political_party_id, political_parties(name), education, hometown, bio, avatar_url")
    .eq("id", userId)
    .maybeSingle();
}
