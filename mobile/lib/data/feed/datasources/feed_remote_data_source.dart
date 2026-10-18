// Port of src/lib/services/feed.ts's three scoped-post queries + write
// actions. `is_test` handling mirrors the web's `isDevEnvironment()`
// (see core/config/app_environment.dart): filtered out in a release
// build, left alone (and written as `true`) in a debug build.
// NOT ported yet: `hydratePoliticianAuthors`/`hydratePostMentions`
// (politician-authorship enrichment for display), `uploadPostImage`
// (composer is text-only for now — see the Feed screen's header comment).
import 'dart:typed_data';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/config/app_environment.dart';
import '../../../domain/posts/entities/post_draft.dart';
import '../../../domain/posts/entities/post.dart';
import '../../posts/politician_authors.dart';

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

  Future<void> createFeedPost(PostDraft draft) {
    return _client.rpc(
      'create_post',
      params: {
        'p_content': draft.content,
        'p_is_test': AppEnvironment.isDev,
        if (draft.imageUrl != null) 'p_image_url': draft.imageUrl,
        if (draft.videoUrl != null) 'p_video_url': draft.videoUrl,
        if (draft.linkMetadata != null) 'p_link_metadata': draft.linkMetadata,
        if (draft.mentionedPoliticianIds.isNotEmpty)
          'p_mentioned_politician_ids': draft.mentionedPoliticianIds,
        if (draft.boundaryIds.isNotEmpty) 'p_boundary_ids': draft.boundaryIds,
      },
    );
  }

  /// Port of `uploadPostImage` — same bucket and `posts/{ghostId}-{ts}.{ext}`
  /// path as the web.
  Future<String> uploadPostImage(
    Uint8List bytes,
    String fileExtension,
    String ghostId,
  ) async {
    final path =
        'posts/$ghostId-${DateTime.now().millisecondsSinceEpoch}.$fileExtension';
    await _client.storage
        .from('post-images')
        .uploadBinary(
          path,
          bytes,
          fileOptions: FileOptions(
            contentType: switch (fileExtension.toLowerCase()) {
              'jpg' || 'jpeg' => 'image/jpeg',
              'heic' => 'image/heic',
              final ext => 'image/$ext',
            },
          ),
        );
    return _client.storage.from('post-images').getPublicUrl(path);
  }

  /// Same bucket and `video_{ts}.{ext}` naming as the web VideoRecorder and
  /// the candidate intro-video upload.
  Future<String> uploadPostVideo(Uint8List bytes, String fileExtension) async {
    final fileName =
        'video_${DateTime.now().millisecondsSinceEpoch}.$fileExtension';
    await _client.storage
        .from('politician_videos')
        .uploadBinary(
          fileName,
          bytes,
          fileOptions: FileOptions(
            contentType: switch (fileExtension.toLowerCase()) {
              'mov' => 'video/quicktime',
              '3gp' => 'video/3gpp',
              final ext => 'video/$ext',
            },
          ),
        );
    return _client.storage.from('politician_videos').getPublicUrl(fileName);
  }

  /// Port of `searchTaggablePoliticians` (country-tier ordering only — the
  /// web's local-boundary tier needs the viewer's memberships).
  Future<List<dynamic>> searchTaggablePoliticians(
    String query, {
    int limit = 24,
    int offset = 0,
    String? country,
  }) {
    var q = _client
        .from('profiles')
        .select(
          'id, full_name, country, politician_profiles(avatar_url, photo_url), office_holders!office_holders_linked_profile_id_fkey(is_current, map_shapes(name), election_role_types(role_title))',
        )
        .eq('role', 'politician')
        .ilike('full_name', '%$query%');
    if (!AppEnvironment.isDev) q = q.eq('is_test', false);
    if (country != null) q = q.eq('country', country);
    return q
        .order('full_name', ascending: true)
        .range(offset, offset + limit - 1);
  }

  /// Current office holders of the given districts (the viewer's own), each
  /// with the profile an @mention resolves to and the office they hold.
  Future<List<dynamic>> getLocalOfficials(List<int> shapeIds) {
    if (shapeIds.isEmpty) return Future.value(const []);
    return _client
        .from('office_holders')
        .select(
          'map_shape_id, election_role_types(role_title), map_shapes(name), profiles!office_holders_linked_profile_id_fkey(id, full_name, is_test, politician_profiles(avatar_url, photo_url))',
        )
        .inFilter('map_shape_id', shapeIds)
        .eq('is_current', true)
        .not('linked_profile_id', 'is', null);
  }

  Future<Map<String, dynamic>?> getPostDetailRow(String postId) {
    var query = _client
        .from('posts')
        .select(
          '*, comments(id, ghost_id, content, created_at), post_boundaries(map_shapes(name)), news_articles(slug, event_date, published_at, hero_image_url)',
        )
        .eq('id', postId);
    if (!AppEnvironment.isDev) query = query.eq('is_test', false);
    return query.maybeSingle();
  }

  Future<bool> canCommentOnPost(String postId) async {
    final result = await _client.rpc(
      'can_comment_on_post',
      params: {'p_post_id': postId},
    );
    return result == true;
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

  Future<void> reportContent(String type, String id, String abuseType) {
    return _client.rpc(
      'report_content',
      params: {
        'p_target_type': type,
        'p_target_id': id,
        'p_abuse_type': abuseType,
      },
    );
  }

  Future<void> blockAuthor(String type, String id) {
    return _client.rpc(
      'block_author',
      params: {'p_target_type': type, 'p_target_id': id},
    );
  }

  Future<Set<String>> getBlockedGhostIds() async {
    final rows = await _client.rpc('my_blocked_ghost_ids') as List<dynamic>;
    return {for (final r in rows) r.toString()};
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

  /// Real names for posts authored by politicians (see politician_authors.dart).
  /// A failed lookup just leaves the anonymous label — never fails the feed.
  Future<Map<String, PoliticianAuthor>> getPoliticianAuthors(
    Iterable<String> ghostIds,
  ) async {
    try {
      return await fetchPoliticianAuthors(_client, ghostIds);
    } catch (_) {
      return const {};
    }
  }
}
