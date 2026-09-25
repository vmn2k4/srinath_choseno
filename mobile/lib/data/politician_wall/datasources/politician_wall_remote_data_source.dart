// Port of src/lib/services/politicianWall.ts's read + support functions.
// Deliberately does NOT port `enrichProfileWithContactFallback` (a
// bio-text-mining fallback for legacy imported profiles missing structured
// contact fields) — same "known, documented gap" pattern as
// elections_remote_data_source.dart's skipped `enrichOfficeHolders`.
// `is_test` handling mirrors the web's `isDevEnvironment()` (see
// core/config/app_environment.dart) — filtered in a release build, left
// alone in a debug build so a developer's own `is_test` account can open
// its own wall instead of 404ing on itself.
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/config/app_environment.dart';

const _profileColumns = '''
  id, current_ghost_id, full_name, role, constituency, country,
  politician_profiles (
    wall_slug, political_target_role, target_boundary_name, target_boundary_id, target_boundary_type,
    political_party_id, bio, avatar_url, contact_email, contact_phone, photo_url, source_url, holding_since,
    political_parties ( name )
  )
''';

/// Same columns, but `politician_profiles!inner` — the web's slug lookups
/// (`getWallOwnerProfileBySlug`) use the inner join so that filtering on
/// `politician_profiles.wall_slug` actually RESTRICTS the returned profiles.
/// With a plain (left) embed, PostgREST only filters the embedded rows and
/// still returns every profile with `politician_profiles: null` — thousands
/// of rows, which `.maybeSingle()` then rejects, so no wall was ever found.
final _profileColumnsInner = _profileColumns.replaceFirst(
  'politician_profiles (',
  'politician_profiles!inner (',
);

bool _isUuid(String value) => RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  caseSensitive: false,
).hasMatch(value);

class PoliticianWallRemoteDataSource {
  const PoliticianWallRemoteDataSource(this._client);

  final SupabaseClient _client;

  Future<Map<String, dynamic>?> getWallOwnerProfile(String ghostId) {
    var query = _client.from('profiles').select(_profileColumns);
    query = _isUuid(ghostId)
        ? query.or('current_ghost_id.eq.$ghostId,id.eq.$ghostId')
        : query.eq('current_ghost_id', ghostId);
    if (!AppEnvironment.isDev) query = query.eq('is_test', false);
    return query.maybeSingle();
  }

  Future<Map<String, dynamic>?> getWallOwnerProfileBySlug(
    String wallSlug,
  ) async {
    // 0. A merged imported wall keeps its old slug as a public redirect —
    // resolve this first so an old link can't land on an archived
    // synthetic profile.
    final redirect = await _client
        .from('office_holder_wall_redirects')
        .select('target_profile_id')
        .eq('old_wall_slug', wallSlug)
        .eq('active', true)
        .maybeSingle();
    if (redirect != null) {
      var redirectedQuery = _client
          .from('profiles')
          .select(_profileColumnsInner)
          .eq('id', redirect['target_profile_id'] as String);
      if (!AppEnvironment.isDev) {
        redirectedQuery = redirectedQuery.eq('is_test', false);
      }
      final redirected = await redirectedQuery.maybeSingle();
      if (redirected != null) return redirected;
    }

    // 1. Exact wall_slug match.
    var exactQuery = _client
        .from('profiles')
        .select(_profileColumnsInner)
        .eq('politician_profiles.wall_slug', wallSlug);
    if (!AppEnvironment.isDev) exactQuery = exactQuery.eq('is_test', false);
    final exact = await exactQuery.maybeSingle();
    if (exact != null) return exact;

    // 2. Fallback: slug hyphens -> spaces as a full_name match, preferring
    // the highest-office match when several people share a name.
    final nameFromSlug = wallSlug.replaceAll('-', ' ');
    var nameQuery = _client
        .from('profiles')
        .select(_profileColumnsInner)
        .ilike('full_name', nameFromSlug);
    if (!AppEnvironment.isDev) nameQuery = nameQuery.eq('is_test', false);
    final nameMatches = await nameQuery
        .order('created_at', ascending: false)
        .limit(5);
    if (nameMatches.isNotEmpty) {
      final highOfficePattern = RegExp(
        'prime minister|president|premier|governor|mayor|senator',
        caseSensitive: false,
      );
      final typedMatches = nameMatches.cast<Map<String, dynamic>>();
      final primary = typedMatches.firstWhere(
        (p) => highOfficePattern.hasMatch(
          ((p['politician_profiles']
                      as Map<String, dynamic>?)?['political_target_role']
                  as String?) ??
              '',
        ),
        orElse: () => typedMatches.first,
      );
      return primary;
    }

    // 3. Fallback: the slug is itself a UUID (profile id or ghost id).
    if (_isUuid(wallSlug)) {
      var uuidQuery = _client
          .from('profiles')
          .select(_profileColumnsInner)
          .or('id.eq.$wallSlug,current_ghost_id.eq.$wallSlug');
      if (!AppEnvironment.isDev) uuidQuery = uuidQuery.eq('is_test', false);
      return uuidQuery.maybeSingle();
    }

    return null;
  }

  Future<int> getAuthenticatedSupporterCount(String politicianId) async {
    final count = await _client
        .from('politician_supporters')
        .count(CountOption.exact)
        .eq('politician_id', politicianId);
    return count;
  }

  Future<int> getAnonymousSupporterCount(String politicianId) async {
    final count = await _client
        .from('anonymous_supporters')
        .count(CountOption.exact)
        .eq('politician_id', politicianId);
    return count;
  }

  Future<Map<String, dynamic>?> getSupportStatus(
    String politicianId,
    String supporterId,
  ) {
    return _client
        .from('politician_supporters')
        .select('supporter_id')
        .eq('politician_id', politicianId)
        .eq('supporter_id', supporterId)
        .maybeSingle();
  }

  Future<void> addSupport(String politicianId, String supporterId) {
    return _client.from('politician_supporters').insert({
      'politician_id': politicianId,
      'supporter_id': supporterId,
      'is_test': AppEnvironment.isDev,
    });
  }

  Future<void> withdrawSupport(String politicianId, String supporterId) {
    return _client
        .from('politician_supporters')
        .delete()
        .eq('politician_id', politicianId)
        .eq('supporter_id', supporterId);
  }

  Future<List<dynamic>> getWallPosts(
    String ghostId, {
    required int limit,
    required int offset,
  }) {
    var query = _client
        .from('posts')
        .select('*, comments(id)')
        .or('ghost_id.eq.$ghostId,wall_ghost_id.eq.$ghostId');
    if (!AppEnvironment.isDev) query = query.eq('is_test', false);
    return query
        .order('created_at', ascending: false)
        .range(offset, offset + limit - 1);
  }
}
