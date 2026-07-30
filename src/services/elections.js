import { supabase } from './supabase';
import { fetchAllPages } from '../utils/fetchAllPages';

const ADMIN_CANDIDATE_COLUMNS = `
  id, seat_id, statement, status, submitted_at, intro_video_url,
  profiles!election_candidates_politician_id_fkey(full_name, current_ghost_id),
  election_candidate_answers(
    id, context_text,
    election_questions(id, question_text, rank),
    election_question_options(option_text)
  )
`;

// ── elections ────────────────────────────────────────────────────────────
export async function getElections() {
  return supabase.from('elections').select('*').order('created_at', { ascending: false });
}

export async function createElection({ name, electionDate }) {
  return supabase.from('elections').insert({ name, election_date: electionDate }).select().single();
}

export async function advanceElectionStatus(electionId, nextStatus) {
  return supabase.from('elections').update({ status: nextStatus }).eq('id', electionId);
}

// ── election_role_types ─────────────────────────────────────────────────
export async function getElectionRoleTypes(country, boundaryType) {
  return supabase
    .from('election_role_types')
    .select('role_key, region_override, role_title')
    .eq('country', country)
    .eq('boundary_type', boundaryType);
}

// ── election_seats (admin) ──────────────────────────────────────────────
export async function getElectionSeatsByElectionId(electionId) {
  return fetchAllPages((from, to) =>
    supabase
      .from('election_seats')
      .select('id, role_title, map_shapes(id, name, boundary_type, country, code, properties)')
      .eq('election_id', electionId)
      .order('role_title')
      .order('id')
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

export async function getElectionCandidatesBySeatIds(seatIds) {
  const chunks = [];
  for (let i = 0; i < seatIds.length; i += SEAT_ID_CHUNK_SIZE) {
    chunks.push(seatIds.slice(i, i + SEAT_ID_CHUNK_SIZE));
  }
  const results = await Promise.all(chunks.map(chunk =>
    fetchAllPages((from, to) =>
      supabase
        .from('election_candidates')
        .select(ADMIN_CANDIDATE_COLUMNS)
        .in('seat_id', chunk)
        .order('id')
        .range(from, to)
    )
  ));
  const failed = results.find(r => r.error);
  if (failed) return { data: null, error: failed.error };
  return { data: results.flatMap(r => r.data || []), error: null };
}

export async function createElectionSeats(rows) {
  return supabase.from('election_seats').insert(rows);
}

export async function deleteElectionSeat(seatId) {
  return supabase.from('election_seats').delete().eq('id', seatId);
}

// ── election_seats (politician / voter facing) ──────────────────────────
export async function getOpenSeatsNearShapeIds(shapeIds) {
  const today = new Date().toISOString().slice(0, 10);
  return supabase
    .from('election_seats')
    .select('id, role_title, map_shape_id, map_shapes(name, boundary_type, country), elections!inner(id, name, election_date, status)')
    .in('map_shape_id', shapeIds)
    .in('elections.status', ['nominations_open', 'active'])
    .gte('elections.election_date', today)
    .order('role_title');
}

export async function getActiveSeatsByShapeIds(shapeIds) {
  return supabase
    .from('election_seats')
    .select('id, role_title, map_shapes(name, boundary_type), elections!inner(id, name, election_date, status)')
    .in('map_shape_id', shapeIds)
    .in('elections.status', ['nominations_open', 'active']);
}

// Platform-wide active seats, unscoped by boundary membership — used for
// public/anonymous browsing where there's no "my area" to filter by.
export async function getActiveSeats() {
  return supabase
    .from('election_seats')
    .select('id, role_title, map_shapes(name, boundary_type), elections!inner(id, name, election_date, status)')
    .in('elections.status', ['nominations_open', 'active'])
    .order('role_title');
}

export async function findOpenSeatsInContainer(containerShapeId) {
  return supabase.rpc('find_open_seats_in_container', { p_container_shape_id: containerShapeId });
}

export async function getSeatById(seatId) {
  return supabase
    .from('election_seats')
    .select('id, role_title, map_shapes(name, boundary_type, country), elections(id, name, election_date, status)')
    .eq('id', seatId)
    .maybeSingle();
}

// ── election_candidates ──────────────────────────────────────────────────
export async function getMyCandidacies(profileId) {
  return supabase
    .from('election_candidates')
    .select('id, statement, seat_id, status, submitted_at, election_seats(role_title, map_shapes(name), elections(name, status))')
    .eq('politician_id', profileId)
    .order('created_at', { ascending: false });
}

export async function getCandidatesBySeatIds(seatIds) {
  return supabase
    .from('election_candidates')
    .select('id, statement, seat_id, nomination_filed, profiles!election_candidates_politician_id_fkey(full_name, current_ghost_id)')
    .in('seat_id', seatIds);
}

export async function getCandidateById(candidateId) {
  return supabase
    .from('election_candidates')
    .select(`
      id, seat_id, statement, status, submitted_at, intro_video_url, politician_id,
      election_seats ( role_title, map_shapes ( name ), elections ( id, name, election_date, status ) )
    `)
    .eq('id', candidateId)
    .maybeSingle();
}

export async function getPublicCandidateById(candidateId) {
  return supabase
    .from('election_candidates')
    .select(`
      id, statement, politician_id, status, intro_video_url, nomination_filed, added_by_election_admin_id,
      election_seats ( role_title, map_shapes ( name, boundary_type ), elections ( name, status ) ),
      profiles!election_candidates_politician_id_fkey ( full_name, current_ghost_id )
    `)
    .eq('id', candidateId)
    .maybeSingle();
}

export async function applyForSeat(seatId) {
  return supabase.rpc('apply_for_seat', { p_seat_id: seatId, p_statement: null });
}

export async function deleteCandidacy(candidateId) {
  return supabase.from('election_candidates').delete().eq('id', candidateId);
}

export async function updateCandidateStatement(candidateId, statement) {
  return supabase.from('election_candidates').update({ statement }).eq('id', candidateId);
}

export async function updateCandidateIntroVideoUrl(candidateId, url) {
  return supabase.from('election_candidates').update({ intro_video_url: url }).eq('id', candidateId);
}

export async function reviewCandidateApplication(candidateId, { approve, reviewedBy }) {
  return supabase
    .from('election_candidates')
    .update({ status: approve ? 'approved' : 'rejected', reviewed_at: new Date(), reviewed_by: reviewedBy })
    .eq('id', candidateId);
}

export async function submitCandidateApplication(candidateId) {
  return supabase.rpc('submit_candidate_application', { p_candidate_id: candidateId });
}

// ── election_questions / election_question_options ─────────────────────
export async function getElectionQuestions(electionId) {
  return supabase
    .from('election_questions')
    .select('id, question_text, required, allow_context, visible_to_public, rank, election_question_options(id, option_text, rank)')
    .eq('election_id', electionId)
    .order('rank');
}

export async function createElectionQuestion(fields) {
  return supabase.from('election_questions').insert(fields).select().single();
}

export async function deleteElectionQuestion(questionId) {
  return supabase.from('election_questions').delete().eq('id', questionId);
}

export async function createElectionQuestionOptions(rows) {
  return supabase.from('election_question_options').insert(rows);
}

// ── election_candidate_answers ──────────────────────────────────────────
export async function getCandidateAnswers(candidateId) {
  return supabase.from('election_candidate_answers').select('question_id, option_id, context_text').eq('candidate_id', candidateId);
}

export async function getPublicCandidateAnswers(candidateId) {
  return supabase
    .from('election_candidate_answers')
    .select('id, context_text, election_questions(id, question_text, rank, visible_to_public), election_question_options(option_text)')
    .eq('candidate_id', candidateId);
}

export async function upsertCandidateAnswer(candidateId, questionId, optionId, contextText) {
  return supabase
    .from('election_candidate_answers')
    .upsert(
      { candidate_id: candidateId, question_id: questionId, option_id: optionId, context_text: contextText },
      { onConflict: 'candidate_id,question_id' }
    );
}

// ── resolve_region_names rpc ────────────────────────────────────────────
export async function resolveRegionNames(shapeIds, country) {
  return supabase.rpc('resolve_region_names', { p_shape_ids: shapeIds, p_country: country });
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
export async function getCandidacyWallPosts(candidateId, ghostId) {
  const filters = [`election_candidate_id.eq.${candidateId}`];
  if (ghostId) filters.push(`ghost_id.eq.${ghostId}`, `wall_ghost_id.eq.${ghostId}`);
  return supabase.from('posts').select('*, comments (*)').or(filters.join(',')).order('created_at', { ascending: false });
}

export async function createCandidatePost(fields) {
  return supabase.from('posts').insert(fields);
}

// ── nomination_filed (self-editable, direct update — same pattern as
// updateCandidateStatement, no RPC needed) ──────────────────────────────
export async function updateNominationFiled(candidateId, filed) {
  return supabase.from('election_candidates').update({ nomination_filed: filed }).eq('id', candidateId);
}

// ── election_administrators ─────────────────────────────────────────────
export async function applyForElectionAdmin(seatId, { motivation, socialMediaInfo, contactEmail }) {
  return supabase.rpc('apply_for_election_admin', {
    p_seat_id: seatId, p_motivation: motivation, p_social_media_info: socialMediaInfo, p_contact_email: contactEmail
  });
}

export async function getSeatAdminStatus(seatId) {
  const { data, error } = await supabase.rpc('get_seat_admin_status', { p_seat_id: seatId });
  return { data: data?.[0] || null, error };
}

export async function getMyElectionAdminApplications(profileId) {
  return supabase
    .from('election_administrators')
    .select('id, seat_id, status, submitted_at, election_seats(role_title, map_shapes(name), elections(name, status))')
    .eq('profile_id', profileId)
    .order('submitted_at', { ascending: false });
}

export async function listPendingElectionAdminApplications() {
  return supabase
    .from('election_administrators')
    .select('id, seat_id, status, motivation, social_media_info, contact_email, submitted_at, election_seats(role_title, map_shapes(name), elections(name, status))')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true });
}

export async function reviewElectionAdminApplication(applicationId, approve) {
  return supabase.rpc('review_election_admin_application', { p_application_id: applicationId, p_approve: approve });
}

// ── unregistered (admin-added, unclaimed) candidates ────────────────────
export async function addUnregisteredCandidate(seatId, { fullName, partyId, education, hometown, bio }) {
  return supabase.rpc('add_unregistered_candidate', {
    p_seat_id: seatId, p_full_name: fullName, p_party_id: partyId || null,
    p_education: education || null, p_hometown: hometown || null, p_bio: bio || null
  });
}

export async function updateUnregisteredCandidate(candidateId, { fullName, partyId, education, hometown, bio }) {
  return supabase.rpc('update_unregistered_candidate', {
    p_candidate_id: candidateId, p_full_name: fullName, p_party_id: partyId || null,
    p_education: education || null, p_hometown: hometown || null, p_bio: bio || null
  });
}

export async function removeUnregisteredCandidate(candidateId) {
  return supabase.rpc('remove_unregistered_candidate', { p_candidate_id: candidateId });
}
