import 'package:flutter/foundation.dart';

/// Port of the profile-card slice of `getPublicCandidateById`
/// (src/lib/services/elections.ts) for Candidacy Wall (§4.A.8). Not yet
/// ported: `intro_video_url` (no video-playback infra yet), claim-request
/// fields, and nomination-filed status.
@immutable
class CandidacyDetail {
  const CandidacyDetail({
    required this.id,
    required this.politicianId,
    required this.fullName,
    this.avatarUrl,
    this.wallSlug,
    this.partyName,
    this.bio,
    this.statement,
    this.roleTitle,
    this.boundaryName,
    this.electionName,
    this.addedByElectionAdminId,
    this.claimedAt,
  });

  final String id;
  final String politicianId;
  final String fullName;
  final String? avatarUrl;
  final String? wallSlug;
  final String? partyName;
  final String? bio;
  final String? statement;
  final String? roleTitle;
  final String? boundaryName;
  final String? electionName;

  /// Non-null when an election administrator added this candidate row
  /// on the politician's behalf, rather than the politician applying
  /// themselves — the real signal for "unclaimed stub candidate" (the
  /// web's own `CandidacyWall.tsx` reads a `candidate.is_unregistered`
  /// field that isn't a real column and isn't set by any query in
  /// src/lib/services/elections.ts, so this port uses the columns that
  /// actually exist instead of copying that dead field).
  final String? addedByElectionAdminId;
  final DateTime? claimedAt;

  bool get isUnclaimedStub =>
      addedByElectionAdminId != null && claimedAt == null;
}
