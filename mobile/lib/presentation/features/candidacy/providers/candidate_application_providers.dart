// Candidate Application (§4.G, docs/FLUTTER_MOBILE_APP_GUIDE.md, parent
// repo) — Written Questionnaire mode only. See
// elections_remote_data_source.dart's header comment for what isn't
// ported (Video Interview player, "choose your questions" screen,
// answer→wall-post pitches, answer comments).
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../domain/elections/entities/candidacy_question_answer.dart';
import '../../../../domain/elections/entities/candidate_answer_draft.dart';
import '../../../../domain/elections/entities/candidate_application.dart';
import '../../../../domain/elections/entities/editable_question.dart';
import '../../auth/providers/auth_providers.dart';
import '../../elections/providers/elections_providers.dart';

@immutable
class CandidateApplicationState {
  const CandidateApplicationState({
    required this.application,
    required this.questions,
    required this.answersByQuestionId,
    this.savingStatement = false,
    this.uploadingVideo = false,
    this.submitting = false,
    this.submitError,
    this.statementDraft,
    this.highlightedQuestionIds = const {},
  });

  final CandidateApplication application;
  final List<EditableQuestion> questions;
  final Map<String, CandidateAnswerDraft> answersByQuestionId;
  final bool savingStatement;
  final bool uploadingVideo;
  final bool submitting;
  final String? submitError;

  /// The statement text as currently typed (may be ahead of what's saved).
  final String? statementDraft;

  /// Required questions that were still unanswered at the last submit try.
  final Set<String> highlightedQuestionIds;

  /// Mirrors the `submit_candidate_application` RPC's own "answered" test
  /// per question type, so the app can point at what's missing instead of
  /// only surfacing the server's generic error.
  bool isAnswered(EditableQuestion q) {
    final a = answersByQuestionId[q.id];
    if (a == null) return false;
    switch (q.questionType) {
      case CandidacyQuestionType.text:
        return (a.textAnswer ?? '').trim().isNotEmpty;
      case CandidacyQuestionType.rating:
        return a.ratingValue != null;
      case CandidacyQuestionType.multipleChoice:
        return a.selectedOptionIds.isNotEmpty;
      case CandidacyQuestionType.ranking:
        return a.selectedOptionIds.length == q.options.length &&
            q.options.isNotEmpty;
      case CandidacyQuestionType.singleChoice:
      case CandidacyQuestionType.unknown:
        return a.optionId != null;
    }
  }

  List<EditableQuestion> get unansweredRequired =>
      questions.where((q) => q.required && !isAnswered(q)).toList();

  CandidateApplicationState copyWith({
    CandidateApplication? application,
    Map<String, CandidateAnswerDraft>? answersByQuestionId,
    bool? savingStatement,
    bool? uploadingVideo,
    bool? submitting,
    String? submitError,
    bool clearSubmitError = false,
    String? statementDraft,
    Set<String>? highlightedQuestionIds,
  }) {
    return CandidateApplicationState(
      application: application ?? this.application,
      questions: questions,
      answersByQuestionId: answersByQuestionId ?? this.answersByQuestionId,
      savingStatement: savingStatement ?? this.savingStatement,
      uploadingVideo: uploadingVideo ?? this.uploadingVideo,
      submitting: submitting ?? this.submitting,
      submitError: clearSubmitError ? null : (submitError ?? this.submitError),
      statementDraft: statementDraft ?? this.statementDraft,
      highlightedQuestionIds:
          highlightedQuestionIds ?? this.highlightedQuestionIds,
    );
  }
}

class CandidateApplicationController
    extends AsyncNotifier<CandidateApplicationState> {
  CandidateApplicationController(this.candidateId);

  final String candidateId;

  @override
  Future<CandidateApplicationState> build() async {
    final repo = ref.watch(electionsRepositoryProvider);
    final userId = ref.read(authStateChangesProvider).value?.id;

    final appResult = await repo.getCandidateApplication(candidateId);
    final application = appResult.when(ok: (a) => a, err: (f) => throw f);

    if (userId == null || application.politicianId != userId) {
      throw const ServerFailure(
        'You are not authorized to edit this application.',
      );
    }

    final questionsResult = await repo.getElectionQuestions(
      application.electionId,
    );
    final questions = questionsResult.when(ok: (q) => q, err: (f) => throw f);

    final draftsResult = await repo.getCandidateAnswerDrafts(candidateId);
    final drafts = draftsResult.when(ok: (d) => d, err: (f) => throw f);

    final initial = CandidateApplicationState(
      application: application,
      questions: questions,
      answersByQuestionId: {for (final d in drafts) d.questionId: d},
      statementDraft: application.statement,
    );

    // A ranking question always has a full order once shown — the web
    // persists the admin's option order as the default answer, and the
    // submit RPC requires EVERY option ranked. Without this, accepting the
    // default order would leave the answer empty and fail at submit.
    Future.microtask(() => _persistDefaultRankings(initial));
    return initial;
  }

  Future<void> _persistDefaultRankings(CandidateApplicationState loaded) async {
    for (final q in loaded.questions) {
      if (q.questionType != CandidacyQuestionType.ranking) continue;
      if (q.options.isEmpty) continue;
      final saved =
          loaded.answersByQuestionId[q.id]?.selectedOptionIds ?? const [];
      if (saved.length == q.options.length) continue;
      await answerRanking(q.id, q.options.map((o) => o.id).toList());
    }
  }

  void setStatementDraft(String value) {
    final current = state.value;
    if (current == null) return;
    state = AsyncData(current.copyWith(statementDraft: value));
  }

  void _mergeAnswer(String questionId, CandidateAnswerDraft draft) {
    final current = state.value;
    if (current == null) return;
    final updated = Map<String, CandidateAnswerDraft>.from(
      current.answersByQuestionId,
    )..[questionId] = draft;
    state = AsyncData(current.copyWith(answersByQuestionId: updated));
  }

  Future<void> saveStatement(String statement) async {
    final current = state.value;
    if (current == null) return;
    state = AsyncData(current.copyWith(savingStatement: true));
    final result = await ref
        .read(electionsRepositoryProvider)
        .updateCandidateStatement(candidateId, statement);
    final latest = state.value ?? current;
    state = AsyncData(
      result.when(
        ok: (_) => latest.copyWith(
          application: latest.application.copyWith(statement: statement),
          savingStatement: false,
        ),
        err: (_) => latest.copyWith(savingStatement: false),
      ),
    );
  }

  Future<bool> uploadIntroVideo(Uint8List bytes, String fileExtension) async {
    final current = state.value;
    if (current == null) return false;
    state = AsyncData(current.copyWith(uploadingVideo: true));
    final repo = ref.read(electionsRepositoryProvider);
    final uploadResult = await repo.uploadCandidateVideo(bytes, fileExtension);
    final url = uploadResult.valueOrNull;
    if (url == null) {
      state = AsyncData(
        (state.value ?? current).copyWith(uploadingVideo: false),
      );
      return false;
    }
    final saveResult = await repo.updateCandidateIntroVideoUrl(
      candidateId,
      url,
    );
    final latest = state.value ?? current;
    state = AsyncData(
      saveResult.when(
        ok: (_) => latest.copyWith(
          application: latest.application.copyWith(introVideoUrl: url),
          uploadingVideo: false,
        ),
        err: (_) => latest.copyWith(uploadingVideo: false),
      ),
    );
    return saveResult.isOk;
  }

  Future<void> answerSingleChoice(String questionId, String optionId) async {
    final result = await ref
        .read(electionsRepositoryProvider)
        .upsertCandidateAnswer(candidateId, questionId, optionId: optionId);
    result.when(ok: (draft) => _mergeAnswer(questionId, draft), err: (_) {});
  }

  Future<void> answerText(String questionId, String text) async {
    final result = await ref
        .read(electionsRepositoryProvider)
        .upsertCandidateAnswer(candidateId, questionId, textAnswer: text);
    result.when(ok: (draft) => _mergeAnswer(questionId, draft), err: (_) {});
  }

  Future<void> answerRating(String questionId, int rating) async {
    final result = await ref
        .read(electionsRepositoryProvider)
        .upsertCandidateAnswer(candidateId, questionId, ratingValue: rating);
    result.when(ok: (draft) => _mergeAnswer(questionId, draft), err: (_) {});
  }

  Future<String?> _ensureAnswerId(String questionId) async {
    final existing = state.value?.answersByQuestionId[questionId]?.answerId;
    if (existing != null) return existing;
    final result = await ref
        .read(electionsRepositoryProvider)
        .upsertCandidateAnswer(candidateId, questionId);
    return result.when(
      ok: (draft) {
        _mergeAnswer(questionId, draft);
        return draft.answerId;
      },
      err: (_) => null,
    );
  }

  Future<void> answerMultipleChoice(
    String questionId,
    List<String> optionIds,
  ) async {
    final answerId = await _ensureAnswerId(questionId);
    if (answerId == null) return;
    final result = await ref
        .read(electionsRepositoryProvider)
        .setCandidateAnswerOptions(answerId, optionIds);
    result.when(
      ok: (_) => _mergeAnswer(
        questionId,
        CandidateAnswerDraft(
          questionId: questionId,
          answerId: answerId,
          selectedOptionIds: optionIds,
        ),
      ),
      err: (_) {},
    );
  }

  Future<void> answerRanking(
    String questionId,
    List<String> orderedOptionIds,
  ) async {
    final answerId = await _ensureAnswerId(questionId);
    if (answerId == null) return;
    final result = await ref
        .read(electionsRepositoryProvider)
        .setCandidateAnswerRanking(answerId, orderedOptionIds);
    result.when(
      ok: (_) => _mergeAnswer(
        questionId,
        CandidateAnswerDraft(
          questionId: questionId,
          answerId: answerId,
          selectedOptionIds: orderedOptionIds,
        ),
      ),
      err: (_) {},
    );
  }

  Future<bool> submit() async {
    final current = state.value;
    if (current == null) return false;

    // The web saves the statement as part of submitting.
    final draft = current.statementDraft?.trim();
    if (draft != null && draft != (current.application.statement ?? '')) {
      await saveStatement(draft);
    }

    final afterSave = state.value ?? current;
    final missing = afterSave.unansweredRequired;
    if (missing.isNotEmpty) {
      state = AsyncData(
        afterSave.copyWith(
          submitError:
              'Please answer all required questions before submitting (${missing.length} left).',
          highlightedQuestionIds: missing.map((q) => q.id).toSet(),
        ),
      );
      return false;
    }

    state = AsyncData(
      afterSave.copyWith(
        submitting: true,
        clearSubmitError: true,
        highlightedQuestionIds: const {},
      ),
    );
    final result = await ref
        .read(electionsRepositoryProvider)
        .submitCandidateApplication(candidateId);
    final latest = state.value ?? afterSave;
    state = AsyncData(
      result.when(
        ok: (_) => latest.copyWith(
          application: latest.application.copyWith(status: 'approved'),
          submitting: false,
        ),
        err: (f) => latest.copyWith(submitting: false, submitError: f.message),
      ),
    );
    return result.isOk;
  }
}

final candidateApplicationControllerProvider = AsyncNotifierProvider.autoDispose
    .family<CandidateApplicationController, CandidateApplicationState, String>(
      (candidateId) => CandidateApplicationController(candidateId),
    );
