// Staggered entrance for list items: each fades up ~14px into place, a few
// tens of milliseconds after the one before it. Runs once per item (when
// it first builds), capped so a long list never queues seconds of delay.
import 'package:flutter/material.dart';

class FadeSlideIn extends StatelessWidget {
  const FadeSlideIn({super.key, required this.child, this.index = 0});

  final Widget child;

  /// Position in the list — drives the stagger delay (capped at 8 steps).
  final int index;

  @override
  Widget build(BuildContext context) {
    final step = index.clamp(0, 8);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 320 + step * 45),
      curve: Curves.easeOutCubic,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, (1 - t) * 14),
          child: child,
        ),
      ),
      child: child,
    );
  }
}
