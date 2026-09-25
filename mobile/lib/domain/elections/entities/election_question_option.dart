import 'package:flutter/foundation.dart';

/// A selectable option belonging to one `election_questions` row —
/// distinct from [CandidacyQuestionAnswer]'s already-resolved option
/// *text* strings, since editing an answer (Candidate Application, §4.G)
/// needs the option's real id to write into
/// `election_candidate_answer_options`.
@immutable
class ElectionQuestionOption {
  const ElectionQuestionOption({
    required this.id,
    required this.optionText,
    required this.rank,
  });

  final String id;
  final String optionText;
  final int rank;
}
