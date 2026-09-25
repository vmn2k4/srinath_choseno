import '../../../core/errors/result.dart';
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

  Future<Result<List<Post>>> getWallPosts(
    String ghostId, {
    int limit = 20,
    int offset = 0,
  });
}
