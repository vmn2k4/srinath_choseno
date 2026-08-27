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
 * landing on a brand-new, empty profile with nowhere else to go. Four-tier,
 * most relevant first: other current officeholders in the exact SAME
 * boundary (rare -- most districts have exactly one seat, so this usually
 * only hits for a city with multiple councillors), then anyone in the same
 * broader AREA (their state/province and everything within it -- the
 * Governor, Senators, other Representatives, State Senators, city mayors --
 * see areaShapeIds), then fellow party members anywhere, then topped up
 * with any other current officeholder in the same country if none of the
 * above fill `limit`. Country alone (the old fallback) produced results
 * with no actual geographic relevance -- a Michigan Representative's wall
 * showing an Austin mayor and Chicago councillors, sharing nothing but a
 * party and a country -- which the areaShapeIds tier exists to fix.
 */
export async function getRelatedPoliticians(
  supabase: Client,
  params: {
    excludeProfileId?: string | null;
    politicalPartyId?: number | null;
    country?: string | null;
    /** The wall subject's own boundary (their office_holders.map_shape_id) -- other officeholders sharing this exact seat/district are the single most relevant match possible, when they exist at all. */
    boundaryId?: number | string | null;
    /** The wall subject's boundary PLUS its containing state/province PLUS every other shape within that same state/province (see page.tsx's shape_containers lookup) -- this is what actually finds "other leaders from the same area" for the near-universal case of a single-seat district with nobody else to match on boundaryId alone. */
    areaShapeIds?: (number | string)[] | null;
    limit?: number;
  }
): Promise<{ data: RelatedPolitician[] }> {
  const limit = params.limit ?? 4;
  const boundaryId = params.boundaryId ? Number(params.boundaryId) : null;
  const areaShapeIds = (params.areaShapeIds || []).map(Number).filter((n) => !Number.isNaN(n));

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
  const addRows = (data: any[] | null) => {
    for (const row of data || []) {
      if (seenIds.has(row.id) || rows.length >= limit) continue;
      rows.push(row);
      seenIds.add(row.id);
    }
  };

  if (boundaryId && !Number.isNaN(boundaryId)) {
    const { data } = await baseQuery().eq("map_shape_id", boundaryId);
    addRows(data);
  }

  if (rows.length < limit && areaShapeIds.length > 0) {
    let areaQuery = baseQuery().in("map_shape_id", areaShapeIds);
    if (seenIds.size > 0) areaQuery = areaQuery.not("id", "in", `(${[...seenIds].join(",")})`);
    const { data } = await areaQuery;
    addRows(data);
  }

  if (rows.length < limit && params.politicalPartyId) {
    let partyQuery = baseQuery().eq("political_party_id", params.politicalPartyId);
    if (seenIds.size > 0) partyQuery = partyQuery.not("id", "in", `(${[...seenIds].join(",")})`);
    const { data } = await partyQuery;
    addRows(data);
  }

  if (rows.length < limit) {
    let fallbackQuery = baseQuery();
    if (seenIds.size > 0) fallbackQuery = fallbackQuery.not("id", "in", `(${[...seenIds].join(",")})`);
    const { data } = await fallbackQuery;
    addRows(data);
  }

  return { data: rows.map(toRelatedPolitician).filter((p): p is RelatedPolitician => p !== null).slice(0, limit) };
}
