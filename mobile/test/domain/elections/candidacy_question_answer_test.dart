import 'package:choseno_mobile/domain/elections/entities/candidacy_question_answer.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('candidacyQuestionTypeFromKey', () {
    test('maps every known question_type key', () {
      expect(
        candidacyQuestionTypeFromKey('single_choice'),
        CandidacyQuestionType.singleChoice,
      );
      expect(
        candidacyQuestionTypeFromKey('multiple_choice'),
        CandidacyQuestionType.multipleChoice,
      );
      expect(candidacyQuestionTypeFromKey('text'), CandidacyQuestionType.text);
      expect(
        candidacyQuestionTypeFromKey('rating'),
        CandidacyQuestionType.rating,
      );
      expect(
        candidacyQuestionTypeFromKey('ranking'),
        CandidacyQuestionType.ranking,
      );
    });

    test('falls back to unknown for an unrecognized or null key', () {
      expect(
        candidacyQuestionTypeFromKey('something_new'),
        CandidacyQuestionType.unknown,
      );
      expect(candidacyQuestionTypeFromKey(null), CandidacyQuestionType.unknown);
    });
  });

  group('CandidacyQuestionAnswer.hasValue', () {
    const base = CandidacyQuestionAnswer(
      id: 'a1',
      questionText: 'Q',
      questionType: CandidacyQuestionType.text,
      rank: 0,
    );

    test('single_choice is unanswered until optionText is set', () {
      final unanswered = CandidacyQuestionAnswer(
        id: base.id,
        questionText: base.questionText,
        questionType: CandidacyQuestionType.singleChoice,
        rank: base.rank,
      );
      final answered = CandidacyQuestionAnswer(
        id: base.id,
        questionText: base.questionText,
        questionType: CandidacyQuestionType.singleChoice,
        rank: base.rank,
        optionText: 'Yes',
      );
      expect(unanswered.hasValue, isFalse);
      expect(answered.hasValue, isTrue);
    });

    test('multiple_choice/ranking need a non-empty selectedOptionTexts', () {
      final unanswered = CandidacyQuestionAnswer(
        id: base.id,
        questionText: base.questionText,
        questionType: CandidacyQuestionType.multipleChoice,
        rank: base.rank,
      );
      final answered = CandidacyQuestionAnswer(
        id: base.id,
        questionText: base.questionText,
        questionType: CandidacyQuestionType.ranking,
        rank: base.rank,
        selectedOptionTexts: const ['Housing', 'Transit'],
      );
      expect(unanswered.hasValue, isFalse);
      expect(answered.hasValue, isTrue);
    });

    test('text needs a non-empty textAnswer', () {
      expect(base.hasValue, isFalse);
      final answered = CandidacyQuestionAnswer(
        id: base.id,
        questionText: base.questionText,
        questionType: CandidacyQuestionType.text,
        rank: base.rank,
        textAnswer: 'My plan is...',
      );
      expect(answered.hasValue, isTrue);
    });

    test('rating needs a non-null ratingValue', () {
      final unanswered = CandidacyQuestionAnswer(
        id: base.id,
        questionText: base.questionText,
        questionType: CandidacyQuestionType.rating,
        rank: base.rank,
      );
      final answered = CandidacyQuestionAnswer(
        id: base.id,
        questionText: base.questionText,
        questionType: CandidacyQuestionType.rating,
        rank: base.rank,
        ratingValue: 4,
      );
      expect(unanswered.hasValue, isFalse);
      expect(answered.hasValue, isTrue);
    });

    test('unknown type never has a renderable value', () {
      final unknown = CandidacyQuestionAnswer(
        id: base.id,
        questionText: base.questionText,
        questionType: CandidacyQuestionType.unknown,
        rank: base.rank,
        optionText: 'Something',
        textAnswer: 'Something',
        ratingValue: 5,
        selectedOptionTexts: const ['x'],
      );
      expect(unknown.hasValue, isFalse);
    });
  });
}
