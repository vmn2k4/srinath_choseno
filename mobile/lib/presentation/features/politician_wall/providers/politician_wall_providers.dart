import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/result.dart';
import '../../../../data/politician_wall/datasources/politician_wall_remote_data_source.dart';
import '../../../../data/politician_wall/repositories/politician_wall_repository_impl.dart';
import '../../../../domain/politician_wall/entities/politician_wall_profile.dart';
import '../../../../domain/politician_wall/repositories/politician_wall_repository.dart';
import '../../../../domain/posts/entities/post.dart';
import '../../../common/providers/supabase_provider.dart';
import '../../auth/providers/auth_providers.dart';

final politicianWallRemoteDataSourceProvider = Provider(
  (ref) => PoliticianWallRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final politicianWallRepositoryProvider = Provider<PoliticianWallRepository>((
  ref,
) {
  return PoliticianWallRepositoryImpl(
    ref.watch(politicianWallRemoteDataSourceProvider),
  );
});

/// Resolves either a raw ghost id/profile id or a `wall_slug` to the same
/// profile shape — mirrors the website's two entry routes
/// (`/wall/[ghostId]` and `/wall/[ghostId]/[slug]`, §4.A.9).
// autoDispose: a failed lookup must not stay cached for the life of the app
// — leaving the wall and coming back (or hot-reloading a fix) has to retry,
// not replay the old error.
final wallProfileProvider = FutureProvider.autoDispose
    .family<PoliticianWallProfile, String>((ref, ghostIdOrSlug) async {
      final repo = ref.watch(politicianWallRepositoryProvider);
      // Same routing as the web's wall page (`/wall/[ghostId]/page.tsx`):
      // a UUID is looked up as a profile/ghost id, anything else as a slug.
      // `current_ghost_id` is a uuid column, so sending a slug to the
      // ghost-id query is a guaranteed Postgres cast error, not a miss.
      final isUuid = RegExp(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        caseSensitive: false,
      ).hasMatch(ghostIdOrSlug);

      if (isUuid) {
        final byId = await repo.getWallOwnerProfile(ghostIdOrSlug);
        if (byId.isOk) return (byId as Ok<PoliticianWallProfile>).value;
      }
      final bySlug = await repo.getWallOwnerProfileBySlug(ghostIdOrSlug);
      return bySlug.when(ok: (p) => p, err: (failure) => throw failure);
    });

final wallSupporterCountProvider = FutureProvider.family<int, String>((
  ref,
  politicianId,
) async {
  final result = await ref
      .watch(politicianWallRepositoryProvider)
      .getSupporterCount(politicianId);
  return result.when(ok: (count) => count, err: (failure) => throw failure);
});

final wallPostsProvider = FutureProvider.family<List<Post>, String>((
  ref,
  ghostId,
) async {
  final result = await ref
      .watch(politicianWallRepositoryProvider)
      .getWallPosts(ghostId);
  return result.when(ok: (posts) => posts, err: (failure) => throw failure);
});

/// Support toggle for the signed-in viewer. Anonymous (signed-out)
/// support (§4.I.7) is a separate, deliberately-scoped-out path for now —
/// this app's current focus is the logged-in screen set.
class WallSupportController extends AsyncNotifier<bool> {
  late String _politicianId;

  @override
  Future<bool> build() async => false;

  Future<void> load(String politicianId) async {
    _politicianId = politicianId;
    final userId = ref.read(authStateChangesProvider).value?.id;
    if (userId == null) {
      state = const AsyncData(false);
      return;
    }
    state = const AsyncLoading();
    final result = await ref
        .read(politicianWallRepositoryProvider)
        .getSupportStatus(politicianId: politicianId, supporterId: userId);
    state = result.when(
      ok: (isSupporting) => AsyncData(isSupporting),
      err: (f) => AsyncError(f, StackTrace.current),
    );
  }

  Future<void> toggle() async {
    final userId = ref.read(authStateChangesProvider).value?.id;
    if (userId == null) return;
    final wasSupporting = state.value ?? false;

    // Optimistic flip, same as the web's ElectionResultsPanel handler.
    state = AsyncData(!wasSupporting);
    final repo = ref.read(politicianWallRepositoryProvider);
    final result = wasSupporting
        ? await repo.withdrawSupport(
            politicianId: _politicianId,
            supporterId: userId,
          )
        : await repo.addSupport(
            politicianId: _politicianId,
            supporterId: userId,
          );

    result.when(
      ok: (_) => ref.invalidate(wallSupporterCountProvider(_politicianId)),
      err: (failure) {
        state = AsyncData(wasSupporting); // rollback
      },
    );
  }
}

final wallSupportControllerProvider =
    AsyncNotifierProvider<WallSupportController, bool>(
      WallSupportController.new,
    );
