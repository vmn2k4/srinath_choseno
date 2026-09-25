// Port of the website's Card.jsx — the one surface primitive every glass
// panel, list row, and dashed placeholder goes through (DESIGN.md rule #2:
// "every surface goes through the shared glass recipe. Nobody hand-rolls a
// <div> with its own one-off background/border combination.") Same rule
// applies here: a new screen reaches for AppCard, it doesn't build its own
// Container with a hand-picked color/border/shadow.
import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/theme_config.dart';
import 'pressable.dart';

enum AppCardVariant {
  /// Standard panel — most list items, form sections, content blocks.
  standard,

  /// Featured/prominent surface — more blur, more shadow (elevation-3 on
  /// web). Use for hero panels, featured cards, floating badges.
  hero,

  /// A single scrollable row inside a list (elevation-1 on web — the
  /// cheapest, since it repeats many times per screen).
  row,

  /// An empty-state / drop-target placeholder — dashed border, no glass
  /// blur.
  dashed,
}

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.variant = AppCardVariant.standard,
    this.padding,
    this.onTap,
  });

  final Widget child;
  final AppCardVariant variant;

  /// Defaults by variant: 20 for panels, 16 for compact list rows.
  final EdgeInsets? padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final padding =
        this.padding ??
        EdgeInsets.all(
          variant == AppCardVariant.row
              ? ChosenoSpacing.md
              : ChosenoSpacing.md + 4,
        );

    if (variant == AppCardVariant.dashed) {
      return _DashedCard(palette: palette, padding: padding, child: child);
    }

    final shadows = variant == AppCardVariant.hero
        ? ChosenoShadows.elevatedLg(palette)
        : ChosenoShadows.elevatedMd(palette);
    final radius = BorderRadius.circular(ChosenoRadii.card);

    // Solid surfaces (the mobile palette) skip BackdropFilter entirely — a
    // blur behind every card in a scrolling list is the single most
    // expensive thing this widget could do, and buys nothing on an opaque
    // fill. A translucent palette (the web's glass look) still gets it.
    final isGlass = palette.surfaceElevated.a < 1;
    final blurSigma = variant == AppCardVariant.hero
        ? 24.0
        : variant == AppCardVariant.row
        ? 10.0
        : 16.0;

    final surface = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: palette.surfaceElevated,
        borderRadius: radius,
        border: Border.all(color: palette.borderLight),
        gradient: variant == AppCardVariant.hero
            ? ChosenoGradients.wash(palette)
            : LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  palette.glassHighlight.withValues(alpha: 0.05),
                  Colors.transparent,
                ],
                stops: const [0.0, 0.08],
              ),
      ),
      child: child,
    );

    final content = ClipRRect(
      borderRadius: radius,
      child: isGlass
          ? BackdropFilter(
              filter: ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
              child: surface,
            )
          : surface,
    );

    final decorated = DecoratedBox(
      decoration: BoxDecoration(borderRadius: radius, boxShadow: shadows),
      child: content,
    );

    if (onTap == null) return decorated;
    return Pressable(
      onTap: onTap,
      scale: 0.98,
      borderRadius: radius,
      child: decorated,
    );
  }
}

class _DashedCard extends StatelessWidget {
  const _DashedCard({
    required this.palette,
    required this.padding,
    required this.child,
  });

  final ChosenoPalette palette;
  final EdgeInsets padding;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _DashedBorderPainter(
        color: palette.borderLight,
        radius: ChosenoRadii.card,
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({required this.color, required this.radius});

  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    const dashWidth = 6.0;
    const dashSpace = 4.0;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = distance + dashWidth;
        canvas.drawPath(
          metric.extractPath(distance, next.clamp(0, metric.length)),
          paint,
        );
        distance = next + dashSpace;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.radius != radius;
}
