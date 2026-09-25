import 'package:flutter/foundation.dart';

/// Port of `NewsArticle` (src/lib/services/news.ts). `body`/
/// `readingTimeMinutes` come from the article's `content` JSONB blob — see
/// `NewsArticleContent` on web. Not yet ported: tagged-politician list
/// (`news_article_politicians`), sources, author byline, share-text
/// overrides (tweet/tweetarticle/tweetmedium — web-share-only concerns).
@immutable
class NewsArticle {
  const NewsArticle({
    required this.id,
    required this.slug,
    required this.headline,
    required this.createdAt,
    this.summary,
    this.category,
    this.heroImageUrl,
    this.publishedAt,
    this.eventDate,
    this.body,
    this.readingTimeMinutes,
    this.isBreakingNews = false,
  });

  final String id;
  final String slug;
  final String headline;
  final DateTime createdAt;
  final String? summary;
  final String? category;
  final String? heroImageUrl;
  final DateTime? publishedAt;
  final DateTime? eventDate;
  final String? body;
  final int? readingTimeMinutes;
  final bool isBreakingNews;

  /// Whichever date the card should actually show — the real-world event
  /// date when known, falling back to when it went live on Choseno. Same
  /// coalesce `getPublishedNewsArticles`'s own `.order()` uses.
  DateTime? get displayDate => eventDate ?? publishedAt ?? createdAt;
}
