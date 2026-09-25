import 'package:flutter/foundation.dart';

/// A politician's own `politician_profiles` row — what Edit Profile has to
/// pre-fill, and what a save has to carry forward untouched. Exists because
/// `politician_profiles` is upserted as a whole row: leaving a field out of
/// the write would null it, so any field a screen doesn't edit (target
/// boundary, office title, avatar) must be read first and written back.
@immutable
class PoliticianDetails {
  const PoliticianDetails({
    this.politicalPartyId,
    this.education,
    this.hometown,
    this.bio,
    this.avatarUrl,
    this.targetBoundaryId,
    this.targetBoundaryName,
    this.politicalTargetRole,
    this.wallSlug,
  });

  final int? politicalPartyId;
  final String? education;
  final String? hometown;
  final String? bio;
  final String? avatarUrl;
  final String? targetBoundaryId;
  final String? targetBoundaryName;
  final String? politicalTargetRole;
  final String? wallSlug;
}
