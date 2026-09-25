import '../../../domain/boundaries/entities/map_shape.dart';
import '../../../domain/boundaries/entities/matched_boundary.dart';

extension MatchedBoundaryMapper on Map<String, dynamic> {
  MatchedBoundary toMatchedBoundary() {
    return MatchedBoundary(
      id: this['id'] as int,
      name: this['name'] as String,
      country: this['country'] as String?,
      boundaryType: this['boundary_type'] as String?,
    );
  }

  MapShape toMapShape() {
    return MapShape(
      id: this['id'] as int,
      name: this['name'] as String,
      country: this['country'] as String?,
      boundaryType: this['boundary_type'] as String?,
      code: this['code'] as String?,
    );
  }
}
