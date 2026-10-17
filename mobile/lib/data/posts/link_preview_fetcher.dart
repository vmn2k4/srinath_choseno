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

// Bot-protected sites (NDTV, others behind Akamai/Cloudflare) answer
// Microlink's fetch with a block page, and Microlink reports that page's text
// as the article. Mirrors web src/lib/utils/linkPreview.ts.
final _blockTitleRe = RegExp(
  r'^(access denied|just a moment|attention required|403\b|forbidden|error 403|are you a robot|robot check|pardon our interruption|request blocked|security check|verifying you are human)',
  caseSensitive: false,
);

bool _isBlockPage(String? title, String? description) =>
    (title != null && _blockTitleRe.hasMatch(title.trim())) ||
    (description != null &&
        RegExp(
          r'^reference #[\w.]+',
          caseSensitive: false,
        ).hasMatch(description.trim()));

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
Future<Map<String, dynamic>?> fetchLinkMetadata(String url) async {
  // Microlink's free tier is rate-limited per IP (25 requests), and phones on
  // a carrier network share IPs, so it often refuses. Fall back to reading the
  // page's own og: tags from the device, then to a title from the URL slug.
  return await _fetchViaMicrolink(url) ??
      await _fetchDirect(url) ??
      _slugOnly(url);
}

Map<String, dynamic>? _slugOnly(String url) {
  final title = titleFromUrlSlug(url);
  if (title == null) return null;
  return {'title': title, 'url': url};
}

String? _metaContent(String html, List<String> keys) {
  for (final tag in RegExp(
    r'<meta\b[^>]*>',
    caseSensitive: false,
  ).allMatches(html)) {
    final t = tag.group(0)!;
    final key = RegExp(
      r'''(?:property|name)\s*=\s*["']([^"']+)["']''',
      caseSensitive: false,
    ).firstMatch(t)?.group(1)?.toLowerCase();
    if (key == null || !keys.contains(key)) continue;
    final content = RegExp(
      r'''content\s*=\s*(?:"([^"]*)"|'([^']*)')''',
      caseSensitive: false,
    ).firstMatch(t);
    final v = content?.group(1) ?? content?.group(2);
    if (v != null && v.trim().isNotEmpty) return _unescape(v.trim());
  }
  return null;
}

String _unescape(String v) => v
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');

Future<Map<String, dynamic>?> _fetchDirect(String url) async {
  try {
    final res = await http
        .get(
          Uri.parse(url),
          headers: {
            'User-Agent':
                'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
            'Accept': 'text/html',
          },
        )
        .timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) return null;
    final html = res.body.length > 300000
        ? res.body.substring(0, 300000)
        : res.body;
    var title =
        _metaContent(html, ['og:title', 'twitter:title']) ??
        RegExp(
          r'<title[^>]*>([^<]*)</title>',
          caseSensitive: false,
        ).firstMatch(html)?.group(1)?.trim();
    var description = _metaContent(html, [
      'og:description',
      'twitter:description',
      'description',
    ]);
    final blocked = _isBlockPage(title, description);
    if (blocked) {
      title = titleFromUrlSlug(url);
      description = null;
    }
    final image = blocked
        ? null
        : _metaContent(html, ['og:image', 'twitter:image']);
    if (title == null && image == null) return null;
    return {
      'title': title,
      'description': description,
      'image': image == null ? null : Uri.parse(url).resolve(image).toString(),
      'video': null,
      'url': url,
    };
  } catch (_) {
    return null;
  }
}

Future<Map<String, dynamic>?> _fetchViaMicrolink(String url) async {
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
    final blocked = _isBlockPage(
      data['title'] as String?,
      data['description'] as String?,
    );
    return {
      'title': blocked ? titleFromUrlSlug(url) : data['title'],
      'description': blocked ? null : data['description'],
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
