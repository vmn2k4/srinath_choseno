import 'package:flutter/foundation.dart';

/// Port of a `getCandidatesBySeatIds` row (src/lib/services/elections.ts)
/// — a candidate's roster/results-view shape. Not yet ported: `statement`
/// display (Candidacy Wall, §4.A.8 — not built), claim-request fields
/// (`added_by_election_admin_id`, `claimed_at`, §4.I.5).
@immutable
class ElectionCandidate {
  const ElectionCandidate({
    required this.id,
    required this.politicianId,
    required this.fullName,
    this.avatarUrl,
    this.wallSlug,
    this.partyName,
    this.bio,
  });

  final String id;
  final String politicianId;
  final String fullName;
  final String? avatarUrl;
  final String? wallSlug;
  final String? partyName;
  final String? bio;
}
