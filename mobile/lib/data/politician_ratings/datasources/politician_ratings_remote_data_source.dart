// Port of the write side of src/lib/services/ratings.ts. Read side
// (getPoliticianEngagementSummaries) already exists in
// data/elections/datasources/elections_remote_data_source.dart — reused
// from there rather than duplicated here.
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/config/app_environment.dart';

class PoliticianRatingsRemoteDataSource {
  const PoliticianRatingsRemoteDataSource(this._client);

  final SupabaseClient _client;

  Future<void> upsertRating({
    required String politicianId,
    required int rating,
    String? comment,
    String? newsArticleId,
  }) {
    return _client.rpc(
      'upsert_politician_rating',
      params: {
        'p_politician_id': politicianId,
        'p_rating': rating,
        'p_comment': comment,
        'p_is_test': AppEnvironment.isDev,
        'p_news_article_id': newsArticleId,
      },
    );
  }
}
