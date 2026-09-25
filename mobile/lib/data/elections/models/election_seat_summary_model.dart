import '../../../domain/elections/entities/election_seat_summary.dart';

extension ElectionSeatSummaryMapper on Map<String, dynamic> {
  ElectionSeatSummary toElectionSeatSummary({int candidateCount = 0}) {
    final shape = this['map_shapes'] as Map<String, dynamic>?;
    final election = this['elections'] as Map<String, dynamic>?;
    final dateStr = election?['election_date'] as String?;

    return ElectionSeatSummary(
      id: this['id'] as String,
      roleTitle: this['role_title'] as String,
      boundaryName: shape?['name'] as String?,
      electionName: election?['name'] as String?,
      electionDate: dateStr != null ? DateTime.tryParse(dateStr) : null,
      candidateCount: candidateCount,
    );
  }
}
