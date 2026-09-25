import 'package:choseno_mobile/domain/elections/entities/seat_admin_status.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('SeatAdminStatus', () {
    test('canApply only when no application on file and no approved admin', () {
      const noAppNoAdmin = SeatAdminStatus(hasApprovedAdmin: false);
      const noAppButAdminExists = SeatAdminStatus(hasApprovedAdmin: true);
      const pending = SeatAdminStatus(
        hasApprovedAdmin: false,
        myApplicationStatus: 'pending',
      );

      expect(noAppNoAdmin.canApply, isTrue);
      expect(noAppButAdminExists.canApply, isFalse);
      expect(pending.canApply, isFalse);
    });

    test('isApprovedAdmin/isPending/isRejected read myApplicationStatus', () {
      const approved = SeatAdminStatus(
        hasApprovedAdmin: true,
        myApplicationStatus: 'approved',
      );
      const pending = SeatAdminStatus(
        hasApprovedAdmin: false,
        myApplicationStatus: 'pending',
      );
      const rejected = SeatAdminStatus(
        hasApprovedAdmin: false,
        myApplicationStatus: 'rejected',
      );

      expect(approved.isApprovedAdmin, isTrue);
      expect(approved.isPending, isFalse);
      expect(pending.isPending, isTrue);
      expect(rejected.isRejected, isTrue);
    });
  });
}
