import 'dart:typed_data';

import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

import '../../../core/errors/app_failure.dart';
import '../../../core/errors/result.dart';
import '../../../core/utils/slugs.dart';
import '../../../domain/profile/entities/boundary_membership.dart';
import '../../../domain/profile/entities/politician_details.dart';
import '../../../domain/profile/entities/user_profile.dart';
import '../../../domain/profile/repositories/profile_repository.dart';
import '../datasources/profile_remote_data_source.dart';
import '../models/user_profile_model.dart';

class ProfileRepositoryImpl implements ProfileRepository {
  const ProfileRepositoryImpl(this._remote);

  final ProfileRemoteDataSource _remote;

  @override
  Future<Result<List<BoundaryMembership>>> getUserBoundaryMemberships(
    String userId,
  ) async {
    try {
      final rows = await _remote.getUserBoundaryMemberships(userId);
      return Result.ok(
        rows
            .cast<Map<String, dynamic>>()
            .map((r) => r.toBoundaryMembership())
            .toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  Future<UserProfile> _withWallSlug(Map<String, dynamic> row) async {
    final role = UserRole.fromDb(row['role'] as String? ?? 'normal');
    if (role != UserRole.politician) return row.toProfileEntity();
    final wallInfo = await _remote.getPoliticianWallInfo(row['id'] as String);
    return row.toProfileEntity(
      politicianWallSlug: wallInfo?['wall_slug'] as String?,
      politicianAvatarUrl: wallInfo?['avatar_url'] as String?,
    );
  }

  @override
  Future<Result<UserProfile>> fetchOrHealProfile(String userId) async {
    try {
      var row = await _remote.getOwnProfile(userId);
      row ??= await _remote.createDefaultProfile(userId);
      return Result.ok(await _withWallSlug(row));
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<UserProfile>> getOwnProfile(String userId) async {
    try {
      final row = await _remote.getOwnProfile(userId);
      if (row == null) {
        return const Result.err(UnknownFailure('Profile not found.'));
      }
      return Result.ok(await _withWallSlug(row));
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> upsertProfileCore({
    required String userId,
    required UserRole role,
    String? fullName,
    String? country,
    String? constituency,
    bool? onboardingCompleted,
  }) async {
    try {
      final row = <String, dynamic>{
        'id': userId,
        'role': role.toDb(),
        'full_name': fullName,
        'country': country,
        'constituency': constituency,
        'updated_at': DateTime.now().toIso8601String(),
      };
      if (onboardingCompleted != null) {
        row['onboarding_completed'] = onboardingCompleted;
      }
      await _remote.upsertProfileCore(row);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<PoliticianDetails?>> getPoliticianDetails(String userId) async {
    try {
      final row = await _remote.getPoliticianProfileRow(userId);
      if (row == null) return const Result.ok(null);
      return Result.ok(
        PoliticianDetails(
          politicalPartyId: (row['political_party_id'] as num?)?.toInt(),
          education: row['education'] as String?,
          hometown: row['hometown'] as String?,
          bio: row['bio'] as String?,
          avatarUrl: row['avatar_url'] as String?,
          targetBoundaryId: row['target_boundary_id']?.toString(),
          targetBoundaryName: row['target_boundary_name'] as String?,
          politicalTargetRole: row['political_target_role'] as String?,
          wallSlug: row['wall_slug'] as String?,
        ),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<String>> uploadAvatar(
    String userId,
    Uint8List bytes,
    String fileExtension,
  ) async {
    try {
      return Result.ok(
        await _remote.uploadAvatar(userId, bytes, fileExtension),
      );
    } on supabase.StorageException catch (e) {
      return Result.err(ServerFailure(e.message));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
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
  }) async {
    try {
      final existing = await _remote.getPoliticianProfileRow(userId);
      final currentProfile = await _remote.getOwnProfile(userId);
      final fullName = currentProfile?['full_name'] as String?;

      // Provided value wins, otherwise the stored one survives; an empty
      // string is an explicit clear (stored as null, like the web's
      // `education || null`).
      String? merge(String? provided, String? stored) =>
          provided == null ? stored : (provided.isEmpty ? null : provided);

      final role = merge(
        politicalTargetRole,
        existing?['political_target_role'] as String?,
      );
      // The web recomputes wall_slug from name + target role on every save
      // (`buildPoliticianWallSlug`) — ported as-is, but fed the MERGED role
      // so an edit that doesn't touch the office title doesn't rewrite
      // "jane-doe-councillor" into "jane-doe".
      final computedSlug = Slugs.buildPoliticianWallSlug(fullName, role);
      // Slugs the database has already disambiguated ("…-councillor-26cdbf")
      // still start with the computed base — keep them rather than
      // rewriting a working public URL back to the bare base.
      final storedSlug = existing?['wall_slug'] as String?;
      final wallSlug = storedSlug != null && storedSlug.startsWith(computedSlug)
          ? storedSlug
          : computedSlug;

      await _remote.upsertPoliticianProfile({
        'id': userId,
        'wall_slug': wallSlug,
        'target_boundary_id':
            targetBoundaryId ?? existing?['target_boundary_id'],
        'target_boundary_name': merge(
          targetBoundaryName,
          existing?['target_boundary_name'] as String?,
        ),
        'political_target_role': role,
        'political_party_id':
            politicalPartyId ?? existing?['political_party_id'],
        'education': merge(education, existing?['education'] as String?),
        'hometown': merge(hometown, existing?['hometown'] as String?),
        'bio': bio ?? existing?['bio'],
        'avatar_url': merge(avatarUrl, existing?['avatar_url'] as String?),
        'updated_at': DateTime.now().toIso8601String(),
      });
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<int>> calculateMyScore() async {
    try {
      return Result.ok(await _remote.calculateMyScore());
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> burnGhostIdentity() async {
    try {
      await _remote.burnGhostIdentity();
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }
}
