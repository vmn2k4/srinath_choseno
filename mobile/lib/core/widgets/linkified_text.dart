import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme/app_theme.dart';

final _urlRe = RegExp(r'https?://[^\s]+', caseSensitive: false);
final _trailingPunct = RegExp(r'[.,;:!?)\]]+$');

/// Post body text where pasted http(s) URLs render as tappable links (primary
/// colour, underlined) — mirrors the web PostCard's linkifyText. Trailing
/// sentence punctuation stays outside the link.
class LinkifiedText extends StatefulWidget {
  const LinkifiedText(this.text, {super.key, required this.style});

  final String text;
  final TextStyle style;

  @override
  State<LinkifiedText> createState() => _LinkifiedTextState();
}

class _LinkifiedTextState extends State<LinkifiedText> {
  final List<TapGestureRecognizer> _recognizers = [];

  void _disposeRecognizers() {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
  }

  @override
  void dispose() {
    _disposeRecognizers();
    super.dispose();
  }

  List<InlineSpan> _spans(TextStyle linkStyle) {
    final text = widget.text;
    final spans = <InlineSpan>[];
    var last = 0;
    for (final m in _urlRe.allMatches(text)) {
      final url = m.group(0)!.replaceFirst(_trailingPunct, '');
      if (m.start > last) spans.add(TextSpan(text: text.substring(last, m.start)));
      final recognizer = TapGestureRecognizer()
        ..onTap = () {
          final uri = Uri.tryParse(url);
          if (uri != null) launchUrl(uri, mode: LaunchMode.externalApplication);
        };
      _recognizers.add(recognizer);
      spans.add(TextSpan(text: url, style: linkStyle, recognizer: recognizer));
      last = m.start + url.length;
    }
    if (last < text.length) spans.add(TextSpan(text: text.substring(last)));
    return spans;
  }

  @override
  Widget build(BuildContext context) {
    // Recognizers are rebuilt with the spans on every build, so drop the old
    // ones first.
    _disposeRecognizers();
    final palette = ChosenoTheme.of(context);
    final linkStyle = widget.style.copyWith(
      color: palette.primary,
      decoration: TextDecoration.underline,
      decorationColor: palette.primary,
    );
    return Text.rich(TextSpan(style: widget.style, children: _spans(linkStyle)));
  }
}
