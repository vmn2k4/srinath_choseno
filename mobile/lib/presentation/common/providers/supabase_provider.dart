// The one place the app reaches for `Supabase.instance.client` — every
// other provider depends on this one rather than calling
// `Supabase.instance.client` directly, so a test can override it with a
// fake/mock client.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final supabaseClientProvider = Provider<SupabaseClient>((ref) {
  return Supabase.instance.client;
});
