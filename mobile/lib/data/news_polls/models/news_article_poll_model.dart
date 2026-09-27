import '../../../domain/news_polls/entities/news_article_poll.dart';

extension NewsArticlePollMapper on Map<String, dynamic> {
  /// [countsByOption] and [myVoteByPoll] come from separate RPC/select
  /// round trips (`get_news_article_poll_results`, the viewer's own
  /// `news_article_poll_votes` row) — folded in here so the repository
  /// hands back one fully-formed [NewsArticlePoll] per row instead of the
  /// screen having to stitch three responses together itself.
  NewsArticlePoll toNewsArticlePoll(
    Map<String, int> countsByOption,
    Map<String, String> myVoteByPoll,
  ) {
    final id = this['id'] as String;
    final optionRows =
        (this['news_article_poll_options'] as List<dynamic>? ?? const [])
            .cast<Map<String, dynamic>>();

    return NewsArticlePoll(
      id: id,
      newsArticleId: this['news_article_id'] as String,
      question: this['question'] as String,
      myVoteOptionId: myVoteByPoll[id],
      options: optionRows
          .map(
            (o) => NewsArticlePollOption(
              id: o['id'] as String,
              label: o['label'] as String,
              voteCount: countsByOption[o['id'] as String] ?? 0,
            ),
          )
          .toList(),
    );
  }
}
