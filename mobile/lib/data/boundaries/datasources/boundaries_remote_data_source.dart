import 'package:supabase_flutter/supabase_flutter.dart';

class BoundariesRemoteDataSource {
  const BoundariesRemoteDataSource(this._client);

  final SupabaseClient _client;

  Future<List<dynamic>> findBoundariesByPoint(double lat, double lng) {
    return _client.rpc(
      'find_boundaries_by_point',
      params: {'lng': lng, 'lat': lat},
    );
  }

  Future<void> syncUserBoundaryMemberships(double lat, double lng) {
    return _client.rpc(
      'sync_user_boundary_memberships',
      params: {'p_lat': lat, 'p_lng': lng},
    );
  }

  Future<Map<String, dynamic>> getMapShapeById(int shapeId) {
    return _client
        .from('map_shapes')
        .select(
          'id, name, country, boundary_type, code, properties, retired_at',
        )
        .eq('id', shapeId)
        .isFilter('retired_at', null)
        .single();
  }

  Future<List<dynamic>> getShapeContainers(int shapeId) {
    return _client
        .from('shape_containers')
        .select(
          'container_shape_id, map_shapes:container_shape_id(id, name, boundary_type)',
        )
        .eq('map_shape_id', shapeId);
  }

  Future<Map<String, dynamic>?> getNationalShapeForCountry(String country) {
    return _client
        .from('map_shapes')
        .select('id, name')
        .eq('country', country)
        .eq('boundary_type', 'National')
        .isFilter('retired_at', null)
        .maybeSingle();
  }
}
