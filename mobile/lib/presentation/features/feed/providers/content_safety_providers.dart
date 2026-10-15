// Report / block / terms-gate support for user-generated content (a Google
// Play UGC-policy requirement). Blocking is keyed by the author's ghost id
// server-side (`block_author`), so it lapses if that author burns their
// identity — the block sheet says so.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'feed_repository_providers.dart';

/// Ghost ids the signed-in user has blocked. Empty on any failure — a failed
/// lookup must never hide content or break the wall.
class BlockedAuthors extends AsyncNotifier<Set<String>> {
  @override
  Future<Set<String>> build() async {
    final result = await ref.read(feedRepositoryProvider).getBlockedGhostIds();
    return result.when(ok: (ids) => ids, err: (_) => <String>{});
  }

  /// Blocks the author of [targetType] `post`|`comment` [targetId]; returns an
  /// error message, or null once blocked.
  Future<String?> block(
    String targetType,
    String targetId,
    String ghostId,
  ) async {
    final result = await ref
        .read(feedRepositoryProvider)
        .blockAuthor(targetType, targetId);
    return result.when(
      ok: (_) {
        state = AsyncData({...?state.value, ghostId});
        return null;
      },
      err: (f) => f.message,
    );
  }
}

final blockedAuthorsProvider =
    AsyncNotifierProvider<BlockedAuthors, Set<String>>(BlockedAuthors.new);

/// One-time acceptance of the Terms & community rules before posting.
class TermsGate {
  static const _key = 'choseno_ugc_terms_v1';
  static const _storage = FlutterSecureStorage();

  static Future<bool> accepted() async {
    try {
      return await _storage.read(key: _key) == '1';
    } catch (_) {
      return false;
    }
  }

  static Future<void> accept() async {
    try {
      await _storage.write(key: _key, value: '1');
    } catch (_) {}
  }
}
