// Port of the web's MediaThumbnail (video branch): a 9:16 tile with a play
// badge — YouTube's own thumbnail for a YouTube link (zoomed to crop the
// landscape image to portrait, like the web), the first frame for an
// uploaded video. Tapping plays it right in the post (YouTube via its embedded
// player, uploads via Chewie) with a fullscreen button on the controls.
import 'package:chewie/chewie.dart';
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';
import 'package:video_thumbnail/video_thumbnail.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';

import '../../../core/theme/theme_config.dart';
import '../../../core/utils/facebook_video.dart';
import '../../../core/utils/youtube.dart';
import 'facebook_video_embed.dart';

final Map<String, Future<Uint8List?>> _frames = {};

Future<Uint8List?> _firstFrame(String url) => _frames.putIfAbsent(
  url,
  () => VideoThumbnail.thumbnailData(
    video: url,
    imageFormat: ImageFormat.JPEG,
    maxWidth: 480,
    quality: 70,
    timeMs: 500,
  ).then<Uint8List?>((b) => b).catchError((_) => null),
);

class PostVideoThumbnail extends StatefulWidget {
  const PostVideoThumbnail({
    super.key,
    required this.url,
    this.posterUrl,
    this.landscape = false,
  });

  final String url;

  /// Link-preview image used as the tile instead of decoding a frame out of a
  /// remote clip (a news site's 1080p mp4 is far too heavy to probe in a feed).
  final String? posterUrl;

  /// 16:9 tile for a news clip; uploaded pitch videos stay 9:16.
  final bool landscape;

  @override
  State<PostVideoThumbnail> createState() => _PostVideoThumbnailState();
}

class _PostVideoThumbnailState extends State<PostVideoThumbnail> {
  bool _playing = false;

  @override
  Widget build(BuildContext context) {
    final url = widget.url;
    final youTubeId = parseYouTubeId(url);
    if (_playing) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(ChosenoRadii.sm + 2),
        child: youTubeId != null
            ? _YouTubeInline(id: youTubeId)
            : _UploadedInline(url: url),
      );
    }
    return Align(
      alignment: Alignment.centerLeft,
      child: GestureDetector(
        onTap: () => setState(() => _playing = true),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(ChosenoRadii.sm + 2),
          child: SizedBox(
            width: widget.landscape ? 280 : 170,
            child: AspectRatio(
              aspectRatio: widget.landscape ? 16 / 9 : 9 / 16,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  const ColoredBox(color: Color(0xE6000000)),
                  if (youTubeId != null)
                    Transform.scale(
                      scale: 1.8,
                      child: Image.network(
                        'https://i.ytimg.com/vi/$youTubeId/hqdefault.jpg',
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const SizedBox.shrink(),
                      ),
                    )
                  else if (widget.posterUrl != null)
                    Image.network(
                      widget.posterUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const SizedBox.shrink(),
                    )
                  else
                    FutureBuilder<Uint8List?>(
                      future: _firstFrame(url),
                      builder: (context, snap) => snap.data == null
                          ? const SizedBox.shrink()
                          : Image.memory(snap.data!, fit: BoxFit.cover),
                    ),
                  const ColoredBox(color: Color(0x4D000000)),
                  Center(
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.6),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white30),
                      ),
                      child: const Icon(
                        Icons.play_arrow_rounded,
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// YouTube link, played with the embedded player (has its own fullscreen).
class _YouTubeInline extends StatefulWidget {
  const _YouTubeInline({required this.id});

  final String id;

  @override
  State<_YouTubeInline> createState() => _YouTubeInlineState();
}

class _YouTubeInlineState extends State<_YouTubeInline> {
  late final YoutubePlayerController _controller = YoutubePlayerController(
    initialVideoId: widget.id,
    flags: const YoutubePlayerFlags(autoPlay: true),
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return YoutubePlayerBuilder(
      onEnterFullScreen: () => SystemChrome.setPreferredOrientations(
        [DeviceOrientation.portraitUp],
      ),
      player: YoutubePlayer(
        controller: _controller,
        showVideoProgressIndicator: true,
      ),
      builder: (context, player) => player,
    );
  }
}

/// Uploaded video, played with Chewie (play/pause, scrub, fullscreen).
class _UploadedInline extends StatefulWidget {
  const _UploadedInline({required this.url});

  final String url;

  @override
  State<_UploadedInline> createState() => _UploadedInlineState();
}

class _UploadedInlineState extends State<_UploadedInline> {
  late final VideoPlayerController _video = VideoPlayerController.networkUrl(
    Uri.parse(widget.url),
  );
  ChewieController? _chewie;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _video
        .initialize()
        .then((_) {
          if (!mounted) return;
          setState(
            () => _chewie = ChewieController(
              videoPlayerController: _video,
              autoPlay: true,
              allowFullScreen: false,
              aspectRatio: _video.value.aspectRatio,
            ),
          );
        })
        .catchError((_) {
          if (mounted) setState(() => _failed = true);
        });
  }

  @override
  void dispose() {
    _chewie?.dispose();
    _video.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) {
      // Typically a WebM recorded on the website, which iOS can't decode —
      // hand it to the browser instead of leaving a dead box.
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: ColoredBox(
          color: Colors.black,
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  "Couldn't play this video here",
                  style: TextStyle(color: Colors.white),
                ),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: () => launchUrl(
                    Uri.parse(widget.url),
                    mode: LaunchMode.externalApplication,
                  ),
                  icon: const Icon(Icons.open_in_new, size: 18),
                  label: const Text('Open in browser'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    final chewie = _chewie;
    if (chewie == null) {
      return const AspectRatio(
        aspectRatio: 16 / 9,
        child: ColoredBox(
          color: Colors.black,
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }
    // Cap a tall portrait video so it doesn't swallow the screen.
    return ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.6,
      ),
      child: Chewie(controller: chewie),
    );
  }
}

/// Plays any video link inside the app — YouTube (embedded player), a Facebook
/// video / reel (Facebook's own player), or an uploaded file (Chewie) — so
/// nothing is handed to the phone's "open with" chooser.
class InAppVideoPlayer extends StatelessWidget {
  const InAppVideoPlayer({super.key, required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    final youTubeId = parseYouTubeId(url);
    if (youTubeId != null) return _YouTubeInline(id: youTubeId);
    final fb = facebookVideoEmbedUrl(url);
    if (fb != null) return FacebookVideoEmbed(embedUrl: fb);
    return _UploadedInline(url: url);
  }
}

/// Full-screen, in-app player for [url] with a close button.
Future<void> showInAppVideo(BuildContext context, String url) {
  return showDialog<void>(
    context: context,
    builder: (dialogContext) => Dialog.fullscreen(
      backgroundColor: Colors.black,
      child: SafeArea(
        child: Stack(
          children: [
            Center(child: InAppVideoPlayer(url: url)),
            Positioned(
              top: 4,
              right: 4,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white, size: 28),
                onPressed: () => Navigator.of(dialogContext).pop(),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
