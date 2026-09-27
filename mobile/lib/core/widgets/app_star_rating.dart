// Port of the website's StarRating.jsx — the one star-rating control every
// rating surface (politician wall, news article, seat detail) goes
// through, same "shared component library" rule as AppButton/AppCard.
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class AppStarRating extends StatelessWidget {
  const AppStarRating({
    super.key,
    required this.value,
    this.onChanged,
    this.size = 20,
    this.color,
  });

  /// Star count, 0-5. Rounds for display when [onChanged] is null (a
  /// read-only average like "3.7"); an exact int when interactive.
  final double value;

  /// Null renders read-only (e.g. showing someone else's average) — the
  /// icons aren't wrapped in a tap target at all, not just disabled, so it
  /// never intercepts a parent's own onTap (a card row that navigates on
  /// tap, say).
  final ValueChanged<int>? onChanged;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final starColor = color ?? palette.primary;
    final filledCount = value.round();

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        final icon = Icon(
          i < filledCount ? Icons.star_rounded : Icons.star_border_rounded,
          size: size,
          color: starColor,
        );
        if (onChanged == null) return icon;
        return GestureDetector(onTap: () => onChanged!(i + 1), child: icon);
      }),
    );
  }
}
