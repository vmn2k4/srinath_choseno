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

// ── Related politicians (wall page "Related People" rail) ──────────────────
export interface RelatedPolitician {
  id: string;
  fullName: string;
  photoUrl: string | null;
  roleTitle: string | null;
  jurisdictionName: string | null;
  partyName: string | null;
  wallHref: string;
}

const RELATED_POLITICIAN_SELECT = `
  id, full_name, photo_url, linked_profile_id,
  election_role_types ( role_title ),
  map_shapes!inner ( name, country ),
  political_parties ( name ),
  profiles!office_holders_linked_profile_id_fkey (
    id, full_name, current_ghost_id,
    politician_profiles ( wall_slug, avatar_url, photo_url, political_target_role )
  )
`;

function toRelatedPolitician(row: any): RelatedPolitician | null {
  const linkedProfile = row.profiles as any;
  const pp = linkedProfile?.politician_profiles;
  const wallSlug = pp?.wall_slug;
  // Only a currently-claimed-or-imported profile has a wall to link to --
  // an office_holders row with no linked_profile_id is data with nobody's
  // Choseno account behind it yet, so it can't be "related people" you can
  // click through to.
  const wallHref = wallSlug
    ? `/wall/${wallSlug}`
    : linkedProfile?.current_ghost_id
      ? `/wall/${linkedProfile.current_ghost_id}`
      : null;
  if (!wallHref) return null;

  return {
    id: linkedProfile.id,
    fullName: linkedProfile.full_name || row.full_name,
    photoUrl: pp?.photo_url || pp?.avatar_url || row.photo_url || null,
    roleTitle: row.election_role_types?.role_title || pp?.political_target_role || null,
    jurisdictionName: row.map_shapes?.name || null,
    partyName: row.political_parties?.name || null,
    wallHref,
  };
}

/**
 * Other current office holders to surface as "Related People" on a
 * politician's wall -- the wall page's antidote to a first-time visitor
 * landing on a brand-new, empty profile with nowhere else to go. Two-tier:
 * fellow party members first (most relevant), topped up with any other
 * current officeholder in the same country if the party alone doesn't fill
 * `limit` (e.g. an independent, or a party with too few other seated
 * members yet).
 */
export async function getRelatedPoliticians(
  supabase: Client,
  params: {
    excludeProfileId?: string | null;
    politicalPartyId?: number | null;
    country?: string | null;
    limit?: number;
  }
): Promise<{ data: RelatedPolitician[] }> {
  const limit = params.limit ?? 4;

  const baseQuery = () => {
    let q = supabase
      .from("office_holders")
      .select(RELATED_POLITICIAN_SELECT)
      .eq("is_current", true)
      .order("holding_since", { ascending: false })
      .limit(limit);
    if (params.country) q = q.eq("map_shapes.country", params.country);
    if (params.excludeProfileId) q = q.neq("linked_profile_id", params.excludeProfileId);
    return q;
  };

  const rows: any[] = [];
  const seenIds = new Set<string>();

  if (params.politicalPartyId) {
    const { data } = await baseQuery().eq("political_party_id", params.politicalPartyId);
    for (const row of data || []) {
      if (seenIds.has(row.id)) continue;
      rows.push(row);
      seenIds.add(row.id);
    }
  }

  if (rows.length < limit) {
    let fallbackQuery = baseQuery();
    if (seenIds.size > 0) fallbackQuery = fallbackQuery.not("id", "in", `(${[...seenIds].join(",")})`);
    const { data } = await fallbackQuery;
    for (const row of data || []) {
      if (seenIds.has(row.id) || rows.length >= limit) continue;
      rows.push(row);
      seenIds.add(row.id);
    }
  }

  return { data: rows.map(toRelatedPolitician).filter((p): p is RelatedPolitician => p !== null).slice(0, limit) };
}
