// The app-bar title block: a small "Choseno" wordmark on top, then the screen
// name (and an optional muted subtitle). Used by both ScreenHeader (tab
// screens) and DetailAppBar (pushed screens) so the brand always precedes
// the screen name.
import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_config.dart';

class BrandTitle extends StatelessWidget {
  const BrandTitle({
    super.key,
    required this.title,
    this.subtitle,
    this.titleSize = 17,
  });

  final String title;
  final String? subtitle;
  final double titleSize;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Choseno',
          maxLines: 1,
          style: ChosenoTypography.body(
            color: palette.primary,
            fontWeight: FontWeight.w600,
            fontSize: 11,
          ).copyWith(letterSpacing: 0.6),
        ),
        Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: ChosenoTypography.display(
            color: palette.textMain,
            fontSize: titleSize,
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
    );
  }
}
