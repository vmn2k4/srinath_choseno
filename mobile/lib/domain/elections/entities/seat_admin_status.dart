import 'package:flutter/foundation.dart';

/// Port of `get_seat_admin_status`'s row shape (RPC,
/// 20260729000007_election_administrators.sql) — the viewer's own
/// election-admin-application state for one seat, plus whether the seat
/// already has anyone approved.
@immutable
class SeatAdminStatus {
  const SeatAdminStatus({
    required this.hasApprovedAdmin,
    this.myApplicationStatus,
  });

  final bool hasApprovedAdmin;

  /// One of 'pending' / 'approved' / 'rejected', or null if the viewer has
  /// never applied for this seat.
  final String? myApplicationStatus;

  bool get isApprovedAdmin => myApplicationStatus == 'approved';
  bool get isPending => myApplicationStatus == 'pending';
  bool get isRejected => myApplicationStatus == 'rejected';
  bool get canApply => myApplicationStatus == null && !hasApprovedAdmin;
}
