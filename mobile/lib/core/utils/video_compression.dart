// Shrinks a picked/recorded video before upload so it fits the 50MB
// `politician_videos` bucket and plays quickly on mobile data. Re-encodes to
// MP4 (H.264) at ~540p — which also fixes iPhone .mov files, a type the
// bucket (webm/mp4 only) rejects. Falls back to the original file if
// compression fails, so callers never lose the upload.
import 'dart:io';
import 'dart:typed_data';

import 'package:video_compress/video_compress.dart';

typedef CompressedVideo = ({Uint8List bytes, String extension});

Future<CompressedVideo> compressVideoForUpload(String path) async {
  try {
    final info = await VideoCompress.compressVideo(
      path,
      quality: VideoQuality.Res960x540Quality,
      frameRate: 30,
      includeAudio: true,
      deleteOrigin: false,
    );
    final out = info?.file;
    if (out != null) {
      final bytes = await out.readAsBytes();
      final original = await File(path).length();
      if (bytes.isNotEmpty && bytes.length < original) {
        return (bytes: bytes, extension: 'mp4');
      }
    }
  } catch (_) {
    // fall through to the original
  }
  final bytes = await File(path).readAsBytes();
  final ext = path.contains('.') ? path.split('.').last.toLowerCase() : 'mp4';
  return (bytes: bytes, extension: ext);
}
