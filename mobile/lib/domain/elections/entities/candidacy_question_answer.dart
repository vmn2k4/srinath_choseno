import 'package:flutter/foundation.dart';

/// Mirrors the `question_type` values in `election_questions`
/// (20260802000000_flexible_questionnaire.sql) — see `AnswerValue.tsx`
/// (src/components/features) for the per-type rendering this enum drives.
enum CandidacyQuestionType {
  singleChoice,
  multipleChoice,
  text,
  rating,
  ranking,
  unknown,
}

CandidacyQuestionType candidacyQuestionTypeFromKey(String? key) {
  switch (key) {
    case 'single_choice':
      return CandidacyQuestionType.singleChoice;
    case 'multiple_choice':
      return CandidacyQuestionType.multipleChoice;
    case 'text':
      return CandidacyQuestionType.text;
    case 'rating':
      return CandidacyQuestionType.rating;
    case 'ranking':
      return CandidacyQuestionType.ranking;
    default:
      return CandidacyQuestionType.unknown;
  }
}

/// One questionnaire question plus this candidate's answer to it — port of
/// `getPublicCandidateAnswers`'s row shape (src/lib/services/elections.ts),
/// pre-joined since the query already embeds the question inside the
/// answer row. Video answers and answer comments aren't ported yet (no
/// video-playback or nested-comment infra for Candidacy Wall).
@immutable
class CandidacyQuestionAnswer {
  const CandidacyQuestionAnswer({
    required this.id,
    required this.questionText,
    required this.questionType,
    required this.rank,
    this.optionText,
    this.selectedOptionTexts = const [],
    this.textAnswer,
    this.ratingValue,
    this.contextText,
  });

  final String id;
  final String questionText;
  final CandidacyQuestionType questionType;
  final int rank;
  final String? optionText;
  final List<String> selectedOptionTexts;
  final String? textAnswer;
  final int? ratingValue;
  final String? contextText;

  /// Whether this answer actually has a renderable value — an unanswered
  /// question still comes back as a row with all value columns null, and
  /// `AnswerValue.tsx` skips rendering those (returns null for empty
  /// text/options/rating) rather than showing an empty state.
  bool get hasValue {
    switch (questionType) {
      case CandidacyQuestionType.singleChoice:
        return optionText != null && optionText!.isNotEmpty;
      case CandidacyQuestionType.multipleChoice:
      case CandidacyQuestionType.ranking:
        return selectedOptionTexts.isNotEmpty;
      case CandidacyQuestionType.text:
        return textAnswer != null && textAnswer!.isNotEmpty;
      case CandidacyQuestionType.rating:
        return ratingValue != null;
      case CandidacyQuestionType.unknown:
        return false;
    }
  }
}
