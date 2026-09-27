import '../../../core/errors/result.dart';

abstract interface class PoliticianRatingsRepository {
  /// Casts (or changes) the signed-in caller's 1 to 5 star rating + optional
  /// comment for a politician, via `upsert_politician_rating` — the same
  /// RPC every rating entry point on web goes through (self-rating check,
  /// 6-month re-rate cooldown, and ghost-id attribution all enforced
  /// server-side, so a `ServerFailure` here may be that cooldown message,
  /// not a generic error).
  Future<Result<void>> upsertRating({
    required String politicianId,
    required int rating,
    String? comment,
    /// The article this rating was cast from, if any — recorded on the
    /// rating so a "via [headline]" link can render wherever reviews are
    /// listed later (see migration
    /// 20260822000002_politician_rating_news_article_source.sql).
    String? newsArticleId,
  });
}
