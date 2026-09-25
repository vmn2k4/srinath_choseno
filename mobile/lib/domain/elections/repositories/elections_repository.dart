import 'dart:typed_data';

import '../../../core/errors/result.dart';
import '../../boundaries/entities/map_shape.dart';
import '../entities/candidacy_detail.dart';
import '../entities/candidacy_question_answer.dart';
import '../entities/candidate_answer_draft.dart';
import '../entities/candidate_application.dart';
import '../entities/editable_question.dart';
import '../entities/election_candidate.dart';
import '../entities/election_seat.dart';
import '../entities/election_seat_summary.dart';
import '../entities/my_candidacy.dart';
import '../entities/my_election_admin_application.dart';
import '../entities/politician_engagement.dart';
import '../entities/representation_branch.dart';
import '../entities/seat_admin_status.dart';

abstract interface class ElectionsRepository {
  /// My Elections' "My Candidacies" section (§4.F) — every seat this
  /// politician has applied to, regardless of status.
  Future<Result<List<MyCandidacy>>> getMyCandidacies(String profileId);

  /// RPC `apply_for_seat` — only succeeds while the seat's election is in
  /// its nominations-open window (enforced server-side).
  Future<Result<void>> applyForSeat(String seatId);

  /// Withdraw a candidacy — a direct RLS-scoped delete on
  /// `election_candidates`, not an RPC (matches the web; withdrawing is a
  /// plain ownership-checked delete, no server-side business rule beyond
  /// "you own this row").
  Future<Result<void>> deleteCandidacy(String candidateId);

  /// Real UUID lookup only — the website's `getSeatById` additionally
  /// resolves a short-hash slug (`buildSeatSlug`) via a fallback chain
  /// (RPC → legacy-slug scan). This app's own navigation only ever
  /// produces a real seat id (from `getActiveSeats(ByShapeIds)`), so that
  /// fallback chain isn't ported yet — add it here if a slug-based deep
  /// link (§1's Universal Links work) ever needs to open Seat Detail
  /// directly.
  Future<Result<ElectionSeat>> getSeatById(String seatId);

  Future<Result<List<ElectionCandidate>>> getCandidatesForSeat(String seatId);

  /// Candidacy Wall's profile card (§4.A.8) — real UUID lookup only, same
  /// simplification as [getSeatById] (this app's navigation only ever
  /// produces a real candidate id, from [getCandidatesForSeat]).
  Future<Result<CandidacyDetail>> getCandidateById(String candidateId);

  /// Candidacy Wall's questionnaire section — port of
  /// `getPublicCandidateAnswers` (src/lib/services/elections.ts), already
  /// scoped to `visible_to_public` questions server-side.
  Future<Result<List<CandidacyQuestionAnswer>>> getCandidateAnswers(
    String candidateId,
  );

  /// Claim Candidacy Flow B (§4.H) — "this is me", reviewed by an election
  /// admin. See the data source's doc comment for why Flow A (email-token
  /// deep link) isn't ported.
  Future<Result<void>> requestCandidacyClaim(
    String candidateId, {
    required String motivation,
    required String contactEmail,
    String? socialMediaInfo,
  });

  /// Election Administrator — self-service half only (§4.I.5). Any
  /// signed-in user can volunteer to administer a seat; a site admin
  /// reviews the application (`review_election_admin_application`, which
  /// requires `profiles.role = 'admin'` — a role this app has no UI for
  /// at all, per profile_screen.dart's header comment, so review isn't
  /// ported). The admin console an approved administrator would then use
  /// (add candidate stub, review claim requests, search/invite/call
  /// flows) also isn't ported — it needs infra (video interview invites,
  /// the Twilio/Grok voice-call flow) well beyond this app's current
  /// scope.
  Future<Result<SeatAdminStatus>> getSeatAdminStatus(String seatId);

  Future<Result<void>> applyForElectionAdmin(
    String seatId, {
    required String motivation,
    required String contactEmail,
    String? socialMediaInfo,
  });

  Future<Result<List<MyElectionAdminApplication>>>
  getMyElectionAdminApplications(String profileId);

  /// Candidate Application (§4.G) — Written Questionnaire mode only. See
  /// elections_remote_data_source.dart's header comment for what isn't
  /// ported (the Video Interview reels-style player, "choose your
  /// questions" screen, answer→wall-post pitches, answer comments).
  ///
  /// Real UUID lookup only, same simplification as [getSeatById]. Callers
  /// must also verify [CandidateApplication.politicianId] matches the
  /// signed-in user themselves — this method doesn't enforce ownership
  /// beyond whatever RLS already does on the underlying select.
  Future<Result<CandidateApplication>> getCandidateApplication(
    String candidateId,
  );

  Future<Result<List<EditableQuestion>>> getElectionQuestions(
    String electionId,
  );

  Future<Result<List<CandidateAnswerDraft>>> getCandidateAnswerDrafts(
    String candidateId,
  );

  Future<Result<void>> updateCandidateStatement(
    String candidateId,
    String statement,
  );

  Future<Result<void>> updateCandidateIntroVideoUrl(
    String candidateId,
    String url,
  );

  /// Uploads a recorded video to the `politician_videos` bucket (same
  /// bucket the web's `VideoRecorder.tsx` uses) and returns its public
  /// URL. [fileExtension] excludes the leading dot (e.g. `'mp4'`).
  Future<Result<String>> uploadCandidateVideo(
    Uint8List bytes,
    String fileExtension,
  );

  /// Upserts one question's answer and returns the answer row (so a
  /// caller can then write into `election_candidate_answer_options` via
  /// [setCandidateAnswerOptions]/[setCandidateAnswerRanking] using its
  /// id). Only pass the field(s) meaningful for that question's type —
  /// see `upsertCandidateAnswer`'s own doc comment in
  /// src/lib/services/elections.ts.
  Future<Result<CandidateAnswerDraft>> upsertCandidateAnswer(
    String candidateId,
    String questionId, {
    String? optionId,
    String? textAnswer,
    int? ratingValue,
  });

  /// Replace-all for a multiple_choice answer's selected options.
  Future<Result<void>> setCandidateAnswerOptions(
    String answerId,
    List<String> optionIds,
  );

  /// Replace-all for a ranking answer's option order — index 0 is rank 1.
  Future<Result<void>> setCandidateAnswerRanking(
    String answerId,
    List<String> orderedOptionIds,
  );

  /// RPC `submit_candidate_application` — auto-approves server-side.
  Future<Result<void>> submitCandidateApplication(String candidateId);

  Future<Result<Map<String, PoliticianEngagement>>>
  getPoliticianEngagementSummaries(List<String> politicianIds);

  /// Port of `resolveRepresentationBranch` (src/lib/services/elections.ts)
  /// — the "who represents me" tree for one boundary. See the data source's
  /// header comment for the one enrichment fallback this deliberately
  /// doesn't port yet.
  Future<Result<RepresentationBranch>> resolveRepresentationBranch(
    MapShape shape,
  );

  /// Seats in the given boundaries currently open for nomination/voting,
  /// each with its live candidate count. Used by Find My District's
  /// "Candidates in Your Area" cards.
  Future<Result<List<ElectionSeatSummary>>> getActiveSeatsByShapeIds(
    List<int> shapeIds,
  );

  /// Platform-wide active seats, unscoped by boundary membership — the
  /// public Elections list (§4.A.5) for a visitor with no location set yet.
  Future<Result<List<ElectionSeatSummary>>> getActiveSeats({
    int limit = 30,
    int offset = 0,
  });
}
