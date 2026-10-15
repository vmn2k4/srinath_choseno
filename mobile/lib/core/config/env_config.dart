// Reads Supabase connection info from a git-ignored `.env` file (see
// `.env.example` at the mobile/ root for the required keys) via
// flutter_dotenv. Never hardcode the URL/anon key in source — both are
// safe to ship in a built app binary (the anon key is public by design,
// RLS is what actually protects data — see the parent repo's
// docs/CODE_LAYERS.md), but keeping them out of source control still
// matters for swapping environments (local Supabase vs. staging vs. prod)
// without a code change.
import 'package:flutter_dotenv/flutter_dotenv.dart';

abstract final class EnvConfig {
  static String get supabaseUrl => _require('SUPABASE_URL');
  static String get supabaseAnonKey => _require('SUPABASE_ANON_KEY');

  /// Google sign-in client IDs — optional: with no web client ID the Google
  /// button is simply not shown.
  static String? get googleWebClientId => _optional('GOOGLE_WEB_CLIENT_ID');
  static String? get googleIosClientId => _optional('GOOGLE_IOS_CLIENT_ID');
  static bool get googleSignInConfigured => googleWebClientId != null;

  static String? _optional(String key) {
    // If .env was never loaded (e.g. widget tests) an optional key is just
    // "not set" — the feature it gates stays off instead of throwing.
    if (!dotenv.isInitialized) return null;
    final value = dotenv.env[key];
    return value == null || value.isEmpty ? null : value;
  }

  static String _require(String key) {
    final value = dotenv.env[key];
    if (value == null || value.isEmpty) {
      throw StateError(
        'Missing $key — copy mobile/.env.example to mobile/.env and fill in '
        'your Supabase project values before running the app.',
      );
    }
    return value;
  }
}
