import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isDevEnvironment } from "@/lib/utils/environment";

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

// politician_profiles & profiles directory of politicians/candidates.
export async function getInterestedPoliticians(
  supabase: Client,
  options?: {
    shapeId?: number;
    filterType?: "all" | "shape" | "country" | "international";
    country?: string | null;
  }
) {
  const { shapeId, filterType = "all", country } = options || {};

  if (filterType === "international") {
    return { data: [], error: null };
  }

  // 1. Fetch shape name if filtering by specific shapeId
  let shapeName: string | null = null;
  if (filterType === "shape" && shapeId) {
    const { data: shapeData } = await supabase
      .from("map_shapes")
      .select("name")
      .eq("id", shapeId)
      .single();
    if (shapeData) shapeName = shapeData.name;
  }

  // 2. Two distinct "belongs to this shape" signals for a politician, kept
  // separate so one never mislabels the other:
  //   - residentPoliticianIds: lives in this exact shape (home-address
  //     membership, same as any citizen) — shown as a generic "Politician"
  //     for the area, regardless of what office (if any) they're running for.
  //   - electionCandidateIds: formally running for a seat AT this shape via
  //     Election Mode — can be anywhere, has nothing to do with residency.
  let residentPoliticianIds = new Set<string>();
  let electionCandidateIds = new Set<string>();

  if (filterType === "shape" && shapeId) {
    let residentsQuery = supabase
      .from("user_boundary_memberships")
      .select("profile_id, profiles!inner(role)")
      .eq("map_shape_id", shapeId)
      .eq("profiles.role", "politician");
    if (!isDevEnvironment()) residentsQuery = residentsQuery.eq("profiles.is_test", false);
    const { data: residents } = await residentsQuery;
    (residents || []).forEach((r: any) => residentPoliticianIds.add(r.profile_id));

    const { data: seatCandidates } = await supabase
      .from("election_seats")
      .select("id, election_candidates(politician_id)")
      .eq("map_shape_id", shapeId);

    (seatCandidates || []).forEach((seat: any) => {
      (seat.election_candidates || []).forEach((cand: any) => {
        if (cand.politician_id) electionCandidateIds.add(cand.politician_id);
      });
    });
  }

  // 3. Fetch politician_profiles joined with profiles
  let polProfilesQuery = supabase.from("politician_profiles").select(`
    id,
    target_boundary_id,
    political_target_role,
    target_boundary_name,
    target_boundary_type,
    avatar_url,
    profiles!inner (
      id,
      current_ghost_id,
      full_name,
      country,
      role
    )
  `);
  if (!isDevEnvironment()) polProfilesQuery = polProfilesQuery.eq("profiles.is_test", false);
  const { data: polProfiles } = await polProfilesQuery;

  // 4. Fetch profiles where role = 'politician' (profiles has no avatar_url
  // column — that only lives on politician_profiles, which is joined in
  // separately above).
  let userQuery = supabase
    .from("profiles")
    .select("id, current_ghost_id, full_name, country, role")
    .eq("role", "politician");

  if (filterType === "country" && country) {
    userQuery = userQuery.eq("country", country);
  }
  if (!isDevEnvironment()) userQuery = userQuery.eq("is_test", false);

  const { data: rawPoliticians } = await userQuery;

  // Deduplicate strictly by current_ghost_id
  const deduplicatedMap = new Map<string, any>();

  const addOrMerge = (profId: string, ghostId: string, item: any) => {
    if (!ghostId) return;
    if (!deduplicatedMap.has(ghostId)) {
      deduplicatedMap.set(ghostId, item);
    } else {
      const existing = deduplicatedMap.get(ghostId);
      deduplicatedMap.set(ghostId, {
        ...existing,
        ...item,
        political_target_role: item.political_target_role || existing.political_target_role,
        target_boundary_name: item.target_boundary_name || existing.target_boundary_name,
        avatar_url: item.avatar_url || existing.avatar_url,
      });
    }
  };

  // Add rawPoliticians first as generic "belongs to this boundary" entries —
  // residency (or a formal election candidacy elsewhere) only ever earns a
  // generic "Politician" placeholder here, never someone else's specific
  // candidacy details. Processed before polProfiles so a real candidacy
  // record (added below) can overwrite this placeholder with specifics.
  (rawPoliticians || []).forEach((user: any) => {
    if (!user.current_ghost_id) return;

    if (filterType === "shape" && shapeId) {
      const isResident = residentPoliticianIds.has(user.id);
      const isElectionCandidate = electionCandidateIds.has(user.id);
      if (!isResident && !isElectionCandidate) return;
    }

    addOrMerge(user.id, user.current_ghost_id, {
      id: user.id,
      political_target_role: "Politician",
      target_boundary_name: shapeName || user.country || "",
      target_boundary_type: "Representative",
      avatar_url: null,
      profiles: user,
    });
  });

  // Add polProfiles second — an explicit candidacy declaration for this exact
  // shape (by id, by name, or a formal election-mode candidacy), which can
  // target any boundary regardless of where the politician actually lives.
  // Never matched by residency, so it can't attach an unrelated boundary's
  // candidacy card the way the old logic did.
  (polProfiles || []).forEach((pol: any) => {
    const prof = pol.profiles;
    if (!prof || !prof.current_ghost_id) return;

    if (filterType === "shape" && shapeId) {
      const matchesId = pol.target_boundary_id === shapeId || String(pol.target_boundary_id) === String(shapeId);
      const matchesName =
        !!shapeName &&
        !!pol.target_boundary_name &&
        pol.target_boundary_name
          .split(",")
          .some((segment: string) => segment.trim().toLowerCase() === shapeName!.toLowerCase());
      const matchesElection = electionCandidateIds.has(prof.id);

      if (!matchesId && !matchesName && !matchesElection) return;
    } else if (filterType === "country" && country) {
      if (pol.target_boundary_type !== "Country" && prof.country !== country) return;
    }

    addOrMerge(prof.id, prof.current_ghost_id, {
      id: pol.id,
      political_target_role: pol.political_target_role || "Candidate",
      target_boundary_name: pol.target_boundary_name || shapeName || prof.country || "",
      target_boundary_type: pol.target_boundary_type || "Local",
      avatar_url: pol.avatar_url,
      profiles: prof,
    });
  });

  const list = Array.from(deduplicatedMap.values());
  return { data: list, error: null };
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
    politicalTargetRole,
  }: {
    targetBoundaryId?: string | null;
    targetBoundaryName?: string | null;
    politicalPartyId?: number | null;
    education?: string | null;
    hometown?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    politicalTargetRole?: string | null;
  },
  fallbackBoundaryId?: string | null
) {
  return supabase.from("politician_profiles").upsert({
    id: userId,
    target_boundary_id: targetBoundaryId ?? fallbackBoundaryId,
    target_boundary_name: targetBoundaryName,
    political_target_role: politicalTargetRole || null,
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
    .select("target_boundary_id, target_boundary_name, political_target_role, political_party_id, political_parties(name), education, hometown, bio, avatar_url")
    .eq("id", userId)
    .maybeSingle();
}
