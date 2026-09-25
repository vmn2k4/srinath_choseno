// Domain entity — what the REST of the app (presentation layer, other
// domains) knows about "the signed-in user." Deliberately doesn't carry a
// Supabase `User`/`Session` object: the domain layer must not know
// Supabase exists at all (see mobile/ARCHITECTURE.md's dependency-rule
// section) — only data/auth/models/app_user_model.dart is allowed to touch
// the Supabase SDK type and map it down to this shape.
import 'package:flutter/foundation.dart';

@immutable
class AppUser {
  const AppUser({required this.id, required this.email, this.emailConfirmedAt});

  final String id;
  final String email;
  final DateTime? emailConfirmedAt;
}
