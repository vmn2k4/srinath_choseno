// Near-1:1 port of src/lib/services/profile.ts's profiles-table functions.
// See profile_repository.dart for which Admin-only branch was deliberately
// dropped.
import 'dart:typed_data';

import 'package:supabase_flutter/supabase_flutter.dart';

class ProfileRemoteDataSource {
  const ProfileRemoteDataSource(this._client);

  final SupabaseClient _client;

  Future<Map<String, dynamic>?> getOwnProfile(String userId) {
    return _client.from('profiles').select().eq('id', userId).maybeSingle();
  }

  Future<Map<String, dynamic>> createDefaultProfile(String userId) async {
    return await _client
        .from('profiles')
        .upsert({'id': userId, 'role': 'normal'})
        .select()
        .single();
  }

  Future<List<dynamic>> getUserBoundaryMemberships(String userId) {
    return _client
        .from('user_boundary_memberships')
        .select('map_shape_id, map_shapes(id, name, country, boundary_type)')
        .eq('profile_id', userId);
  }

  /// Wall slug + avatar in one round trip — the avatar is what lets the
  /// bottom nav's Profile tab show a real photo for a politician instead
  /// of the generic person icon (citizens have no avatar, by design —
  /// everything they post is anonymous).
  Future<Map<String, dynamic>?> getPoliticianWallInfo(String userId) {
    return _client
        .from('politician_profiles')
        .select('wall_slug, avatar_url')
        .eq('id', userId)
        .maybeSingle();
  }

  Future<Map<String, dynamic>?> getPoliticianProfileRow(String userId) {
    return _client
        .from('politician_profiles')
        .select(
          'political_party_id, education, hometown, bio, avatar_url, target_boundary_id, target_boundary_name, political_target_role, wall_slug',
        )
        .eq('id', userId)
        .maybeSingle();
  }

  static const _avatarBucket = 'politician-avatars';

  Future<String> uploadAvatar(
    String userId,
    Uint8List bytes,
    String fileExtension,
  ) async {
    final path =
        '$userId-${DateTime.now().millisecondsSinceEpoch}.$fileExtension';
    await _client.storage
        .from(_avatarBucket)
        .uploadBinary(
          path,
          bytes,
          fileOptions: FileOptions(contentType: 'image/$fileExtension'),
        );
    return _client.storage.from(_avatarBucket).getPublicUrl(path);
  }

  Future<void> upsertProfileCore(Map<String, dynamic> row) {
    return _client.from('profiles').upsert(row);
  }

  Future<void> upsertPoliticianProfile(Map<String, dynamic> row) {
    return _client.from('politician_profiles').upsert(row);
  }

  Future<int> calculateMyScore() async {
    final result = await _client.rpc('calculate_my_score');
    return (result as num).toInt();
  }

  Future<void> burnGhostIdentity() => _client.rpc('burn_ghost_identity');
}
