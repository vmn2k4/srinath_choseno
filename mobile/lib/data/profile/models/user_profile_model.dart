import '../../../domain/profile/entities/boundary_membership.dart';
import '../../../domain/profile/entities/user_profile.dart';

extension BoundaryMembershipMapper on Map<String, dynamic> {
  BoundaryMembership toBoundaryMembership() {
    final shape = this['map_shapes'] as Map<String, dynamic>;
    return BoundaryMembership(
      shapeId: shape['id'] as int,
      name: shape['name'] as String,
      country: shape['country'] as String?,
      boundaryType: shape['boundary_type'] as String?,
    );
  }
}

extension UserProfileMapper on Map<String, dynamic> {
  UserProfile toProfileEntity({
    String? politicianWallSlug,
    String? politicianAvatarUrl,
  }) {
    return UserProfile(
      id: this['id'] as String,
      role: UserRole.fromDb(this['role'] as String? ?? 'normal'),
      onboardingCompleted: this['onboarding_completed'] as bool? ?? false,
      fullName: this['full_name'] as String?,
      country: this['country'] as String?,
      constituency: this['constituency'] as String?,
      politicianWallSlug: politicianWallSlug,
      currentGhostId: this['current_ghost_id'] as String?,
      politicianAvatarUrl: politicianAvatarUrl,
      designation: this['designation'] as String?,
    );
  }
}
