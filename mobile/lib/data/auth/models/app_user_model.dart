// The ONLY file in the auth feature allowed to import supabase_flutter's
// `User` type. Maps it down to the domain's [AppUser] entity — everything
// above the data layer (domain, presentation) only ever sees [AppUser],
// never this model or the Supabase SDK type it wraps.
import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

import '../../../domain/auth/entities/app_user.dart';

extension AppUserMapper on supabase.User {
  AppUser toEntity() => AppUser(
    id: id,
    email: email ?? '',
    emailConfirmedAt: emailConfirmedAt != null
        ? DateTime.tryParse(emailConfirmedAt!)
        : null,
  );
}
