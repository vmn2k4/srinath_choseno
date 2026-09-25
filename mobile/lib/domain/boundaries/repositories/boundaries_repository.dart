import '../../../core/errors/result.dart';
import '../entities/map_shape.dart';
import '../entities/matched_boundary.dart';

abstract interface class BoundariesRepository {
  /// RPC `find_boundaries_by_point` — every boundary a point falls inside,
  /// not just the most specific one.
  Future<Result<List<MatchedBoundary>>> findBoundariesByPoint({
    required double lat,
    required double lng,
  });

  /// RPC `sync_user_boundary_memberships` — the actual persistence step;
  /// [findBoundariesByPoint] alone only previews the match, it writes
  /// nothing.
  Future<Result<void>> syncUserBoundaryMemberships({
    required double lat,
    required double lng,
  });

  Future<Result<MapShape>> getMapShapeById(int shapeId);

  /// The container shape(s) (e.g. a province) a shape sits inside — used by
  /// [ElectionsRepository.resolveRepresentationBranch]'s container-superior
  /// lookup (a riding's Province, a State's national head).
  Future<Result<List<MapShape>>> getShapeContainers(int shapeId);

  /// The single National-level shape for a country, if one exists — the
  /// anchor for a Prime Minister/President `office_holders` row.
  Future<Result<MapShape?>> getNationalShapeForCountry(String country);
}
