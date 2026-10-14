import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_config.dart';

/// Up / score / down as one pill — a single, easy-to-hit control instead of
/// two loose icon buttons.
class VotePill extends StatelessWidget {
  const VotePill({
    super.key,
    required this.score,
    required this.onUp,
    required this.onDown,
  });

  final int score;
  final VoidCallback onUp;
  final VoidCallback onDown;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: palette.surfaceHover,
        borderRadius: BorderRadius.circular(ChosenoRadii.full),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.arrow_upward, size: 19),
            color: palette.success,
            onPressed: onUp,
          ),
          // The count ticks over with a quick scale so a vote visibly
          // "lands" — the small dopamine hit that makes voting feel good.
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            transitionBuilder: (child, animation) => ScaleTransition(
              scale: animation,
              child: FadeTransition(opacity: animation, child: child),
            ),
            child: Text(
              '$score',
              key: ValueKey(score),
              style: ChosenoTypography.body(
                color: palette.textMain,
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.arrow_downward, size: 19),
            color: palette.danger,
            onPressed: onDown,
          ),
        ],
      ),
    );
  }
}
