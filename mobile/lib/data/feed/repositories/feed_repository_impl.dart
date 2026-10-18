import 'dart:typed_data';

import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

import '../../../core/errors/app_failure.dart';
import '../../../core/errors/result.dart';
import '../../../domain/feed/repositories/feed_repository.dart';
import '../../../domain/posts/entities/post.dart';
import '../../../domain/posts/entities/post_detail.dart';
import '../../../domain/posts/entities/post_draft.dart';
import '../../posts/models/post_model.dart';
import '../../posts/politician_authors.dart';
import '../datasources/feed_remote_data_source.dart';

class FeedRepositoryImpl implements FeedRepository {
  const FeedRepositoryImpl(this._remote);

  final FeedRemoteDataSource _remote;

  Future<List<Post>> _mapPosts(List<dynamic> rows) async {
    final posts = rows
        .cast<Map<String, dynamic>>()
        .map((r) => r.toPost())
        .toList();
    final authors = await _remote.getPoliticianAuthors(
      posts.map((p) => p.ghostId),
    );
    return withAuthors(posts, authors);
  }

  @override
  Future<Result<List<Post>>> getMembershipScopedPosts(
    List<int> shapeIds, {
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final rows = await _remote.getMembershipScopedPosts(
        shapeIds,
        limit: limit,
        offset: offset,
      );
      return Result.ok(await _mapPosts(rows));
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<List<Post>>> getCountryScopedPosts(
    String country, {
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final rows = await _remote.getCountryScopedPosts(
        country,
        limit: limit,
        offset: offset,
      );
      return Result.ok(await _mapPosts(rows));
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<List<Post>>> getInternationalScopedPosts({
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final rows = await _remote.getInternationalScopedPosts(
        limit: limit,
        offset: offset,
      );
      return Result.ok(await _mapPosts(rows));
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> createFeedPost(PostDraft draft) async {
    try {
      await _remote.createFeedPost(draft);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<String>> uploadPostImage(
    Uint8List bytes,
    String fileExtension,
    String ghostId,
  ) async {
    try {
      return Result.ok(
        await _remote.uploadPostImage(bytes, fileExtension, ghostId),
      );
    } on supabase.StorageException catch (e) {
      return Result.err(ServerFailure(e.message));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<String>> uploadPostVideo(
    Uint8List bytes,
    String fileExtension,
  ) async {
    try {
      return Result.ok(await _remote.uploadPostVideo(bytes, fileExtension));
    } on supabase.StorageException catch (e) {
      return Result.err(ServerFailure(e.message));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<List<TaggablePolitician>>> searchTaggablePoliticians(
    String query, {
    String? viewerCountry,
    int limit = 8,
    int offset = 0,
    bool onlyCountry = false,
  }) async {
    try {
      // The inline autocomplete (default args) fetches 24 and shows 8,
      // country-first; a paged call returns exactly its page.
      final paged = limit != 8 || offset != 0;
      final rows = (await _remote.searchTaggablePoliticians(
        query,
        limit: paged ? limit : 24,
        offset: offset,
        country: onlyCountry ? viewerCountry : null,
      )).cast<Map<String, dynamic>>();
      int tier(Map<String, dynamic> r) =>
          viewerCountry != null && r['country'] == viewerCountry ? 0 : 1;
      final sorted = [...rows]..sort((a, b) => tier(a).compareTo(tier(b)));
      return Result.ok([
        for (final r in paged ? sorted : sorted.take(8))
          TaggablePolitician(
            id: r['id'] as String,
            fullName: r['full_name'] as String? ?? 'Politician',
            photoUrl: _photo(r['politician_profiles']),
          ),
      ]);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  static String? _photo(dynamic pp) {
    final m = pp is List ? (pp.isEmpty ? null : pp.first) : pp;
    if (m is! Map) return null;
    return (m['photo_url'] ?? m['avatar_url']) as String?;
  }

  @override
  Future<Result<PostDetail?>> getPostDetail(String postId) async {
    try {
      final row = await _remote.getPostDetailRow(postId);
      if (row == null) return const Result.ok(null);
      final boundaries = (row['post_boundaries'] as List?) ?? const [];
      final names = <String>{
        for (final b in boundaries)
          if ((b as Map)['map_shapes'] is Map &&
              (b['map_shapes'] as Map)['name'] != null)
            (b['map_shapes'] as Map)['name'] as String,
      }.toList();
      final canComment = await _remote.canCommentOnPost(postId);
      return Result.ok(
        PostDetail(
          post: (await _mapPosts([row])).first,
          areaNames: names,
          canComment: canComment,
        ),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<({int likes, int dislikes})>> voteOnPost(
    String postId,
    int voteType,
  ) async {
    try {
      await _remote.voteOnPost(postId, voteType);
      final row = await _remote.getPostVoteCounts(postId);
      return Result.ok((
        likes: row['likes_count'] as int? ?? 0,
        dislikes: row['dislikes_count'] as int? ?? 0,
      ));
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> createComment(String postId, String content) async {
    try {
      await _remote.createComment(postId, content);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  Future<Result<T>> _guard<T>(Future<T> Function() run) async {
    try {
      return Result.ok(await run());
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> reportContent(
    String targetType,
    String targetId,
    String abuseType,
  ) => _guard(() => _remote.reportContent(targetType, targetId, abuseType));

  @override
  Future<Result<void>> blockAuthor(String targetType, String targetId) =>
      _guard(() => _remote.blockAuthor(targetType, targetId));

  @override
  Future<Result<Set<String>>> getBlockedGhostIds() =>
      _guard(_remote.getBlockedGhostIds);
}
