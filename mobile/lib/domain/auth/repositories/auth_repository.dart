// Abstract contract the domain layer depends on. `data/auth/repositories/
// auth_repository_impl.dart` is the only concrete implementation — the
// presentation layer only ever sees this interface (injected via a
// Riverpod provider, see presentation/features/auth/providers), never the
// Supabase-backed implementation directly. This is what makes the data
// layer swappable/testable: a widget test can provide a fake
// AuthRepository with none of this app ever touching a real network call.
import '../../../core/errors/result.dart';
import '../entities/app_user.dart';
import '../entities/sign_up_outcome.dart';

abstract interface class AuthRepository {
  /// Current user, or null if signed out. Does not throw/fail — "no user"
  /// is a valid, non-error state.
  AppUser? get currentUser;

  /// Fires on every auth state change (sign in, sign out, token refresh) —
  /// the Flutter equivalent of the web's `AuthContext` subscribing to
  /// `onAuthStateChange` once at the app root (see
  /// docs/FLUTTER_MOBILE_APP_GUIDE.md §1 in the parent repo). Presentation
  /// wires this into a Riverpod `AsyncNotifier`, not a raw StreamBuilder
  /// per screen.
  Stream<AppUser?> get authStateChanges;

  Future<Result<AppUser>> signInWithPassword({
    required String email,
    required String password,
  });

  /// Creates the account. The app marks it as an app sign-up (user metadata
  /// `signup_client: app`) so the confirmation email's button opens the app.
  Future<Result<SignUpOutcome>> signUpWithPassword({
    required String email,
    required String password,
  });

  /// Confirms the email with the 6-digit code from the confirmation email and
  /// signs the user in.
  Future<Result<AppUser>> verifySignupCode({
    required String email,
    required String code,
  });

  /// Confirms the email from the `choseno://auth/confirm?token_hash=…` link in
  /// the confirmation email and signs the user in.
  Future<Result<AppUser>> verifySignupTokenHash(String tokenHash);

  /// Password reset, step 2: confirms the 6-digit code from the reset email.
  /// Signs the user in with a short-lived recovery session, which is then used
  /// to set the new password ([updatePassword]).
  Future<Result<AppUser>> verifyRecoveryCode({
    required String email,
    required String code,
  });

  /// Same as [verifyRecoveryCode] but from the `choseno://auth/confirm` link
  /// in the reset email.
  Future<Result<AppUser>> verifyRecoveryTokenHash(String tokenHash);

  /// Sends a fresh confirmation email (new button + new code; the old ones
  /// stop working). Supabase rate-limits this to roughly once a minute.
  Future<Result<void>> resendSignupEmail(String email);

  /// Native Google account picker → Supabase session. A user cancelling the
  /// picker comes back as [SignInCancelled], not a real error.
  Future<Result<AppUser>> signInWithGoogle();

  Future<Result<void>> signOut();

  /// Permanently deletes the signed-in account (RPC `delete_my_account`).
  Future<Result<void>> deleteAccount();

  Future<Result<void>> resetPasswordForEmail(String email);

  Future<Result<void>> updatePassword(String newPassword);
}
