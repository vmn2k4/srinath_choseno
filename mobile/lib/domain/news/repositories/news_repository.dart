import '../../../core/errors/result.dart';
import '../entities/news_article.dart';

abstract interface class NewsRepository {
  Future<Result<List<NewsArticle>>> getPublishedNewsArticles({
    String? category,
    int limit = 20,
    int offset = 0,
  });
  Future<Result<NewsArticle>> getNewsArticleBySlug(String slug);
}
