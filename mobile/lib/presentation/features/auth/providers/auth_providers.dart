// Wires the whole auth vertical slice together (data source → repository →
// use cases → the AsyncNotifier screens actually watch) and is the
// pattern every other feature's providers file should copy. Nothing below
// the `AuthController` should be imported by a screen directly — a screen
// watches `authControllerProvider`, calls
// `ref.read(authControllerProvider.notifier).signIn(...)`, and knows
// nothing about repositories/use cases/Supabase underneath it.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/result.dart';
import '../../../../data/auth/datasources/auth_remote_data_source.dart';
import '../../../../data/auth/repositories/auth_repository_impl.dart';
import '../../../../domain/auth/entities/app_user.dart';
import '../../../../domain/auth/repositories/auth_repository.dart';
import '../../../../domain/auth/usecases/sign_in_with_password.dart';
import '../../../../domain/auth/usecases/sign_out.dart';
import '../../../../domain/auth/usecases/sign_up_with_password.dart';
import '../../../common/providers/supabase_provider.dart';

final authRemoteDataSourceProvider = Provider<AuthRemoteDataSource>((ref) {
  return AuthRemoteDataSource(ref.watch(supabaseClientProvider));
});

/// Exposed as the [AuthRepository] interface, not [AuthRepositoryImpl] —
/// this is the seam a test overrides to inject a fake repository.
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(ref.watch(authRemoteDataSourceProvider));
});

final signInWithPasswordProvider = Provider(
  (ref) => SignInWithPassword(ref.watch(authRepositoryProvider)),
);
final signUpWithPasswordProvider = Provider(
  (ref) => SignUpWithPassword(ref.watch(authRepositoryProvider)),
);
final signOutProvider = Provider(
  (ref) => SignOut(ref.watch(authRepositoryProvider)),
);

/// The live auth state stream — go_router's redirect logic (see
/// core/router/app_router.dart) listens to this via a `Listenable`
/// adapter to gate every protected route, the same job the website's
/// `ProtectedRoute`/`MainLayout` do off `AuthContext`
/// (docs/FLUTTER_MOBILE_APP_GUIDE.md §1 in the parent repo).
final authStateChangesProvider = StreamProvider<AppUser?>((ref) {
  return ref.watch(authRepositoryProvider).authStateChanges;
});

/// Sign-in/sign-up form actions. Deliberately separate from
/// [authStateChangesProvider] above: that one is "what is the current
/// session," this one is "is a sign-in attempt in flight, and what was the
/// last error" — a form screen watches this, the router guard watches
/// that one.
class AuthController extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<bool> signIn({required String email, required String password}) async {
    state = const AsyncLoading();
    final result = await ref.read(signInWithPasswordProvider)(
      email: email,
      password: password,
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

  Future<bool> signUp({required String email, required String password}) async {
    state = const AsyncLoading();
    final result = await ref.read(signUpWithPasswordProvider)(
      email: email,
      password: password,
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

  Future<void> signOut() async {
    state = const AsyncLoading();
    final Result<void> result = await ref.read(signOutProvider)();
    state = result.when(
      ok: (_) => const AsyncData(null),
      err: (f) => AsyncError(f, StackTrace.current),
    );
  }
}

final authControllerProvider = AsyncNotifierProvider<AuthController, void>(
  AuthController.new,
);
