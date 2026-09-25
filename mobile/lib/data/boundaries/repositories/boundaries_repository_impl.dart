import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

import '../../../core/errors/app_failure.dart';
import '../../../core/errors/result.dart';
import '../../../domain/boundaries/entities/map_shape.dart';
import '../../../domain/boundaries/entities/matched_boundary.dart';
import '../../../domain/boundaries/repositories/boundaries_repository.dart';
import '../datasources/boundaries_remote_data_source.dart';
import '../models/matched_boundary_model.dart';

class BoundariesRepositoryImpl implements BoundariesRepository {
  const BoundariesRepositoryImpl(this._remote);

  final BoundariesRemoteDataSource _remote;

  @override
  Future<Result<List<MatchedBoundary>>> findBoundariesByPoint({
    required double lat,
    required double lng,
  }) async {
    try {
      final rows = await _remote.findBoundariesByPoint(lat, lng);
      return Result.ok(
        rows
            .cast<Map<String, dynamic>>()
            .map((r) => r.toMatchedBoundary())
            .toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> syncUserBoundaryMemberships({
    required double lat,
    required double lng,
  }) async {
    try {
      await _remote.syncUserBoundaryMemberships(lat, lng);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<MapShape>> getMapShapeById(int shapeId) async {
    try {
      final row = await _remote.getMapShapeById(shapeId);
      return Result.ok(row.toMapShape());
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<List<MapShape>>> getShapeContainers(int shapeId) async {
    try {
      final rows = await _remote.getShapeContainers(shapeId);
      final shapes = rows
          .cast<Map<String, dynamic>>()
          .map((r) => r['map_shapes'] as Map<String, dynamic>?)
          .whereType<Map<String, dynamic>>()
          .map((s) => s.toMapShape())
          .toList();
      return Result.ok(shapes);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<MapShape?>> getNationalShapeForCountry(String country) async {
    try {
      final row = await _remote.getNationalShapeForCountry(country);
      return Result.ok(row?.toMapShape());
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }
}
