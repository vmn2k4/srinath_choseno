// The user's chosen app palette, persisted across launches. "Midnight Pulse"
// (dark) is the default; "Warm orange" is the website's light theme. Stored
// in secure storage (already a dependency) — a theme key isn't secret, but
// it avoids pulling in another plugin for one string.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'theme_config.dart';

enum AppThemeChoice {
  clean('Clean', 'Light'),
  pulse('Midnight Pulse', 'Dark', 'Dark'),
  warmOrange('Warm orange', 'Light', 'Orange');

  const AppThemeChoice(this.label, this.mode, [String? short])
    : shortLabel = short ?? label;
  final String label;
  final String mode;

  /// Compact name for tight rows (Profile's one-line picker).
  final String shortLabel;

  ChosenoPalette get palette => switch (this) {
    AppThemeChoice.clean => ChosenoPalette.clean,
    AppThemeChoice.pulse => ChosenoPalette.pulse,
    AppThemeChoice.warmOrange => ChosenoPalette.warmOrange,
  };
}

// v2: the default changed to Clean, so earlier saved choices are ignored once.
const _storageKey = 'choseno_theme_v2';

class ThemeController extends Notifier<AppThemeChoice> {
  final _storage = const FlutterSecureStorage();

  @override
  AppThemeChoice build() {
    _restore();
    return AppThemeChoice.clean;
  }

  Future<void> _restore() async {
    try {
      final saved = await _storage.read(key: _storageKey);
      final match = AppThemeChoice.values.where((t) => t.name == saved);
      if (match.isNotEmpty) state = match.first;
    } catch (e) {
      if (kDebugMode) debugPrint('ThemeController: restore failed: $e');
    }
  }

  Future<void> select(AppThemeChoice choice) async {
    state = choice;
    try {
      await _storage.write(key: _storageKey, value: choice.name);
    } catch (e) {
      if (kDebugMode) debugPrint('ThemeController: save failed: $e');
    }
  }
}

final themeControllerProvider =
    NotifierProvider<ThemeController, AppThemeChoice>(ThemeController.new);
