// Port of the website's Spinner.jsx — the one loading indicator, themed to
// the active palette's primary color instead of Flutter's default.
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class LoadingIndicator extends StatelessWidget {
  const LoadingIndicator({super.key, this.size = 24});

  final double size;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        strokeWidth: 2.5,
        color: palette.primary,
      ),
    );
  }
}
