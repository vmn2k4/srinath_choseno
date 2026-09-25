// The heading row that opens every content section on the primary screens —
// a tinted icon tile, a display-font title, an optional one-line subtitle,
// and an optional trailing action. One widget so every section on every
// screen gets identical rhythm and breathing room instead of each screen
// hand-rolling an icon + Text row.
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/theme_config.dart';

class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.icon,
    this.subtitle,
    this.trailing,
  });

  final String title;
  final IconData? icon;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (icon != null) ...[
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: palette.primary.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, size: 20, color: palette.primary),
          ),
          const SizedBox(width: ChosenoSpacing.md),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: ChosenoTypography.display(
                  color: palette.textMain,
                  fontSize: 22,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: ChosenoSpacing.sm),
          trailing!,
        ],
      ],
    );
  }
}
