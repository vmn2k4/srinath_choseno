import 'package:flutter/foundation.dart';

/// The candidate's own in-progress answer to one question, as loaded from
/// `getCandidateAnswers` (the *private*, id-based variant — not
/// `getPublicCandidateAnswers`'s display-text one). `answerId` is null
/// until the first write creates the `election_candidate_answers` row;
/// `selectedOptionIds` holds either the multiple_choice selection or the
/// ranking order (index 0 = rank 1), never both, per [questionId]'s type.
@immutable
class CandidateAnswerDraft {
  const CandidateAnswerDraft({
    required this.questionId,
    this.answerId,
    this.optionId,
    this.selectedOptionIds = const [],
    this.textAnswer,
    this.ratingValue,
  });

  final String questionId;
  final String? answerId;
  final String? optionId;
  final List<String> selectedOptionIds;
  final String? textAnswer;
  final int? ratingValue;

  CandidateAnswerDraft copyWith({
    String? answerId,
    String? optionId,
    List<String>? selectedOptionIds,
    String? textAnswer,
    int? ratingValue,
  }) {
    return CandidateAnswerDraft(
      questionId: questionId,
      answerId: answerId ?? this.answerId,
      optionId: optionId ?? this.optionId,
      selectedOptionIds: selectedOptionIds ?? this.selectedOptionIds,
      textAnswer: textAnswer ?? this.textAnswer,
      ratingValue: ratingValue ?? this.ratingValue,
    );
  }
}
