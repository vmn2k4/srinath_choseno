// Shimmering placeholder blocks. A screen that shows the *shape* of its
// content while loading feels dramatically faster than one showing a lone
// spinner, even when the data takes exactly as long. One shared animation
// clock per [SkeletonScope] keeps every block on a screen shimmering in
// sync.
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/theme_config.dart';
import 'app_card.dart';

class SkeletonScope extends StatefulWidget {
  const SkeletonScope({super.key, required this.child});

  final Widget child;

  @override
  State<SkeletonScope> createState() => _SkeletonScopeState();
}

class _SkeletonScopeState extends State<SkeletonScope>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1300),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SkeletonAnimation(
      animation: _controller,
      child: ExcludeSemantics(child: widget.child),
    );
  }
}

class _SkeletonAnimation extends InheritedWidget {
  const _SkeletonAnimation({required this.animation, required super.child});

  final Animation<double> animation;

  static Animation<double>? maybeOf(BuildContext context) => context
      .dependOnInheritedWidgetOfExactType<_SkeletonAnimation>()
      ?.animation;

  @override
  bool updateShouldNotify(_SkeletonAnimation old) => old.animation != animation;
}

class SkeletonBox extends StatelessWidget {
  const SkeletonBox({super.key, this.width, this.height = 14, this.radius = 8});

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final animation = _SkeletonAnimation.maybeOf(context);
    final base = palette.surfaceHover;
    final highlight = palette.surfaceActive;
    if (animation == null) {
      return Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: base,
          borderRadius: BorderRadius.circular(radius),
        ),
      );
    }
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        final t = animation.value;
        return Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            gradient: LinearGradient(
              begin: Alignment(-1.5 + 3 * t, 0),
              end: Alignment(-0.5 + 3 * t, 0),
              colors: [base, highlight, base],
            ),
          ),
        );
      },
    );
  }
}

/// A card-shaped skeleton: avatar + two lines + body lines. Stand-in for a
/// feed post, news card or seat row.
class SkeletonCard extends StatelessWidget {
  const SkeletonCard({super.key, this.lines = 3});

  final int lines;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const SkeletonBox(width: 36, height: 36, radius: 18),
              const SizedBox(width: ChosenoSpacing.md),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonBox(width: 110, height: 12),
                  SizedBox(height: 6),
                  SkeletonBox(width: 70, height: 10),
                ],
              ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.md),
          for (var i = 0; i < lines; i++) ...[
            SkeletonBox(
              height: 12,
              width: i == lines - 1 ? 160 : double.infinity,
            ),
            const SizedBox(height: ChosenoSpacing.sm),
          ],
        ],
      ),
    );
  }
}

/// A screen-sized list of [SkeletonCard]s.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 4, this.padding});

  final int count;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        padding:
            padding ??
            const EdgeInsets.fromLTRB(
              ChosenoSpacing.lg,
              ChosenoSpacing.md,
              ChosenoSpacing.lg,
              ChosenoSpacing.lg,
            ),
        itemCount: count,
        separatorBuilder: (_, _) => const SizedBox(height: ChosenoSpacing.md),
        itemBuilder: (_, _) => const SkeletonCard(),
      ),
    );
  }
}
