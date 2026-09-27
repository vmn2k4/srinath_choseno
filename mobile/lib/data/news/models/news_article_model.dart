import '../../../domain/news/entities/news_article.dart';
import '../../../domain/news/entities/tagged_politician.dart';

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

/// A profile row nested inside `news_article_politicians` may have zero,
/// one, or (per Supabase's join inference) sometimes an array-shaped
/// `politician_profiles` — normalize both to a single map before reading,
/// same defensive pattern the web's `Array.isArray(...) ? [0] : ...` uses.
Map<String, dynamic>? _asSingleMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is List && value.isNotEmpty) {
    return value.first as Map<String, dynamic>?;
  }
  return null;
}

List<TaggedPolitician> _parseTaggedPoliticians(dynamic rows) {
  if (rows is! List) return const [];
  return rows
      .cast<Map<String, dynamic>>()
      .map((row) => _asSingleMap(row['profiles']))
      .whereType<Map<String, dynamic>>()
      .where((profile) => profile['id'] != null && profile['full_name'] != null)
      .map((profile) {
        final pp = _asSingleMap(profile['politician_profiles']);
        return TaggedPolitician(
          id: profile['id'] as String,
          fullName: profile['full_name'] as String,
          photoUrl: (pp?['photo_url'] ?? pp?['avatar_url']) as String?,
          wallSlug: (pp?['wall_slug'] ?? profile['current_ghost_id']) as String?,
        );
      })
      .toList();
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
      taggedPoliticians: _parseTaggedPoliticians(this['news_article_politicians']),
    );
  }
}
