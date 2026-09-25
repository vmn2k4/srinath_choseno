import 'package:flutter/foundation.dart';

/// Port of `isDevEnvironment()` (src/lib/utils/environment.ts): true for
/// anything but a release build. On the website, a non-production build
/// neither hides `is_test` rows on reads nor writes `is_test = false` — a
/// developer's own test account (`profiles.is_test = true`) has to be able
/// to see its own wall/posts, otherwise it 404s on itself. A release build
/// hides all test data, exactly like production web.
abstract final class AppEnvironment {
  static bool get isDev => !kReleaseMode;
}
