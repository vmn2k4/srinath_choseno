// Typed failure reasons a repository can hand back. Deliberately small and
// closed (a sealed class, not a free-text string bag) so presentation code
// can pattern-match on *kind* of failure ("show a retry button" vs. "route
// to /auth") instead of parsing error messages.
import 'package:flutter/foundation.dart';

@immutable
sealed class AppFailure {
  const AppFailure(this.message);

  /// Human-readable, safe to show directly in a SnackBar/dialog.
  final String message;

  /// Without this override, string-interpolating an [AppFailure] (e.g.
  /// `'$error'` in a SnackBar) prints `Instance of 'ServerFailure'` instead
  /// of the actual message — a real bug caught live (sign-in showed
  /// "Instance of ServerFailure" instead of Supabase's real rejection
  /// reason). Every presentation-layer call site that stringifies a
  /// caught failure relies on this.
  @override
  String toString() => message;
}

/// The network call itself failed (no connectivity, DNS, timeout) — never
/// a server-side rejection.
final class NetworkFailure extends AppFailure {
  const NetworkFailure([
    super.message = 'Network error. Check your connection and try again.',
  ]);
}

/// Supabase/Postgres returned an error — a failed RLS check, a
/// SECURITY DEFINER RPC's RAISE EXCEPTION (rate limit, cooldown, ownership),
/// or a constraint violation. [code] is the raw Postgres/PostgREST error
/// code when available, for the rare case a caller needs to branch on it
/// (e.g. a unique-violation vs. everything else).
final class ServerFailure extends AppFailure {
  const ServerFailure(super.message, {this.code});
  final String? code;
}

/// The current session is missing/expired for an action that requires one
/// — presentation code should route to Auth on this, not just show a
/// message (see docs/FLUTTER_MOBILE_APP_GUIDE.md §1's route-guarding
/// section in the parent repo).
final class AuthRequiredFailure extends AppFailure {
  const AuthRequiredFailure([super.message = 'Sign in to do that.']);
}

/// A catch-all for anything that doesn't fit the above — kept distinct
/// from [ServerFailure] so it's obvious at a call site which failures were
/// anticipated vs. genuinely unexpected.
final class UnknownFailure extends AppFailure {
  const UnknownFailure([
    super.message = 'Something went wrong. Please try again.',
  ]);
}
