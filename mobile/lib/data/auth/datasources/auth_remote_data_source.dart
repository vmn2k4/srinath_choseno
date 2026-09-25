// The raw Supabase calls — a 1:1 port of the website's
// src/lib/services/auth.ts, same shape ("thin wrappers... the same query
// the caller would've written", docs/SERVICES.md in the parent repo). This
// class does the network call and nothing else: no mapping to domain
// entities (that's the repository's job, see auth_repository_impl.dart)
// and no error-shape translation (also the repository's job) — kept this
// thin specifically so it stays a faithful, easy-to-diff mirror of the
// corresponding .ts file when that file changes on web.
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthRemoteDataSource {
  const AuthRemoteDataSource(this._client);

  final SupabaseClient _client;

  User? get currentUser => _client.auth.currentUser;

  Stream<AuthState> get onAuthStateChange => _client.auth.onAuthStateChange;

  Future<AuthResponse> signUp({
    required String email,
    required String password,
  }) {
    return _client.auth.signUp(email: email, password: password);
  }

  Future<AuthResponse> signInWithPassword({
    required String email,
    required String password,
  }) {
    return _client.auth.signInWithPassword(email: email, password: password);
  }

  Future<void> signOut() => _client.auth.signOut();

  Future<void> resetPasswordForEmail(String email) =>
      _client.auth.resetPasswordForEmail(email);

  Future<UserResponse> updatePassword(String newPassword) {
    return _client.auth.updateUser(UserAttributes(password: newPassword));
  }
}
