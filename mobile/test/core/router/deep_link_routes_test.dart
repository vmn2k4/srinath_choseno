import 'package:choseno_mobile/core/router/app_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Every web path a shared link can carry must resolve to a real route — a
/// miss would show go_router's "page not found" instead of the content.
void main() {
  test('shared choseno.com paths match an app route', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final router = container.read(appRouterProvider);
    final paths = [
      '/news/bc-election-2026-most-discussed-this-week',
      '/elections/seat/11111111-1111-1111-1111-111111111111',
      '/elections/e/bc-2026-11111111-1111-1111-1111-111111111111',
      '/elections/surrey-123',
      '/wall/some-politician-slug',
      '/candidacy/11111111-1111-1111-1111-111111111111',
      '/apply/11111111-1111-1111-1111-111111111111',
      '/p/abc123',
    ];
    for (final p in paths) {
      final matches = router.configuration.findMatch(Uri.parse(p));
      expect(
        matches.isError,
        isFalse,
        reason: '$p did not match any route',
      );
    }
  });
}
