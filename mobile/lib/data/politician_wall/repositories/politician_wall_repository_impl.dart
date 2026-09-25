import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

import '../../../core/errors/app_failure.dart';
import '../../../core/errors/result.dart';
import '../../../domain/politician_wall/entities/politician_wall_profile.dart';
import '../../../domain/politician_wall/repositories/politician_wall_repository.dart';
import '../../../domain/posts/entities/post.dart';
import '../../posts/models/post_model.dart';
import '../datasources/politician_wall_remote_data_source.dart';
import '../models/politician_wall_profile_model.dart';

class PoliticianWallRepositoryImpl implements PoliticianWallRepository {
  const PoliticianWallRepositoryImpl(this._remote);

  final PoliticianWallRemoteDataSource _remote;

  @override
  Future<Result<PoliticianWallProfile>> getWallOwnerProfile(
    String ghostId,
  ) async {
    try {
      final row = await _remote.getWallOwnerProfile(ghostId);
      if (row == null) {
        return const Result.err(
          UnknownFailure('This wall could not be found.'),
        );
      }
      return Result.ok(row.toPoliticianWallProfile());
    } on supabase.PostgrestException catch (e) {
      debugPrint('[wall] getWallOwnerProfile failed: ${e.code} ${e.message}');
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (e, st) {
      debugPrint('[wall] getWallOwnerProfile failed: $e\n$st');
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<PoliticianWallProfile>> getWallOwnerProfileBySlug(
    String wallSlug,
  ) async {
    try {
      final row = await _remote.getWallOwnerProfileBySlug(wallSlug);
      if (row == null) {
        return const Result.err(
          UnknownFailure('This wall could not be found.'),
        );
      }
      return Result.ok(row.toPoliticianWallProfile());
    } on supabase.PostgrestException catch (e) {
      debugPrint(
        '[wall] getWallOwnerProfileBySlug failed: ${e.code} ${e.message}',
      );
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (e, st) {
      debugPrint('[wall] getWallOwnerProfileBySlug failed: $e\n$st');
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<int>> getSupporterCount(String politicianId) async {
    try {
      final results = await Future.wait([
        _remote.getAuthenticatedSupporterCount(politicianId),
        _remote.getAnonymousSupporterCount(politicianId),
      ]);
      return Result.ok(results[0] + results[1]);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<bool>> getSupportStatus({
    required String politicianId,
    required String supporterId,
  }) async {
    try {
      final row = await _remote.getSupportStatus(politicianId, supporterId);
      return Result.ok(row != null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> addSupport({
    required String politicianId,
    required String supporterId,
  }) async {
    try {
      await _remote.addSupport(politicianId, supporterId);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> withdrawSupport({
    required String politicianId,
    required String supporterId,
  }) async {
    try {
      await _remote.withdrawSupport(politicianId, supporterId);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<List<Post>>> getWallPosts(
    String ghostId, {
    int limit = 20,
    int offset = 0,
  }) async {
    try {
      final rows = await _remote.getWallPosts(
        ghostId,
        limit: limit,
        offset: offset,
      );
      return Result.ok(
        rows.cast<Map<String, dynamic>>().map((r) => r.toPost()).toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }
}
