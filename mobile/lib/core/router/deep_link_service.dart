// Wires incoming Universal Links (iOS) / App Links (Android) — a
// choseno.com URL tapped in Messages, Mail, another app, etc. — to
// go_router, so a link shared from the website (or from this app's own
// Share button, see share_link.dart) opens the matching screen instead of
// falling through to a browser. `app_links` was already a pubspec
// dependency (added for the not-yet-built auth password-recovery deep
// link — see sign_in_screen.dart's header comment) but nothing used it
// until now.
//
// Native config (Associated Domains entitlement + apple-app-site-
// association on iOS, the manifest intent-filter + assetlinks.json on
// Android) is what actually makes the OS hand a tapped web link to this
// app instead of a browser — this class only handles it once that's
// already happened. See docs/DEEP_LINKING.md for the native setup and its
// current blockers (no Apple Team ID / release keystore configured yet).
import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_router.dart';

class DeepLinkService {
  DeepLinkService(this._ref) : _appLinks = AppLinks();

  final Ref _ref;
  final AppLinks _appLinks;
  StreamSubscription<Uri>? _subscription;

  /// Call once at app boot (see `app.dart`). Checks the cold-start link
  /// first (the app was launched BY tapping one), then subscribes for any
  /// tapped while already running.
  Future<void> start() async {
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) _handle(initial);
    } catch (e) {
      // getInitialLink can throw on some platform channel edge cases
      // (e.g. no Activity yet) — a missed cold-start link just means the
      // app opens to its normal initial route instead, never a crash.
      if (kDebugMode) debugPrint('DeepLinkService: getInitialLink failed: $e');
    }
    _subscription = _appLinks.uriLinkStream.listen(
      _handle,
      onError: (Object e) {
        if (kDebugMode) debugPrint('DeepLinkService: uriLinkStream error: $e');
      },
    );
  }

  void dispose() => _subscription?.cancel();

  void _handle(Uri uri) {
    // Only ever act on our own domain (or a schemeless/hostless path, in
    // case something constructs a bare Uri directly) — never navigate on
    // an arbitrary host some other app's link handed us.
    const ownHosts = {'choseno.com', 'www.choseno.com'};
    if (uri.host.isNotEmpty && !ownHosts.contains(uri.host)) return;

    final target = uri.path.isEmpty
        ? '/'
        : '${uri.path}${uri.hasQuery ? '?${uri.query}' : ''}';
    if (target == '/' || target.isEmpty) return;

    // go_router's own `redirect` (app_router.dart) still applies on top of
    // this — a signed-out tap lands on Auth first, carrying `?from=` so
    // sign-in resumes here afterward, not just Home. An unmatched path
    // (a web page with no mobile screen yet) renders go_router's normal
    // "page not found" rather than crashing.
    _ref.read(appRouterProvider).go(target);
  }
}

final deepLinkServiceProvider = Provider<DeepLinkService>((ref) {
  final service = DeepLinkService(ref);
  ref.onDispose(service.dispose);
  return service;
});
