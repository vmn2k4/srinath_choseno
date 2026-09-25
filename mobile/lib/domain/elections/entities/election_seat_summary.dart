import 'package:flutter/foundation.dart';

/// One `election_seats` row joined with its boundary + election, plus a
/// candidate count — matches `FindMyDistrictClient.tsx`'s `SeatWithElections`
/// shape (parent repo) and is generic enough for the Elections list screen
/// (§4.A.5) to reuse as-is.
@immutable
class ElectionSeatSummary {
  const ElectionSeatSummary({
    required this.id,
    required this.roleTitle,
    this.boundaryName,
    this.electionName,
    this.electionDate,
    this.candidateCount = 0,
  });

  final String id;
  final String roleTitle;
  final String? boundaryName;
  final String? electionName;
  final DateTime? electionDate;
  final int candidateCount;
}
