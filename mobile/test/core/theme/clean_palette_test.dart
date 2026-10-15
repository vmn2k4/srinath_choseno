import 'package:choseno_mobile/core/theme/theme_config.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final hi = la > lb ? la : lb;
  final lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  const p = ChosenoPalette.clean;

  test(
    'Clean palette is light and flat (no gradient between primary ends)',
    () {
      expect(p.isLight, isTrue);
      expect(p.primaryGlow, p.primary);
    },
  );

  test('Clean body text clears WCAG AA on its surfaces', () {
    for (final bg in [p.background, p.surface, p.surfaceHover]) {
      expect(_contrast(p.textMain, bg), greaterThanOrEqualTo(4.5));
      expect(_contrast(p.textMuted, bg), greaterThanOrEqualTo(4.5));
      expect(_contrast(p.primary, bg), greaterThanOrEqualTo(4.5));
    }
  });

  test('Clean button label and semantic label shades clear AA', () {
    expect(_contrast(p.textOnPrimary, p.primary), greaterThanOrEqualTo(4.5));
    expect(_contrast(p.warningLight, p.background), greaterThanOrEqualTo(4.5));
    expect(_contrast(p.successLight, p.background), greaterThanOrEqualTo(4.5));
    expect(_contrast(p.danger, p.background), greaterThanOrEqualTo(4.5));
  });
}
