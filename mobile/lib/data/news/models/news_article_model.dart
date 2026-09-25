import '../../../domain/news/entities/news_article.dart';

/// Port of `isBreakingNewsActive`/`BREAKING_NEWS_ACTIVE_HOURS`
/// (src/lib/services/news.ts) — computed lazily from `published_at` on
/// every read, no stored expiry column, so nobody has to remember to
/// unset the flag.
const _breakingNewsActiveHours = 3;

bool _isBreakingNewsActive(
  Map<String, dynamic>? content,
  DateTime? publishedAt,
) {
  if (content?['breakingNews'] != true) return false;
  if (publishedAt == null) return true;
  return DateTime.now().isBefore(
    publishedAt.add(const Duration(hours: _breakingNewsActiveHours)),
  );
}

extension NewsArticleMapper on Map<String, dynamic> {
  NewsArticle toNewsArticle() {
    final content = this['content'] as Map<String, dynamic>?;
    final publishedAtStr = this['published_at'] as String?;
    final publishedAt = publishedAtStr != null
        ? DateTime.tryParse(publishedAtStr)
        : null;
    final eventDateStr = this['event_date'] as String?;

    return NewsArticle(
      id: this['id'] as String,
      slug: this['slug'] as String,
      headline: this['headline'] as String,
      createdAt: DateTime.parse(this['created_at'] as String),
      summary: this['summary'] as String?,
      category: this['category'] as String?,
      heroImageUrl: this['hero_image_url'] as String?,
      publishedAt: publishedAt,
      eventDate: eventDateStr != null ? DateTime.tryParse(eventDateStr) : null,
      body: content?['body'] as String?,
      readingTimeMinutes: (content?['readingTimeMinutes'] as num?)?.toInt(),
      isBreakingNews: _isBreakingNewsActive(content, publishedAt),
    );
  }
}
