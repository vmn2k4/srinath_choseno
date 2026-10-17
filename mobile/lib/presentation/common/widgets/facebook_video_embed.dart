// A Facebook video / reel played inside the post through Facebook's own
// embeddable player (same as the web's iframe). Shows a tap-to-play tile first
// so a feed full of Facebook links doesn't spin up a WebView per post.
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../core/theme/theme_config.dart';

class FacebookVideoEmbed extends StatefulWidget {
  const FacebookVideoEmbed({super.key, required this.embedUrl});

  final String embedUrl;

  @override
  State<FacebookVideoEmbed> createState() => _FacebookVideoEmbedState();
}

class _FacebookVideoEmbedState extends State<FacebookVideoEmbed> {
  WebViewController? _web;

  void _play() {
    setState(() {
      _web = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..loadRequest(Uri.parse(widget.embedUrl));
    });
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(ChosenoRadii.sm + 2),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: _web == null
            ? GestureDetector(
                onTap: _play,
                child: const ColoredBox(
                  color: Color(0xE6000000),
                  child: Center(
                    child: Icon(
                      Icons.play_circle_fill_rounded,
                      color: Colors.white,
                      size: 56,
                    ),
                  ),
                ),
              )
            : WebViewWidget(controller: _web!),
      ),
    );
  }
}
