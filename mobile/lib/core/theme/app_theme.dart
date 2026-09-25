// Turns a [ChosenoPalette] token set into a real Flutter [ThemeData]. This
// is the ONLY file that should ever construct a ThemeData — screens and
// widgets consume the result via `Theme.of(context)` /
// `ChosenoTheme.of(context)`, never build their own.
library;

import 'package:flutter/material.dart';

import 'theme_config.dart';

/// Convenience accessor so a widget can write
/// `ChosenoTheme.of(context).primary` instead of the more verbose
/// `Theme.of(context).extension<ChosenoPalette>()!.primary`.
/// Corner radius for buttons and inputs — rounder than the website's 8px
/// small-control radius on purpose: on a touch screen a 52pt-tall control
/// with a soft 16pt corner reads (and taps) as a native control.
const double _controlRadius = 16;

abstract final class ChosenoTheme {
  static ChosenoPalette of(BuildContext context) {
    final palette = Theme.of(context).extension<ChosenoPalette>();
    assert(
      palette != null,
      'ChosenoPalette theme extension not found — '
      'wrap the app in a MaterialApp using AppTheme.build().',
    );
    return palette ?? ChosenoPalette.pulse;
  }
}

abstract final class AppTheme {
  /// Builds the app's single (currently dark-only, matching the website's
  /// default) [ThemeData]. Takes a [ChosenoPalette] explicitly rather than
  /// hardcoding [ChosenoPalette.pulse] so a future theme switcher
  /// (mirroring the website's Admin → Theme, DESIGN.md's Theming section)
  /// can rebuild this with a different palette without touching this
  /// function's shape.
  static ThemeData build(ChosenoPalette palette) {
    final textTheme = TextTheme(
      displayLarge: ChosenoTypography.display(
        color: palette.textMain,
        fontSize: 40,
        fontWeight: FontWeight.w700,
      ),
      displayMedium: ChosenoTypography.display(
        color: palette.textMain,
        fontSize: 32,
        fontWeight: FontWeight.w700,
      ),
      headlineLarge: ChosenoTypography.display(
        color: palette.textMain,
        fontSize: 26,
        fontWeight: FontWeight.w600,
      ),
      headlineMedium: ChosenoTypography.display(
        color: palette.textMain,
        fontSize: 22,
        fontWeight: FontWeight.w600,
      ),
      titleLarge: ChosenoTypography.body(
        color: palette.textMain,
        fontSize: 18,
        fontWeight: FontWeight.w700,
      ),
      titleMedium: ChosenoTypography.body(
        color: palette.textMain,
        fontSize: 16,
        fontWeight: FontWeight.w600,
      ),
      bodyLarge: ChosenoTypography.body(color: palette.textMain, fontSize: 16),
      bodyMedium: ChosenoTypography.body(color: palette.textMain, fontSize: 14),
      bodySmall: ChosenoTypography.body(color: palette.textMuted, fontSize: 12),
      labelLarge: ChosenoTypography.body(
        color: palette.textOnPrimary,
        fontSize: 15,
        fontWeight: FontWeight.w700,
      ),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: palette.background,
      colorScheme: ColorScheme.dark(
        primary: palette.primary,
        onPrimary: palette.textOnPrimary,
        secondary: palette.accent,
        onSecondary: palette.textOnPrimary,
        surface: palette.surface,
        onSurface: palette.textMain,
        error: palette.danger,
        onError: palette.textOnPrimary,
        outline: palette.border,
      ),
      textTheme: textTheme,
      // Pushed detail screens: flat, background-coloured, no scroll tint —
      // the page content is the star, not a heavy toolbar.
      appBarTheme: AppBarTheme(
        backgroundColor: palette.background,
        foregroundColor: palette.textMain,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: ChosenoTypography.body(
          color: palette.textMain,
          fontSize: 17,
          fontWeight: FontWeight.w700,
        ),
      ),
      cardTheme: CardThemeData(
        color: palette.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ChosenoRadii.card),
          side: BorderSide(color: palette.borderLight),
        ),
      ),
      dividerTheme: DividerThemeData(color: palette.border, space: 1),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: palette.primary,
          foregroundColor: palette.textOnPrimary,
          textStyle: ChosenoTypography.body(
            color: palette.textOnPrimary,
            fontWeight: FontWeight.w700,
          ),
          elevation: 0,
          minimumSize: const Size(64, 52),
          padding: const EdgeInsets.symmetric(
            horizontal: ChosenoSpacing.lg,
            vertical: ChosenoSpacing.md,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_controlRadius),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: palette.primary,
          side: BorderSide(color: palette.primary, width: 1.5),
          minimumSize: const Size(64, 52),
          textStyle: ChosenoTypography.body(
            color: palette.primary,
            fontWeight: FontWeight.w700,
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: ChosenoSpacing.lg,
            vertical: ChosenoSpacing.md,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_controlRadius),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: palette.primary,
          textStyle: ChosenoTypography.body(
            color: palette.primary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: palette.surfaceHover,
        hintStyle: ChosenoTypography.body(color: palette.textMuted),
        labelStyle: ChosenoTypography.body(color: palette.textSecondary),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: ChosenoSpacing.md + 2,
          vertical: ChosenoSpacing.md + 2,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_controlRadius),
          borderSide: BorderSide(color: palette.borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_controlRadius),
          borderSide: BorderSide(color: palette.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_controlRadius),
          borderSide: BorderSide(color: palette.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_controlRadius),
          borderSide: BorderSide(color: palette.danger),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: palette.surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: palette.border,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: palette.surfaceElevated,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ChosenoRadii.card),
        ),
        titleTextStyle: ChosenoTypography.display(
          color: palette.textMain,
          fontSize: 22,
        ),
        contentTextStyle: ChosenoTypography.body(
          color: palette.textSecondary,
          fontSize: 14,
          height: 1.45,
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: palette.surfaceActive,
        contentTextStyle: ChosenoTypography.body(color: palette.textMain),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(_controlRadius),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: palette.surface,
        height: 68,
        indicatorColor: palette.primary.withValues(alpha: 0.18),
        surfaceTintColor: Colors.transparent,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => ChosenoTypography.body(
            color: states.contains(WidgetState.selected)
                ? palette.primary
                : palette.textMuted,
            fontSize: 11,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? palette.primary
                : palette.textMuted,
          ),
        ),
      ),
      extensions: <ThemeExtension<dynamic>>[palette],
    );
  }
}
