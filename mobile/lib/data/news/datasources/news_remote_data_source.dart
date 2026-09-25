// Port of the read side of src/lib/services/news.ts. Not yet ported: the
// engagement-order RPC path (`getPublishedNewsArticlesByEngagement`), the
// tagged-politician join, topic/tag filtering (`newsTaxonomy.ts`'s
// tag-frequency extraction) — see docs/FLUTTER_MOBILE_APP_GUIDE.md §4.A.4
// in the parent repo for why category/topic browsing is documented as
// "build as one parameterized screen, low priority" relative to the plain
// list this ports first.
import 'package:supabase_flutter/supabase_flutter.dart';

const _articleColumns =
    'id, slug, headline, summary, category, country, province, status, published_at, event_date, hero_image_url, content, created_at';

class NewsRemoteDataSource {
  const NewsRemoteDataSource(this._client);

  final SupabaseClient _client;

  Future<List<dynamic>> getPublishedNewsArticles({
    String? category,
    required int limit,
    required int offset,
  }) {
    var query = _client
        .from('news_articles')
        .select(_articleColumns)
        .eq('status', 'published')
        .lte('published_at', DateTime.now().toIso8601String());
    if (category != null) query = query.eq('category', category);
    return query
        .order('event_date', ascending: false, nullsFirst: false)
        .order('published_at', ascending: false)
        .range(offset, offset + limit - 1);
  }

  Future<Map<String, dynamic>> getNewsArticleBySlug(String slug) {
    return _client
        .from('news_articles')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .lte('published_at', DateTime.now().toIso8601String())
        .single();
  }
}
