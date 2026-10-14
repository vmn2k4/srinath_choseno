// The app-bar title: "Choseno - Screen name" on ONE line (brand in the primary
// colour, then the screen name), optionally followed by a muted detail such as
// the place for a race. Single line on purpose — the bar must not grow.
// Used by ScreenHeader (tab screens) and DetailAppBar (pushed screens).
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
    final base = ChosenoTypography.display(
      color: palette.textMain,
      fontSize: titleSize,
    );
    return Text.rich(
      TextSpan(
        style: base,
        children: [
          TextSpan(
            text: 'Choseno',
            style: base.copyWith(color: palette.primary),
          ),
          TextSpan(
            text: ' - ',
            style: base.copyWith(color: palette.textDark),
          ),
          TextSpan(text: title),
          if (subtitle != null)
            TextSpan(
              text: '  $subtitle',
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: titleSize * 0.7,
              ),
            ),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      textAlign: TextAlign.center,
    );
  }
}
