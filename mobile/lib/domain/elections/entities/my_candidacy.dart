import 'package:flutter/foundation.dart';

/// Port of `getMyCandidacies`'s row shape (src/lib/services/elections.ts)
/// — one entry in My Elections' "My Candidacies" section (§4.F).
@immutable
class MyCandidacy {
  const MyCandidacy({
    required this.id,
    required this.seatId,
    required this.status,
    this.statement,
    this.roleTitle,
    this.boundaryName,
    this.electionName,
  });

  final String id;
  final String seatId;

  /// draft | pending | approved | rejected
  final String status;
  final String? statement;
  final String? roleTitle;
  final String? boundaryName;
  final String? electionName;
}
