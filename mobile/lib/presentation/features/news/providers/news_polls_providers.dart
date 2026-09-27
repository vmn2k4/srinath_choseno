import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/news_polls/datasources/news_polls_remote_data_source.dart';
import '../../../../data/news_polls/repositories/news_polls_repository_impl.dart';
import '../../../../domain/news_polls/entities/news_article_poll.dart';
import '../../../../domain/news_polls/repositories/news_polls_repository.dart';
import '../../../common/providers/supabase_provider.dart';
import '../../auth/providers/auth_providers.dart';

final newsPollsRemoteDataSourceProvider = Provider(
  (ref) => NewsPollsRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final newsPollsRepositoryProvider = Provider<NewsPollsRepository>((ref) {
  return NewsPollsRepositoryImpl(ref.watch(newsPollsRemoteDataSourceProvider));
});

/// Polls (with live tallies + the viewer's own picks) for whichever article
/// is currently open. Same shape as `WallSupportController`
/// (politician_wall_providers.dart): a singleton controller with an
/// explicit `load(id)` the screen calls once the id is known, rather than a
/// `.family` provider — this app has exactly one article screen active at a
/// time, so there's nothing a family would buy here that `load()` doesn't
/// already give for free.
class NewsArticlePollsController extends AsyncNotifier<List<NewsArticlePoll>> {
  @override
  Future<List<NewsArticlePoll>> build() async => const [];

  Future<void> load(String articleId) async {
    state = const AsyncLoading();
    final userId = ref.read(authStateChangesProvider).value?.id;
    final result = await ref
        .read(newsPollsRepositoryProvider)
        .getPollsForArticle(articleId, userId: userId);
    state = result.when(
      ok: (polls) => AsyncData(polls),
      err: (f) => AsyncError(f, StackTrace.current),
    );
  }

  /// Signed-out taps are a silent no-op, same convention as
  /// `WallSupportController.toggle()` — this screen doesn't route to Auth
  /// for a secondary action like voting, it just doesn't act until signed
  /// in (the poll widget shows a "Sign in to vote" hint instead).
  Future<void> vote(String pollId, String optionId) async {
    if (ref.read(authStateChangesProvider).value?.id == null) return;
    final current = state.value;
    if (current == null) return;

    // Optimistic: move this poll's bar to the new pick before the round
    // trip resolves, same as the web widget.
    state = AsyncData([
      for (final poll in current)
        if (poll.id == pollId) poll.withVote(optionId) else poll,
    ]);

    final result = await ref
        .read(newsPollsRepositoryProvider)
        .castVote(optionId);
    result.when(
      ok: (_) {},
      err: (_) => state = AsyncData(current), // rollback
    );
  }
}

final newsArticlePollsControllerProvider =
    AsyncNotifierProvider<NewsArticlePollsController, List<NewsArticlePoll>>(
      NewsArticlePollsController.new,
    );
