// A calm, centred "nothing here yet" panel — icon in a soft tile, a short
// headline, one sentence of guidance, and an optional call to action.
// Replaces the bare grey `Text('No X yet.')` lines scattered across screens.
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/theme_config.dart';
import 'app_button.dart';

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ChosenoSpacing.lg,
        vertical: ChosenoSpacing.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: palette.primary.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 32, color: palette.primary),
          ),
          const SizedBox(height: ChosenoSpacing.md),
          Text(
            title,
            textAlign: TextAlign.center,
            style: ChosenoTypography.display(
              color: palette.textMain,
              fontSize: 22,
            ),
          ),
          if (message != null) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            Text(
              message!,
              textAlign: TextAlign.center,
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: 14,
                height: 1.45,
              ),
            ),
          ],
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: ChosenoSpacing.lg),
            AppButton(label: actionLabel!, onPressed: onAction),
          ],
        ],
      ),
    );
  }
}
