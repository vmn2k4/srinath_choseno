import 'package:flutter/foundation.dart';

import 'candidacy_question_answer.dart';
import 'election_question_option.dart';

/// Port of `getElectionQuestions`'s row shape (src/lib/services/elections.ts)
/// — Candidate Application's (§4.G) writable question list. Distinct from
/// [CandidacyQuestionAnswer] (Candidacy Wall's read-only, already-answered
/// view): this carries the question's raw options (with ids, for writing)
/// and `required`, neither of which the public read side needs.
@immutable
class EditableQuestion {
  const EditableQuestion({
    required this.id,
    required this.questionText,
    required this.questionType,
    required this.rank,
    required this.required,
    this.options = const [],
  });

  final String id;
  final String questionText;
  final CandidacyQuestionType questionType;
  final int rank;
  final bool required;
  final List<ElectionQuestionOption> options;
}
