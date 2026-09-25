// The Snapchat-style top bar for this app's five primary bottom-nav screens
// (it replaces a Material AppBar on those screens):
//
//     [avatar] [search]        Title        [action] [action]
//
// Everything interactive is a round, softly-filled 40pt button — the same
// silhouette as Snapchat's Chat header — with the screen title centred
// between the two clusters. The avatar is the signed-in politician's photo
// (`UserProfile.politicianAvatarUrl`); citizens are anonymous by design and
// never have one, so they get the brand mark instead. Either one opens the
// Profile tab, like tapping your Bitmoji on Snapchat.
//
// Search is a stub for now — the actual search backend (`searchPoliticians`,
// §4.A.11) isn't ported yet, see the parent repo's Flutter guide.
//
// Detail screens reached by pushing (Seat Detail, Politician Wall, News
// Article, Edit Profile, Auth, Onboarding, Set Location) keep a real
// AppBar with a title and back arrow — they're not primary destinations,
// this header is only for the five shell screens.
//
// Lives here rather than in core/widgets because it reads the signed-in
// profile (core must stay feature-agnostic, see ARCHITECTURE.md).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_config.dart';
import '../../../core/utils/haptics.dart';
import '../../../core/widgets/app_avatar.dart';
import '../../../core/widgets/pressable.dart';
import '../../features/profile/providers/profile_providers.dart';

/// Diameter shared by every circular control in the header, so the avatar,
/// search and action buttons line up as one row.
const double _kHeaderControlSize = 40;

class ScreenHeader extends ConsumerWidget implements PreferredSizeWidget {
  const ScreenHeader({super.key, required this.title, this.actions = const []});

  final String title;

  /// Trailing controls, laid out right-aligned — use [HeaderIconButton].
  /// Two is the most that fits beside a centred title on a small phone.
  final List<Widget> actions;

  @override
  Size get preferredSize => const Size.fromHeight(_kHeaderControlSize + 16);

  void _openSearch(BuildContext context) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('Search is coming soon.')));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final avatarUrl = ref.watch(ownProfileProvider).value?.politicianAvatarUrl;

    // Room for two controls (2 × 40 + 8 gap) on each side of the title, so
    // it stays optically centred and never runs into either cluster.
    const titleInset = _kHeaderControlSize * 2 + ChosenoSpacing.sm;

    return SizedBox(
      height: preferredSize.height,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: ChosenoSpacing.md),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: titleInset + ChosenoSpacing.sm,
              ),
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: ChosenoTypography.display(
                  color: palette.textMain,
                  fontSize: 21,
                ),
              ),
            ),
            Row(
              children: [
                _ProfileButton(
                  avatarUrl: avatarUrl,
                  onTap: () => context.go(AppRoutes.profile),
                ),
                const SizedBox(width: ChosenoSpacing.sm),
                HeaderIconButton(
                  icon: Icons.search_rounded,
                  tooltip: 'Search',
                  onTap: () => _openSearch(context),
                ),
                const Spacer(),
                for (final (i, action) in actions.indexed) ...[
                  if (i > 0) const SizedBox(width: ChosenoSpacing.sm),
                  action,
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// A round, softly-filled icon button — the header's one control shape.
class HeaderIconButton extends StatelessWidget {
  const HeaderIconButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;

  /// Doubles as the screen-reader label — an icon-only button has no other.
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Semantics(
      button: true,
      label: tooltip,
      excludeSemantics: true,
      child: Pressable(
        scale: 0.9,
        onTap: () {
          AppHaptics.select();
          onTap();
        },
        child: Container(
          width: _kHeaderControlSize,
          height: _kHeaderControlSize,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: palette.surfaceHover,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 22, color: palette.textSecondary),
        ),
      ),
    );
  }
}

/// The signed-in politician's photo, or — for citizens, who are anonymous
/// and have no photo — the brand mark drawn from the existing type/color
/// tokens (this app has no logo image asset yet, so no placeholder raster).
class _ProfileButton extends StatelessWidget {
  const _ProfileButton({required this.avatarUrl, required this.onTap});

  final String? avatarUrl;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final hasPhoto = avatarUrl != null && avatarUrl!.trim().isNotEmpty;

    return Semantics(
      button: true,
      label: 'Profile',
      excludeSemantics: true,
      child: Pressable(
        scale: 0.92,
        onTap: () {
          AppHaptics.select();
          onTap();
        },
        child: hasPhoto
            ? Container(
                width: _kHeaderControlSize,
                height: _kHeaderControlSize,
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: ChosenoGradients.primary(palette),
                ),
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: palette.background,
                  ),
                  child: AppAvatar(
                    imageUrl: avatarUrl,
                    fallbackIcon: Icons.person_outline,
                    radius: 16,
                  ),
                ),
              )
            : Container(
                width: _kHeaderControlSize,
                height: _kHeaderControlSize,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: ChosenoGradients.primary(palette),
                  shape: BoxShape.circle,
                ),
                child: Text(
                  'C',
                  style: ChosenoTypography.display(
                    color: palette.textOnPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 19,
                  ),
                ),
              ),
      ),
    );
  }
}
