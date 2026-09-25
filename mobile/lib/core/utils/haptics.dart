// Centralizes the haptic feedback docs/FLUTTER_MOBILE_APP_GUIDE.md §8 (parent
// repo) calls out as free physical feedback the web literally cannot
// provide — one place so every optimistic-update tap across the app uses
// the same weight for the same kind of action, instead of each screen
// picking its own `HapticFeedback.*` call ad hoc.
import 'package:flutter/services.dart';

abstract final class AppHaptics {
  /// A lightweight optimistic action just fired (vote, Support toggle,
  /// rating submit) — the everyday case, most taps in the app.
  static void tap() => HapticFeedback.lightImpact();

  /// A selection changed (bottom-nav tab, filter chip) — the lightest
  /// tick, so switching tabs feels physical without being noisy.
  static void select() => HapticFeedback.selectionClick();

  /// Before a genuinely destructive confirm (Burn Identity, Rotate Ghost
  /// ID, Withdraw Candidacy) — heavier than [tap] so it reads as "this one
  /// matters more," fired on the confirm tap itself, not the dialog open.
  static void destructiveConfirm() => HapticFeedback.heavyImpact();
}
