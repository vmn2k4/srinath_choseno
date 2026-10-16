// Wires the whole auth vertical slice together (data source → repository →
// use cases → the AsyncNotifier screens actually watch) and is the
// pattern every other feature's providers file should copy. Nothing below
// the `AuthController` should be imported by a screen directly — a screen
// watches `authControllerProvider`, calls
// `ref.read(authControllerProvider.notifier).signIn(...)`, and knows
// nothing about repositories/use cases/Supabase underneath it.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/errors/result.dart';
import '../../../../data/auth/datasources/auth_remote_data_source.dart';
import '../../../../data/auth/repositories/auth_repository_impl.dart';
import '../../../../domain/auth/entities/app_user.dart';
import '../../../../domain/auth/entities/sign_up_outcome.dart';
import '../../../../domain/auth/repositories/auth_repository.dart';
import '../../../../domain/auth/usecases/sign_in_with_google.dart';
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
final signInWithGoogleProvider = Provider(
  (ref) => SignInWithGoogle(ref.watch(authRepositoryProvider)),
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

/// A one-line notice for the sign-in screen (e.g. a confirmation link that
/// didn't work), set where there is no BuildContext to show it from.
class AuthNotice extends Notifier<String?> {
  @override
  String? build() => null;

  void show(String? message) => state = message;
}

final authNoticeProvider = NotifierProvider<AuthNotice, String?>(
  AuthNotice.new,
);

/// True from the moment a password-reset code/link is accepted until the new
/// password is saved (or cancelled). The code creates a real session, so
/// without this the router would treat the person as simply signed in and
/// move them to Home before they set the password.
class PasswordRecoveryPending extends Notifier<bool> {
  @override
  bool build() => false;

  void set(bool value) => state = value;
}

final passwordRecoveryPendingProvider =
    NotifierProvider<PasswordRecoveryPending, bool>(
      PasswordRecoveryPending.new,
    );

enum SignInOutcome { signedIn, failed, needsEmailConfirmation }

/// Sign-in/sign-up form actions. Deliberately separate from
/// [authStateChangesProvider] above: that one is "what is the current
/// session," this one is "is a sign-in attempt in flight, and what was the
/// last error" — a form screen watches this, the router guard watches
/// that one.
class AuthController extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<SignInOutcome> signIn({
    required String email,
    required String password,
  }) async {
    state = const AsyncLoading();
    final result = await ref.read(signInWithPasswordProvider)(
      email: email,
      password: password,
    );
    return result.when(
      ok: (_) {
        state = const AsyncData(null);
        return SignInOutcome.signedIn;
      },
      err: (failure) {
        // Signing in before confirming the email (or after the confirmation
        // link expired) isn't an error to show — it routes to the code
        // screen, which sends a fresh email.
        if (failure is ServerFailure && failure.code == 'email_not_confirmed') {
          state = const AsyncData(null);
          return SignInOutcome.needsEmailConfirmation;
        }
        state = AsyncError(failure, StackTrace.current);
        return SignInOutcome.failed;
      },
    );
  }

  /// Native Google sign-in. Returns true on success; a cancelled picker
  /// returns false WITHOUT putting the form into an error state.
  Future<bool> signInWithGoogle() async {
    state = const AsyncLoading();
    final result = await ref.read(signInWithGoogleProvider)();
    return result.when(
      ok: (_) {
        state = const AsyncData(null);
        return true;
      },
      err: (failure) {
        state = failure is SignInCancelled
            ? const AsyncData(null)
            : AsyncError(failure, StackTrace.current);
        return false;
      },
    );
  }

  /// Null on failure (the error is on [state]); otherwise whether the email
  /// still needs confirming.
  Future<SignUpOutcome?> signUp({
    required String email,
    required String password,
  }) async {
    state = const AsyncLoading();
    final result = await ref.read(signUpWithPasswordProvider)(
      email: email,
      password: password,
    );
    return result.when(
      ok: (outcome) {
        state = const AsyncData(null);
        return outcome;
      },
      err: (failure) {
        state = AsyncError(failure, StackTrace.current);
        return null;
      },
    );
  }

  /// Confirms the email with the 6-digit code and signs in. Returns null on
  /// success (the router takes over), otherwise the message to show. Kept off
  /// [state] so the confirm screen shows its own inline error.
  Future<String?> verifySignupCode({
    required String email,
    required String code,
  }) async {
    final result = await ref
        .read(authRepositoryProvider)
        .verifySignupCode(
          email: email,
          code: code.replaceAll(RegExp(r'\s'), ''),
        );
    return result.when(ok: (_) => null, err: _confirmMessage);
  }

  /// Confirms from the `choseno://auth/confirm` link. Null on success.
  Future<String?> verifySignupTokenHash(String tokenHash) async {
    final result = await ref
        .read(authRepositoryProvider)
        .verifySignupTokenHash(tokenHash);
    return result.when(ok: (_) => null, err: _confirmMessage);
  }

  /// Sends a fresh confirmation email. Null on success; a message otherwise
  /// (including Supabase's "wait N seconds" cooldown).
  Future<String?> resendConfirmation(String email) async {
    final result = await ref
        .read(authRepositoryProvider)
        .resendSignupEmail(email);
    return result.when(ok: (_) => null, err: (f) => f.message);
  }

  /// Sends the "reset your password" email (a button + a 6-digit code).
  /// Supabase answers success even for an unknown email, so the UI can always
  /// move on without revealing which emails have accounts. Null on success.
  Future<String?> requestPasswordReset(String email) async {
    final result = await ref
        .read(authRepositoryProvider)
        .resetPasswordForEmail(email);
    return result.when(ok: (_) => null, err: (f) => f.message);
  }

  /// Accepts the reset code. On success the router sends the person to the
  /// set-new-password screen. Null on success, otherwise the message to show.
  Future<String?> verifyRecoveryCode({
    required String email,
    required String code,
  }) async {
    final pending = ref.read(passwordRecoveryPendingProvider.notifier);
    pending.set(true); // before the session event, so the router doesn't race
    final result = await ref
        .read(authRepositoryProvider)
        .verifyRecoveryCode(
          email: email,
          code: code.replaceAll(RegExp(r'\s'), ''),
        );
    return result.when(
      ok: (_) => null,
      err: (f) {
        pending.set(false);
        return _confirmMessage(f);
      },
    );
  }

  /// Same, from the `choseno://auth/confirm?type=recovery` link.
  Future<String?> verifyRecoveryTokenHash(String tokenHash) async {
    final pending = ref.read(passwordRecoveryPendingProvider.notifier);
    pending.set(true);
    final result = await ref
        .read(authRepositoryProvider)
        .verifyRecoveryTokenHash(tokenHash);
    return result.when(
      ok: (_) => null,
      err: (f) {
        pending.set(false);
        return _confirmMessage(f);
      },
    );
  }

  /// Saves the new password for the recovery session. Null on success (the
  /// router then moves on); otherwise the message to show.
  Future<String?> setNewPassword(String password) async {
    final result = await ref
        .read(authRepositoryProvider)
        .updatePassword(password);
    return result.when(
      ok: (_) {
        ref.read(passwordRecoveryPendingProvider.notifier).set(false);
        return null;
      },
      err: (f) => f.message,
    );
  }

  /// Abandons a password reset: signs the temporary session back out.
  Future<void> cancelPasswordReset() async {
    await ref.read(authRepositoryProvider).signOut();
    ref.read(passwordRecoveryPendingProvider.notifier).set(false);
  }

  static String _confirmMessage(AppFailure f) {
    final text = '${f is ServerFailure ? f.code : ''} ${f.message}'
        .toLowerCase();
    if (text.contains('expired') ||
        text.contains('invalid') ||
        text.contains('otp')) {
      return "That code isn't right or has expired. Check the email, or tap Resend code for a new one.";
    }
    return f.message;
  }

  /// Returns null on success, otherwise the reason to show the user.
  Future<String?> deleteAccount() async {
    final result = await ref.read(authRepositoryProvider).deleteAccount();
    return result.when(ok: (_) => null, err: (f) => f.message);
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
