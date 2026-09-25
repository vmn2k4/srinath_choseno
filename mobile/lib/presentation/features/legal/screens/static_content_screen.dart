// Screen A.12 from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo) — one
// generic screen fed by an enum, per that section's own recommendation:
// "not worth building a CMS-backed version of these for a v1." No data
// layer at all — every one of these renders static, hardcoded copy on
// web too.
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';

enum StaticPage { about, privacy, terms, correctionsPolicy, editorialStandards }

extension on StaticPage {
  String get title => switch (this) {
    StaticPage.about => 'About Choseno',
    StaticPage.privacy => 'Privacy Policy',
    StaticPage.terms => 'Terms of Service',
    StaticPage.correctionsPolicy => 'Corrections Policy',
    StaticPage.editorialStandards => 'Editorial Standards',
  };

  String get body => switch (this) {
    StaticPage.about =>
      'Choseno connects citizens and candidates inside real electoral boundaries — '
          'an anonymous, hyperlocal civic network free of party influence. Every post is '
          'signed with a rotating Ghost ID, not a real name, so the conversation stays about '
          'the issues in your own community rather than who\'s speaking.',
    StaticPage.privacy =>
      'Choseno is built around anonymity by default. Your posts and comments are tied to a '
          'Ghost ID you can rotate at any time from your Profile — burning it permanently '
          'disconnects your past activity from your account. We collect only what\'s needed '
          'to resolve your electoral boundaries and keep the platform secure.',
    StaticPage.terms =>
      'By using Choseno you agree to participate in good faith — no impersonation, no '
          'coordinated abuse of the anonymous posting system, and no content that violates '
          'the platform\'s moderation rules. Election Administrators and politicians take on '
          'additional responsibilities specific to their role.',
    StaticPage.correctionsPolicy =>
      'Every representation card and office-holder record on Choseno can be flagged for a '
          'factual correction directly from the card itself. Corrections are reviewed and '
          'applied as quickly as possible — civic data only stays useful if it\'s accurate.',
    StaticPage.editorialStandards =>
      'Choseno\'s News section covers real civic events with a neutral tone and sourced '
          'facts. Politicians tagged in an article can respond directly on their own wall; '
          'errors are corrected transparently, not silently edited away.',
  };
}

class StaticContentScreen extends StatelessWidget {
  const StaticContentScreen({super.key, required this.page});

  final StaticPage page;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(page.title)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(ChosenoSpacing.lg),
          child: Text(
            page.body,
            style: ChosenoTypography.body(
              color: palette.textMain,
              fontSize: 15,
              height: 1.5,
            ),
          ),
        ),
      ),
    );
  }
}
