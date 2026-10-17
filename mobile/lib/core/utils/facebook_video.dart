// Port of src/lib/utils/facebookVideo.ts — recognizes Facebook video links
// (watch, /<page>/videos/<id>, reel, share/v|r, video.php, fb.watch) and
// returns Facebook's own embeddable player URL, so they play inside Choseno.
// Null for anything that isn't a video link (a profile, a plain post).
String? parseFacebookVideoUrl(String? input) {
  final raw = (input ?? '').trim();
  if (raw.isEmpty) return null;
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
  final host = url.host.replaceFirst(RegExp(r'^(www|m|web|mbasic|l)\.'), '');
  final path = url.path.replaceFirst(RegExp(r'/+$'), '');

  if (host == 'fb.watch') {
    final code = path.split('/').length > 1 ? path.split('/')[1] : '';
    return code.isEmpty ? null : 'https://fb.watch/$code/';
  }
  if (host != 'facebook.com' && host != 'fb.com') return null;

  if (path == '/watch' || path == '/video.php') {
    final id = url.queryParameters['v'];
    return id != null && RegExp(r'^\d+$').hasMatch(id)
        ? 'https://www.facebook.com/watch/?v=$id'
        : null;
  }
  final reel = RegExp(r'^/reel/(\d+)').firstMatch(path);
  if (reel != null) return 'https://www.facebook.com/reel/${reel.group(1)}';
  final share = RegExp(r'^/share/([vr])/([^/]+)').firstMatch(path);
  if (share != null) {
    return 'https://www.facebook.com/share/${share.group(1)}/${share.group(2)}/';
  }
  if (RegExp(r'^/[^/]+(?:/[^/]+)*/videos/(?:[^/]+/)?\d+').hasMatch(path)) {
    return 'https://www.facebook.com$path';
  }
  return null;
}

String? facebookVideoEmbedUrl(String? input) {
  final canonical = parseFacebookVideoUrl(input);
  if (canonical == null) return null;
  return 'https://www.facebook.com/plugins/video.php?href=${Uri.encodeComponent(canonical)}&show_text=false&width=560&autoplay=true';
}
