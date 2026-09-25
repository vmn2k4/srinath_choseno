// The signed-in politician's own wall as a bottom-nav tab (the "My Wall"
// destination in app_shell.dart). Same screen as `/wall/:slug`, but shown
// inside the shell — persistent nav bar, no back arrow — with the slug
// resolved from the user's own profile instead of the URL.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/widgets/widgets.dart';
import '../../profile/providers/profile_providers.dart';
import 'politician_wall_screen.dart';

class MyWallScreen extends ConsumerWidget {
  const MyWallScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final slug = ref.watch(ownProfileProvider).value?.myWallSlug;
    if (slug == null) {
      // Only reachable for an instant (profile still resolving) — the
      // router redirects non-politicians away from /my-wall.
      return const Scaffold(body: Center(child: LoadingIndicator()));
    }
    return PoliticianWallScreen(
      key: ValueKey(slug),
      ghostIdOrSlug: slug,
      isTab: true,
    );
  }
}
