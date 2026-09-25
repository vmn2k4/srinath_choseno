import 'package:flutter/foundation.dart';

/// Full `election_seats` row for Seat Detail (§4.A.7) — a superset of the
/// list-card shape [ElectionSeatSummary].
@immutable
class ElectionSeat {
  const ElectionSeat({
    required this.id,
    required this.roleTitle,
    this.boundaryName,
    this.electionName,
    this.electionDate,
  });

  final String id;
  final String roleTitle;
  final String? boundaryName;
  final String? electionName;
  final DateTime? electionDate;
}
