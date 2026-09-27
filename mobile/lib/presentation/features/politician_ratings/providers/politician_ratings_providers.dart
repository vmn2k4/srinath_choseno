import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/politician_ratings/datasources/politician_ratings_remote_data_source.dart';
import '../../../../data/politician_ratings/repositories/politician_ratings_repository_impl.dart';
import '../../../../domain/politician_ratings/repositories/politician_ratings_repository.dart';
import '../../../common/providers/supabase_provider.dart';

final politicianRatingsRemoteDataSourceProvider = Provider(
  (ref) => PoliticianRatingsRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final politicianRatingsRepositoryProvider = Provider<PoliticianRatingsRepository>((
  ref,
) {
  return PoliticianRatingsRepositoryImpl(
    ref.watch(politicianRatingsRemoteDataSourceProvider),
  );
});

/// Submit state for the "rate this politician" sheet — same shape as
/// `AuthController` (auth_providers.dart): an `AsyncNotifier<void>` whose
/// state is "is a submit in flight, and what was the last error," not the
/// rating itself (the sheet holds the star value locally; the aggregate
/// avg/count a caller shows elsewhere comes from
/// `ElectionsRepository.getPoliticianEngagementSummaries`, invalidated on
/// success so it re-fetches the new average).
class PoliticianRatingController extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<bool> submit({
    required String politicianId,
    required int rating,
    String? comment,
    String? newsArticleId,
  }) async {
    state = const AsyncLoading();
    final result = await ref
        .read(politicianRatingsRepositoryProvider)
        .upsertRating(
          politicianId: politicianId,
          rating: rating,
          comment: comment,
          newsArticleId: newsArticleId,
        );
    return result.when(
      ok: (_) {
        state = const AsyncData(null);
        return true;
      },
      err: (failure) {
        state = AsyncError(failure, StackTrace.current);
        return false;
      },
    );
  }
}

final politicianRatingControllerProvider =
    AsyncNotifierProvider<PoliticianRatingController, void>(
      PoliticianRatingController.new,
    );
