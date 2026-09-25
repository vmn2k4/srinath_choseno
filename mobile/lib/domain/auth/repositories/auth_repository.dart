// Abstract contract the domain layer depends on. `data/auth/repositories/
// auth_repository_impl.dart` is the only concrete implementation — the
// presentation layer only ever sees this interface (injected via a
// Riverpod provider, see presentation/features/auth/providers), never the
// Supabase-backed implementation directly. This is what makes the data
// layer swappable/testable: a widget test can provide a fake
// AuthRepository with none of this app ever touching a real network call.
import '../../../core/errors/result.dart';
import '../entities/app_user.dart';

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

  Future<Result<AppUser>> signUpWithPassword({
    required String email,
    required String password,
  });

  Future<Result<void>> signOut();

  Future<Result<void>> resetPasswordForEmail(String email);

  Future<Result<void>> updatePassword(String newPassword);
}
