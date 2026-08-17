import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { fetchAllPages } from "@/lib/utils/fetchAllPages";
import { extractIdFromSlug, buildSeatSlug, buildLegacySeatSlug, buildCandidateSlug, slugifyText } from "@/lib/utils/slugs";
import { isDevEnvironment } from "@/lib/utils/environment";

type Client = SupabaseClient<Database>;
type ElectionSeatInsert = Database["public"]["Tables"]["election_seats"]["Insert"];
type ElectionQuestionInsert = Database["public"]["Tables"]["election_questions"]["Insert"];
type ElectionQuestionOptionInsert = Database["public"]["Tables"]["election_question_options"]["Insert"];
type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];

const ADMIN_CANDIDATE_COLUMNS = `
  id, seat_id, statement, status, submitted_at, intro_video_url,
  profiles!election_candidates_politician_id_fkey(full_name, current_ghost_id),
  election_candidate_answers(
    id, context_text, video_url, text_answer, rating_value,
    election_questions(id, question_text, question_type, rank),
    election_question_options(option_text),
    election_candidate_answer_options(rank, election_question_options(option_text))
  )
`;

// ── elections ────────────────────────────────────────────────────────────
export async function getElections(supabase: Client) {
  return supabase.from("elections").select("*").order("created_at", { ascending: false });
}

export async function createElection(
  supabase: Client,
  { name, electionDate }: { name: string; electionDate: string }
) {
  return supabase.from("elections").insert({ name, election_date: electionDate }).select().single();
}

export async function advanceElectionStatus(supabase: Client, electionId: string, nextStatus: string) {
  return supabase.from("elections").update({ status: nextStatus }).eq("id", electionId);
}

export async function deleteElection(supabase: Client, electionId: string) {
  return supabase.from("elections").delete().eq("id", electionId);
}

// ── election_role_types ─────────────────────────────────────────────────
export async function getElectionRoleTypes(supabase: Client, country: string, boundaryType: string) {
  return supabase
    .from("election_role_types")
    .select("id, role_key, region_override, role_title, description")
    .eq("country", country)
    .eq("boundary_type", boundaryType);
}

/**
 * Every role type for a country, unfiltered by boundary_type -- feeds the
 * NewsImportAdminClient scope tree (country -> boundary_type -> role_key
 * checkboxes, same pattern as BoundaryVisualizerClient's entityTypes tree).
 * Grouped client-side by role_key so region-varying titles (MLA/MPP/MNA/MHA
 * all share role_key='provincial_rep') collapse into one checkbox instead
 * of four -- "select all provincial reps" should mean all of them
 * regardless of what a given province calls the seat.
 */
export async function getAllElectionRoleTypesForCountry(supabase: Client, country: string) {
  return supabase
    .from("election_role_types")
    .select("id, boundary_type, role_key, region_override, role_title")
    .eq("country", country)
    .order("boundary_type")
    .order("role_key");
}

/**
 * All current officeholders whose election_role_type_id is in the given
 * set, across every map_shape -- the "select all MLAs" / "select all MPs"
 * bulk query for NewsImportAdminClient. Distinct from
 * getOfficeHoldersForShapes (which scopes by shape, not role) -- this is
 * the shape-agnostic counterpart for "every seat of this role, anywhere".
 * linked_profile_id is surfaced explicitly since the bulk news-import flow
 * can only tag/generate for officeholders who have one (see
 * NewsImportAdminClient's "no linked profile -- will be skipped" badge).
 */
export async function getOfficeHoldersByRoleTypeIds(supabase: Client, roleTypeIds: string[]) {
  if (!roleTypeIds.length) return { data: [], error: null };
  return supabase
    .from("office_holders")
    .select(
      `id, map_shape_id, election_role_type_id, full_name, linked_profile_id,
       map_shapes(id, name, boundary_type, country),
       election_role_types(role_title, role_key)`
    )
    .in("election_role_type_id", roleTypeIds)
    .eq("is_current", true)
    .order("full_name");
}

async function enrichOfficeHolders(supabase: Client, holders: any[]) {
  if (!holders || !holders.length) return holders;

  const missingNames = holders
    .filter((h) => !h.photo_url || !h.contact_email || !h.contact_phone || !h.source_url)
    .map((h) => h.full_name?.trim())
    .filter(Boolean);

  const nameToContact = new Map<
    string,
    { photo_url?: string; email?: string; phone?: string; source?: string }
  >();

  if (missingNames.length > 0) {
    const { data: profMatches } = await supabase
      .from("profiles")
      .select("full_name, politician_profiles(photo_url, avatar_url, contact_email, contact_phone, source_url)")
      .in("full_name", missingNames);

    (profMatches || []).forEach((p: any) => {
      const norm = p.full_name?.trim().toLowerCase();
      if (!norm || !p.politician_profiles) return;
      const pp = p.politician_profiles;
      const photo = pp.photo_url || pp.avatar_url;
      if (!nameToContact.has(norm)) {
        nameToContact.set(norm, {
          photo_url: photo || undefined,
          email: pp.contact_email || undefined,
          phone: pp.contact_phone || undefined,
          source: pp.source_url || undefined,
        });
      }
    });
  }

  return holders.map((h) => {
    const linkedPP = h.profiles?.politician_profiles;
    const norm = h.full_name?.trim().toLowerCase();
    const fallback = norm ? nameToContact.get(norm) : null;

    return {
      ...h,
      photo_url:
        h.photo_url ||
        linkedPP?.photo_url ||
        linkedPP?.avatar_url ||
        fallback?.photo_url ||
        null,
      contact_email:
        h.contact_email ||
        linkedPP?.contact_email ||
        fallback?.email ||
        null,
      contact_phone:
        h.contact_phone ||
        linkedPP?.contact_phone ||
        fallback?.phone ||
        null,
      source_url:
        h.source_url ||
        linkedPP?.source_url ||
        fallback?.source ||
        null,
    };
  });
}

// ── office_holders (current officeholder shown on boundary directory pages) ──
export async function getOfficeHoldersForShape(supabase: Client, mapShapeId: number | string) {
  const res = await supabase
    .from("office_holders")
    .select(
      `id, election_role_type_id, full_name, bio, source_url, photo_url, holding_since,
       is_current, term_ended_at,
       contact_email, contact_phone, linked_profile_id,
       map_shapes(id, name, boundary_type, country),
       election_role_types(role_title, role_key, description),
       political_parties(name),
       profiles!office_holders_linked_profile_id_fkey(id, full_name, current_ghost_id, politician_profiles(photo_url, avatar_url, contact_email, contact_phone, source_url))`
    )
    .eq("map_shape_id", Number(mapShapeId))
    .eq("is_current", true);

  if (res.data) {
    res.data = await enrichOfficeHolders(supabase, res.data);
  }
  return res;
}

export async function getOfficeHoldersForShapes(
  supabase: Client,
  mapShapeIds: (number | string)[]
) {
  if (!mapShapeIds.length) return { data: [], error: null };
  const ids = mapShapeIds.map(Number);
  const res = await supabase
    .from("office_holders")
    .select(
      `id, map_shape_id, election_role_type_id, full_name, bio, source_url, photo_url, holding_since,
       is_current, term_ended_at,
       contact_email, contact_phone, linked_profile_id,
       map_shapes(id, name, boundary_type, country),
       election_role_types(role_title, role_key),
       political_parties(name),
       profiles!office_holders_linked_profile_id_fkey(id, full_name, current_ghost_id, politician_profiles(photo_url, avatar_url, contact_email, contact_phone, source_url, wall_slug))`
    )
    .in("map_shape_id", ids)
    .eq("is_current", true);

  if (res.data) {
    res.data = await enrichOfficeHolders(supabase, res.data);
  }
  return res;
}

export async function getFeaturedOfficeHolders(
  supabase: Client,
  country?: string | null
) {
  let query = supabase
    .from("office_holders")
    .select(
      `id, map_shape_id, election_role_type_id, full_name, bio, source_url, photo_url, holding_since,
       is_current, term_ended_at,
       contact_email, contact_phone, linked_profile_id,
       map_shapes!inner(id, name, boundary_type, country),
       election_role_types(role_title, role_key),
       political_parties(name),
       profiles!office_holders_linked_profile_id_fkey(id, full_name, current_ghost_id, politician_profiles(photo_url, avatar_url, contact_email, contact_phone, source_url))`
    )
    .eq("is_current", true)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (country) {
    query = query.eq("map_shapes.country", country);
  }

  const res = await query;
  if (res.data) {
    res.data = await enrichOfficeHolders(supabase, res.data);
  }
  return res;
}

export async function getOfficeHolderByRole(
  supabase: Client,
  mapShapeId: number | string,
  electionRoleTypeId: string
) {
  const res = await supabase
    .from("office_holders")
    .select(
      `id, election_role_type_id, full_name, bio, source_url, photo_url, holding_since,
       is_current, term_ended_at,
       contact_email, contact_phone, linked_profile_id,
       election_role_types(role_title, role_key),
       political_parties(name),
       profiles!office_holders_linked_profile_id_fkey(id, full_name, current_ghost_id, politician_profiles(photo_url, avatar_url, contact_email, contact_phone, source_url))`
    )
    .eq("map_shape_id", Number(mapShapeId))
    .eq("election_role_type_id", electionRoleTypeId)
    .eq("is_current", true)
    .maybeSingle();

  if (res.data) {
    const enriched = await enrichOfficeHolders(supabase, [res.data]);
    res.data = enriched[0];
  }
  return res;
}

export async function getOfficeHolder(
  supabase: Client,
  mapShapeId: number | string,
  electionRoleTypeId: string
) {
  return supabase
    .from("office_holders")
    .select("*")
    .eq("map_shape_id", Number(mapShapeId))
    .eq("election_role_type_id", electionRoleTypeId)
    .maybeSingle();
}

export async function upsertOfficeHolder(
  supabase: Client,
  fields: {
    mapShapeId: number | string;
    electionRoleTypeId: string;
    fullName: string;
    politicalPartyId?: number | null;
    bio?: string | null;
    sourceUrl?: string | null;
    photoUrl?: string | null;
    holdingSince?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    linkedProfileId?: string | null;
  },
  updatedBy: string
) {
  return supabase
    .from("office_holders")
    .upsert(
      {
        map_shape_id: Number(fields.mapShapeId),
        election_role_type_id: fields.electionRoleTypeId,
        full_name: fields.fullName,
        political_party_id: fields.politicalPartyId ?? null,
        bio: fields.bio ?? null,
        source_url: fields.sourceUrl ?? null,
        photo_url: fields.photoUrl ?? null,
        holding_since: fields.holdingSince ?? null,
        contact_email: fields.contactEmail ?? null,
        contact_phone: fields.contactPhone ?? null,
        linked_profile_id: fields.linkedProfileId ?? null,
        is_current: true,
        term_ended_at: null,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      } as any,
      // Must match the live unique constraint exactly -- it's 3 columns
      // (map_shape_id, election_role_type_id, full_name), not the 2-column
      // one the original table definition declared; see the note in
      // 20260816000000_office_holder_term_lifecycle.sql. The narrower
      // 2-column target here would have made Postgres reject every upsert
      // for a seat that already has any current row (councillors sharing a
      // map_shape_id + role always do) with "no unique or exclusion
      // constraint matching the ON CONFLICT specification".
      { onConflict: "map_shape_id,election_role_type_id,full_name" }
    )
    .select()
    .single();
}

/**
 * Ends one officeholder's term. Never delete or overwrite an outgoing
 * holder's row in place -- office_holder_wall_claims.office_holder_id is ON
 * DELETE RESTRICT (a claimed wall blocks a hard delete outright), and
 * overwriting destroys their term history for no reason. Retiring keeps the
 * row, its wall, and any claim intact; only the badge changes (current ->
 * former) via the is_current check in politicianWall.ts / elections.ts reads.
 */
export async function retireOfficeHolder(
  supabase: Client,
  officeHolderId: string,
  updatedBy: string,
  termEndedAt?: string | null
) {
  return supabase
    .from("office_holders")
    .update({
      is_current: false,
      term_ended_at: termEndedAt ?? new Date().toISOString().slice(0, 10),
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", officeHolderId)
    .select()
    .single();
}

/**
 * The standard "an election happened" write: retire the outgoing holder and
 * insert their successor as the new current holder for the same seat, in
 * one call. For multi-seat roles (Councillor) this is called once per
 * outgoing/incoming pair, not once per seat.
 */
export async function replaceOfficeHolder(
  supabase: Client,
  outgoingHolderId: string,
  incoming: Parameters<typeof upsertOfficeHolder>[1],
  updatedBy: string,
  termEndedAt?: string | null
) {
  const retireRes = await retireOfficeHolder(supabase, outgoingHolderId, updatedBy, termEndedAt);
  if (retireRes.error) return retireRes;
  return upsertOfficeHolder(supabase, incoming, updatedBy);
}

export async function getOfficeHoldersByShapeAndRole(
  supabase: Client,
  mapShapeId: number | string,
  roleTitle?: string
) {
  let query = supabase
    .from("office_holders")
    .select(
      `id, election_role_type_id, full_name, bio, source_url, photo_url, holding_since,
       is_current, term_ended_at,
       contact_email, contact_phone, linked_profile_id,
       election_role_types(role_title, role_key),
       political_parties(name),
       profiles!office_holders_linked_profile_id_fkey(id, full_name, current_ghost_id)`
    )
    .eq("map_shape_id", Number(mapShapeId))
    .eq("is_current", true);

  if (roleTitle) {
    query = query.eq("election_role_types.role_title", roleTitle);
  }

  return query;
}

export async function removeOfficeHolder(supabase: Client, officeHolderId: string) {
  return supabase.from("office_holders").delete().eq("id", officeHolderId);
}

// ── election_seats (admin) ──────────────────────────────────────────────
export async function getElectionSeatsByElectionId(supabase: Client, electionId: string) {
  return fetchAllPages((from, to) =>
    supabase
      .from("election_seats")
      .select("id, role_title, map_shapes(id, name, boundary_type, country, code, properties)")
      .eq("election_id", electionId)
      .order("role_title")
      .order("id")
      .range(from, to)
  );
}

// fetchAllPages alone paginates the *result* rows via .range(), but the
// .in('seat_id', seatIds) filter itself was passed whole on every page --
// fine for a small election, but for one with thousands of seats (e.g. a
// municipal election) the filter clause alone can exceed 2000+ UUIDs.
// Confirmed directly: at ~2300 ids the resulting request's headers exceed
// 60KB and the request fails outright ("Failed sending data to the peer"),
// which is what actually caused the ~1 minute load (the query doesn't just
// get slow, it fails and the browser client retries). Chunking the id list
// itself, not just the result pagination, fixes this at the root; chunks are
// independent so they run in parallel rather than one giant sequential call.
const SEAT_ID_CHUNK_SIZE = 200;

export async function getElectionCandidatesBySeatIds(supabase: Client, seatIds: string[]) {
  const chunks: string[][] = [];
  for (let i = 0; i < seatIds.length; i += SEAT_ID_CHUNK_SIZE) {
    chunks.push(seatIds.slice(i, i + SEAT_ID_CHUNK_SIZE));
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      fetchAllPages((from, to) =>
        supabase
          .from("election_candidates")
          .select(ADMIN_CANDIDATE_COLUMNS)
          .in("seat_id", chunk)
          .order("id")
          .range(from, to)
      )
    )
  );
  const failed = results.find((r) => r.error);
  if (failed) return { data: null, error: failed.error };
  return { data: results.flatMap((r) => r.data || []), error: null };
}

export async function createElectionSeats(supabase: Client, rows: ElectionSeatInsert[]) {
  return supabase.from("election_seats").insert(rows);
}

export async function deleteElectionSeat(supabase: Client, seatId: string) {
  return supabase.from("election_seats").delete().eq("id", seatId);
}

// ── election_seats (politician / voter facing) ──────────────────────────
export async function getOpenSeatsNearShapeIds(supabase: Client, shapeIds: number[]) {
  const today = new Date().toISOString().slice(0, 10);
  return supabase
    .from("election_seats")
    .select(
      "id, role_title, map_shape_id, map_shapes(name, boundary_type, country, properties), elections!inner(id, name, election_date, status)"
    )
    .in("map_shape_id", shapeIds)
    .in("elections.status", ["nominations_open", "active"])
    .gte("elections.election_date", today)
    .order("role_title");
}

export async function getActiveSeatsByShapeIds(supabase: Client, shapeIds: number[]) {
  return supabase
    .from("election_seats")
    .select("id, role_title, map_shapes(name, boundary_type, properties), elections!inner(id, name, election_date, status)")
    .in("map_shape_id", shapeIds)
    .in("elections.status", ["nominations_open", "active"]);
}

// Platform-wide active seats, unscoped by boundary membership — used for
// public/anonymous browsing where there's no "my area" to filter by.
export async function getActiveSeats(supabase: Client) {
  return supabase
    .from("election_seats")
    .select(
      "id, role_title, map_shape_id, map_shapes(id, name, boundary_type, properties), elections!inner(id, name, election_date, status)"
    )
    .in("elections.status", ["nominations_open", "active"])
    .order("role_title");
}

export async function findOpenSeatsInContainer(supabase: Client, containerShapeId: number) {
  return supabase.rpc("find_open_seats_in_container", { p_container_shape_id: containerShapeId });
}

const SEAT_COLUMNS =
  "id, map_shape_id, role_title, map_shapes(name, boundary_type, country, properties), elections(id, name, election_date, status)";

export async function getSeatById(supabase: Client, seatId: string) {
  const realSeatId = extractIdFromSlug(seatId);
  if (realSeatId && realSeatId.length === 36) {
    const res = await supabase
      .from("election_seats")
      .select(SEAT_COLUMNS)
      .eq("id", realSeatId)
      .maybeSingle();

    if (res.data) return res;
  }

  // Seat slugs (buildSeatSlug) always carry a short 6-char hex hash, never a
  // full UUID, so this is the common path. Resolve it to a real id through
  // an indexed lookup instead of fetching every seat and scanning in JS.
  if (realSeatId && /^[0-9a-f]{6,8}$/i.test(realSeatId)) {
    const { data: resolvedId } = await supabase.rpc("find_seat_id_by_short_hash", {
      short_hash: realSeatId,
    });
    if (resolvedId) {
      const res = await supabase.from("election_seats").select(SEAT_COLUMNS).eq("id", resolvedId).maybeSingle();
      if (res.data) return res;
    }
  }

  // Last-resort fallback for any slug shape the fast paths above don't cover.
  const { data: seats } = await supabase.from("election_seats").select(SEAT_COLUMNS);

  if (!seats || seats.length === 0) {
    return { data: null };
  }

  const match = seats.find((s) => {
    const seatSlug = buildSeatSlug(s as any);
    const legacySeatSlug = buildLegacySeatSlug(s as any);
    return (
      s.id === seatId ||
      s.id === realSeatId ||
      seatSlug === seatId ||
      legacySeatSlug === seatId ||
      slugifyText(s.role_title) === seatId ||
      (s.map_shapes && typeof s.map_shapes !== 'string' && 'name' in s.map_shapes && s.map_shapes.name && slugifyText(`${s.role_title}-${s.map_shapes.name}`) === seatId)
    );
  });
  return { data: match || seats[0] || null };
}

// ── election_candidates ──────────────────────────────────────────────────
export async function getMyCandidacies(supabase: Client, profileId: string) {
  return supabase
    .from("election_candidates")
    .select("id, statement, seat_id, status, submitted_at, election_seats(role_title, map_shapes(name, properties), elections(name, status))")
    .eq("politician_id", profileId)
    .order("created_at", { ascending: false });
}

export async function getCandidatesBySeatIds(supabase: Client, seatIds: string[]) {
  if (!seatIds || seatIds.length === 0) {
    return { data: [], error: null };
  }

  const resolvedIds: string[] = [];

  for (const sId of seatIds) {
    if (!sId) continue;
    const extracted = extractIdFromSlug(sId);
    if (extracted && extracted.length === 36) {
      resolvedIds.push(extracted);
    } else {
      const { data: seatMatch } = await getSeatById(supabase, sId);
      if (seatMatch?.id && !resolvedIds.includes(seatMatch.id)) {
        resolvedIds.push(seatMatch.id);
      }
    }
  }

  if (resolvedIds.length === 0) {
    return { data: [], error: null };
  }

  // profiles joined via !inner so a test-flagged candidate's row drops out
  // entirely in production, instead of surviving with a null-embedded
  // profile (the default to-one embed behavior when an .eq() filter on the
  // embed doesn't match).
  const columns =
    "id, statement, seat_id, nomination_filed, added_by_election_admin_id, claimed_at, profiles!election_candidates_politician_id_fkey!inner(id, full_name, current_ghost_id, politician_profiles(avatar_url))";

  let query = supabase.from("election_candidates").select(columns).in("seat_id", resolvedIds);
  if (!isDevEnvironment()) query = query.eq("profiles.is_test", false);
  return query;
}

const CANDIDATE_COLUMNS = `
  id, seat_id, statement, status, submitted_at, intro_video_url, politician_id,
  election_seats ( role_title, map_shapes ( name, properties ), elections ( id, name, election_date, status ) )
`;

export async function getCandidateById(supabase: Client, candidateId: string) {
  const realCandidateId = extractIdFromSlug(candidateId);
  if (realCandidateId && realCandidateId.length === 36) {
    const res = await supabase
      .from("election_candidates")
      .select(CANDIDATE_COLUMNS)
      .eq("id", realCandidateId)
      .maybeSingle();

    if (res.data) return res;
  }

  // Candidate slugs (buildCandidateSlug) always carry a short 6-char hex
  // hash, never a full UUID, so this is the common path. Resolve it to a
  // real id through an indexed lookup instead of fetching every candidate
  // and scanning in JS.
  if (realCandidateId && /^[0-9a-f]{6,8}$/i.test(realCandidateId)) {
    const { data: resolvedId } = await supabase.rpc("find_candidate_id_by_short_hash", {
      short_hash: realCandidateId,
    });
    if (resolvedId) {
      const res = await supabase
        .from("election_candidates")
        .select(CANDIDATE_COLUMNS)
        .eq("id", resolvedId)
        .maybeSingle();
      if (res.data) return res;
    }
  }

  // Last-resort fallback for any slug shape the fast paths above don't cover.
  const { data: cands } = await supabase.from("election_candidates").select(CANDIDATE_COLUMNS);

  const match = (cands || []).find((c) => {
    const candSlug = buildCandidateSlug(c as any);
    return c.id === candidateId || c.id === realCandidateId || candSlug === candidateId;
  });
  return { data: match || null };
}

export async function getPublicCandidateById(supabase: Client, candidateId: string) {
  // profiles joined via !inner so a test-flagged candidate drops out
  // entirely in production rather than surviving with a null-embedded
  // profile (the default to-one embed behavior when an .eq() filter on the
  // embed doesn't match).
  const columns = `
    id, statement, politician_id, status, intro_video_url, nomination_filed, added_by_election_admin_id, claimed_at, seat_id,
    election_seats ( role_title, map_shapes ( name, boundary_type, properties ), elections ( name, status ) ),
    profiles!election_candidates_politician_id_fkey!inner ( full_name, current_ghost_id )
  `;

  const realCandidateId = extractIdFromSlug(candidateId);
  if (realCandidateId && realCandidateId.length === 36) {
    let query = supabase.from("election_candidates").select(columns).eq("id", realCandidateId);
    if (!isDevEnvironment()) query = query.eq("profiles.is_test", false);
    const res = await query.maybeSingle();

    if (res.data) return res;
  }

  // Candidate slugs (buildCandidateSlug) always carry a short 6-char hex
  // hash, never a full UUID, so this is the common path. Resolve it to a
  // real id through an indexed lookup instead of fetching every candidate
  // and scanning in JS.
  if (realCandidateId && /^[0-9a-f]{6,8}$/i.test(realCandidateId)) {
    const { data: resolvedId } = await supabase.rpc("find_candidate_id_by_short_hash", {
      short_hash: realCandidateId,
    });
    if (resolvedId) {
      let query = supabase.from("election_candidates").select(columns).eq("id", resolvedId);
      if (!isDevEnvironment()) query = query.eq("profiles.is_test", false);
      const res = await query.maybeSingle();
      if (res.data) return res;
    }
  }

  // Last-resort fallback for any slug shape the fast paths above don't cover.
  let listQuery = supabase.from("election_candidates").select(columns);
  if (!isDevEnvironment()) listQuery = listQuery.eq("profiles.is_test", false);
  const { data: cands } = await listQuery;

  const match = (cands || []).find((c) => {
    const candSlug = buildCandidateSlug(c as any);
    return c.id === candidateId || c.id === realCandidateId || candSlug === candidateId;
  });
  return { data: match || null };
}

export async function applyForSeat(supabase: Client, seatId: string) {
  // p_statement's generated type is a non-nullable `string` (no SQL
  // DEFAULT), but the column/param is genuinely nullable at runtime --
  // same codegen caveat as insertMapShape/addUnregisteredCandidate above.
  return supabase.rpc("apply_for_seat", {
    p_seat_id: seatId,
    p_statement: null,
  } as unknown as { p_seat_id: string; p_statement: string });
}

export async function deleteCandidacy(supabase: Client, candidateId: string) {
  return supabase.from("election_candidates").delete().eq("id", candidateId);
}

export async function updateCandidateStatement(supabase: Client, candidateId: string, statement: string) {
  return supabase.from("election_candidates").update({ statement }).eq("id", candidateId);
}

export async function updateCandidateIntroVideoUrl(supabase: Client, candidateId: string, url: string) {
  return supabase.from("election_candidates").update({ intro_video_url: url }).eq("id", candidateId);
}

export async function reviewCandidateApplication(
  supabase: Client,
  candidateId: string,
  { approve, reviewedBy }: { approve: boolean; reviewedBy: string }
) {
  return supabase
    .from("election_candidates")
    .update({ status: approve ? "approved" : "rejected", reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy })
    .eq("id", candidateId);
}

export async function submitCandidateApplication(supabase: Client, candidateId: string) {
  return supabase.rpc("submit_candidate_application", { p_candidate_id: candidateId });
}

// ── election_questions / election_question_options ─────────────────────
export async function getElectionQuestions(supabase: Client, electionId: string) {
  return supabase
    .from("election_questions")
    .select("id, question_text, question_type, required, allow_context, allow_video, visible_to_public, rank, election_question_options(id, option_text, rank)")
    .eq("election_id", electionId)
    .order("rank");
}

export async function createElectionQuestion(supabase: Client, fields: ElectionQuestionInsert) {
  return supabase.from("election_questions").insert(fields).select().single();
}

export async function updateElectionQuestion(
  supabase: Client,
  questionId: string,
  fields: Database["public"]["Tables"]["election_questions"]["Update"]
) {
  return supabase.from("election_questions").update(fields).eq("id", questionId).select().single();
}

export async function deleteElectionQuestion(supabase: Client, questionId: string) {
  return supabase.from("election_questions").delete().eq("id", questionId);
}

export async function createElectionQuestionOptions(supabase: Client, rows: ElectionQuestionOptionInsert[]) {
  return supabase.from("election_question_options").insert(rows);
}

export async function updateElectionQuestionOption(
  supabase: Client,
  optionId: string,
  fields: Database["public"]["Tables"]["election_question_options"]["Update"]
) {
  return supabase.from("election_question_options").update(fields).eq("id", optionId);
}

export async function deleteElectionQuestionOption(supabase: Client, optionId: string) {
  return supabase.from("election_question_options").delete().eq("id", optionId);
}

// ── election_candidate_answers ──────────────────────────────────────────
export async function getCandidateAnswers(supabase: Client, candidateId: string) {
  return supabase
    .from("election_candidate_answers")
    .select("id, question_id, option_id, text_answer, rating_value, context_text, video_url, election_candidate_answer_options(option_id, rank)")
    .eq("candidate_id", candidateId);
}

export async function getPublicCandidateAnswers(supabase: Client, candidateId: string) {
  return supabase
    .from("election_candidate_answers")
    .select(
      `
      id, context_text, video_url, text_answer, rating_value,
      election_questions(id, question_text, question_type, rank, visible_to_public),
      election_question_options(option_text),
      election_candidate_answer_options(rank, election_question_options(option_text)),
      election_answer_comments(id, ghost_id, content, created_at)
    `
    )
    .eq("candidate_id", candidateId);
}

// fields: { optionId, textAnswer, ratingValue, contextText, videoUrl } -- an
// options object rather than positional params since which fields are
// meaningful depends on the question's type (see
// 20260802000000_flexible_questionnaire.sql), so most calls only set one or
// two of them. Returns the row (not just {error}) because multiple_choice
// answers need the row's own id to write into
// election_candidate_answer_options afterward.
export async function upsertCandidateAnswer(
  supabase: Client,
  candidateId: string,
  questionId: string,
  {
    optionId = null,
    textAnswer = null,
    ratingValue = null,
    contextText = null,
    videoUrl = null,
  }: {
    optionId?: string | null;
    textAnswer?: string | null;
    ratingValue?: number | null;
    contextText?: string | null;
    videoUrl?: string | null;
  } = {}
) {
  return supabase
    .from("election_candidate_answers")
    .upsert(
      {
        candidate_id: candidateId,
        question_id: questionId,
        option_id: optionId,
        text_answer: textAnswer,
        rating_value: ratingValue,
        context_text: contextText,
        video_url: videoUrl,
      },
      { onConflict: "candidate_id,question_id" }
    )
    .select()
    .single();
}

// Replace-all for a multiple_choice answer's selected options -- simpler
// than diffing against the previous selection, and this is a small set
// (a handful of checkboxes) so a delete-then-insert is cheap.
export async function setCandidateAnswerOptions(supabase: Client, answerId: string, optionIds: string[]) {
  const { error: deleteError } = await supabase.from("election_candidate_answer_options").delete().eq("answer_id", answerId);
  if (deleteError) return { data: null, error: deleteError };
  if (optionIds.length === 0) return { data: [], error: null };
  return supabase
    .from("election_candidate_answer_options")
    .insert(optionIds.map((optionId) => ({ answer_id: answerId, option_id: optionId })));
}

// Replace-all for a "ranking" answer's option order -- orderedOptionIds[0]
// is rank 1 (top priority). Same delete-then-insert shape as
// setCandidateAnswerOptions; the partial unique index on (answer_id, rank)
// (20260804000005_ranking_question_type.sql) guarantees no duplicate ranks.
export async function setCandidateAnswerRanking(supabase: Client, answerId: string, orderedOptionIds: string[]) {
  const { error: deleteError } = await supabase.from("election_candidate_answer_options").delete().eq("answer_id", answerId);
  if (deleteError) return { data: null, error: deleteError };
  if (orderedOptionIds.length === 0) return { data: [], error: null };
  return supabase
    .from("election_candidate_answer_options")
    .insert(orderedOptionIds.map((optionId, i) => ({ answer_id: answerId, option_id: optionId, rank: i + 1 })));
}

// ── election_answer_comments — public discussion on a single candidate's
// answer to a single question, separate from the general CandidacyWall post
// feed (see 20260801000001_answer_video_and_comments.sql). ────────────────
export async function createAnswerComment(supabase: Client, answerId: string, ghostId: string, content: string) {
  const res = await supabase.from("election_answer_comments").insert({ answer_id: answerId, ghost_id: ghostId, content });
  if (res.error && (res.error.code === "42501" || res.error.message?.includes("row-level security"))) {
    return supabase.rpc("create_answer_comment", {
      p_answer_id: answerId,
      p_ghost_id: ghostId,
      p_content: content,
    });
  }
  return res;
}

// ── resolve_region_names rpc ────────────────────────────────────────────
export async function resolveRegionNames(supabase: Client, shapeIds: number[], country: string) {
  return supabase.rpc("resolve_region_names", { p_shape_ids: shapeIds, p_country: country });
}

// ── posts scoped to a candidacy (CandidacyWall) ─────────────────────────
// Matches on election_candidate_id (always known — it's the candidacy row
// id, no join required) OR'd with the candidate's ghost id when resolvable,
// so a candidacy's own discussion always shows even if the profiles join
// that would normally supply ghostId gets RLS-blocked for this viewer (e.g.
// a candidate whose profiles.role isn't 'politician' for whatever reason —
// the "public can view politician profiles" policy doesn't cover them).
// When ghostId IS resolvable this also pulls in the same person's permanent
// wall posts, unifying the two views — see
// 20260730000003_unify_candidacy_and_wall_posts.sql.
export async function getCandidacyWallPosts(supabase: Client, candidateId: string, ghostId?: string | null) {
  const filters = [`election_candidate_id.eq.${candidateId}`];
  if (ghostId) filters.push(`ghost_id.eq.${ghostId}`, `wall_ghost_id.eq.${ghostId}`);
  let query = supabase.from("posts").select("*, comments (*)").or(filters.join(",")).order("created_at", { ascending: false });
  if (!isDevEnvironment()) query = query.eq("is_test", false).eq("comments.is_test", false);
  return query;
}

export async function createCandidatePost(supabase: Client, fields: PostInsert) {
  // .select().single() (added alongside attachPostMentions below) so the
  // caller gets the new post's id back to attach mentions in a second step.
  return supabase.from("posts").insert({ ...fields, is_test: isDevEnvironment() }).select().single();
}

// createCandidatePost above is a direct table insert (this file's own
// documented divergence from create_post/create_wall_post), so @mentions
// can't ride along inside one RPC call the way they do for those two. Call
// this as a second step right after a successful createCandidatePost — the
// attach_post_mentions RPC verifies the post's ghost_id matches the caller's
// current ghost before writing, so it can't be used to tag someone else's
// post (see 20260815000002_post_mentions.sql).
export async function attachPostMentions(supabase: Client, postId: string, mentionedPoliticianIds: string[]) {
  if (!mentionedPoliticianIds || mentionedPoliticianIds.length === 0) return { data: null, error: null };
  return supabase.rpc("attach_post_mentions", { p_post_id: postId, p_mentioned_ids: mentionedPoliticianIds });
}

// ── nomination_filed (self-editable, direct update — same pattern as
// updateCandidateStatement, no RPC needed) ──────────────────────────────
export async function updateNominationFiled(supabase: Client, candidateId: string, filed: boolean) {
  return supabase.from("election_candidates").update({ nomination_filed: filed }).eq("id", candidateId);
}

// ── election_administrators ─────────────────────────────────────────────
export async function applyForElectionAdmin(
  supabase: Client,
  seatId: string,
  { motivation, socialMediaInfo, contactEmail }: { motivation: string; socialMediaInfo?: string | null; contactEmail: string }
) {
  return supabase.rpc("apply_for_election_admin", {
    p_seat_id: seatId,
    p_motivation: motivation,
    p_social_media_info: socialMediaInfo ?? null,
    p_contact_email: contactEmail,
  } as unknown as { p_seat_id: string; p_motivation: string; p_social_media_info: string; p_contact_email: string });
}

export async function getSeatAdminStatus(supabase: Client, seatId: string) {
  const { data, error } = await supabase.rpc("get_seat_admin_status", { p_seat_id: seatId });
  return { data: data?.[0] || null, error };
}

export async function getMyElectionAdminApplications(supabase: Client, profileId: string) {
  return supabase
    .from("election_administrators")
    .select("id, seat_id, status, submitted_at, election_seats(role_title, map_shapes(name, properties), elections(name, status))")
    .eq("profile_id", profileId)
    .order("submitted_at", { ascending: false });
}

export async function listPendingElectionAdminApplications(supabase: Client) {
  return supabase
    .from("election_administrators")
    .select("id, seat_id, status, motivation, social_media_info, contact_email, submitted_at, election_seats(role_title, map_shapes(name, properties), elections(name, status))")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });
}

export async function reviewElectionAdminApplication(supabase: Client, applicationId: string, approve: boolean) {
  return supabase.rpc("review_election_admin_application", { p_application_id: applicationId, p_approve: approve });
}

// ── unregistered (admin-added, unclaimed) candidates ────────────────────
export async function addUnregisteredCandidate(
  supabase: Client,
  seatId: string,
  {
    fullName,
    partyId,
    education,
    hometown,
    bio,
    avatarUrl,
  }: {
    fullName: string;
    partyId?: number | null;
    education?: string | null;
    hometown?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
  }
) {
  // Same generated-type caveat as insertMapShape above: these RPC params
  // have no SQL DEFAULT, so codegen marks them required/non-null even
  // though Postgres happily accepts an explicit NULL at runtime (which is
  // exactly what an admin adding a stub candidate with no bio/education
  // etc. needs to send).
  return supabase.rpc("add_unregistered_candidate", {
    p_seat_id: seatId,
    p_full_name: fullName,
    p_party_id: partyId || null,
    p_education: education || null,
    p_hometown: hometown || null,
    p_bio: bio || null,
    p_avatar_url: avatarUrl || null,
  } as unknown as {
    p_seat_id: string;
    p_full_name: string;
    p_party_id: number;
    p_education: string;
    p_hometown: string;
    p_bio: string;
    p_avatar_url?: string;
  });
}

export async function updateUnregisteredCandidate(
  supabase: Client,
  candidateId: string,
  {
    fullName,
    partyId,
    education,
    hometown,
    bio,
  }: { fullName: string; partyId?: number | null; education?: string | null; hometown?: string | null; bio?: string | null }
) {
  return supabase.rpc("update_unregistered_candidate", {
    p_candidate_id: candidateId,
    p_full_name: fullName,
    p_party_id: partyId || null,
    p_education: education || null,
    p_hometown: hometown || null,
    p_bio: bio || null,
  } as unknown as {
    p_candidate_id: string;
    p_full_name: string;
    p_party_id: number;
    p_education: string;
    p_hometown: string;
    p_bio: string;
  });
}

export async function removeUnregisteredCandidate(supabase: Client, candidateId: string) {
  return supabase.rpc("remove_unregistered_candidate", { p_candidate_id: candidateId });
}

// ── candidacy claim flow (see 20260802000001_candidacy_claims.sql) ──────
// Flow A: an election admin emails the real candidate an invite link.
//
// functions.invoke()'s error on a non-2xx response is always a
// FunctionsHttpError whose .message is the fixed string "Edge Function
// returned a non-2xx status code" -- the edge function's actual { error }
// body (e.g. "email rate limit exceeded") only lives on error.context, an
// unread Response. Unwrap it here so callers reading error.message (same
// as every other service function) get the real reason.
export async function inviteCandidateToClaim(supabase: Client, candidateId: string, email: string) {
  const { data, error } = await supabase.functions.invoke("send-claim-invite", {
    body: { candidateId, email, redirectOrigin: window.location.origin },
  });
  if (error && "context" in error) {
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    if (context?.json) {
      const body = await context.json().catch(() => null);
      if (body?.error) return { data, error: { ...error, message: body.error } };
    }
  }
  return { data, error };
}

export async function claimCandidacyViaToken(supabase: Client, token: string) {
  return supabase.rpc("claim_candidacy_via_token", { p_token: token });
}

// Flow B: a citizen/politician says "this is me" and an election admin (or
// site admin) reviews it.
export async function requestCandidacyClaim(
  supabase: Client,
  candidateId: string,
  { motivation, contactEmail, socialMediaInfo }: { motivation: string; contactEmail: string; socialMediaInfo?: string | null }
) {
  return supabase.rpc("request_candidacy_claim", {
    p_candidate_id: candidateId,
    p_motivation: motivation,
    p_contact_email: contactEmail,
    p_social_media_info: socialMediaInfo || null,
  } as unknown as { p_candidate_id: string; p_motivation: string; p_contact_email: string; p_social_media_info: string });
}

export async function getClaimRequestsForSeat(supabase: Client, seatId: string) {
  return supabase
    .from("candidacy_claim_requests")
    .select(
      "id, candidate_id, motivation, contact_email, social_media_info, status, submitted_at, election_candidates!inner(seat_id, profiles!election_candidates_politician_id_fkey(full_name))"
    )
    .eq("election_candidates.seat_id", seatId)
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });
}

export async function reviewCandidacyClaim(supabase: Client, requestId: string, approve: boolean) {
  return supabase.rpc("review_candidacy_claim", { p_request_id: requestId, p_approve: approve });
}

// Officeholder claims must be created by the server-side invitation flow so
// raw tokens never reach the database. This low-level wrapper is kept here for
// the edge function/service boundary; the browser should invoke that flow,
// not manufacture token hashes or call this RPC directly.
export async function createOfficeholderWallClaimRecord(
  supabase: Client,
  officeHolderId: string,
  email: string,
  tokenHash: string,
  expiresAt?: string,
) {
  return supabase.rpc("create_officeholder_wall_claim", {
    p_office_holder_id: officeHolderId,
    p_email: email,
    p_token_hash: tokenHash,
    ...(expiresAt ? { p_expires_at: expiresAt } : {}),
  });
}

// supabase-js's functions.invoke() only surfaces a generic "Edge Function
// returned a non-2xx status code" on failure — the function's own {error}
// JSON body (e.g. "SMTP not configured", "account already exists") is left
// on error.context (the raw Response) and never read. Unwrap it here so
// admins see the real reason an invite failed, not a blank status code.
async function invokeOfficeholderClaimFn(
  supabase: Client,
  body: Record<string, unknown>
) {
  const result = await supabase.functions.invoke("send-officeholder-claim", { body });
  if (result.error) {
    const context = (result.error as { context?: Response }).context;
    if (context && typeof context.clone === "function") {
      try {
        const parsed = await context.clone().json();
        if (parsed?.error) {
          return { ...result, error: new Error(parsed.error) };
        }
      } catch {
        // Response body wasn't JSON (e.g. a network-level failure below the
        // function) — fall through and surface the original generic error.
      }
    }
  }
  return result;
}

export async function inviteOfficeholderToClaim(supabase: Client, officeHolderId: string, email: string) {
  return invokeOfficeholderClaimFn(supabase, { officeHolderId, email, redirectOrigin: window.location.origin });
}

export async function resendOfficeholderClaim(supabase: Client, claimId: string, email: string) {
  return invokeOfficeholderClaimFn(supabase, { claimId, email, redirectOrigin: window.location.origin });
}

export async function cancelOfficeholderClaim(supabase: Client, claimId: string) {
  return supabase.rpc("cancel_officeholder_wall_claim", { p_claim_id: claimId });
}

export async function redeemOfficeholderWallClaim(supabase: Client, tokenHash: string) {
  return supabase.rpc("redeem_officeholder_wall_claim", { p_token_hash: tokenHash });
}

export async function previewOfficeholderWallClaim(supabase: Client, claimId: string) {
  return supabase.rpc("preview_officeholder_wall_claim", { p_claim_id: claimId });
}

export async function mergeOfficeholderWallClaim(supabase: Client, claimId: string) {
  return supabase.rpc("merge_officeholder_wall_claim", { p_claim_id: claimId });
}

export async function reverseOfficeholderWallClaim(supabase: Client, claimId: string, reason: string) {
  return supabase.rpc("reverse_officeholder_wall_claim", { p_claim_id: claimId, p_reason: reason });
}

// Closes out a claim stuck at 'pending_review' (redeemed or self-requested,
// but not approved) — the counterpart to reverse (which only handles already-
// approved/merged claims). Also undoes the redemption-time profile backfill
// (contact info, bio, party, etc.) so a rejected claimant's profile stops
// showing the officeholder's details.
export async function rejectOfficeholderWallClaim(supabase: Client, claimId: string, reason: string) {
  return supabase.rpc("reject_officeholder_wall_claim", { p_claim_id: claimId, p_reason: reason });
}

export async function getOfficeholderWallClaims(supabase: Client, officeHolderId: string) {
  return supabase
    .from("office_holder_wall_claims")
    .select("*")
    .eq("office_holder_id", officeHolderId)
    .order("created_at", { ascending: false });
}

// Cross-wall admin feed (migration 20260811220000) — unlike
// getOfficeholderWallClaims above, this isn't scoped to one officeholder the
// admin already looked up, and it's meant to be loaded on every page mount
// so "which wall did we invite, and what's its status" survives a refresh
// instead of living only in the invite-form's transient client state.
export async function listRecentOfficeholderWallClaims(supabase: Client, limit = 50) {
  return supabase.rpc("list_recent_officeholder_wall_claims", { p_limit: limit });
}

// Unified "can this wall be claimed, and by which system" check — read-only,
// works for logged-out visitors too. Returns one of:
//   { kind: 'unclaimed_candidate', candidate_id }   -> route to the existing
//     election-candidacy claim form (requestCandidacyClaim), unchanged.
//   { kind: 'unclaimed_officeholder', office_holder_id } -> route to
//     requestOfficeholderWallClaim below.
//   { kind: 'not_claimable' } -> hide all claim UI; the wall already has an
//     owner (a real account) or an open/approved claim in flight.
export async function getWallClaimEligibility(supabase: Client, profileId: string) {
  return supabase.rpc("get_wall_claim_eligibility", { p_profile_id: profileId });
}

// Self-service counterpart to the admin-initiated officeholder invite: a
// logged-in citizen asserts "this is me" directly, no token/email-invite
// round trip needed. Lands in pending_review and is reviewed by an admin
// exactly like an invited-and-redeemed claim (preview -> merge/reverse).
export async function requestOfficeholderWallClaim(
  supabase: Client,
  officeHolderId: string,
  contactEmail: string,
  note?: string | null,
) {
  return supabase.rpc("request_officeholder_wall_claim", {
    p_office_holder_id: officeHolderId,
    p_contact_email: contactEmail,
    p_note: note || undefined,
  });
}

// Admin-only: self-requested claims are otherwise only visible by already
// having navigated to that specific officeholder's admin panel. This lists
// all of them globally so admins can discover and review them.
export async function listPendingSelfRequestedOfficeholderClaims(supabase: Client) {
  return supabase.rpc("list_pending_self_requested_officeholder_claims");
}
