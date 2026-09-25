import '../../../core/errors/result.dart';
import '../../posts/entities/post.dart';

abstract interface class FeedRepository {
  Future<Result<List<Post>>> getMembershipScopedPosts(
    List<int> shapeIds, {
    int limit = 50,
    int offset = 0,
  });
  Future<Result<List<Post>>> getCountryScopedPosts(
    String country, {
    int limit = 50,
    int offset = 0,
  });
  Future<Result<List<Post>>> getInternationalScopedPosts({
    int limit = 50,
    int offset = 0,
  });

  /// RPC `create_post` — resolves `ghost_id` from `auth.uid()` server-side
  /// and enforces the politician daily-post limit. Never merge with
  /// Politician Wall's `createWallPost` (a different RPC, exempt from that
  /// limit — see docs/FLUTTER_MOBILE_APP_GUIDE.md §6 in the parent repo).
  Future<Result<void>> createFeedPost(String content);

  /// RPC `vote_on_post` — a toggle server-side (voting the same type again
  /// removes the vote). Returns the authoritative post-vote counts read
  /// back after the call, since a naive client-side +1 drifts the instant
  /// someone un-votes.
  Future<Result<({int likes, int dislikes})>> voteOnPost(
    String postId,
    int voteType,
  );

  /// RPC `create_comment` — resolves `ghost_id` server-side, enforces a
  /// rate limit. Direct inserts are blocked by RLS (§6's "comments are
  /// RPC-only, everywhere" gotcha) — never build a fallback around that.
  Future<Result<void>> createComment(String postId, String content);
}
