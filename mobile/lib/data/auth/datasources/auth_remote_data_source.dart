// The raw Supabase calls — a 1:1 port of the website's
// src/lib/services/auth.ts, same shape ("thin wrappers... the same query
// the caller would've written", docs/SERVICES.md in the parent repo). This
// class does the network call and nothing else: no mapping to domain
// entities (that's the repository's job, see auth_repository_impl.dart)
// and no error-shape translation (also the repository's job) — kept this
// thin specifically so it stays a faithful, easy-to-diff mirror of the
// corresponding .ts file when that file changes on web.
import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/config/env_config.dart';

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

  // One nonce per app run. google_sign_in only accepts the nonce at
  // initialize() (which runs once), so it is generated and registered there.
  // Google puts the SHA-256 of it in the ID token; Supabase is given the raw
  // value and checks that the two match — the token can't be replayed from a
  // different session.
  static final String _rawNonce = _randomNonce();
  static Future<void>? _googleReady;

  static String _randomNonce() {
    final rnd = Random.secure();
    return base64Url.encode(List<int>.generate(32, (_) => rnd.nextInt(256)));
  }

  static Future<void> _initGoogle() {
    return _googleReady ??= GoogleSignIn.instance.initialize(
      clientId: EnvConfig.googleIosClientId,
      serverClientId: EnvConfig.googleWebClientId,
      nonce: sha256.convert(utf8.encode(_rawNonce)).toString(),
    );
  }

  /// Native Google account picker (no browser), then hands Google's ID token
  /// to Supabase. `serverClientId` is the Web client Supabase trusts; on iOS
  /// `clientId` is the iOS client. Throws [GoogleSignInException] if the user
  /// cancels.
  Future<AuthResponse> signInWithGoogle() async {
    await _initGoogle();
    final account = await GoogleSignIn.instance.authenticate();
    final idToken = account.authentication.idToken;
    if (idToken == null) {
      throw const AuthException('Google did not return an ID token.');
    }
    return _client.auth.signInWithIdToken(
      provider: OAuthProvider.google,
      idToken: idToken,
      nonce: _rawNonce,
    );
  }

  Future<void> signOut() async {
    await _client.auth.signOut();
    try {
      await GoogleSignIn.instance.signOut();
    } catch (_) {
      // Not signed in with Google, or never initialised — nothing to clear.
    }
  }

  Future<void> resetPasswordForEmail(String email) =>
      _client.auth.resetPasswordForEmail(email);

  Future<UserResponse> updatePassword(String newPassword) {
    return _client.auth.updateUser(UserAttributes(password: newPassword));
  }
}
