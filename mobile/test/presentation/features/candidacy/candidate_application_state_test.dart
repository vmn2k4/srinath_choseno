import 'package:choseno_mobile/domain/elections/entities/candidacy_question_answer.dart';
import 'package:choseno_mobile/domain/elections/entities/candidate_answer_draft.dart';
import 'package:choseno_mobile/domain/elections/entities/candidate_application.dart';
import 'package:choseno_mobile/domain/elections/entities/editable_question.dart';
import 'package:choseno_mobile/domain/elections/entities/election_question_option.dart';
import 'package:choseno_mobile/presentation/features/candidacy/providers/candidate_application_providers.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const app = CandidateApplication(
    id: 'c1',
    politicianId: 'p1',
    electionId: 'e1',
    status: 'draft',
  );
  const options = [
    ElectionQuestionOption(id: 'o1', optionText: 'A', rank: 1),
    ElectionQuestionOption(id: 'o2', optionText: 'B', rank: 2),
  ];
  const ranking = EditableQuestion(
    id: 'q-rank',
    questionText: 'Rank',
    questionType: CandidacyQuestionType.ranking,
    rank: 1,
    required: true,
    options: options,
  );
  const text = EditableQuestion(
    id: 'q-text',
    questionText: 'Why',
    questionType: CandidacyQuestionType.text,
    rank: 2,
    required: true,
  );
  const optional = EditableQuestion(
    id: 'q-opt',
    questionText: 'Extra',
    questionType: CandidacyQuestionType.rating,
    rank: 3,
    required: false,
  );

  CandidateApplicationState stateWith(Map<String, CandidateAnswerDraft> a) =>
      CandidateApplicationState(
        application: app,
        questions: const [ranking, text, optional],
        answersByQuestionId: a,
      );

  test('a ranking only counts once EVERY option is ranked (server rule)', () {
    final partial = stateWith({
      'q-rank': const CandidateAnswerDraft(
        questionId: 'q-rank',
        selectedOptionIds: ['o1'],
      ),
    });
    final full = stateWith({
      'q-rank': const CandidateAnswerDraft(
        questionId: 'q-rank',
        selectedOptionIds: ['o2', 'o1'],
      ),
    });
    expect(partial.isAnswered(ranking), isFalse);
    expect(full.isAnswered(ranking), isTrue);
  });

  test('unansweredRequired lists only required, unanswered questions', () {
    final s = stateWith({
      'q-rank': const CandidateAnswerDraft(
        questionId: 'q-rank',
        selectedOptionIds: ['o1', 'o2'],
      ),
    });
    expect(s.unansweredRequired.map((q) => q.id), ['q-text']);
  });

  test('blank text does not count as answered', () {
    final s = stateWith({
      'q-text': const CandidateAnswerDraft(
        questionId: 'q-text',
        textAnswer: '   ',
      ),
    });
    expect(s.isAnswered(text), isFalse);
  });
}
