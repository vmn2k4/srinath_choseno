import 'dart:math' as math;

import 'package:choseno_mobile/core/theme/theme_config.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ChosenoPalette', () {
    test('civicOriginal matches the website\'s default theme tokens', () {
      const palette = ChosenoPalette.civicOriginal;
      // Spot-check against src/app/globals.css's @theme block (parent
      // repo) rather than asserting every field — these three are the
      // ones most likely to silently drift if someone "fixes" a color
      // without checking the web source first.
      expect(palette.background.toARGB32(), 0xFF14080E);
      expect(palette.primary.toARGB32(), 0xFFE9EB9E);
      expect(palette.textMain.toARGB32(), 0xFFF4F5F0);
    });

    test('copyWith overrides only the given fields', () {
      const palette = ChosenoPalette.civicOriginal;
      final copy = palette.copyWith(primary: const Color(0xFF000000));
      expect(copy.primary.toARGB32(), 0xFF000000);
      expect(copy.accent, palette.accent);
    });

    test('lerp at t=0 returns the start palette, t=1 the end palette', () {
      const a = ChosenoPalette.civicOriginal;
      final b = a.copyWith(primary: const Color(0xFFFFFFFF));
      expect(a.lerp(b, 0).primary, a.primary);
      expect(a.lerp(b, 1).primary, b.primary);
    });
  });

  group('ChosenoPalette.pulse (the mobile palette)', () {
    // WCAG 2.x contrast ratio between two opaque colours.
    double contrast(Color a, Color b) {
      double lum(Color c) {
        double ch(double v) => v <= 0.03928
            ? v / 12.92
            : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
        return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
      }

      final la = lum(a), lb = lum(b);
      final hi = math.max(la, lb), lo = math.min(la, lb);
      return (hi + 0.05) / (lo + 0.05);
    }

    const p = ChosenoPalette.pulse;

    test('body text clears WCAG AA (4.5:1) on every surface it sits on', () {
      for (final bg in [p.background, p.surface, p.surfaceElevated]) {
        expect(contrast(p.textMain, bg), greaterThanOrEqualTo(4.5));
        expect(contrast(p.textSecondary, bg), greaterThanOrEqualTo(4.5));
        expect(contrast(p.textTertiary, bg), greaterThanOrEqualTo(4.5));
        expect(contrast(p.textMuted, bg), greaterThanOrEqualTo(4.5));
      }
    });

    test('button labels clear AA on both ends of the brand gradient', () {
      expect(contrast(p.textOnPrimary, p.primary), greaterThanOrEqualTo(4.5));
      // The gradient's far end is lighter; large bold labels need 3:1.
      expect(contrast(p.textOnPrimary, p.primaryGlow), greaterThanOrEqualTo(3));
    });

    test('cards are opaque so they never need a backdrop blur', () {
      expect(p.surfaceElevated.a, 1);
    });
  });
}
