// Shown only for the brief moment the router is resolving whether a
// session already exists (see core/router/app_router.dart's redirect
// logic) — not the marketing Home/landing page from
// docs/FLUTTER_MOBILE_APP_GUIDE.md §4.A.1 (parent repo), which is a
// separate, deliberate product decision documented there and not yet
// built here.
import 'package:flutter/material.dart';

import '../../../../core/widgets/widgets.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: LoadingIndicator(size: 32)));
  }
}
