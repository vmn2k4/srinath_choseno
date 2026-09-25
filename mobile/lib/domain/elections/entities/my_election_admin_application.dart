import 'package:flutter/foundation.dart';

/// Port of `getMyElectionAdminApplications`'s row shape
/// (src/lib/services/elections.ts) — My Elections' "My Admin
/// Applications" section (§4.F), the sibling list to [MyCandidacy].
@immutable
class MyElectionAdminApplication {
  const MyElectionAdminApplication({
    required this.id,
    required this.seatId,
    required this.status,
    this.roleTitle,
    this.boundaryName,
    this.electionName,
  });

  final String id;
  final String seatId;

  /// One of 'pending' / 'approved' / 'rejected'.
  final String status;
  final String? roleTitle;
  final String? boundaryName;
  final String? electionName;
}
