// The user's chosen app palette, persisted across launches. "Midnight Pulse"
// (dark) is the default; "Warm orange" is the website's light theme. Stored
// in secure storage (already a dependency) — a theme key isn't secret, but
// it avoids pulling in another plugin for one string.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'theme_config.dart';

enum AppThemeChoice {
  pulse('Midnight Pulse', 'Dark'),
  warmOrange('Warm orange', 'Light');

  const AppThemeChoice(this.label, this.mode);
  final String label;
  final String mode;

  ChosenoPalette get palette => switch (this) {
    AppThemeChoice.pulse => ChosenoPalette.pulse,
    AppThemeChoice.warmOrange => ChosenoPalette.warmOrange,
  };
}

const _storageKey = 'choseno_theme';

class ThemeController extends Notifier<AppThemeChoice> {
  final _storage = const FlutterSecureStorage();

  @override
  AppThemeChoice build() {
    _restore();
    return AppThemeChoice.pulse;
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
