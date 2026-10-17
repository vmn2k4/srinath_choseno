// Receives content shared INTO Choseno from other apps (X, WhatsApp, the photo
// gallery, a browser's Share sheet) and parks it as a pending draft. The Home
// feed picks it up and opens the post composer prefilled — the same "share to
// create a draft post" flow as Facebook. Native side: the SEND intent filters
// in AndroidManifest.xml, and the Share Extension target on iOS (see
// docs/SHARE_INTO_APP.md).
import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:receive_sharing_intent/receive_sharing_intent.dart';

import 'app_router.dart';

/// What another app shared: text/link and/or one image.
@immutable
class SharedDraft {
  const SharedDraft({this.text = '', this.imageBytes, this.imageExt = 'jpg'});

  final String text;
  final Uint8List? imageBytes;
  final String imageExt;
}

/// Set when a share arrives; FeedScreen consumes (and clears) it. It survives
/// a signed-out detour, so sharing before signing in still lands in the composer.
class PendingShareNotifier extends Notifier<SharedDraft?> {
  @override
  SharedDraft? build() => null;

  void set(SharedDraft draft) => state = draft;
  void clear() => state = null;
}

final pendingShareProvider =
    NotifierProvider<PendingShareNotifier, SharedDraft?>(
      PendingShareNotifier.new,
    );

const _maxImageBytes = 5 * 1024 * 1024;

class ShareIntakeService {
  ShareIntakeService(this._ref);

  final Ref _ref;
  StreamSubscription<List<SharedMediaFile>>? _subscription;

  /// Call once at app boot. Handles the share that launched the app, then
  /// any that arrive while it's running.
  Future<void> start() async {
    if (kIsWeb || !(Platform.isAndroid || Platform.isIOS)) return;
    final instance = ReceiveSharingIntent.instance;
    _subscription = instance.getMediaStream().listen(
      _handle,
      onError: (Object e) {
        if (kDebugMode) debugPrint('ShareIntakeService: stream error: $e');
      },
    );
    try {
      final initial = await instance.getInitialMedia();
      await _handle(initial);
    } catch (e) {
      if (kDebugMode) debugPrint('ShareIntakeService: initial failed: $e');
    }
  }

  void dispose() => _subscription?.cancel();

  Future<void> _handle(List<SharedMediaFile> files) async {
    if (files.isEmpty) return;
    final texts = <String>[];
    Uint8List? image;
    var ext = 'jpg';
    for (final f in files) {
      switch (f.type) {
        case SharedMediaType.text:
        case SharedMediaType.url:
          if (f.path.trim().isNotEmpty) texts.add(f.path.trim());
        case SharedMediaType.image:
          if (image != null) break; // composer takes a single photo
          try {
            final bytes = await File(f.path).readAsBytes();
            if (bytes.length <= _maxImageBytes) {
              image = bytes;
              ext = f.path.contains('.')
                  ? f.path.split('.').last.toLowerCase()
                  : 'jpg';
            }
          } catch (e) {
            if (kDebugMode) debugPrint('ShareIntakeService: read failed: $e');
          }
        case SharedMediaType.video:
        case SharedMediaType.file:
          break;
      }
    }
    // Clear the OS-side copy so the same share isn't replayed next launch.
    await ReceiveSharingIntent.instance.reset();
    if (texts.isEmpty && image == null) return;

    _ref
        .read(pendingShareProvider.notifier)
        .set(
          SharedDraft(text: texts.join('\n'), imageBytes: image, imageExt: ext),
        );
    _ref.read(appRouterProvider).go(AppRoutes.home);
  }
}

final shareIntakeServiceProvider = Provider<ShareIntakeService>((ref) {
  final service = ShareIntakeService(ref);
  ref.onDispose(service.dispose);
  return service;
});
