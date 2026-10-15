import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_config.dart';

/// Like and dislike as one pill — thumbs with their own counts (the website's
/// 👍 n 👎 n), each half a full touch target. Replaces the old up-arrow /
/// net-score / down-arrow control, whose arrows read as "move" not "react".
class VotePill extends StatelessWidget {
  const VotePill({
    super.key,
    required this.likes,
    required this.dislikes,
    required this.onLike,
    required this.onDislike,
  });

  final int likes;
  final int dislikes;
  final VoidCallback onLike;
  final VoidCallback onDislike;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: palette.surfaceHover,
        borderRadius: BorderRadius.circular(ChosenoRadii.full),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Half(
            icon: Icons.thumb_up_outlined,
            count: likes,
            label: 'Like',
            color: palette.success,
            onTap: onLike,
            left: true,
          ),
          Container(width: 1, height: 20, color: palette.borderLight),
          _Half(
            icon: Icons.thumb_down_outlined,
            count: dislikes,
            label: 'Dislike',
            color: palette.danger,
            onTap: onDislike,
            left: false,
          ),
        ],
      ),
    );
  }
}

class _Half extends StatelessWidget {
  const _Half({
    required this.icon,
    required this.count,
    required this.label,
    required this.color,
    required this.onTap,
    required this.left,
  });

  final IconData icon;
  final int count;
  final String label;
  final Color color;
  final VoidCallback onTap;
  final bool left;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final radius = Radius.circular(ChosenoRadii.full);
    return Semantics(
      button: true,
      label: '$label, $count',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.horizontal(
          left: left ? radius : Radius.zero,
          right: left ? Radius.zero : radius,
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44, minWidth: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 20, color: color),
                const SizedBox(width: 6),
                // The count ticks over with a quick scale so a reaction
                // visibly "lands".
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  transitionBuilder: (child, animation) => ScaleTransition(
                    scale: animation,
                    child: FadeTransition(opacity: animation, child: child),
                  ),
                  child: Text(
                    '$count',
                    key: ValueKey(count),
                    style: ChosenoTypography.body(
                      color: palette.textMain,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
