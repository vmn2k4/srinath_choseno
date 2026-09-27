import 'package:flutter/foundation.dart';

/// Port of the web's reader-poll widget (`NewsArticlePoll.tsx` /
/// `news_article_polls` + `news_article_poll_options` + `news_article_poll_votes`,
/// migration `20260927000000_news_article_polls.sql`). An admin attaches any
/// number of these to a news article (e.g. "which party?" and "which
/// promise?" on the same story); this entity already carries the live tally
/// (`voteCount` per option, from `get_news_article_poll_results`) and the
/// viewer's own pick (`myVoteOptionId`, from the viewer's own row in
/// `news_article_poll_votes` — RLS only ever returns that one row to them),
/// so the widget never needs a second round trip after the initial load.
@immutable
class NewsArticlePollOption {
  const NewsArticlePollOption({
    required this.id,
    required this.label,
    this.voteCount = 0,
  });

  final String id;
  final String label;
  final int voteCount;

  NewsArticlePollOption copyWith({int? voteCount}) => NewsArticlePollOption(
    id: id,
    label: label,
    voteCount: voteCount ?? this.voteCount,
  );
}

@immutable
class NewsArticlePoll {
  const NewsArticlePoll({
    required this.id,
    required this.newsArticleId,
    required this.question,
    required this.options,
    this.myVoteOptionId,
  });

  final String id;
  final String newsArticleId;
  final String question;
  final List<NewsArticlePollOption> options;
  final String? myVoteOptionId;

  int get totalVotes => options.fold(0, (sum, o) => sum + o.voteCount);

  /// Moves this poll's tally from the viewer's previous pick (if any) to
  /// [optionId] — the optimistic update `NewsArticlePollsController.vote`
  /// applies before the round trip to `cast_news_article_poll_vote`
  /// resolves, mirroring the web widget's same optimistic bar movement.
  NewsArticlePoll withVote(String optionId) {
    if (myVoteOptionId == optionId) return this;
    final previous = myVoteOptionId;
    return NewsArticlePoll(
      id: id,
      newsArticleId: newsArticleId,
      question: question,
      myVoteOptionId: optionId,
      options: options.map((o) {
        if (o.id == previous) {
          return o.copyWith(voteCount: (o.voteCount - 1).clamp(0, 1 << 31));
        }
        if (o.id == optionId) return o.copyWith(voteCount: o.voteCount + 1);
        return o;
      }).toList(),
    );
  }
}
