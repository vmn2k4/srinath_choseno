import 'package:choseno_mobile/domain/elections/entities/candidacy_detail.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CandidacyDetail.isUnclaimedStub', () {
    const base = CandidacyDetail(
      id: 'c1',
      politicianId: 'p1',
      fullName: 'Alice',
    );

    test('false when never added by an admin', () {
      expect(base.isUnclaimedStub, isFalse);
    });

    test('true when admin-added and not yet claimed', () {
      final stub = CandidacyDetail(
        id: base.id,
        politicianId: base.politicianId,
        fullName: base.fullName,
        addedByElectionAdminId: 'admin-1',
      );
      expect(stub.isUnclaimedStub, isTrue);
    });

    test('false once claimed, even if originally admin-added', () {
      final claimed = CandidacyDetail(
        id: base.id,
        politicianId: base.politicianId,
        fullName: base.fullName,
        addedByElectionAdminId: 'admin-1',
        claimedAt: DateTime(2026, 1, 1),
      );
      expect(claimed.isUnclaimedStub, isFalse);
    });
  });
}
