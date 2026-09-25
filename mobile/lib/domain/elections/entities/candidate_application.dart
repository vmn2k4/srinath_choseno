import 'package:flutter/foundation.dart';

/// The signed-in candidate's own view of their `election_candidates` row
/// — Candidate Application's (§4.G) header data. Distinct from
/// [CandidacyDetail] (the public, read-only Candidacy Wall view): this
/// carries `electionId` (needed to fetch that election's questionnaire)
/// and `status`, neither of which a visitor needs.
@immutable
class CandidateApplication {
  const CandidateApplication({
    required this.id,
    required this.politicianId,
    required this.electionId,
    required this.status,
    this.statement,
    this.introVideoUrl,
    this.roleTitle,
  });

  final String id;
  final String politicianId;
  final String electionId;

  /// One of 'draft' / 'pending' / 'approved' / 'rejected'. Submission
  /// auto-approves server-side (`submit_candidate_application`), so
  /// 'pending' is a legacy value this app's own submit flow never
  /// produces — 'draft' means "not submitted yet", not "under review".
  final String status;
  final String? statement;
  final String? introVideoUrl;
  final String? roleTitle;

  CandidateApplication copyWith({
    String? status,
    String? statement,
    String? introVideoUrl,
  }) {
    return CandidateApplication(
      id: id,
      politicianId: politicianId,
      electionId: electionId,
      status: status ?? this.status,
      statement: statement ?? this.statement,
      introVideoUrl: introVideoUrl ?? this.introVideoUrl,
      roleTitle: roleTitle,
    );
  }
}
