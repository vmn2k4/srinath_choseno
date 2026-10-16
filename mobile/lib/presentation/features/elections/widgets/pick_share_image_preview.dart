// Makes sure a pick share's preview card exists BEFORE the link is shared, and
// shows it — what the website's share dialog does ("Generating your image…").
//
// The card is rendered on demand by the website (/p/<code>/opengraph-image) and
// then cached in public storage. The site's bot protection answers plain
// non-browser requests with HTTP 429, so the app can't just GET that URL; a
// real (hidden) web view passes the check and triggers the render, and we poll
// storage for the finished PNG and display it natively.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../core/config/env_config.dart';
import '../../../../core/config/site_config.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';

// Keep in step with IMAGE_VERSION in src/lib/services/pickShareImages.ts.
const _bucket = 'pick-share-og-images';
const _imageVersion = 'v3';

String pickShareStoredImageUrl(String code) =>
    '${EnvConfig.supabaseUrl}/storage/v1/object/public/$_bucket/$_imageVersion/$code.png';

class PickShareImagePreview extends StatefulWidget {
  const PickShareImagePreview({
    super.key,
    required this.code,
    required this.onReady,
    required this.onGaveUp,
  });

  final String code;

  /// The card exists in storage — safe to share the link.
  final VoidCallback onReady;

  /// Still not there after [_giveUpAfter]; let the user share anyway.
  final VoidCallback onGaveUp;

  @override
  State<PickShareImagePreview> createState() => _PickShareImagePreviewState();
}

class _PickShareImagePreviewState extends State<PickShareImagePreview> {
  static const _giveUpAfter = Duration(seconds: 45);

  late final WebViewController _web;
  Timer? _poll;
  late final DateTime _started;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _started = DateTime.now();
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..loadRequest(
        Uri.parse('${SiteConfig.siteUrl}/p/${widget.code}/opengraph-image'),
      );
    _poll = Timer.periodic(const Duration(milliseconds: 1500), (_) => _check());
    _check();
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _check() async {
    if (_ready) return;
    try {
      final res = await http
          .get(Uri.parse(pickShareStoredImageUrl(widget.code)))
          .timeout(const Duration(seconds: 6));
      if (res.statusCode == 200 && res.bodyBytes.isNotEmpty && mounted) {
        _poll?.cancel();
        setState(() => _ready = true);
        widget.onReady();
        return;
      }
    } catch (_) {
      // not there yet / offline blip — keep polling
    }
    if (mounted && DateTime.now().difference(_started) > _giveUpAfter) {
      _poll?.cancel();
      widget.onGaveUp();
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Stack(
      children: [
        AspectRatio(
          aspectRatio: 1200 / 630,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(ChosenoRadii.sm * 2),
            child: ColoredBox(
              color: palette.surfaceHover,
              child: _ready
                  ? Image.network(
                      pickShareStoredImageUrl(widget.code),
                      fit: BoxFit.cover,
                    )
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        const SizedBox(height: ChosenoSpacing.sm),
                        Text(
                          'Generating your image…',
                          style: ChosenoTypography.body(
                            color: palette.textMuted,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
        // Invisible 1px browser whose only job is to hit the render route.
        if (!_ready)
          Positioned(
            left: 0,
            top: 0,
            width: 1,
            height: 1,
            child: Opacity(
              opacity: 0.01,
              child: WebViewWidget(controller: _web),
            ),
          ),
      ],
    );
  }
}
