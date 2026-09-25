import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

import '../../../core/errors/app_failure.dart';
import '../../../core/errors/result.dart';
import '../../../domain/feed/repositories/feed_repository.dart';
import '../../../domain/posts/entities/post.dart';
import '../../posts/models/post_model.dart';
import '../datasources/feed_remote_data_source.dart';

class FeedRepositoryImpl implements FeedRepository {
  const FeedRepositoryImpl(this._remote);

  final FeedRemoteDataSource _remote;

  List<Post> _mapPosts(List<dynamic> rows) =>
      rows.cast<Map<String, dynamic>>().map((r) => r.toPost()).toList();

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
      return Result.ok(_mapPosts(rows));
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
      return Result.ok(_mapPosts(rows));
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
      return Result.ok(_mapPosts(rows));
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> createFeedPost(String content) async {
    try {
      await _remote.createFeedPost(content);
      return const Result.ok(null);
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
}
