import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/router/deep_link_service.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_config.dart';

class ChosenoApp extends ConsumerStatefulWidget {
  const ChosenoApp({super.key});

  @override
  ConsumerState<ChosenoApp> createState() => _ChosenoAppState();
}

class _ChosenoAppState extends ConsumerState<ChosenoApp> {
  @override
  void initState() {
    super.initState();
    // Starts exactly once for the app's lifetime — checks the cold-start
    // link (if the app was launched by tapping one) and subscribes for
    // any tapped while already running.
    ref.read(deepLinkServiceProvider).start();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'Choseno',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.build(ChosenoPalette.pulse),
      routerConfig: router,
    );
  }
}
