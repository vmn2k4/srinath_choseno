import 'dart:typed_data';

import '../../../core/errors/result.dart';
import '../../posts/entities/post.dart';
import '../../posts/entities/post_detail.dart';
import '../../posts/entities/post_draft.dart';

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
  Future<Result<void>> createFeedPost(PostDraft draft);

  /// Storage upload to `post-images` (`posts/{ghostId}-{ts}.{ext}`) —
  /// returns the public URL to pass in [PostDraft.imageUrl].
  Future<Result<String>> uploadPostImage(
    Uint8List bytes,
    String fileExtension,
    String ghostId,
  );

  /// Storage upload to `politician_videos` — returns the public URL to pass
  /// in [PostDraft.videoUrl].
  Future<Result<String>> uploadPostVideo(Uint8List bytes, String fileExtension);

  /// @mention autocomplete: politicians whose name contains [query].
  Future<Result<List<TaggablePolitician>>> searchTaggablePoliticians(
    String query, {
    String? viewerCountry,
  });

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

  /// One post (with comments, districts and the viewer's right to comment)
  /// for the page a shared link opens. Null when it doesn't exist.
  Future<Result<PostDetail?>> getPostDetail(String postId);

  /// RPC `report_content` — [targetType] is `post` or `comment`.
  Future<Result<void>> reportContent(
    String targetType,
    String targetId,
    String abuseType,
  );

  /// RPC `block_author` — hides the author's content from the caller.
  Future<Result<void>> blockAuthor(String targetType, String targetId);

  /// RPC `my_blocked_ghost_ids` — authors the caller has blocked.
  Future<Result<Set<String>>> getBlockedGhostIds();
}
