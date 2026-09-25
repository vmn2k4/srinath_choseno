import '../../../domain/politician_wall/entities/politician_wall_profile.dart';

extension PoliticianWallProfileMapper on Map<String, dynamic> {
  PoliticianWallProfile toPoliticianWallProfile() {
    final pp = this['politician_profiles'] as Map<String, dynamic>?;
    final party = pp?['political_parties'] as Map<String, dynamic>?;

    return PoliticianWallProfile(
      id: this['id'] as String,
      currentGhostId:
          (this['current_ghost_id'] as String?) ?? (this['id'] as String),
      fullName: (this['full_name'] as String?) ?? 'Politician',
      wallSlug: pp?['wall_slug'] as String?,
      politicalTargetRole: pp?['political_target_role'] as String?,
      targetBoundaryName: pp?['target_boundary_name'] as String?,
      partyName: party?['name'] as String?,
      bio: pp?['bio'] as String?,
      avatarUrl: pp?['avatar_url'] as String?,
      photoUrl: pp?['photo_url'] as String?,
      contactEmail: pp?['contact_email'] as String?,
      contactPhone: pp?['contact_phone'] as String?,
      sourceUrl: pp?['source_url'] as String?,
    );
  }
}
