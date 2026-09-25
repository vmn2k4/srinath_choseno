// Port of the website's Button.jsx — every action in the app, including
// icon-only actions, goes through this (DESIGN.md rule #3). A raw
// ElevatedButton/TextButton at a call site is a sign it should have been
// AppButton instead.
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/theme_config.dart';
import '../utils/haptics.dart';
import 'pressable.dart';

enum AppButtonVariant { primary, outline, text, icon }

enum AppButtonTone { primary, danger, success, defaultTone }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.tone = AppButtonTone.primary,
    this.icon,
    this.loading = false,
  });

  /// Icon-only constructor — mirrors the web's `variant="icon"` (e.g. vote
  /// arrows, report flag, share icon).
  const AppButton.icon({
    super.key,
    required IconData this.icon,
    required this.onPressed,
    this.tone = AppButtonTone.defaultTone,
    this.loading = false,
  }) : label = '',
       variant = AppButtonVariant.icon;

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final AppButtonTone tone;
  final IconData? icon;
  final bool loading;

  Color _toneColor(ChosenoPalette palette) {
    switch (tone) {
      case AppButtonTone.primary:
        return palette.primary;
      case AppButtonTone.danger:
        return palette.danger;
      case AppButtonTone.success:
        return palette.success;
      case AppButtonTone.defaultTone:
        return palette.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final color = _toneColor(palette);

    if (variant == AppButtonVariant.icon) {
      return IconButton(
        onPressed: loading ? null : onPressed,
        icon: loading
            ? SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: color),
              )
            : Icon(icon, color: color),
      );
    }

    final child = loading
        ? SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: variant == AppButtonVariant.primary
                  ? palette.textOnPrimary
                  : color,
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18),
                const SizedBox(width: ChosenoSpacing.sm),
              ],
              // Flexible so a long label wraps instead of overflowing a
              // narrow phone / large accessibility font.
              Flexible(child: Text(label, textAlign: TextAlign.center)),
            ],
          );

    switch (variant) {
      case AppButtonVariant.primary:
        if (tone == AppButtonTone.primary) {
          return _GradientButton(
            onPressed: loading ? null : onPressed,
            child: child,
          );
        }
        return ElevatedButton(
          onPressed: loading ? null : onPressed,
          style: tone == AppButtonTone.primary
              ? null // inherit theme default (primary color)
              : ElevatedButton.styleFrom(
                  backgroundColor: color,
                  foregroundColor: palette.textOnPrimary,
                ),
          child: child,
        );
      case AppButtonVariant.outline:
        return OutlinedButton(
          onPressed: loading ? null : onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: color,
            side: BorderSide(color: color, width: 1.5),
          ),
          child: child,
        );
      case AppButtonVariant.text:
        return TextButton(
          onPressed: loading ? null : onPressed,
          style: TextButton.styleFrom(foregroundColor: color),
          child: child,
        );
      case AppButtonVariant.icon:
        throw StateError('unreachable — handled above');
    }
  }
}

/// The brand call-to-action: violet→orchid gradient, soft coloured glow, and
/// a springy press. Only the default (primary-tone) filled button uses it —
/// danger/success filled buttons stay flat so a destructive action never
/// looks like the brand's happy path.
class _GradientButton extends StatelessWidget {
  const _GradientButton({required this.onPressed, required this.child});

  final VoidCallback? onPressed;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final enabled = onPressed != null;
    return Pressable(
      onTap: onPressed == null
          ? null
          : () {
              AppHaptics.tap();
              onPressed!();
            },
      borderRadius: BorderRadius.circular(16),
      child: Opacity(
        opacity: enabled ? 1 : 0.45,
        child: Container(
          constraints: const BoxConstraints(minHeight: 52, minWidth: 64),
          padding: const EdgeInsets.symmetric(horizontal: ChosenoSpacing.lg),
          decoration: BoxDecoration(
            gradient: ChosenoGradients.primary(palette),
            borderRadius: BorderRadius.circular(16),
            boxShadow: enabled
                ? [
                    BoxShadow(
                      color: palette.primary.withValues(alpha: 0.38),
                      blurRadius: 18,
                      offset: const Offset(0, 6),
                    ),
                  ]
                : null,
          ),
          child: Center(
            widthFactor: 1,
            heightFactor: 1,
            child: DefaultTextStyle(
              style: ChosenoTypography.body(
                color: palette.textOnPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 15,
              ),
              child: IconTheme(
                data: IconThemeData(color: palette.textOnPrimary),
                child: child,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
