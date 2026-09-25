import 'package:flutter/foundation.dart';

/// Port of the row shape `getWallOwnerProfile`/`getWallOwnerProfileBySlug`
/// (src/lib/services/politicianWall.ts) return — a politician's own
/// standing wall, distinct from any one campaign (Candidacy Wall, §4.A.8).
@immutable
class PoliticianWallProfile {
  const PoliticianWallProfile({
    required this.id,
    required this.currentGhostId,
    required this.fullName,
    this.wallSlug,
    this.politicalTargetRole,
    this.targetBoundaryName,
    this.partyName,
    this.bio,
    this.avatarUrl,
    this.photoUrl,
    this.contactEmail,
    this.contactPhone,
    this.sourceUrl,
  });

  final String id;
  final String currentGhostId;
  final String fullName;
  final String? wallSlug;
  final String? politicalTargetRole;
  final String? targetBoundaryName;
  final String? partyName;
  final String? bio;
  final String? avatarUrl;
  final String? photoUrl;
  final String? contactEmail;
  final String? contactPhone;
  final String? sourceUrl;

  /// Web falls back photo_url -> avatar_url for display — same here rather
  /// than making every call site repeat the `??`.
  String? get displayPhotoUrl => photoUrl ?? avatarUrl;
}
