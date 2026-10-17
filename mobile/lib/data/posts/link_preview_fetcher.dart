// Link-preview metadata for a pasted URL, in the shape the web saves as
// `posts.link_metadata` — {title, description, image, video, url}. Read
// server-side by the `link-preview` edge function, shared with the web.
import 'package:supabase_flutter/supabase_flutter.dart';

final _urlRe = RegExp(r'https?://[^\s]+', caseSensitive: false);

/// The first http(s) URL in [text], trailing punctuation trimmed; null if none.
String? firstUrlIn(String text) {
  final m = _urlRe.firstMatch(text);
  if (m == null) return null;
  return m.group(0)!.replaceFirst(RegExp(r'[.,;:!?)\]]+$'), '');
}

/// A readable title from a headline-style URL slug, or null when the last path
/// segment isn't one (fewer than 3 words).
String? titleFromUrlSlug(String url) {
  final uri = Uri.tryParse(url);
  if (uri == null || uri.pathSegments.isEmpty) return null;
  final segment = uri.pathSegments.lastWhere(
    (s) => s.isNotEmpty,
    orElse: () => '',
  );
  final words = Uri.decodeComponent(segment)
      .replaceFirst(RegExp(r'\.(html?|php|aspx?)$', caseSensitive: false), '')
      .split(RegExp(r'[-_]+'))
      .where((w) => w.isNotEmpty && !RegExp(r'^\d{6,}$').hasMatch(w))
      .toList();
  if (words.length < 3) return null;
  final text = words.join(' ');
  return text[0].toUpperCase() + text.substring(1);
}

/// Null on any failure (offline, rate-limited, unfetchable page) — the post
/// then simply goes out without a card, exactly like the web.
/// Null on any failure (offline, unfetchable page) — the post then simply goes
/// out without a card, exactly like the web. If the function can't be reached,
/// a headline-style URL still yields a title-only card.
Future<Map<String, dynamic>?> fetchLinkMetadata(String url) async {
  try {
    final res = await Supabase.instance.client.functions
        .invoke('link-preview', body: {'url': url})
        .timeout(const Duration(seconds: 12));
    final data = res.data;
    if (data is Map && data['error'] == null) {
      return Map<String, dynamic>.from(data);
    }
  } catch (_) {}
  final title = titleFromUrlSlug(url);
  return title == null ? null : {'title': title, 'url': url};
}
