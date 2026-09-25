import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

import '../../../core/errors/app_failure.dart';
import '../../../core/errors/result.dart';
import '../../../domain/news/entities/news_article.dart';
import '../../../domain/news/repositories/news_repository.dart';
import '../datasources/news_remote_data_source.dart';
import '../models/news_article_model.dart';

class NewsRepositoryImpl implements NewsRepository {
  const NewsRepositoryImpl(this._remote);

  final NewsRemoteDataSource _remote;

  @override
  Future<Result<List<NewsArticle>>> getPublishedNewsArticles({
    String? category,
    int limit = 20,
    int offset = 0,
  }) async {
    try {
      final rows = await _remote.getPublishedNewsArticles(
        category: category,
        limit: limit,
        offset: offset,
      );
      return Result.ok(
        rows
            .cast<Map<String, dynamic>>()
            .map((r) => r.toNewsArticle())
            .toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<NewsArticle>> getNewsArticleBySlug(String slug) async {
    try {
      final row = await _remote.getNewsArticleBySlug(slug);
      return Result.ok(row.toNewsArticle());
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }
}
