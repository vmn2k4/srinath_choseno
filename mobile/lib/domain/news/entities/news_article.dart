import 'package:flutter/foundation.dart';

import 'tagged_politician.dart';

/// Port of `NewsArticle` (src/lib/services/news.ts). `body`/
/// `readingTimeMinutes` come from the article's `content` JSONB blob — see
/// `NewsArticleContent` on web. Not yet ported: sources, author byline,
/// share-text overrides (tweet/tweetarticle/tweetmedium — web-share-only
/// concerns). `taggedPoliticians` (`news_article_politicians`) IS ported —
/// see `getNewsArticleBySlug`'s join.
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
    this.taggedPoliticians = const [],
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
  final List<TaggedPolitician> taggedPoliticians;

  /// Whichever date the card should actually show — the real-world event
  /// date when known, falling back to when it went live on Choseno. Same
  /// coalesce `getPublishedNewsArticles`'s own `.order()` uses.
  DateTime? get displayDate => eventDate ?? publishedAt ?? createdAt;

  /// `heroImageUrl`, filtered to exclude a known bad-data pattern: some
  /// ingestion pipeline run set this column to the article's own
  /// auto-generated social-share OG card (`.../og-cards/<slug>.png` — a
  /// branded "Choseno" preview graphic with the headline baked into it,
  /// meant for a Twitter/Facebook link preview, never for in-article
  /// display) instead of leaving it null or a real photo. Both the news
  /// list thumbnail and the article screen's own hero image read this
  /// getter, not `heroImageUrl` directly, so neither ever renders that
  /// card as if it were a photo — same underlying data issue affects the
  /// website's article page, not something specific to this app.
  String? get displayableHeroImageUrl {
    final url = heroImageUrl;
    if (url == null || url.contains('/og-cards/')) return null;
    return url;
  }
}
