// Port of the website's Badge.jsx — every status/role/type pill (election
// status, candidate status, "Leading"/"Tied", boundary tags) goes through
// this, never a raw colored Container (DESIGN.md rule #3).
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/theme_config.dart';

enum AppBadgeTone {
  primary,
  accent,
  danger,
  warning,
  caution,
  success,
  neutral,
}

enum AppBadgeSize { xs2, xs, sm }

class AppBadge extends StatelessWidget {
  const AppBadge({
    super.key,
    required this.label,
    this.tone = AppBadgeTone.neutral,
    this.size = AppBadgeSize.sm,
  });

  final String label;
  final AppBadgeTone tone;
  final AppBadgeSize size;

  Color _color(ChosenoPalette palette) {
    switch (tone) {
      case AppBadgeTone.primary:
        return palette.primary;
      case AppBadgeTone.accent:
        return palette.accent;
      case AppBadgeTone.danger:
        return palette.danger;
      case AppBadgeTone.warning:
        return palette.warning;
      case AppBadgeTone.caution:
        return palette.caution;
      case AppBadgeTone.success:
        return palette.success;
      case AppBadgeTone.neutral:
        return palette.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final color = _color(palette);
    // Amber / green at their fill shades are below 4.5:1 as small text on a
    // light background, so light themes use the darker "-Light" shade for the
    // label (the tint and border keep the semantic colour).
    final textColor = palette.isLight
        ? switch (tone) {
            AppBadgeTone.warning ||
            AppBadgeTone.caution => palette.warningLight,
            AppBadgeTone.success => palette.successLight,
            _ => color,
          }
        : color;
    final fontSize = size == AppBadgeSize.xs2
        ? 10.0
        : (size == AppBadgeSize.xs ? 11.0 : 12.0);
    final vPad = size == AppBadgeSize.xs2 ? 1.0 : 3.0;
    final hPad = size == AppBadgeSize.xs2 ? 6.0 : 9.0;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(ChosenoRadii.full),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: ChosenoTypography.body(
          color: textColor,
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
