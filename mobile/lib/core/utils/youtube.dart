// Port of src/lib/utils/youtube.ts — pulls the 11-char video id out of any
// common YouTube URL shape (watch, youtu.be, shorts, embed, live) or a bare
// id; null for anything else, so it doubles as input validation.
final _idRe = RegExp(r'^[A-Za-z0-9_-]{11}$');

String? parseYouTubeId(String? input) {
  final raw = (input ?? '').trim();
  if (raw.isEmpty) return null;
  if (_idRe.hasMatch(raw)) return raw;
  final Uri url;
  try {
    url = Uri.parse(
      RegExp(r'^https?://', caseSensitive: false).hasMatch(raw)
          ? raw
          : 'https://$raw',
    );
  } catch (_) {
    return null;
  }
  final host = url.host.replaceFirst(RegExp(r'^(www|m)\.'), '');
  String? id;
  if (host == 'youtu.be') {
    id = url.pathSegments.isEmpty ? null : url.pathSegments.first;
  } else if (host == 'youtube.com' || host == 'youtube-nocookie.com') {
    if (url.path == '/watch') {
      id = url.queryParameters['v'];
    } else {
      final m = RegExp(
        r'^/(?:embed|shorts|live|v)/([^/?]+)',
      ).firstMatch(url.path);
      id = m?.group(1);
    }
  }
  return id != null && _idRe.hasMatch(id) ? id : null;
}

String youTubeWatchUrl(String id) => 'https://www.youtube.com/watch?v=$id';
