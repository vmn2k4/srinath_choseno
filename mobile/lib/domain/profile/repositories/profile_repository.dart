import 'dart:typed_data';

import '../../../core/errors/result.dart';
import '../entities/boundary_membership.dart';
import '../entities/politician_details.dart';
import '../entities/user_profile.dart';

abstract interface class ProfileRepository {
  Future<Result<List<BoundaryMembership>>> getUserBoundaryMemberships(
    String userId,
  );

  /// Ports `fetchOrHealProfile` (src/lib/services/profile.ts) minus its
  /// Admin-email correction branch (see user_profile.dart's header
  /// comment) — self-heals a missing `profiles` row on first login and
  /// folds in `politician_profiles.wall_slug` for a politician account.
  /// Called once at session start and on every auth state change, same as
  /// the website's `AuthContext`.
  Future<Result<UserProfile>> fetchOrHealProfile(String userId);

  Future<Result<UserProfile>> getOwnProfile(String userId);

  Future<Result<void>> upsertProfileCore({
    required String userId,
    required UserRole role,
    String? fullName,
    String? country,
    String? constituency,
    bool? onboardingCompleted,
  });

  /// The politician's current `politician_profiles` row (null for an
  /// account that has none yet) — see [PoliticianDetails].
  Future<Result<PoliticianDetails?>> getPoliticianDetails(String userId);

  /// Uploads a profile photo to the `politician-avatars` bucket (same
  /// bucket + `<userId>-<timestamp>.<ext>` naming as the web's
  /// `uploadAvatarImage`) and returns its public URL.
  Future<Result<String>> uploadAvatar(
    String userId,
    Uint8List bytes,
    String fileExtension,
  );

  /// Upserts the politician row, MERGING with what's already stored: a
  /// null argument means "not provided, keep the existing value", never
  /// "clear it" (an empty string clears). The web's version writes every
  /// column, but its callers always pass the full existing profile — this
  /// app's Edit Profile doesn't edit every field, so the merge happens
  /// here instead.
  Future<Result<void>> upsertPoliticianProfile({
    required String userId,
    int? politicalPartyId,
    String? education,
    String? hometown,
    String? bio,
    String? avatarUrl,
    String? targetBoundaryId,
    String? targetBoundaryName,
    String? politicalTargetRole,
  });

  /// RPC `calculate_my_score` — banked `civic_score` plus the current
  /// (still-live) ghost identity's contribution, recomputed live rather
  /// than read from a stale column.
  Future<Result<int>> calculateMyScore();

  /// RPC `burn_ghost_identity` — banks the outgoing ghost's score
  /// contribution, then rotates to a brand-new anonymous id. Destructive
  /// and irreversible: every past post/comment stays attached to the old
  /// (now orphaned) ghost id forever. Shared by Feed's "Burn Identity" and
  /// Profile's "Rotate Ghost ID" — same action, two labels (§4.E).
  Future<Result<void>> burnGhostIdentity();
}
