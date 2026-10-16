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

import '../../presentation/features/auth/providers/auth_providers.dart';
import 'app_router.dart';

/// The link a signed-out visitor tapped, remembered until they are signed in
/// and onboarded. go_router's own `?from=` is not enough on a cold start: the
/// splash screen can resolve auth (and write `from=/`) before the OS link has
/// been handed over, which dropped the article on the floor and landed on Home.
class PendingDeepLink {
  String? target;
}

final pendingDeepLinkProvider = Provider<PendingDeepLink>(
  (ref) => PendingDeepLink(),
);

/// What `choseno://auth/confirm?token_hash=…&type=signup|recovery` carries —
/// the button in the sign-up or password-reset email of someone who uses the
/// app (via the website's /auth/open-app page). Null for anything else, so
/// only these two types are ever acted on this way.
({String tokenHash, String type})? parseAuthConfirmLink(Uri uri) {
  if (uri.scheme != 'choseno' || uri.host != 'auth') return null;
  if (uri.path != '/confirm') return null;
  final type = uri.queryParameters['type'];
  if (type != 'signup' && type != 'recovery') return null;
  final tokenHash = uri.queryParameters['token_hash'];
  if (tokenHash == null ||
      !RegExp(r'^[A-Za-z0-9_-]{10,256}$').hasMatch(tokenHash)) {
    return null;
  }
  return (tokenHash: tokenHash, type: type!);
}

class DeepLinkService {
  DeepLinkService(this._ref) : _appLinks = AppLinks();

  final Ref _ref;
  final AppLinks _appLinks;
  StreamSubscription<Uri>? _subscription;

  /// Call once at app boot (see `app.dart`). Checks the cold-start link
  /// first (the app was launched BY tapping one), then subscribes for any
  /// tapped while already running.
  Future<void> start() async {
    // Subscribe FIRST. On Android a cold start hands the launching link to
    // the stream, and `getInitialLink()` can take long enough (or never
    // return) that awaiting it before listening — the old order — dropped
    // the very link that launched the app.
    _subscription = _appLinks.uriLinkStream.listen(
      _handle,
      onError: (Object e) {
        if (kDebugMode) debugPrint('DeepLinkService: uriLinkStream error: $e');
      },
    );
    try {
      final initial = await _appLinks.getInitialLink().timeout(
        const Duration(seconds: 3),
      );
      // The stream may already have delivered the same link; _handle is
      // idempotent for an identical target, so a duplicate is harmless.
      if (initial != null) _handle(initial);
    } catch (e) {
      // A missed cold-start link just means the app opens to its normal
      // initial route instead, never a crash.
      if (kDebugMode) debugPrint('DeepLinkService: getInitialLink failed: $e');
    }
  }

  void dispose() => _subscription?.cancel();

  String? _lastTarget;
  DateTime? _lastAt;

  String? _lastConfirmToken;

  Future<void> _confirmFromLink(({String tokenHash, String type}) link) async {
    final tokenHash = link.tokenHash;
    // The OS can deliver the same link on both the stream and getInitialLink;
    // the token is single-use, so only try it once.
    if (tokenHash == _lastConfirmToken) return;
    _lastConfirmToken = tokenHash;
    if (kDebugMode) {
      debugPrint('DeepLinkService: confirming sign-up from app link');
    }
    final controller = _ref.read(authControllerProvider.notifier);
    final error = link.type == 'recovery'
        ? await controller.verifyRecoveryTokenHash(tokenHash)
        : await controller.verifySignupTokenHash(tokenHash);
    if (kDebugMode) {
      debugPrint(
        'DeepLinkService: confirm link result: ${error ?? 'signed in'}',
      );
    }
    if (error == null) return; // session created — the router takes over
    _ref
        .read(authNoticeProvider.notifier)
        .show(
          link.type == 'recovery'
              ? "That reset link didn't work — it may have expired or been used already. Tap Forgot password? to get a new code."
              : "That confirmation link didn't work — it may have expired or been used already. Sign in to get a new code.",
        );
    _ref.read(appRouterProvider).go(AppRoutes.auth);
  }

  void _handle(Uri uri) {
    final confirmLink = parseAuthConfirmLink(uri);
    if (confirmLink != null) {
      unawaited(_confirmFromLink(confirmLink));
      return;
    }
    // Any other choseno:// link is ignored; only https links on our own
    // domain are routed below.
    if (uri.scheme == 'choseno') return;
    // Only ever act on our own domain (or a schemeless/hostless path, in
    // case something constructs a bare Uri directly) — never navigate on
    // an arbitrary host some other app's link handed us.
    const ownHosts = {'choseno.com', 'www.choseno.com'};
    if (uri.host.isNotEmpty && !ownHosts.contains(uri.host)) return;

    final target = uri.path.isEmpty
        ? '/'
        : '${uri.path}${uri.hasQuery ? '?${uri.query}' : ''}';
    if (target == '/' || target.isEmpty) return;

    final now = DateTime.now();
    if (target == _lastTarget &&
        _lastAt != null &&
        now.difference(_lastAt!) < const Duration(seconds: 2)) {
      return;
    }
    _lastTarget = target;
    _lastAt = now;

    // go_router's own `redirect` (app_router.dart) still applies on top of
    // this — a signed-out tap lands on Auth first, carrying `?from=` so
    // sign-in resumes here afterward, not just Home. An unmatched path
    // (a web page with no mobile screen yet) renders go_router's normal
    // "page not found" rather than crashing.
    // Signed out (or auth still resolving): remember it so sign-in can resume
    // here instead of Home.
    if (_ref.read(authStateChangesProvider).value == null) {
      _ref.read(pendingDeepLinkProvider).target = target;
    }
    _ref.read(appRouterProvider).go(target);
  }
}

final deepLinkServiceProvider = Provider<DeepLinkService>((ref) {
  final service = DeepLinkService(ref);
  ref.onDispose(service.dispose);
  return service;
});
