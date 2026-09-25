// Single source of truth for every color, font, radius, spacing, and shadow
// value used anywhere in this app. Nothing outside this file (and
// [app_theme.dart], which turns this into a Flutter [ThemeData]) should ever
// write a raw Color(...) / hex / font family string — components read
// tokens from here (usually indirectly, via Theme.of(context)), exactly the
// same "every color is a semantic token, never a raw value" rule the
// website's DESIGN.md enforces in CSS. If a color/spacing value doesn't
// have a token yet, add one here — don't inline it at the call site.
//
// Values are a direct port of the website's "civic-original" default theme
// (src/app/globals.css's `@theme` block + DESIGN.md), so the app reads as
// the same product as the web, not a reskin. The website ships 13
// admin-switchable palettes (see DESIGN.md's Theming section); only the
// default is ported here. To add another palette later: copy
// [ChosenoPalette.civicOriginal] into a new named constant with that
// theme's `[data-theme="..."]` overrides from globals.css applied, add it
// to a theme picker, and nothing else in the app needs to change — every
// widget already reads colors through [ChosenoPalette], never a literal.
library;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// One full set of semantic color roles — one instance per switchable
/// theme. Field names mirror the CSS custom-property names in
/// `src/app/globals.css` 1:1 (`primary`, `surfaceHover`, `textMuted`, ...)
/// so porting a new web theme override is a mechanical find-the-CSS-block,
/// fill-the-matching-fields exercise, not a redesign.
///
/// Implements Flutter's [ThemeExtension] so it rides on the normal
/// `Theme.of(context)` mechanism instead of a bespoke InheritedWidget —
/// any widget reaches it with `ChosenoTheme.of(context)` (see
/// `app_theme.dart`), the same way it would reach `Theme.of(context).textTheme`.
@immutable
class ChosenoPalette extends ThemeExtension<ChosenoPalette> {
  const ChosenoPalette({
    required this.background,
    required this.surface,
    required this.surfaceHover,
    required this.surfaceActive,
    required this.surfaceElevated,
    required this.border,
    required this.borderLight,
    required this.textMain,
    required this.textSecondary,
    required this.textTertiary,
    required this.textMuted,
    required this.textDark,
    required this.textDarker,
    required this.primary,
    required this.primaryHover,
    required this.primaryLight,
    required this.primaryLighter,
    required this.primaryGlow,
    required this.accent,
    required this.accentHover,
    required this.danger,
    required this.dangerLight,
    required this.dangerLighter,
    required this.warning,
    required this.warningLight,
    required this.caution,
    required this.cautionLight,
    required this.success,
    required this.successLight,
    required this.textOnPrimary,
    required this.overlay,
    required this.overlayHeavy,
    required this.glassHighlight,
  });

  final Color background;
  final Color surface;
  final Color surfaceHover;
  final Color surfaceActive;
  final Color surfaceElevated;

  final Color border;
  final Color borderLight;

  final Color textMain;
  final Color textSecondary;
  final Color textTertiary;
  final Color textMuted;
  final Color textDark;
  final Color textDarker;

  final Color primary;
  final Color primaryHover;
  final Color primaryLight;
  final Color primaryLighter;

  /// The far end of the brand gradient (see [ChosenoGradients]) — primary
  /// buttons, the logo mark, and hero accents fade from [primary] to this.
  final Color primaryGlow;

  final Color accent;
  final Color accentHover;

  // Semantic states stay constant across every theme on the web (a warning
  // is amber no matter which brand palette is active) — carried over
  // per-palette here anyway so a palette CAN override them later without
  // restructuring, but every palette should copy these same four for now.
  final Color danger;
  final Color dangerLight;
  final Color dangerLighter;
  final Color warning;
  final Color warningLight;
  final Color caution;
  final Color cautionLight;
  final Color success;
  final Color successLight;

  /// Text drawn on a filled primary/warning-colored surface (button
  /// labels) — deliberately its own token, never reused from [textDarker],
  /// see DESIGN.md's Colors section for why.
  final Color textOnPrimary;

  final Color overlay;
  final Color overlayHeavy;

  /// Approximates the web's `color-mix(in srgb, var(--color-primary) 30%,
  /// white)` — Flutter has no direct color-mix equivalent, so this is
  /// pre-computed per palette rather than derived at runtime. Used as the
  /// specular top-edge highlight on glass surfaces (see
  /// [ChosenoShadows] / the elevation system below).
  final Color glassHighlight;

  /// The website's default ("civic-original") dark theme — verified
  /// against `src/app/globals.css` and `DESIGN.md` on 2026-09-17.
  static const civicOriginal = ChosenoPalette(
    background: Color(0xFF14080E), // --color-coffee-bean
    surface: Color(0xFF201A24),
    surfaceHover: Color(0xFF322B37),
    surfaceActive: Color(0xFF443C4C),
    surfaceElevated: Color(0x5949475B), // vintage-grape @ 35% alpha
    border: Color(0xFF3C3543),
    borderLight: Color(0x40799496), // cool-steel @ 25% alpha
    textMain: Color(0xFFF4F5F0),
    textSecondary: Color(0xFFE9EB9E), // vanilla-custard
    textTertiary: Color(0xFFACC196), // muted-olive
    textMuted: Color(0xFF799496), // cool-steel
    textDark: Color(0xFF49475B), // vintage-grape
    textDarker: Color(0xFF2F2D3D),
    primary: Color(0xFFE9EB9E), // vanilla-custard
    primaryHover: Color(0xFFDBDD8D),
    primaryLight: Color(0xFFACC196), // muted-olive
    primaryLighter: Color(0xFF799496), // cool-steel
    primaryGlow: Color(0xFFACC196),
    accent: Color(0xFFACC196), // muted-olive
    accentHover: Color(0xFF9BB185),
    danger: Color(0xFFF43F5E), // Tailwind rose-500
    dangerLight: Color(0xFFFB7185), // rose-400
    dangerLighter: Color(0xFFFDA4AF), // rose-300
    warning: Color(0xFFF59E0B), // amber-500
    warningLight: Color(0xFFFCD34D), // amber-300
    caution: Color(0xFFF97316), // orange-500
    cautionLight: Color(0xFFFDBA74), // orange-300
    success: Color(0xFF10B981), // emerald-500
    successLight: Color(0xFF6EE7B7), // emerald-300
    textOnPrimary: Color(0xFF020617), // slate-950
    overlay: Color(0x40000000), // rgba(0,0,0,0.25)
    overlayHeavy: Color(0xF2000000), // rgba(0,0,0,0.95)
    glassHighlight: Color(0xFFF8F9E2), // color-mix(primary 30%, white)
  );

  /// The mobile app's own palette — deliberately NOT the website's. The
  /// web palette (pale olive on maroon-black, translucent glass, cool-grey
  /// text) reads muted and low-contrast on a phone held at arm's length.
  /// "Midnight Pulse" is built for a handheld screen: a near-black ink
  /// canvas, solid (fast, no-blur) surfaces stepped up in clear increments,
  /// an electric violet→orchid brand gradient that pops on dark, and a
  /// mint accent. Every text/background pairing clears WCAG AA (asserted in
  /// theme_config_test.dart). The website is unaffected.
  static const pulse = ChosenoPalette(
    background: Color(0xFF0A0B10),
    surface: Color(0xFF12141C),
    surfaceHover: Color(0xFF1B1E2A),
    surfaceActive: Color(0xFF262A3A),
    surfaceElevated: Color(0xFF161925), // opaque on purpose: no blur cost
    border: Color(0xFF262A38),
    borderLight: Color(0x1FFFFFFF), // white @ 12%
    textMain: Color(0xFFF5F6FA),
    textSecondary: Color(0xFFCBD0DF),
    textTertiary: Color(0xFF9EA5BA),
    textMuted: Color(0xFF8089A0),
    textDark: Color(0xFF5A6178),
    textDarker: Color(0xFF3A4054),
    primary: Color(0xFF6E5CFF), // electric violet
    primaryHover: Color(0xFF5D4AF0),
    primaryLight: Color(0xFF9C8FFF),
    primaryLighter: Color(0xFFBFB6FF),
    primaryGlow: Color(0xFFB45CFF), // orchid — gradient end
    accent: Color(0xFF2EE6B8), // mint
    accentHover: Color(0xFF22CFA4),
    danger: Color(0xFFFF4D6D),
    dangerLight: Color(0xFFFF7A93),
    dangerLighter: Color(0xFFFFA3B4),
    warning: Color(0xFFFFB020),
    warningLight: Color(0xFFFFD166),
    caution: Color(0xFFFF7A2F),
    cautionLight: Color(0xFFFFAB73),
    success: Color(0xFF22C55E),
    successLight: Color(0xFF86EFAC),
    textOnPrimary: Color(0xFFFFFFFF),
    overlay: Color(0x40000000),
    overlayHeavy: Color(0xF2000000),
    glassHighlight: Color(0xFFFFFFFF),
  );

  @override
  ChosenoPalette copyWith({
    Color? background,
    Color? surface,
    Color? surfaceHover,
    Color? surfaceActive,
    Color? surfaceElevated,
    Color? border,
    Color? borderLight,
    Color? textMain,
    Color? textSecondary,
    Color? textTertiary,
    Color? textMuted,
    Color? textDark,
    Color? textDarker,
    Color? primary,
    Color? primaryHover,
    Color? primaryLight,
    Color? primaryLighter,
    Color? primaryGlow,
    Color? accent,
    Color? accentHover,
    Color? danger,
    Color? dangerLight,
    Color? dangerLighter,
    Color? warning,
    Color? warningLight,
    Color? caution,
    Color? cautionLight,
    Color? success,
    Color? successLight,
    Color? textOnPrimary,
    Color? overlay,
    Color? overlayHeavy,
    Color? glassHighlight,
  }) {
    return ChosenoPalette(
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceHover: surfaceHover ?? this.surfaceHover,
      surfaceActive: surfaceActive ?? this.surfaceActive,
      surfaceElevated: surfaceElevated ?? this.surfaceElevated,
      border: border ?? this.border,
      borderLight: borderLight ?? this.borderLight,
      textMain: textMain ?? this.textMain,
      textSecondary: textSecondary ?? this.textSecondary,
      textTertiary: textTertiary ?? this.textTertiary,
      textMuted: textMuted ?? this.textMuted,
      textDark: textDark ?? this.textDark,
      textDarker: textDarker ?? this.textDarker,
      primary: primary ?? this.primary,
      primaryHover: primaryHover ?? this.primaryHover,
      primaryLight: primaryLight ?? this.primaryLight,
      primaryLighter: primaryLighter ?? this.primaryLighter,
      primaryGlow: primaryGlow ?? this.primaryGlow,
      accent: accent ?? this.accent,
      accentHover: accentHover ?? this.accentHover,
      danger: danger ?? this.danger,
      dangerLight: dangerLight ?? this.dangerLight,
      dangerLighter: dangerLighter ?? this.dangerLighter,
      warning: warning ?? this.warning,
      warningLight: warningLight ?? this.warningLight,
      caution: caution ?? this.caution,
      cautionLight: cautionLight ?? this.cautionLight,
      success: success ?? this.success,
      successLight: successLight ?? this.successLight,
      textOnPrimary: textOnPrimary ?? this.textOnPrimary,
      overlay: overlay ?? this.overlay,
      overlayHeavy: overlayHeavy ?? this.overlayHeavy,
      glassHighlight: glassHighlight ?? this.glassHighlight,
    );
  }

  @override
  ChosenoPalette lerp(ThemeExtension<ChosenoPalette>? other, double t) {
    if (other is! ChosenoPalette) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    return ChosenoPalette(
      background: c(background, other.background),
      surface: c(surface, other.surface),
      surfaceHover: c(surfaceHover, other.surfaceHover),
      surfaceActive: c(surfaceActive, other.surfaceActive),
      surfaceElevated: c(surfaceElevated, other.surfaceElevated),
      border: c(border, other.border),
      borderLight: c(borderLight, other.borderLight),
      textMain: c(textMain, other.textMain),
      textSecondary: c(textSecondary, other.textSecondary),
      textTertiary: c(textTertiary, other.textTertiary),
      textMuted: c(textMuted, other.textMuted),
      textDark: c(textDark, other.textDark),
      textDarker: c(textDarker, other.textDarker),
      primary: c(primary, other.primary),
      primaryHover: c(primaryHover, other.primaryHover),
      primaryLight: c(primaryLight, other.primaryLight),
      primaryLighter: c(primaryLighter, other.primaryLighter),
      primaryGlow: c(primaryGlow, other.primaryGlow),
      accent: c(accent, other.accent),
      accentHover: c(accentHover, other.accentHover),
      danger: c(danger, other.danger),
      dangerLight: c(dangerLight, other.dangerLight),
      dangerLighter: c(dangerLighter, other.dangerLighter),
      warning: c(warning, other.warning),
      warningLight: c(warningLight, other.warningLight),
      caution: c(caution, other.caution),
      cautionLight: c(cautionLight, other.cautionLight),
      success: c(success, other.success),
      successLight: c(successLight, other.successLight),
      textOnPrimary: c(textOnPrimary, other.textOnPrimary),
      overlay: c(overlay, other.overlay),
      overlayHeavy: c(overlayHeavy, other.overlayHeavy),
      glassHighlight: c(glassHighlight, other.glassHighlight),
    );
  }
}

/// Brand gradients — the one place a gradient is defined, so buttons, the
/// logo mark and hero accents all fade the same way.
abstract final class ChosenoGradients {
  static LinearGradient primary(ChosenoPalette p) => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [p.primary, p.primaryGlow],
  );

  /// A faint wash of the brand colour over a surface — hero cards.
  static LinearGradient wash(ChosenoPalette p) => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      p.primary.withValues(alpha: 0.22),
      p.primaryGlow.withValues(alpha: 0.06),
    ],
  );
}

/// Font family tokens. Real Google Fonts via the `google_fonts` package.
/// Mobile deliberately differs from the website here: the web's condensed
/// "Big Shoulders Display" headline face is a signage look that reads small
/// and stiff on a phone; headlines here use Plus Jakarta Sans (a modern,
/// friendly geometric sans) and body copy uses Inter, the most legible UI
/// face at small sizes.
abstract final class ChosenoTypography {
  /// Headlines and big numbers. Sizes passed by call sites were tuned for a
  /// condensed face, so they're scaled down slightly here to keep the same
  /// visual weight in a wider one.
  static TextStyle display({
    required Color color,
    double fontSize = 28,
    FontWeight fontWeight = FontWeight.w800,
    double? height,
  }) => GoogleFonts.plusJakartaSans(
    color: color,
    fontSize: fontSize * 0.88,
    fontWeight: fontWeight == FontWeight.w700 ? FontWeight.w800 : fontWeight,
    height: height,
    letterSpacing: -0.4,
  );

  /// Body copy, labels, buttons, form fields — everything that isn't a
  /// headline.
  static TextStyle body({
    required Color color,
    double fontSize = 15,
    FontWeight fontWeight = FontWeight.w400,
    double? height,
  }) => GoogleFonts.inter(
    color: color,
    fontSize: fontSize,
    fontWeight: fontWeight,
    height: height,
  );
}

/// Corner-radius tokens — DESIGN.md's Shapes section: 24px cards, 8px small
/// controls, fully round for pills/avatars (never for a card).
abstract final class ChosenoRadii {
  static const double card = 24;
  static const double sm = 8;
  static const double full = 9999;
}

/// Spacing scale. Only `md` (16px) has a named web equivalent
/// (DESIGN.md's Spacing section); the rest is a standard 8pt-grid
/// extension of that one value so every screen has a consistent scale to
/// reach for instead of inventing ad hoc padding numbers.
abstract final class ChosenoSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;
}

/// Elevation shadows — ports the website's `--shadow-elevated-md/lg/xl`
/// neutral, offset (never brand-glow) shadows described in DESIGN.md's
/// Elevation & Glassmorphism section. Flutter has no `backdrop-filter`
/// blur-behind-content primitive as cheap as CSS's, so the glass "blur +
/// saturate" part of that system is approximated with `BackdropFilter` at
/// the widget level (see `core/widgets/app_card.dart`) rather than here —
/// this class only owns the drop-shadow + top-edge-highlight half of the
/// recipe, which is pure geometry/color and belongs in the token file.
abstract final class ChosenoShadows {
  static List<BoxShadow> elevatedMd(ChosenoPalette palette) => [
    // Tighter and lighter than the web's 30px blur: this repeats on every
    // card in a scrolling list, and on a near-black canvas a wide soft
    // shadow is invisible anyway — it only costs frame time.
    const BoxShadow(
      color: Color(0x59000000),
      blurRadius: 16,
      offset: Offset(0, 6),
      spreadRadius: -2,
    ),
  ];

  static List<BoxShadow> elevatedLg(ChosenoPalette palette) => const [
    BoxShadow(
      color: Color(0x80000000),
      blurRadius: 40,
      offset: Offset(0, 14),
      spreadRadius: -6,
    ),
  ];

  static List<BoxShadow> elevatedXl(ChosenoPalette palette) => const [
    BoxShadow(
      color: Color(0x8C000000),
      blurRadius: 70,
      offset: Offset(0, 24),
      spreadRadius: -10,
    ),
  ];
}
