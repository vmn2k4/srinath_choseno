import 'package:flutter/foundation.dart';

/// A `user_boundary_memberships` row joined with its shape — port of
/// `getUserBoundaryMemberships` (src/lib/services/profile.ts). Drives
/// Feed's per-boundary tabs (§4.D).
@immutable
class BoundaryMembership {
  const BoundaryMembership({
    required this.shapeId,
    required this.name,
    this.country,
    this.boundaryType,
  });

  final int shapeId;
  final String name;
  final String? country;
  final String? boundaryType;
}
