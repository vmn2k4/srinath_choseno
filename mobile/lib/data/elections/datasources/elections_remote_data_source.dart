// Near-1:1 port of the relevant slice of src/lib/services/elections.ts.
// Deliberately does NOT port `enrichOfficeHolders` — the web's fallback
// that matches an `office_holders` row with no `linked_profile_id` to a
// registered profile by exact name, backfilling missing photo/contact
// info. An office holder that already has a `linked_profile_id` (the
// normal case for anyone who claimed their wall) is unaffected; one that
// doesn't will show only its own `office_holders` columns until this is
// ported. Add it here, in this file, alongside `getOfficeHoldersForShape`
// if that gap turns out to matter in practice.
//
// Candidate Application (§4.G) methods below are the Written
// Questionnaire mode only, ported from CandidateApplicationClient.tsx.
// Not ported: the Video Interview reels-style player
// (CandidateVideoInterviewPlayer.tsx — a full-screen, one-question-at-a-
// time flow with its own video-per-answer recording), the "choose your
// questions" screen, `upsertAnswerPitchPost` (posting a video answer to
// the candidate's wall as a feed post), and answer comments — the shared
// `election_candidate_answers` rows this app writes stay fully compatible
// with all of that if/when it's built.
import 'dart:typed_data';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/config/app_environment.dart';

const _officeHolderColumns = '''
  id, election_role_type_id, full_name, bio, source_url, photo_url, holding_since,
  is_current, term_ended_at, linked_profile_id,
  map_shapes(id, name, boundary_type, country),
  election_role_types(role_title, role_key, description),
  political_parties(name),
  profiles!office_holders_linked_profile_id_fkey(id, full_name, current_ghost_id, politician_profiles(photo_url, avatar_url, source_url, wall_slug))
''';

class ElectionsRemoteDataSource {
  const ElectionsRemoteDataSource(this._client);

  final SupabaseClient _client;

  Future<List<dynamic>> getOfficeHoldersForShape(int mapShapeId) {
    return _client
        .from('office_holders')
        .select(_officeHolderColumns)
        .eq('map_shape_id', mapShapeId)
        .eq('is_current', true);
  }

  Future<void> syncElectionStatus() => _client.rpc('sync_election_status');

  Future<List<dynamic>> getActiveSeatsByShapeIds(List<int> shapeIds) async {
    await syncElectionStatus();
    return _client
        .from('election_seats')
        .select(
          'id, role_title, map_shapes(name, boundary_type, properties), elections!inner(id, name, election_date, status)',
        )
        .inFilter('map_shape_id', shapeIds)
        .inFilter('elections.status', [
          'nominations_open',
          'nominations_closed',
          'active',
        ]);
  }

  Future<List<dynamic>> getActiveSeats({
    required int limit,
    required int offset,
  }) async {
    await syncElectionStatus();
    return _client
        .from('election_seats')
        .select(
          'id, role_title, map_shape_id, map_shapes(id, name, boundary_type, properties), elections!inner(id, name, election_date, status)',
        )
        .inFilter('elections.status', [
          'nominations_open',
          'nominations_closed',
          'active',
        ])
        .order('role_title')
        .range(offset, offset + limit - 1);
  }

  /// Lighter than [getCandidatesForSeat] — just the seat_id column, for
  /// Find My District/Elections list's per-seat counts.
  Future<List<dynamic>> getCandidateSeatIds(List<String> seatIds) {
    if (seatIds.isEmpty) return Future.value(const []);
    return _client
        .from('election_candidates')
        .select('seat_id')
        .inFilter('seat_id', seatIds);
  }

  Future<Map<String, dynamic>> getSeatById(String seatId) {
    return _client
        .from('election_seats')
        .select(
          'id, role_title, map_shape_id, map_shapes(name, boundary_type, country), elections(id, name, election_date, status)',
        )
        .eq('id', seatId)
        .single();
  }

  /// Real-UUID-only variant of the web's `getCandidatesBySeatIds` — see
  /// `ElectionsRepository.getSeatById`'s doc comment for why the slug-
  /// resolution fallback loop isn't needed (or ported) here.
  Future<List<dynamic>> getCandidatesForSeat(String seatId) {
    var query = _client
        .from('election_candidates')
        .select(
          'id, statement, seat_id, intro_video_url, profiles!election_candidates_politician_id_fkey!inner(id, full_name, politician_profiles(avatar_url, wall_slug, bio, political_parties(name)))',
        )
        .eq('seat_id', seatId);
    if (!AppEnvironment.isDev) query = query.eq('profiles.is_test', false);
    return query;
  }

  Future<List<dynamic>> getPoliticianEngagementSummaries(
    List<String> politicianIds,
  ) {
    if (politicianIds.isEmpty) return Future.value(const []);
    return _client.rpc(
      'get_politician_engagement_summaries',
      params: {
        'p_politician_ids': politicianIds,
        'p_include_test': AppEnvironment.isDev,
      },
    );
  }

  /// Port of `getVotingPlacesForShape` (src/lib/services/votingPlaces.ts).
  Future<List<dynamic>> getVotingPlacesForShape(
    int mapShapeId,
    String electionDate,
  ) {
    return _client
        .from('voting_places')
        .select(
          'id, name, address, lat, lng, notes, last_checked_at, voting_place_schedules(voting_type, vote_date, opens_at, closes_at, notes)',
        )
        .eq('map_shape_id', mapShapeId)
        .eq('election_date', electionDate)
        .order('name');
  }

  /// RPC `create_race_pick_share` — returns the share's short code. The
  /// server enforces that picks belong to the seat, note length / no links,
  /// and rate limits.
  Future<String> createRacePickShare({
    required String seatId,
    required List<({String candidateId, String note})> picks,
    String? authorLabel,
  }) async {
    final code = await _client.rpc(
      'create_race_pick_share',
      params: {
        'p_seat_id': seatId,
        'p_candidate_ids': picks.map((p) => p.candidateId).toList(),
        'p_note': null,
        'p_pick_notes': picks.map((p) => p.note).toList(),
        'p_author_label': (authorLabel ?? '').isEmpty ? null : authorLabel,
        'p_anon_id': null,
        'p_is_test': AppEnvironment.isDev,
      },
    );
    return code as String;
  }

  /// RPC `post_pick_share_messages_to_walls` — posts each pick's message on
  /// that candidate's wall (owner-checked, idempotent).
  Future<void> postPickShareToWalls(String code) => _client.rpc(
    'post_pick_share_messages_to_walls',
    params: {'p_code': code},
  );

  Future<List<dynamic>> getPublicElectionDirectory() => _client
      .rpc('get_public_election_directory')
      .then((r) => r as List<dynamic>);

  Future<List<dynamic>> getPublicElectionPlaces({int perElection = 8}) =>
      _client
          .rpc(
            'get_public_election_places',
            params: {'p_per_election': perElection},
          )
          .then((r) => r as List<dynamic>);

  Future<List<dynamic>> getSeatsForElection(String electionId) {
    return _client
        .from('election_seats')
        .select(
          'id, role_title, map_shape_id, map_shapes(id, name, boundary_type, properties), elections!inner(id, name, election_date, status)',
        )
        .eq('election_id', electionId)
        .order('role_title');
  }

  /// Port of `getVotingPlaceDatesForShapes` — which boundaries have
  /// published voting places for an upcoming election.
  Future<List<dynamic>> getVotingPlaceDatesForShapes(List<int> shapeIds) {
    if (shapeIds.isEmpty) return Future.value(const []);
    final today = DateTime.now().toIso8601String().substring(0, 10);
    return _client
        .from('voting_places')
        .select('map_shape_id, election_date')
        .inFilter('map_shape_id', shapeIds)
        .gte('election_date', today);
  }

  /// Fire-and-forget analytics RPCs (see district_lookups migration). Never
  /// throw: a logging failure must not degrade the user's results.
  Future<void> logDistrictLookup({
    required String source,
    required String method,
    required int boundaryCount,
    String? page,
  }) async {
    try {
      await _client.rpc(
        'log_district_lookup',
        params: {
          'p_source': source,
          'p_method': method,
          'p_found': boundaryCount > 0,
          'p_boundary_count': boundaryCount,
          'p_visitor_id': _client.auth.currentUser?.id,
          'p_page': page,
          'p_is_test': AppEnvironment.isDev,
        },
      );
    } catch (_) {}
  }

  Future<void> logDistrictBannerClick({
    required String targetType,
    required String targetId,
    String? page,
  }) async {
    try {
      await _client.rpc(
        'log_district_banner_click',
        params: {
          'p_target_type': targetType,
          'p_target_id': targetId,
          'p_visitor_id': _client.auth.currentUser?.id,
          'p_page': page,
          'p_is_test': AppEnvironment.isDev,
        },
      );
    } catch (_) {}
  }

  /// Explicit columns: the table's identity/abuse columns aren't granted to
  /// anon/authenticated.
  Future<Map<String, dynamic>?> getRacePickShareByCode(String code) async {
    final share = await _client
        .from('race_pick_shares')
        .select('id, code, seat_id, note, author_label, created_at')
        .eq('code', code)
        .isFilter('removed_at', null)
        .maybeSingle();
    if (share == null) return null;
    final picks = await _client
        .from('race_pick_share_picks')
        .select('candidate_id, position, note')
        .eq('share_id', share['id'] as String)
        .order('position', ascending: true);
    return {...share, 'picks': picks};
  }

  Future<void> reportRacePickShare(String code) =>
      _client.rpc('report_race_pick_share', params: {'p_code': code});

  Future<List<dynamic>> getMyCandidacies(String profileId) {
    return _client
        .from('election_candidates')
        .select(
          'id, statement, seat_id, status, submitted_at, election_seats(role_title, map_shapes(name, properties), elections(name, status))',
        )
        .eq('politician_id', profileId)
        .order('created_at', ascending: false);
  }

  Future<void> applyForSeat(String seatId) {
    return _client.rpc(
      'apply_for_seat',
      params: {'p_seat_id': seatId, 'p_statement': null},
    );
  }

  Future<void> deleteCandidacy(String candidateId) {
    return _client.from('election_candidates').delete().eq('id', candidateId);
  }

  /// Real-UUID-only variant of `getPublicCandidateById` — see
  /// [ElectionsRepository.getCandidateById]'s doc comment.
  Future<Map<String, dynamic>> getCandidateById(String candidateId) {
    return _client
        .from('election_candidates')
        .select(
          'id, statement, politician_id, added_by_election_admin_id, claimed_at, '
          'election_seats(role_title, map_shapes(name), elections(name)), '
          'profiles!election_candidates_politician_id_fkey!inner(id, full_name, politician_profiles(avatar_url, wall_slug, bio, political_parties(name)))',
        )
        .eq('id', candidateId)
        .single();
  }

  /// Flow B of the candidacy claim system (see `request_candidacy_claim`
  /// in 20260802000001_candidacy_claims.sql) — a citizen/politician says
  /// "this is me" on an admin-added candidate row, and an election admin
  /// reviews it (§4.I.5, not yet ported). Distinct from Flow A
  /// (`claim_candidacy_via_token`), which needs an email-invite deep link
  /// this app's router doesn't handle yet.
  Future<void> requestCandidacyClaim(
    String candidateId, {
    required String motivation,
    required String contactEmail,
    String? socialMediaInfo,
  }) {
    return _client.rpc(
      'request_candidacy_claim',
      params: {
        'p_candidate_id': candidateId,
        'p_motivation': motivation,
        'p_contact_email': contactEmail,
        'p_social_media_info': socialMediaInfo,
      },
    );
  }

  /// Port of `getPublicCandidateAnswers` (src/lib/services/elections.ts).
  /// `election_answer_comments` and `video_url` are left out of the select
  /// entirely — Candidacy Wall doesn't have answer-comment or video-
  /// playback infra yet.
  Future<List<dynamic>> getPublicCandidateAnswers(String candidateId) {
    return _client
        .from('election_candidate_answers')
        .select(
          'id, context_text, text_answer, rating_value, '
          'election_questions!inner(id, question_text, question_type, rank, visible_to_public), '
          'election_question_options(option_text), '
          'election_candidate_answer_options(rank, election_question_options(option_text))',
        )
        .eq('candidate_id', candidateId)
        .eq('election_questions.visible_to_public', true)
        .order('rank', ascending: true, referencedTable: 'election_questions');
  }

  /// `get_seat_admin_status` always returns exactly one row — its body is
  /// `RETURN QUERY SELECT <scalar subquery>, <scalar subquery>`, not a
  /// scan over a variable-length set.
  Future<Map<String, dynamic>> getSeatAdminStatus(String seatId) async {
    final rows = await _client.rpc(
      'get_seat_admin_status',
      params: {'p_seat_id': seatId},
    );
    return (rows as List).cast<Map<String, dynamic>>().first;
  }

  Future<void> applyForElectionAdmin(
    String seatId, {
    required String motivation,
    required String contactEmail,
    String? socialMediaInfo,
  }) {
    return _client.rpc(
      'apply_for_election_admin',
      params: {
        'p_seat_id': seatId,
        'p_motivation': motivation,
        'p_social_media_info': socialMediaInfo,
        'p_contact_email': contactEmail,
      },
    );
  }

  Future<List<dynamic>> getMyElectionAdminApplications(String profileId) {
    return _client
        .from('election_administrators')
        .select(
          'id, seat_id, status, election_seats(role_title, map_shapes(name, properties), elections(name, status))',
        )
        .eq('profile_id', profileId)
        .order('submitted_at', ascending: false);
  }

  Future<Map<String, dynamic>> getCandidateApplication(String candidateId) {
    return _client
        .from('election_candidates')
        .select(
          'id, politician_id, status, statement, intro_video_url, '
          'election_seats(role_title, elections(id))',
        )
        .eq('id', candidateId)
        .single();
  }

  Future<List<dynamic>> getElectionQuestions(String electionId) {
    return _client
        .from('election_questions')
        .select(
          'id, question_text, question_type, required, rank, '
          'election_question_options(id, option_text, rank)',
        )
        .eq('election_id', electionId)
        .order('rank');
  }

  /// Private, id-based variant of [getPublicCandidateAnswers] — carries
  /// `option_id`/`election_candidate_answer_options(option_id, rank)`
  /// instead of resolved display text, since Candidate Application needs
  /// real option ids to write with, not text to render.
  Future<List<dynamic>> getCandidateAnswerDrafts(String candidateId) {
    return _client
        .from('election_candidate_answers')
        .select(
          'id, question_id, option_id, text_answer, rating_value, '
          'election_candidate_answer_options(option_id, rank)',
        )
        .eq('candidate_id', candidateId);
  }

  Future<void> updateCandidateStatement(String candidateId, String statement) {
    return _client
        .from('election_candidates')
        .update({'statement': statement})
        .eq('id', candidateId);
  }

  Future<void> updateCandidateIntroVideoUrl(String candidateId, String url) {
    return _client
        .from('election_candidates')
        .update({'intro_video_url': url})
        .eq('id', candidateId);
  }

  static const _videoBucket = 'politician_videos';

  Future<String> uploadCandidateVideo(
    Uint8List bytes,
    String fileExtension,
  ) async {
    final fileName =
        'video_${DateTime.now().millisecondsSinceEpoch}.$fileExtension';
    await _client.storage
        .from(_videoBucket)
        .uploadBinary(
          fileName,
          bytes,
          fileOptions: FileOptions(
            contentType: switch (fileExtension.toLowerCase()) {
              'mov' => 'video/quicktime',
              '3gp' => 'video/3gpp',
              final ext => 'video/$ext',
            },
          ),
        );
    return _client.storage.from(_videoBucket).getPublicUrl(fileName);
  }

  Future<Map<String, dynamic>> upsertCandidateAnswer(
    String candidateId,
    String questionId, {
    String? optionId,
    String? textAnswer,
    int? ratingValue,
  }) {
    return _client
        .from('election_candidate_answers')
        .upsert({
          'candidate_id': candidateId,
          'question_id': questionId,
          'option_id': optionId,
          'text_answer': textAnswer,
          'rating_value': ratingValue,
        }, onConflict: 'candidate_id,question_id')
        .select()
        .single();
  }

  Future<void> setCandidateAnswerOptions(
    String answerId,
    List<String> optionIds,
  ) async {
    await _client
        .from('election_candidate_answer_options')
        .delete()
        .eq('answer_id', answerId);
    if (optionIds.isEmpty) return;
    await _client
        .from('election_candidate_answer_options')
        .insert(
          optionIds
              .map((id) => {'answer_id': answerId, 'option_id': id})
              .toList(),
        );
  }

  Future<void> setCandidateAnswerRanking(
    String answerId,
    List<String> orderedOptionIds,
  ) async {
    await _client
        .from('election_candidate_answer_options')
        .delete()
        .eq('answer_id', answerId);
    if (orderedOptionIds.isEmpty) return;
    await _client
        .from('election_candidate_answer_options')
        .insert(
          orderedOptionIds
              .asMap()
              .entries
              .map(
                (e) => {
                  'answer_id': answerId,
                  'option_id': e.value,
                  'rank': e.key + 1,
                },
              )
              .toList(),
        );
  }

  Future<void> submitCandidateApplication(String candidateId) {
    return _client.rpc(
      'submit_candidate_application',
      params: {'p_candidate_id': candidateId},
    );
  }
}
