// Candidacy Wall's read side (§4.A.8, docs/FLUTTER_MOBILE_APP_GUIDE.md in
// the parent repo). The Support toggle/count reuse
// politician_wall_providers.dart's `wallSupportControllerProvider` /
// `wallSupporterCountProvider` directly — a candidate's support status is
// keyed by politician id, exactly the same as a Politician Wall's, so
// there's no separate "candidacy support" concept to port.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/elections/entities/candidacy_detail.dart';
import '../../../../domain/elections/entities/candidacy_question_answer.dart';
import '../../elections/providers/elections_providers.dart';

@immutable
class CandidacyWallData {
  const CandidacyWallData({required this.detail, required this.answers});

  final CandidacyDetail detail;
  final List<CandidacyQuestionAnswer> answers;
}

final candidacyWallProvider = FutureProvider.autoDispose
    .family<CandidacyWallData, String>((ref, candidateId) async {
      final repo = ref.watch(electionsRepositoryProvider);

      final detailResult = await repo.getCandidateById(candidateId);
      final detail = detailResult.when(ok: (d) => d, err: (f) => throw f);

      final answersResult = await repo.getCandidateAnswers(candidateId);
      final answers = answersResult.when(ok: (a) => a, err: (f) => throw f);

      return CandidacyWallData(detail: detail, answers: answers);
    });

@immutable
class ClaimCandidacyState {
  const ClaimCandidacyState({
    this.submitting = false,
    this.submitted = false,
    this.error,
  });

  final bool submitting;
  final bool submitted;
  final String? error;

  ClaimCandidacyState copyWith({
    bool? submitting,
    bool? submitted,
    String? error,
    bool clearError = false,
  }) {
    return ClaimCandidacyState(
      submitting: submitting ?? this.submitting,
      submitted: submitted ?? this.submitted,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// One instance per Candidacy Wall screen visit (autoDispose, keyed by
/// candidate id) — a claim request is a one-shot form, not app-wide state
/// like the shared support controllers elsewhere. Takes the candidate id
/// via constructor (the same family-arg pattern `SeatDetailController`
/// uses), since Riverpod 3.x's plain `Notifier` has no built-in family-arg
/// wiring the way `AsyncNotifier` does.
class ClaimCandidacyController extends Notifier<ClaimCandidacyState> {
  ClaimCandidacyController(this.candidateId);

  final String candidateId;

  @override
  ClaimCandidacyState build() => const ClaimCandidacyState();

  Future<void> submit({
    required String motivation,
    required String contactEmail,
    String? socialMediaInfo,
  }) async {
    state = state.copyWith(submitting: true, clearError: true);
    final result = await ref
        .read(electionsRepositoryProvider)
        .requestCandidacyClaim(
          candidateId,
          motivation: motivation,
          contactEmail: contactEmail,
          socialMediaInfo: socialMediaInfo,
        );
    state = result.when(
      ok: (_) => state.copyWith(submitting: false, submitted: true),
      err: (f) => state.copyWith(submitting: false, error: f.message),
    );
  }
}

final claimCandidacyControllerProvider = NotifierProvider.autoDispose
    .family<ClaimCandidacyController, ClaimCandidacyState, String>(
      (candidateId) => ClaimCandidacyController(candidateId),
    );
