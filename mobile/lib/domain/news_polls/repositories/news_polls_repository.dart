import '../../../core/errors/result.dart';
import '../entities/news_article_poll.dart';

abstract interface class NewsPollsRepository {
  /// All polls (with options, tallies, and — when [userId] is given — the
  /// viewer's own vote) attached to one article, in author-defined order.
  Future<Result<List<NewsArticlePoll>>> getPollsForArticle(
    String articleId, {
    String? userId,
  });

  /// Casts (or changes) the signed-in caller's vote on one poll, via
  /// `cast_news_article_poll_vote` — the RPC resolves the poll from the
  /// option itself and upserts on (poll_id, voter_id), so re-voting changes
  /// the answer instead of erroring or duplicating a ballot.
  Future<Result<void>> castVote(String optionId);
}
