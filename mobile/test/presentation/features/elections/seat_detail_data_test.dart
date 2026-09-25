import 'package:choseno_mobile/domain/elections/entities/election_candidate.dart';
import 'package:choseno_mobile/domain/elections/entities/election_seat.dart';
import 'package:choseno_mobile/domain/elections/entities/politician_engagement.dart';
import 'package:choseno_mobile/presentation/features/elections/providers/seat_detail_providers.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const seat = ElectionSeat(id: 's1', roleTitle: 'Mayor');
  const a = ElectionCandidate(id: 'c1', politicianId: 'p1', fullName: 'Alice');
  const b = ElectionCandidate(id: 'c2', politicianId: 'p2', fullName: 'Bob');
  const c = ElectionCandidate(id: 'c3', politicianId: 'p3', fullName: 'Cara');

  SeatDetailData withEngagement(Map<String, int> counts) {
    return SeatDetailData(
      seat: seat,
      candidates: [a, b, c],
      engagementByPoliticianId: {
        for (final e in counts.entries)
          e.key: PoliticianEngagement(
            politicianId: e.key,
            supporterCount: e.value,
          ),
      },
      mySupportedIds: const {},
    );
  }

  group('SeatDetailData', () {
    test('a single top count produces a leader, not a tie', () {
      final data = withEngagement({'p1': 10, 'p2': 4, 'p3': 4});
      expect(data.leader?.politicianId, 'p1');
      expect(data.isTie, isFalse);
    });

    test('two candidates sharing the top count is a tie, no leader', () {
      final data = withEngagement({'p1': 10, 'p2': 10, 'p3': 2});
      expect(data.leader, isNull);
      expect(data.isTie, isTrue);
    });

    test('zero total support is neither a leader nor a tie', () {
      final data = withEngagement({'p1': 0, 'p2': 0, 'p3': 0});
      expect(data.leader, isNull);
      expect(data.isTie, isFalse);
    });

    test('rankedCandidates sorts by supporter count descending', () {
      final data = withEngagement({'p1': 2, 'p2': 10, 'p3': 5});
      expect(data.rankedCandidates.map((c) => c.politicianId), [
        'p2',
        'p3',
        'p1',
      ]);
    });
  });
}
