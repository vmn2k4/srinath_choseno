// Port of src/lib/services/feed.ts's three scoped-post queries + write
// actions. `is_test` handling mirrors the web's `isDevEnvironment()`
// (see core/config/app_environment.dart): filtered out in a release
// build, left alone (and written as `true`) in a debug build.
// NOT ported yet: `hydratePoliticianAuthors`/`hydratePostMentions`
// (politician-authorship enrichment for display), `uploadPostImage`
// (composer is text-only for now — see the Feed screen's header comment).
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/config/app_environment.dart';

const _postColumns = '*, comments(*)';

class FeedRemoteDataSource {
  const FeedRemoteDataSource(this._client);

  final SupabaseClient _client;

  Future<List<dynamic>> getMembershipScopedPosts(
    List<int> shapeIds, {
    required int limit,
    required int offset,
  }) {
    if (shapeIds.isEmpty) return Future.value(const []);
    var query = _client
        .from('posts')
        .select('$_postColumns, post_boundaries!inner(map_shape_id)')
        .inFilter('post_boundaries.map_shape_id', shapeIds);
    if (!AppEnvironment.isDev) query = query.eq('is_test', false);
    return query
        .order('created_at', ascending: false)
        .range(offset, offset + limit - 1);
  }

  Future<List<dynamic>> getCountryScopedPosts(
    String country, {
    required int limit,
    required int offset,
  }) {
    var query = _client
        .from('posts')
        .select(_postColumns)
        .eq('is_country', true)
        .eq('country', country);
    if (!AppEnvironment.isDev) query = query.eq('is_test', false);
    return query
        .order('created_at', ascending: false)
        .range(offset, offset + limit - 1);
  }

  Future<List<dynamic>> getInternationalScopedPosts({
    required int limit,
    required int offset,
  }) {
    var query = _client
        .from('posts')
        .select(_postColumns)
        .eq('is_international', true);
    if (!AppEnvironment.isDev) query = query.eq('is_test', false);
    return query
        .order('created_at', ascending: false)
        .range(offset, offset + limit - 1);
  }

  Future<void> createFeedPost(String content) {
    return _client.rpc(
      'create_post',
      params: {'p_content': content, 'p_is_test': AppEnvironment.isDev},
    );
  }

  Future<void> voteOnPost(String postId, int voteType) {
    return _client.rpc(
      'vote_on_post',
      params: {'p_post_id': postId, 'p_vote_type': voteType},
    );
  }

  Future<Map<String, dynamic>> getPostVoteCounts(String postId) {
    return _client
        .from('posts')
        .select('likes_count, dislikes_count')
        .eq('id', postId)
        .single();
  }

  Future<void> createComment(String postId, String content) {
    return _client.rpc(
      'create_comment',
      params: {
        'p_post_id': postId,
        'p_content': content,
        'p_is_test': AppEnvironment.isDev,
      },
    );
  }
}
