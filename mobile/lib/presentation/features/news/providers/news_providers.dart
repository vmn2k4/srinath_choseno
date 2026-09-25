import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/news/datasources/news_remote_data_source.dart';
import '../../../../data/news/repositories/news_repository_impl.dart';
import '../../../../domain/news/entities/news_article.dart';
import '../../../../domain/news/repositories/news_repository.dart';
import '../../../common/providers/supabase_provider.dart';

final newsRemoteDataSourceProvider = Provider(
  (ref) => NewsRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final newsRepositoryProvider = Provider<NewsRepository>((ref) {
  return NewsRepositoryImpl(ref.watch(newsRemoteDataSourceProvider));
});

final publishedNewsArticlesProvider =
    FutureProvider.autoDispose<List<NewsArticle>>((ref) async {
      final result = await ref
          .watch(newsRepositoryProvider)
          .getPublishedNewsArticles();
      return result.when(
        ok: (articles) => articles,
        err: (failure) => throw failure,
      );
    });

final newsArticleBySlugProvider = FutureProvider.family
    .autoDispose<NewsArticle, String>((ref, slug) async {
      final result = await ref
          .watch(newsRepositoryProvider)
          .getNewsArticleBySlug(slug);
      return result.when(
        ok: (article) => article,
        err: (failure) => throw failure,
      );
    });
