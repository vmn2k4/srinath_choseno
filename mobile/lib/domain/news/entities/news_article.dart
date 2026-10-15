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
    this.updatedAt,
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
  final DateTime? updatedAt;
  final String? body;
  final int? readingTimeMinutes;
  final bool isBreakingNews;
  final List<TaggedPolitician> taggedPoliticians;

  /// True when the article was revised more than a day after it went live —
  /// the same threshold the web header uses for its "Updated" label.
  bool get wasUpdated {
    final u = updatedAt;
    final p = publishedAt ?? createdAt;
    return u != null && u.difference(p) > const Duration(days: 1);
  }

  /// Whichever date the card should actually show — the real-world event
  /// date when known, falling back to when it went live on Choseno. Same
  /// coalesce `getPublishedNewsArticles`'s own `.order()` uses.
  DateTime? get displayDate => eventDate ?? publishedAt ?? createdAt;

  /// The article's image. The generated `og-cards/<slug>.png` share card IS a
  /// valid image — the website shows it on every news card and article page —
  /// so nothing is filtered out (an older version of this app hid those cards
  /// as "bad data", which left most articles with no picture).
  String? get displayableHeroImageUrl {
    final url = heroImageUrl;
    return url == null || url.isEmpty ? null : url;
  }
}
