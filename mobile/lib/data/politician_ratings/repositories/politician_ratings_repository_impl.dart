import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

import '../../../core/errors/app_failure.dart';
import '../../../core/errors/result.dart';
import '../../../domain/politician_ratings/repositories/politician_ratings_repository.dart';
import '../datasources/politician_ratings_remote_data_source.dart';

class PoliticianRatingsRepositoryImpl implements PoliticianRatingsRepository {
  const PoliticianRatingsRepositoryImpl(this._remote);

  final PoliticianRatingsRemoteDataSource _remote;

  @override
  Future<Result<void>> upsertRating({
    required String politicianId,
    required int rating,
    String? comment,
    String? newsArticleId,
  }) async {
    try {
      await _remote.upsertRating(
        politicianId: politicianId,
        rating: rating,
        comment: comment,
        newsArticleId: newsArticleId,
      );
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      // The RPC's RAISE EXCEPTION messages (self-rating, 6-month cooldown,
      // "not a politician profile") land here as e.message, safe to show
      // directly per ServerFailure's contract.
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }
}
