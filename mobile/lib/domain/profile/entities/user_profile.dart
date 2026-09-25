// Domain entity for a `profiles` row. Deliberately excludes the Admin role
// correction the website's `fetchOrHealProfile` (src/lib/services/profile.ts)
// performs for one hardcoded email — Admin is explicitly out of scope for
// this app (see docs/FLUTTER_MOBILE_APP_GUIDE.md §0 in the parent repo:
// "the fourth role, Admin, is explicitly excluded"), so that branch isn't
// ported here. `UserRole.admin` still exists in the enum only so a
// deserialized row with that value doesn't crash — nothing in this app
// grants admin capability.
import 'package:flutter/foundation.dart';

import '../../../core/utils/slugs.dart';

enum UserRole {
  normal,
  politician,
  admin;

  static UserRole fromDb(String value) => switch (value) {
    'politician' => UserRole.politician,
    'admin' => UserRole.admin,
    _ => UserRole.normal,
  };

  String toDb() => switch (this) {
    UserRole.normal => 'normal',
    UserRole.politician => 'politician',
    UserRole.admin => 'admin',
  };
}

@immutable
class UserProfile {
  const UserProfile({
    required this.id,
    required this.role,
    required this.onboardingCompleted,
    this.fullName,
    this.country,
    this.constituency,
    this.politicianWallSlug,
    this.currentGhostId,
    this.politicianAvatarUrl,
    this.designation,
  });

  final String id;
  final UserRole role;
  final bool onboardingCompleted;
  final String? fullName;
  final String? country;

  /// `profiles.designation` — a politician's target office/role title
  /// (e.g. "Councillor - Vancouver"), used only as an input to
  /// [buildPoliticianWallSlug] below. Not otherwise surfaced anywhere in
  /// this app yet.
  final String? designation;

  /// The active anonymous identity everything the citizen posts is signed
  /// with — burnable via [ProfileRepository.burnGhostIdentity]. Null only
  /// transiently (e.g. a not-yet-fully-loaded row); every real profile has
  /// one from signup.
  final String? currentGhostId;

  /// Comma-joined boundary names — matches the website's
  /// `profiles.constituency` free-text column (a display convenience, not
  /// the source of truth; `user_boundary_memberships`, ported by the
  /// Boundaries domain, is the real membership list).
  final String? constituency;

  /// Only populated for a politician account — joined from
  /// `politician_profiles.wall_slug`, mirroring `fetchOrHealProfile`'s
  /// `politician_wall_slug` field on the web.
  final String? politicianWallSlug;

  /// Only populated for a politician account — joined from
  /// `politician_profiles.avatar_url` alongside the wall slug. Citizens
  /// never have one (everything they post is anonymous by design, see
  /// `currentGhostId`'s doc comment) — the bottom nav's Profile tab uses
  /// this to show a real photo for a politician and falls back to a
  /// generic icon otherwise, never a blank/broken image.
  final String? politicianAvatarUrl;

  /// A politician's "My Wall" link always resolves to something, even
  /// before `politician_wall_slug` is assigned — mirrors the website's
  /// `profile.politician_wall_slug || buildPoliticianWallSlug(...)`
  /// fallback (NavBar.tsx). Null for a citizen, who has no wall.
  String? get myWallSlug {
    if (role != UserRole.politician) return null;
    return politicianWallSlug ??
        Slugs.buildPoliticianWallSlug(fullName, designation);
  }

  UserProfile copyWith({
    bool? onboardingCompleted,
    String? fullName,
    String? country,
    String? constituency,
  }) {
    return UserProfile(
      id: id,
      role: role,
      onboardingCompleted: onboardingCompleted ?? this.onboardingCompleted,
      fullName: fullName ?? this.fullName,
      country: country ?? this.country,
      constituency: constituency ?? this.constituency,
      politicianWallSlug: politicianWallSlug,
      currentGhostId: currentGhostId,
      politicianAvatarUrl: politicianAvatarUrl,
      designation: designation,
    );
  }
}
