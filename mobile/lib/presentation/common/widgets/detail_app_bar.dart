// The top bar for every pushed (non-tab) screen — Seat Detail, a wall, an
// article, race lists, Edit Profile, etc. It is the sibling of ScreenHeader
// (the tab-screen header) and uses the same round, softly-filled 40pt
// control so the whole app reads as one system:
//
//     (‹)        Title         (action) (action)
//
// Back always works: it pops when there is something to pop, and otherwise
// (a deep link opened this screen cold, e.g. a shared /p/<code> link) goes
// Home, so a pushed screen is never a dead end. [onBack] overrides that for
// multi-step flows (Edit Profile steps back within itself first).
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_config.dart';
import 'screen_header.dart';

const double _kBarHeight = 56;

class DetailAppBar extends StatelessWidget implements PreferredSizeWidget {
  const DetailAppBar({
    super.key,
    this.title,
    this.subtitle,
    this.actions = const [],
    this.onBack,
  });

  final String? title;

  /// Small muted line under the title (e.g. the place for a race).
  final String? subtitle;

  /// Trailing controls — use [HeaderIconButton]. Two fit beside the title.
  final List<Widget> actions;

  final VoidCallback? onBack;

  @override
  Size get preferredSize => const Size.fromHeight(_kBarHeight);

  void _defaultBack(BuildContext context) {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.home);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    // Same inset on both sides keeps the title optically centred whether
    // there are zero, one or two trailing actions.
    final slots = actions.isEmpty ? 1 : actions.length;
    final sideInset = 40.0 * slots + ChosenoSpacing.sm * slots;

    return SafeArea(
      bottom: false,
      child: SizedBox(
        height: _kBarHeight,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: ChosenoSpacing.md),
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (title != null)
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: sideInset),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: ChosenoTypography.body(
                          color: palette.textMain,
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                        ),
                      ),
                      if (subtitle != null)
                        Text(
                          subtitle!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: ChosenoTypography.body(
                            color: palette.textMuted,
                            fontSize: 12,
                          ),
                        ),
                    ],
                  ),
                ),
              Row(
                children: [
                  HeaderIconButton(
                    icon: Icons.arrow_back_ios_new_rounded,
                    tooltip: 'Back',
                    onTap: onBack ?? () => _defaultBack(context),
                  ),
                  const Spacer(),
                  for (final (i, a) in actions.indexed) ...[
                    if (i > 0) const SizedBox(width: ChosenoSpacing.sm),
                    a,
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
