// The app-wide canvas: the palette's background colour with a faint
// electoral-map SVG (contour lines + soft blue / violet / orange glows) behind
// every screen — the same look as the sign-in page — instead of flat white.
//
// Screens' Scaffolds are transparent (see AppTheme), so this shows through.
// Applied once around the whole app (MaterialApp.router `builder`).
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'theme_config.dart';

class AppBackdrop extends StatelessWidget {
  const AppBackdrop({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette =
        Theme.of(context).extension<ChosenoPalette>() ?? ChosenoPalette.pulse;
    return Stack(
      fit: StackFit.expand,
      children: [
        ColoredBox(color: palette.background),
        // Painted once and cached by RepaintBoundary, so scrolling content
        // above it does not re-rasterise the SVG.
        RepaintBoundary(
          child: SvgPicture.asset(
            'assets/svg/app_backdrop.svg',
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
          ),
        ),
        child,
      ],
    );
  }
}
