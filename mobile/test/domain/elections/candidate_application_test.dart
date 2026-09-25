import 'package:choseno_mobile/domain/elections/entities/candidate_answer_draft.dart';
import 'package:choseno_mobile/domain/elections/entities/candidate_application.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CandidateApplication.copyWith', () {
    const base = CandidateApplication(
      id: 'c1',
      politicianId: 'p1',
      electionId: 'e1',
      status: 'draft',
      statement: 'Original statement',
    );

    test('overrides only the given fields', () {
      final updated = base.copyWith(statement: 'New statement');
      expect(updated.statement, 'New statement');
      expect(updated.status, 'draft');
      expect(updated.id, 'c1');
      expect(updated.electionId, 'e1');
    });

    test('status update leaves statement/introVideoUrl untouched', () {
      final approved = base.copyWith(status: 'approved');
      expect(approved.status, 'approved');
      expect(approved.statement, 'Original statement');
    });
  });

  group('CandidateAnswerDraft.copyWith', () {
    const base = CandidateAnswerDraft(questionId: 'q1');

    test('a fresh draft has no answerId until the first write', () {
      expect(base.answerId, isNull);
    });

    test('copyWith sets answerId without touching other fields', () {
      final withId = base.copyWith(answerId: 'a1', textAnswer: 'hello');
      expect(withId.answerId, 'a1');
      expect(withId.textAnswer, 'hello');
      expect(withId.questionId, 'q1');
    });
  });
}
