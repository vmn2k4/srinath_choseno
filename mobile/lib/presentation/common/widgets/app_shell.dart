// The persistent bottom-nav shell wrapping the app's five primary
// destinations (Feed, Find My District, Elections, News, Profile) — added
// per explicit product direction to feel like a native app. Built on
// go_router's `StatefulShellRoute.indexedStack` (core/router/app_router.dart)
// specifically because it preserves each tab's own navigation stack and
// scroll position when switching tabs — a plain `IndexedStack` you drive
// yourself would work too, but you'd have to reimplement that state
// preservation by hand.
//
// The bar itself is a frosted/translucent overlay (Snapchat-style — icons
// only, no labels, floating over content rather than a solid opaque strip)
// using the same blur-glass recipe DESIGN.md's Elevation section already
// establishes for `AppCard` (see core/widgets/app_card.dart), applied here
// instead of a literal fully-transparent bar so icons stay legible over
// scrolling content behind them. `Scaffold.extendBody: true` lets each
// screen's content actually run underneath the bar — each screen's own
// scroll view adds bottom padding (see `kBottomNavClearance`) so its last
// item isn't permanently hidden behind it.
//
// The Profile destination shows the signed-in politician's real avatar
// when one is on file (`UserProfile.politicianAvatarUrl`) instead of the
// generic person icon — citizens never have one, by design (everything
// they post is anonymous), so they always see the generic icon; that's
// the correct behavior, not a missing feature.
//
// "My Wall" is a SIXTH destination, politician-only, inserted right after
// Feed (per product direction: it belongs next to Home, not buried at the
// end). It IS a real `StatefulShellBranch` (`/my-wall`, second in the
// router's branch list) — the route is fixed and always registered, and
// its screen resolves the signed-in politician's wall slug from
// `ownProfileProvider` itself, so the branch list never has to change with
// the user's role (which would mean rebuilding the whole `GoRouter` and
// losing every branch's stack). Only the nav *destination* is conditional:
// citizens simply never get a tab that leads there.
//
// Because the branch is second in the router but hidden for citizens, the
// `NavigationBar`'s visual index only lines up 1:1 with `navigationShell`'s
// branch index when My Wall is showing — `_visualIndexForBranch`/
// `_branchIndexForVisual` below translate between the two otherwise.
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/haptics.dart';
import '../../../core/widgets/app_avatar.dart';
import '../../features/profile/providers/profile_providers.dart';

/// Extra bottom padding a shell screen's scrollable content should add so
/// its last item clears the floating bottom nav bar instead of sitting
/// permanently underneath it.
const double kBottomNavClearance = 88;

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  /// Branch index (as `navigationShell` knows it, 0..5) -> visual position
  /// in the `NavigationBar`'s destination list. Identity when My Wall is
  /// showing; otherwise every branch after the (hidden) My Wall branch at
  /// index 1 shifts left one slot.
  int _visualIndexForBranch(int branchIndex, bool hasMyWall) {
    if (hasMyWall || branchIndex == 0) return branchIndex;
    return branchIndex <= 1 ? 0 : branchIndex - 1;
  }

  /// Inverse of [_visualIndexForBranch].
  int _branchIndexForVisual(int visualIndex, bool hasMyWall) {
    if (hasMyWall || visualIndex == 0) return visualIndex;
    return visualIndex + 1;
  }

  void _onDestinationSelected(
    BuildContext context,
    int visualIndex,
    bool hasMyWall,
  ) {
    AppHaptics.select();
    final branchIndex = _branchIndexForVisual(visualIndex, hasMyWall);
    // Tapping the ALREADY-selected tab resets that branch to its initial
    // location (pops any pushed detail screen back to the tab's root) —
    // the same "tap home again to go home" behavior every major app's
    // bottom nav has.
    navigationShell.goBranch(
      branchIndex,
      initialLocation: branchIndex == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final profile = ref.watch(ownProfileProvider).value;
    final avatarUrl = profile?.politicianAvatarUrl;
    final myWallSlug = profile?.myWallSlug;

    return Scaffold(
      extendBody: true,
      body: navigationShell,
      bottomNavigationBar: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            decoration: BoxDecoration(
              color: palette.surface.withValues(alpha: 0.82),
              border: Border(top: BorderSide(color: palette.borderLight)),
            ),
            child: NavigationBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              labelBehavior: NavigationDestinationLabelBehavior.alwaysHide,
              selectedIndex: _visualIndexForBranch(
                navigationShell.currentIndex,
                myWallSlug != null,
              ),
              onDestinationSelected: (index) =>
                  _onDestinationSelected(context, index, myWallSlug != null),
              destinations: [
                const NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home),
                  label: 'Feed',
                ),
                if (myWallSlug != null)
                  const NavigationDestination(
                    icon: Icon(Icons.forum_outlined),
                    selectedIcon: Icon(Icons.forum),
                    label: 'My Wall',
                  ),
                const NavigationDestination(
                  icon: Icon(Icons.my_location_outlined),
                  selectedIcon: Icon(Icons.my_location),
                  label: 'District',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.how_to_vote_outlined),
                  selectedIcon: Icon(Icons.how_to_vote),
                  label: 'Elections',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.newspaper_outlined),
                  selectedIcon: Icon(Icons.newspaper),
                  label: 'News',
                ),
                NavigationDestination(
                  icon: _ProfileTabIcon(avatarUrl: avatarUrl, selected: false),
                  selectedIcon: _ProfileTabIcon(
                    avatarUrl: avatarUrl,
                    selected: true,
                  ),
                  label: 'Profile',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileTabIcon extends StatelessWidget {
  const _ProfileTabIcon({required this.avatarUrl, required this.selected});

  final String? avatarUrl;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    if (avatarUrl == null) {
      return Icon(selected ? Icons.person : Icons.person_outline);
    }
    final palette = ChosenoTheme.of(context);
    return Container(
      padding: EdgeInsets.all(selected ? 1.5 : 0),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: selected
            ? Border.all(color: palette.primary, width: 1.5)
            : null,
      ),
      child: AppAvatar(
        imageUrl: avatarUrl,
        fallbackIcon: Icons.person_outline,
        radius: 11,
      ),
    );
  }
}
