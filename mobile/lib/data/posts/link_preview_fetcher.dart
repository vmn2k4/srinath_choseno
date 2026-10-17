// Port of the web LinkPreview's metadata fetch (src/components/features/
// LinkPreview.tsx): asks the Microlink API for a pasted URL's title /
// description / image and returns it in the same shape the web saves as
// `posts.link_metadata` — {title, description, image, video, url}.
import 'dart:convert';

import 'package:http/http.dart' as http;

final _urlRe = RegExp(r'https?://[^\s]+', caseSensitive: false);

/// The first http(s) URL in [text], trailing punctuation trimmed; null if none.
String? firstUrlIn(String text) {
  final m = _urlRe.firstMatch(text);
  if (m == null) return null;
  return m.group(0)!.replaceFirst(RegExp(r'[.,;:!?)\]]+$'), '');
}

/// Null on any failure (offline, rate-limited, unfetchable page) — the post
/// then simply goes out without a card, exactly like the web.
Future<Map<String, dynamic>?> fetchLinkMetadata(String url) async {
  try {
    final res = await http
        .get(
          Uri.https('api.microlink.io', '/', {
            'url': url,
            'audio': 'false',
            'video': 'true',
          }),
        )
        .timeout(const Duration(seconds: 8));
    final json = jsonDecode(res.body) as Map<String, dynamic>;
    if (json['status'] != 'success') return null;
    final data = json['data'] as Map<String, dynamic>;
    return {
      'title': data['title'],
      'description': data['description'],
      'image':
          (data['image'] as Map<String, dynamic>?)?['url'] ??
          (data['logo'] as Map<String, dynamic>?)?['url'],
      'video': (data['video'] as Map<String, dynamic>?)?['url'],
      'url': data['url'] ?? url,
    };
  } catch (_) {
    return null;
  }
}
