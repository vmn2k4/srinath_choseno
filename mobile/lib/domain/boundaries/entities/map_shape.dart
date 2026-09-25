import 'package:flutter/foundation.dart';

/// Port of a `map_shapes` row (src/lib/services/boundaries.ts's
/// `getMapShapeById`/`getShapeContainers`/`getNationalShapeForCountry`).
@immutable
class MapShape {
  const MapShape({
    required this.id,
    required this.name,
    this.country,
    this.boundaryType,
    this.code,
  });

  final int id;
  final String name;
  final String? country;
  final String? boundaryType;
  final String? code;
}
