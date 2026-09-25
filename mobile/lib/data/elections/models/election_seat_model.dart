import '../../../domain/elections/entities/candidacy_detail.dart';
import '../../../domain/elections/entities/candidacy_question_answer.dart';
import '../../../domain/elections/entities/candidate_answer_draft.dart';
import '../../../domain/elections/entities/candidate_application.dart';
import '../../../domain/elections/entities/editable_question.dart';
import '../../../domain/elections/entities/election_candidate.dart';
import '../../../domain/elections/entities/election_question_option.dart';
import '../../../domain/elections/entities/election_seat.dart';
import '../../../domain/elections/entities/my_candidacy.dart';
import '../../../domain/elections/entities/my_election_admin_application.dart';
import '../../../domain/elections/entities/politician_engagement.dart';
import '../../../domain/elections/entities/seat_admin_status.dart';

extension ElectionSeatMapper on Map<String, dynamic> {
  ElectionSeat toElectionSeat() {
    final shape = this['map_shapes'] as Map<String, dynamic>?;
    final election = this['elections'] as Map<String, dynamic>?;
    final dateStr = election?['election_date'] as String?;
    return ElectionSeat(
      id: this['id'] as String,
      roleTitle: this['role_title'] as String,
      boundaryName: shape?['name'] as String?,
      electionName: election?['name'] as String?,
      electionDate: dateStr != null ? DateTime.tryParse(dateStr) : null,
    );
  }
}

extension ElectionCandidateMapper on Map<String, dynamic> {
  ElectionCandidate toElectionCandidate() {
    final profile = this['profiles'] as Map<String, dynamic>;
    final pp = profile['politician_profiles'] as Map<String, dynamic>?;
    final party = pp?['political_parties'] as Map<String, dynamic>?;
    return ElectionCandidate(
      id: this['id'] as String,
      politicianId: profile['id'] as String,
      fullName: profile['full_name'] as String? ?? 'Candidate',
      avatarUrl: pp?['avatar_url'] as String?,
      wallSlug: pp?['wall_slug'] as String?,
      partyName: party?['name'] as String?,
      bio: pp?['bio'] as String?,
    );
  }
}

extension MyCandidacyMapper on Map<String, dynamic> {
  MyCandidacy toMyCandidacy() {
    final seat = this['election_seats'] as Map<String, dynamic>?;
    final shape = seat?['map_shapes'] as Map<String, dynamic>?;
    final election = seat?['elections'] as Map<String, dynamic>?;
    return MyCandidacy(
      id: this['id'] as String,
      seatId: this['seat_id'] as String,
      status: this['status'] as String? ?? 'draft',
      statement: this['statement'] as String?,
      roleTitle: seat?['role_title'] as String?,
      boundaryName: shape?['name'] as String?,
      electionName: election?['name'] as String?,
    );
  }
}

extension CandidacyDetailMapper on Map<String, dynamic> {
  CandidacyDetail toCandidacyDetail() {
    final profile = this['profiles'] as Map<String, dynamic>;
    final pp = profile['politician_profiles'] as Map<String, dynamic>?;
    final party = pp?['political_parties'] as Map<String, dynamic>?;
    final seat = this['election_seats'] as Map<String, dynamic>?;
    final shape = seat?['map_shapes'] as Map<String, dynamic>?;
    final election = seat?['elections'] as Map<String, dynamic>?;
    final claimedAtStr = this['claimed_at'] as String?;
    return CandidacyDetail(
      id: this['id'] as String,
      politicianId: profile['id'] as String,
      fullName: profile['full_name'] as String? ?? 'Candidate',
      avatarUrl: pp?['avatar_url'] as String?,
      wallSlug: pp?['wall_slug'] as String?,
      partyName: party?['name'] as String?,
      bio: pp?['bio'] as String?,
      statement: this['statement'] as String?,
      roleTitle: seat?['role_title'] as String?,
      boundaryName: shape?['name'] as String?,
      electionName: election?['name'] as String?,
      addedByElectionAdminId: this['added_by_election_admin_id'] as String?,
      claimedAt: claimedAtStr != null ? DateTime.tryParse(claimedAtStr) : null,
    );
  }
}

extension CandidacyQuestionAnswerMapper on Map<String, dynamic> {
  CandidacyQuestionAnswer toCandidacyQuestionAnswer() {
    final question = this['election_questions'] as Map<String, dynamic>;
    final singleOption =
        this['election_question_options'] as Map<String, dynamic>?;
    final rankedOptions =
        (this['election_candidate_answer_options'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>()
          ..sort(
            (a, b) =>
                ((a['rank'] as num?) ?? 0).compareTo((b['rank'] as num?) ?? 0),
          );
    return CandidacyQuestionAnswer(
      id: this['id'] as String,
      questionText: question['question_text'] as String? ?? '',
      questionType: candidacyQuestionTypeFromKey(
        question['question_type'] as String?,
      ),
      rank: (question['rank'] as num?)?.toInt() ?? 0,
      optionText: singleOption?['option_text'] as String?,
      selectedOptionTexts: rankedOptions
          .map(
            (o) =>
                (o['election_question_options']
                        as Map<String, dynamic>?)?['option_text']
                    as String?,
          )
          .whereType<String>()
          .toList(),
      textAnswer: this['text_answer'] as String?,
      ratingValue: (this['rating_value'] as num?)?.toInt(),
      contextText: this['context_text'] as String?,
    );
  }
}

extension SeatAdminStatusMapper on Map<String, dynamic> {
  SeatAdminStatus toSeatAdminStatus() {
    return SeatAdminStatus(
      hasApprovedAdmin: this['has_approved_admin'] as bool? ?? false,
      myApplicationStatus: this['my_application_status'] as String?,
    );
  }
}

extension MyElectionAdminApplicationMapper on Map<String, dynamic> {
  MyElectionAdminApplication toMyElectionAdminApplication() {
    final seat = this['election_seats'] as Map<String, dynamic>?;
    final shape = seat?['map_shapes'] as Map<String, dynamic>?;
    final election = seat?['elections'] as Map<String, dynamic>?;
    return MyElectionAdminApplication(
      id: this['id'] as String,
      seatId: this['seat_id'] as String,
      status: this['status'] as String? ?? 'pending',
      roleTitle: seat?['role_title'] as String?,
      boundaryName: shape?['name'] as String?,
      electionName: election?['name'] as String?,
    );
  }
}

extension CandidateApplicationMapper on Map<String, dynamic> {
  CandidateApplication toCandidateApplication() {
    final seat = this['election_seats'] as Map<String, dynamic>?;
    final election = seat?['elections'] as Map<String, dynamic>?;
    return CandidateApplication(
      id: this['id'] as String,
      politicianId: this['politician_id'] as String,
      electionId: election?['id'] as String? ?? '',
      status: this['status'] as String? ?? 'draft',
      statement: this['statement'] as String?,
      introVideoUrl: this['intro_video_url'] as String?,
      roleTitle: seat?['role_title'] as String?,
    );
  }
}

extension EditableQuestionMapper on Map<String, dynamic> {
  EditableQuestion toEditableQuestion() {
    final options =
        (this['election_question_options'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>()
            .map(
              (o) => ElectionQuestionOption(
                id: o['id'] as String,
                optionText: o['option_text'] as String? ?? '',
                rank: (o['rank'] as num?)?.toInt() ?? 0,
              ),
            )
            .toList()
          ..sort((a, b) => a.rank.compareTo(b.rank));
    return EditableQuestion(
      id: this['id'] as String,
      questionText: this['question_text'] as String? ?? '',
      questionType: candidacyQuestionTypeFromKey(
        this['question_type'] as String?,
      ),
      rank: (this['rank'] as num?)?.toInt() ?? 0,
      required: this['required'] as bool? ?? false,
      options: options,
    );
  }
}

extension CandidateAnswerDraftMapper on Map<String, dynamic> {
  /// From [ElectionsRemoteDataSource.getCandidateAnswerDrafts]'s select —
  /// carries `election_candidate_answer_options` with real option ids.
  CandidateAnswerDraft toCandidateAnswerDraft() {
    final rankedOptions =
        (this['election_candidate_answer_options'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>()
          ..sort(
            (a, b) =>
                ((a['rank'] as num?) ?? 0).compareTo((b['rank'] as num?) ?? 0),
          );
    return CandidateAnswerDraft(
      questionId: this['question_id'] as String,
      answerId: this['id'] as String?,
      optionId: this['option_id'] as String?,
      selectedOptionIds: rankedOptions
          .map((o) => o['option_id'] as String?)
          .whereType<String>()
          .toList(),
      textAnswer: this['text_answer'] as String?,
      ratingValue: (this['rating_value'] as num?)?.toInt(),
    );
  }

  /// From [ElectionsRemoteDataSource.upsertCandidateAnswer]'s `.select()`
  /// result — no `election_candidate_answer_options` embed (that write
  /// happens separately via `setCandidateAnswerOptions`/`...Ranking`), so
  /// this always comes back with an empty `selectedOptionIds`; the caller
  /// already knows what it just selected and merges that in itself.
  CandidateAnswerDraft toCandidateAnswerDraftFromUpsert() {
    return CandidateAnswerDraft(
      questionId: this['question_id'] as String,
      answerId: this['id'] as String,
      optionId: this['option_id'] as String?,
      textAnswer: this['text_answer'] as String?,
      ratingValue: (this['rating_value'] as num?)?.toInt(),
    );
  }
}

extension PoliticianEngagementMapper on Map<String, dynamic> {
  PoliticianEngagement toPoliticianEngagement() {
    return PoliticianEngagement(
      politicianId: this['politician_id'] as String,
      supporterCount: (this['supporter_count'] as num?)?.toInt() ?? 0,
      avgRating: (this['avg_rating'] as num?)?.toDouble() ?? 0,
      ratingCount: (this['rating_count'] as num?)?.toInt() ?? 0,
      commentCount: (this['comment_count'] as num?)?.toInt() ?? 0,
    );
  }
}
