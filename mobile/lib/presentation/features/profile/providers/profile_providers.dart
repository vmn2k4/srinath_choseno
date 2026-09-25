import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/profile/datasources/profile_remote_data_source.dart';
import '../../../../data/profile/repositories/profile_repository_impl.dart';
import '../../../../domain/profile/entities/boundary_membership.dart';
import '../../../../domain/profile/entities/user_profile.dart';
import '../../../../domain/profile/repositories/profile_repository.dart';
import '../../../../domain/profile/usecases/complete_onboarding.dart';
import '../../../../domain/profile/usecases/fetch_or_heal_profile.dart';
import '../../../common/providers/supabase_provider.dart';
import '../../auth/providers/auth_providers.dart';

final profileRemoteDataSourceProvider = Provider(
  (ref) => ProfileRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepositoryImpl(ref.watch(profileRemoteDataSourceProvider));
});

final fetchOrHealProfileProvider = Provider(
  (ref) => FetchOrHealProfile(ref.watch(profileRepositoryProvider)),
);
final completeOnboardingProvider = Provider(
  (ref) => CompleteOnboarding(ref.watch(profileRepositoryProvider)),
);

/// The signed-in user's own profile — the Flutter equivalent of the
/// website's `AuthContext` holding both `user` and `profile`. `null` means
/// either signed-out or not-yet-loaded; watch `authStateChangesProvider`
/// alongside this to tell the two apart.
///
/// Deliberately skips re-fetching when the auth stream fires again for the
/// *same* user id (e.g. a `TOKEN_REFRESHED` event, or the app resuming from
/// background) — the parent repo's Flutter guide §1 calls this out
/// explicitly as a bug the website's `AuthContext` had to specifically fix
/// ("a same-user token refresh or app-resume event must not flash a full
/// loading state"), so it's ported as a first-class behavior here, not an
/// afterthought.
class OwnProfileController extends AsyncNotifier<UserProfile?> {
  String? _loadedForUserId;

  @override
  Future<UserProfile?> build() async {
    final user = ref.watch(authStateChangesProvider).value;

    if (user == null) {
      _loadedForUserId = null;
      return null;
    }

    if (_loadedForUserId == user.id && state.hasValue) {
      return state.value;
    }

    final result = await ref.read(fetchOrHealProfileProvider)(user.id);
    return result.when(
      ok: (profile) {
        _loadedForUserId = user.id;
        return profile;
      },
      err: (failure) => throw failure,
    );
  }

  /// Call after a write that changes the profile (Onboarding submit, Edit
  /// Profile save, Burn Identity, ...) so the rest of the app sees the
  /// fresh row without waiting for an unrelated auth event.
  Future<void> refresh() async {
    _loadedForUserId = null;
    ref.invalidateSelf();
    await future;
  }
}

final ownProfileProvider =
    AsyncNotifierProvider<OwnProfileController, UserProfile?>(
      OwnProfileController.new,
    );

/// Refetched (not cached) on every read — a live "current score" reading is
/// the point (see `calculateMyScore`'s own doc comment); a `Provider`
/// wrapping a plain `Future` would only ever compute it once.
final civicScoreProvider = FutureProvider.autoDispose<int>((ref) async {
  final result = await ref.watch(profileRepositoryProvider).calculateMyScore();
  return result.when(ok: (score) => score, err: (failure) => throw failure);
});

class BurnIdentityController extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<bool> call() async {
    state = const AsyncLoading();
    final result = await ref
        .read(profileRepositoryProvider)
        .burnGhostIdentity();
    return result.when(
      ok: (_) async {
        state = const AsyncData(null);
        await ref.read(ownProfileProvider.notifier).refresh();
        ref.invalidate(civicScoreProvider);
        return true;
      },
      err: (failure) async {
        state = AsyncError(failure, StackTrace.current);
        return false;
      },
    );
  }
}

final burnIdentityControllerProvider =
    AsyncNotifierProvider<BurnIdentityController, void>(
      BurnIdentityController.new,
    );

final userBoundaryMembershipsProvider =
    FutureProvider.autoDispose<List<BoundaryMembership>>((ref) async {
      final userId = ref.watch(authStateChangesProvider).value?.id;
      if (userId == null) return const [];
      final result = await ref
          .watch(profileRepositoryProvider)
          .getUserBoundaryMemberships(userId);
      return result.when(
        ok: (memberships) => memberships,
        err: (failure) => throw failure,
      );
    });

/// The one-click "Switch to Citizen Account" / (reciprocal, not yet wired
/// to a screen) "Become a Politician" action — a full-row
/// [ProfileRepository.upsertProfileCore] call, so it must carry the
/// CURRENT `fullName`/`country`/`constituency` forward, not just the new
/// role, or those fields would be nulled out (see that method's own doc
/// comment on why it's a full upsert, not a patch).
class SwitchRoleController extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<bool> switchTo(UserRole role) async {
    final current = ref.read(ownProfileProvider).value;
    if (current == null) return false;
    state = const AsyncLoading();
    final result = await ref
        .read(profileRepositoryProvider)
        .upsertProfileCore(
          userId: current.id,
          role: role,
          fullName: current.fullName,
          country: current.country,
          constituency: current.constituency,
          onboardingCompleted: true,
        );
    return result.when(
      ok: (_) async {
        state = const AsyncData(null);
        await ref.read(ownProfileProvider.notifier).refresh();
        return true;
      },
      err: (failure) async {
        state = AsyncError(failure, StackTrace.current);
        return false;
      },
    );
  }
}

final switchRoleControllerProvider =
    AsyncNotifierProvider<SwitchRoleController, void>(SwitchRoleController.new);
