import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { fetchAllPages } from "@/lib/utils/fetchAllPages";
import { extractIdFromSlug, buildSeatSlug, buildCandidateSlug, slugifyText } from "@/lib/utils/slugs";
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

// ── office_holders (current officeholder shown on boundary directory pages) ──
export async function getOfficeHoldersForShape(supabase: Client, mapShapeId: number | string) {
  return supabase
    .from("office_holders")
    .select(
      `id, election_role_type_id, full_name, bio, source_url, photo_url, holding_since,
       contact_email, contact_phone, linked_profile_id,
       map_shapes(id, name, boundary_type, country),
       election_role_types(role_title, role_key, description),
       political_parties(name),
       profiles!office_holders_linked_profile_id_fkey(id, full_name, current_ghost_id)`
    )
    .eq("map_shape_id", Number(mapShapeId));
}

export async function getOfficeHoldersForShapes(
  supabase: Client,
  mapShapeIds: (number | string)[]
) {
  if (!mapShapeIds.length) return { data: [], error: null };
  const ids = mapShapeIds.map(Number);
  return supabase
    .from("office_holders")
    .select(
      `id, map_shape_id, election_role_type_id, full_name, bio, source_url, photo_url, holding_since,
       contact_email, contact_phone, linked_profile_id,
       map_shapes(id, name, boundary_type, country),
       election_role_types(role_title, role_key),
       political_parties(name),
       profiles!office_holders_linked_profile_id_fkey(id, full_name, current_ghost_id)`
    )
    .in("map_shape_id", ids);
}

export async function getFeaturedOfficeHolders(
  supabase: Client,
  country?: string | null
) {
  let query = supabase
    .from("office_holders")
    .select(
      `id, map_shape_id, election_role_type_id, full_name, bio, source_url, photo_url, holding_since,
       contact_email, contact_phone, linked_profile_id,
       map_shapes!inner(id, name, boundary_type, country),
       election_role_types(role_title, role_key),
       political_parties(name),
       profiles!office_holders_linked_profile_id_fkey(id, full_name, current_ghost_id)`
    )
    .not("photo_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (country) {
    query = query.eq("map_shapes.country", country);
  }

  return query;
}

export async function getOfficeHolderByRole(
  supabase: Client,
  mapShapeId: number | string,
  electionRoleTypeId: string
) {
  return supabase
    .from("office_holders")
    .select(
      `id, election_role_type_id, full_name, bio, source_url, photo_url, holding_since,
       contact_email, contact_phone, linked_profile_id,
       election_role_types(role_title, role_key),
       political_parties(name),
       profiles!office_holders_linked_profile_id_fkey(id, full_name, current_ghost_id)`
    )
    .eq("map_shape_id", Number(mapShapeId))
    .eq("election_role_type_id", electionRoleTypeId)
    .maybeSingle();
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
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "map_shape_id,election_role_type_id" }
    )
    .select()
    .single();
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
       contact_email, contact_phone, linked_profile_id,
       election_role_types(role_title, role_key),
       political_parties(name),
       profiles!office_holders_linked_profile_id_fkey(id, full_name, current_ghost_id)`
    )
    .eq("map_shape_id", Number(mapShapeId));

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
      "id, role_title, map_shape_id, map_shapes(name, boundary_type, country), elections!inner(id, name, election_date, status)"
    )
    .in("map_shape_id", shapeIds)
    .in("elections.status", ["nominations_open", "active"])
    .gte("elections.election_date", today)
    .order("role_title");
}

export async function getActiveSeatsByShapeIds(supabase: Client, shapeIds: number[]) {
  return supabase
    .from("election_seats")
    .select("id, role_title, map_shapes(name, boundary_type), elections!inner(id, name, election_date, status)")
    .in("map_shape_id", shapeIds)
    .in("elections.status", ["nominations_open", "active"]);
}

// Platform-wide active seats, unscoped by boundary membership — used for
// public/anonymous browsing where there's no "my area" to filter by.
export async function getActiveSeats(supabase: Client) {
  return supabase
    .from("election_seats")
    .select(
      "id, role_title, map_shape_id, map_shapes(id, name, boundary_type), elections!inner(id, name, election_date, status)"
    )
    .in("elections.status", ["nominations_open", "active"])
    .order("role_title");
}

export async function findOpenSeatsInContainer(supabase: Client, containerShapeId: number) {
  return supabase.rpc("find_open_seats_in_container", { p_container_shape_id: containerShapeId });
}

export async function getSeatById(supabase: Client, seatId: string) {
  const realSeatId = extractIdFromSlug(seatId);
  if (realSeatId && realSeatId.length === 36) {
    const res = await supabase
      .from("election_seats")
      .select("id, map_shape_id, role_title, map_shapes(name, boundary_type, country), elections(id, name, election_date, status)")
      .eq("id", realSeatId)
      .maybeSingle();

    if (res.data) return res;
  }

  const { data: seats } = await supabase
    .from("election_seats")
    .select("id, map_shape_id, role_title, map_shapes(name, boundary_type, country), elections(id, name, election_date, status)");

  if (!seats || seats.length === 0) {
    return { data: null };
  }

  const match = seats.find((s) => {
    const seatSlug = buildSeatSlug(s as any);
    return (
      s.id === seatId ||
      s.id === realSeatId ||
      seatSlug === seatId ||
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
    .select("id, statement, seat_id, status, submitted_at, election_seats(role_title, map_shapes(name), elections(name, status))")
    .eq("politician_id", profileId)
    .order("created_at", { ascending: false });
}

export async function getCandidatesBySeatIds(supabase: Client, seatIds: string[]) {
  const realSeatIds = seatIds.map(extractIdFromSlug).filter((id) => id && id.length === 36);
  // profiles joined via !inner so a test-flagged candidate's row drops out
  // entirely in production, instead of surviving with a null-embedded
  // profile (the default to-one embed behavior when an .eq() filter on the
  // embed doesn't match).
  const columns =
    "id, statement, seat_id, nomination_filed, added_by_election_admin_id, claimed_at, profiles!election_candidates_politician_id_fkey!inner(id, full_name, current_ghost_id, politician_profiles(avatar_url))";

  let query =
    realSeatIds.length > 0
      ? supabase.from("election_candidates").select(columns).in("seat_id", realSeatIds)
      : supabase.from("election_candidates").select(columns);
  if (!isDevEnvironment()) query = query.eq("profiles.is_test", false);
  return query;
}

export async function getCandidateById(supabase: Client, candidateId: string) {
  const realCandidateId = extractIdFromSlug(candidateId);
  if (realCandidateId && realCandidateId.length === 36) {
    const res = await supabase
      .from("election_candidates")
      .select(
        `
        id, seat_id, statement, status, submitted_at, intro_video_url, politician_id,
        election_seats ( role_title, map_shapes ( name ), elections ( id, name, election_date, status ) )
      `
      )
      .eq("id", realCandidateId)
      .maybeSingle();

    if (res.data) return res;
  }

  const { data: cands } = await supabase
    .from("election_candidates")
    .select(
      `
      id, seat_id, statement, status, submitted_at, intro_video_url, politician_id,
      election_seats ( role_title, map_shapes ( name ), elections ( id, name, election_date, status ) )
    `
    );

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
    election_seats ( role_title, map_shapes ( name, boundary_type ), elections ( name, status ) ),
    profiles!election_candidates_politician_id_fkey!inner ( full_name, current_ghost_id )
  `;

  const realCandidateId = extractIdFromSlug(candidateId);
  if (realCandidateId && realCandidateId.length === 36) {
    let query = supabase.from("election_candidates").select(columns).eq("id", realCandidateId);
    if (!isDevEnvironment()) query = query.eq("profiles.is_test", false);
    const res = await query.maybeSingle();

    if (res.data) return res;
  }

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
  return supabase.from("posts").insert({ ...fields, is_test: isDevEnvironment() });
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
    .select("id, seat_id, status, submitted_at, election_seats(role_title, map_shapes(name), elections(name, status))")
    .eq("profile_id", profileId)
    .order("submitted_at", { ascending: false });
}

export async function listPendingElectionAdminApplications(supabase: Client) {
  return supabase
    .from("election_administrators")
    .select("id, seat_id, status, motivation, social_media_info, contact_email, submitted_at, election_seats(role_title, map_shapes(name), elections(name, status))")
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
