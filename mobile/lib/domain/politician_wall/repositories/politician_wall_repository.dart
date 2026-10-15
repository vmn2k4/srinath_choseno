import '../../../core/errors/result.dart';
import '../../posts/entities/post_draft.dart';
import '../../posts/entities/post.dart';
import '../entities/politician_wall_profile.dart';

abstract interface class PoliticianWallRepository {
  Future<Result<PoliticianWallProfile>> getWallOwnerProfile(String ghostId);
  Future<Result<PoliticianWallProfile>> getWallOwnerProfileBySlug(
    String wallSlug,
  );

  /// Combined authenticated + anonymous supporter count — the single
  /// public number every Support heart shows (see
  /// docs/FLUTTER_MOBILE_APP_GUIDE.md §4.I.7's note on this combined count
  /// in the parent repo).
  Future<Result<int>> getSupporterCount(String politicianId);

  Future<Result<bool>> getSupportStatus({
    required String politicianId,
    required String supporterId,
  });

  Future<Result<void>> addSupport({
    required String politicianId,
    required String supporterId,
  });
  Future<Result<void>> withdrawSupport({
    required String politicianId,
    required String supporterId,
  });

  /// RPC `create_wall_post` — posts on this politician's wall (identified by
  /// their current ghost id). A different RPC from the Feed's `create_post`
  /// (exempt from the politician daily-post limit); never merge the two.
  Future<Result<void>> createWallPost(String wallGhostId, PostDraft draft);

  /// The Candidacy Wall's post feed: posts tagged to the candidacy plus the
  /// candidate's own wall posts.
  Future<Result<List<Post>>> getCandidatePosts(
    String candidateId,
    String politicianId,
  );

  /// Direct insert on `posts` for a candidacy (+ `attach_post_mentions`).
  /// Photo and @tags only — the web's Candidacy Wall has no video attach.
  Future<Result<void>> createCandidatePost(
    String candidateId,
    String ghostId,
    PostDraft draft,
  );

  Future<Result<List<Post>>> getWallPosts(
    String ghostId, {
    int limit = 20,
    int offset = 0,
  });
}
