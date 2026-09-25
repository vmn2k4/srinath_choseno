import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'core/config/env_config.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await dotenv.load(fileName: '.env');

  // PKCE flow is required for a mobile app's deep-link auth callback (see
  // docs/FLUTTER_MOBILE_APP_GUIDE.md §1 in the parent repo) — the implicit
  // flow the web client can get away with doesn't work once the redirect
  // has to land back inside a native app instead of the same browser tab
  // that started the request.
  await Supabase.initialize(
    url: EnvConfig.supabaseUrl,
    publishableKey: EnvConfig.supabaseAnonKey,
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
  );

  runApp(const ProviderScope(child: ChosenoApp()));
}
