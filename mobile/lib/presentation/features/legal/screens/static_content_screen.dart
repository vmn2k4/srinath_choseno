// Screen A.12 from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo) — one
// generic screen fed by an enum. No data layer: the copy below mirrors the
// website pages (src/app/{about,privacy,terms}) and the `about` strings in
// src/lib/i18n/locales/en.json. When those change, update this file too.
import '../../../common/widgets/detail_app_bar.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';

enum StaticPage { about, privacy, terms }

const _contactEmail = 'contact@choseno.com';

sealed class _Block {
  const _Block();
}

class _Para extends _Block {
  const _Para(this.text);
  final String text;
}

class _Bullets extends _Block {
  const _Bullets(this.items);
  final List<String> items;
}

/// Bold label followed by a paragraph (used for the privacy "what we collect"
/// sub-items and the About mission/standards cards).
class _Labeled extends _Block {
  const _Labeled(this.label, this.text);
  final String label;
  final String text;
}

class _Section {
  const _Section(this.heading, this.blocks);
  final String? heading;
  final List<_Block> blocks;
}

extension on StaticPage {
  String get title => switch (this) {
    StaticPage.about => 'About Choseno',
    StaticPage.privacy => 'Privacy Policy',
    StaticPage.terms => 'Terms of Service',
  };

  String? get meta => switch (this) {
    StaticPage.about => null,
    StaticPage.privacy || StaticPage.terms => 'Effective date: October 16, 2026',
  };

  /// Other legal pages offered at the bottom of each page.
  List<(String, String)> get related => switch (this) {
    StaticPage.about => const [
      ('Terms of Service', AppRoutes.terms),
      ('Privacy Policy', AppRoutes.privacy),
    ],
    StaticPage.privacy => const [
      ('Terms of Service', AppRoutes.terms),
      ('About Choseno', AppRoutes.about),
    ],
    StaticPage.terms => const [
      ('Privacy Policy', AppRoutes.privacy),
      ('About Choseno', AppRoutes.about),
    ],
  };

  List<_Section> get sections => switch (this) {
    StaticPage.about => _about,
    StaticPage.privacy => _privacy,
    StaticPage.terms => _terms,
  };
}

const _about = <_Section>[
  _Section(null, [
    _Para(
      'Choseno started as a personal dream — not a startup pitch. It was born out '
      'of a simple frustration that millions of people share: we vote once, and '
      'then politicians do whatever they want.',
    ),
  ]),
  _Section('Who built this', [
    _Labeled(
      'Murugappan Valliyappan',
      'Independent Software Developer & Citizen',
    ),
    _Para(
      'I am a common person — not a politician, not a lobbyist, not a media '
      'company. I am someone who watches the news, votes in every election, and '
      'still feels like my voice disappears the moment I leave the polling booth.',
    ),
    _Para(
      'Choseno is my personal contribution to the world. I built it because I '
      'genuinely believe people deserve to be part of the political conversation '
      'every single day of a politician\'s term — not just every two or four '
      'years on election day.',
    ),
    _Para(
      'This platform is not funded by any political party, PAC, or corporate '
      'interest. It is an independent, self-started initiative. No agenda. No '
      'endorsements. Just a tool to help citizens find each other, share their '
      'real experiences with the people who represent them, and hold those '
      'representatives accountable through public opinion.',
    ),
  ]),
  _Section('Our mission', [
    _Labeled(
      'Continuous Conversation',
      'Politics isn\'t a one-day event. Choseno gives citizens a permanent forum '
          'to ask questions, share feedback, and hold representatives accountable '
          'throughout their entire term.',
    ),
    _Labeled(
      'Voice of the Silent Majority',
      'Most people have opinions but nowhere to share them safely. Choseno\'s '
          'anonymous Ghost ID system lets people speak honestly without fear of '
          'retribution.',
    ),
    _Labeled(
      'Zero Party Influence',
      'Choseno has no political affiliation and accepts no political donations. '
          'Every candidate is represented equally. Voters decide who gets a good '
          'rating — not us.',
    ),
  ]),
  _Section('How We Work — Editorial Standards', [
    _Labeled(
      'Strict Non-Partisanship',
      'We do not rank candidates based on party affiliation or endorsement. '
          'Every verified candidate gets the exact same presentation.',
    ),
    _Labeled(
      'Verified Voters & One Person, One Vote',
      'To prevent bots, brigading, and foreign interference, all location-based '
          'votes are tied to real, verified electoral boundaries.',
    ),
    _Labeled(
      'Privacy First',
      'Your real identity is never exposed on posts or ratings. We protect '
          'citizen privacy while maintaining high-trust community signals.',
    ),
  ]),
  _Section('Questions, concerns, or corrections?', [
    _Para('Reach us at $_contactEmail.'),
  ]),
];

const _privacy = <_Section>[
  _Section('1. Overview', [
    _Para(
      'Choseno ("we," "our," or "the platform") is an independent civic '
      'social media platform, available on the web and as a mobile app, that '
      'lets citizens anonymously rate, review, and discuss elected officials '
      'and political candidates. This policy explains what data we collect, '
      'why we collect it, and the steps we take to protect it.',
    ),
    _Para(
      'Choseno is an early-stage startup and is currently in beta. We work '
      'hard to protect your information, but we cannot guarantee that every '
      'feature works as intended or that your data will never be exposed (see '
      'Section 8).',
    ),
  ]),
  _Section('2. Information We Collect', [
    _Labeled(
      'Account Information',
      'If you create an account (via email or Google Sign-In), we store your '
      'email address and name for authentication and account management. We '
      'do not sell your personal account information.',
    ),
    _Labeled(
      'Ghost IDs & Anonymity',
      'Public activity on Choseno (posts, ratings, and comments) is tied to a '
      'rotating, anonymized "Ghost ID" rather than your real name. The system '
      'is designed so that other users, including politicians on the '
      'platform, cannot link a Ghost ID to your real identity. We strive to '
      'maintain this, but we cannot guarantee absolute anonymity. For '
      'example, information you choose to include in a post, a legal order, '
      'or a security incident could reveal who you are.',
    ),
    _Labeled(
      'Usage, Analytics & Diagnostic Data',
      'We collect standard analytics data (page views, session durations, '
      'referral sources) through Google Analytics, and technical error '
      'information (such as error messages, the page you were on, and browser '
      'or device details) to find and fix problems. We use this to improve '
      'the platform and do not use it to identify you.',
    ),
    _Labeled(
      'Location (Boundary Matching Only)',
      'To show you elections and candidates relevant to your area, we may ask '
      'for your location or address. We use it to match you to your electoral '
      'boundaries. If you search by address, city, or postal code, the text '
      'you type is sent to the OpenStreetMap Nominatim geocoding service to '
      'find the matching location.',
    ),
  ]),
  _Section('3. User-Generated Content', [
    _Para(
      'Content posted by users, including ratings, reviews, comments, and '
      'wall posts, is user-generated. Choseno does not verify, endorse, or '
      'take responsibility for it. Users are solely responsible for the '
      'accuracy and legality of what they post.',
    ),
    _Para(
      'By posting on Choseno, you grant Choseno a non-exclusive license to '
      'display your content on the platform. Content posted publicly may be '
      'visible to search engines and AI indexing systems.',
    ),
  ]),
  _Section('4. Public Politician & Candidate Data', [
    _Para(
      'Politician and candidate profile information (name, office sought, '
      'party affiliation, campaign website) is sourced from publicly '
      'available government records and official election filings. We do not '
      'guarantee that it is complete or current. If you are a public official '
      'and believe information about you is incorrect, please contact us at '
      '$_contactEmail.',
    ),
  ]),
  _Section('5. How We Use Your Data', [
    _Bullets([
      'To authenticate and maintain your account',
      'To match you to your electoral districts and relevant candidates',
      'To display anonymized community discussions and ratings',
      'To keep the platform secure, diagnose errors, and improve performance',
      'To send optional notification emails if you opt in',
    ]),
  ]),
  _Section('6. Data Sharing', [
    _Para(
      'We do not sell your personal data, and we do not share it with '
      'political parties, advertisers, or data brokers. We may share '
      'aggregated, anonymized statistics publicly.',
    ),
    _Para(
      'We rely on service providers to run the platform, including Supabase '
      '(database and authentication, with data stored in the United States), '
      'Google (Sign-In and Analytics), OpenStreetMap (address search), and '
      'our hosting provider. They process data on our behalf. We may also '
      'disclose information if required by law, a valid court order, or to '
      'protect the rights and safety of others.',
    ),
  ]),
  _Section('7. Cookies', [
    _Para(
      'Choseno uses essential cookies for session authentication and '
      'non-essential analytics cookies (Google Analytics) on the website. You '
      'can disable analytics cookies through your browser settings. Essential '
      'cookies are required for the platform to function.',
    ),
  ]),
  _Section('8. Security & Beta Disclaimer', [
    _Para(
      'We use commercially reasonable measures to protect your information. '
      'However, no website, app, or database is completely secure, and '
      'Choseno is a beta product built by a small team. We cannot guarantee '
      'that unauthorized access, hacking, data loss, or data disclosure will '
      'never occur. To the fullest extent permitted by law, Choseno and its '
      'founders are not liable for losses resulting from such events. If we '
      'become aware of a breach affecting your personal information, we will '
      'notify you as required by applicable law.',
    ),
    _Para(
      'You are responsible for keeping your login credentials secure.',
    ),
  ]),
  _Section('9. Your Rights', [
    _Para(
      'You can delete your account and associated personal data at any time '
      'in the app (Profile → Delete account) or at '
      'choseno.com/delete-account. You may also contact us at $_contactEmail. '
      'Anonymized public content (ratings, posts) may remain on the platform, '
      'as it cannot be linked back to your identity after deletion.',
    ),
  ]),
  _Section('10. Children\'s Privacy', [
    _Para(
      'Choseno is not intended for anyone under the age of 13. We do not '
      'knowingly collect personal data from children. If you believe a child '
      'has created an account, please contact us.',
    ),
  ]),
  _Section('11. Changes to This Policy', [
    _Para(
      'We may update this policy from time to time. Significant changes will '
      'be communicated via the platform. Continued use of Choseno after an '
      'update constitutes acceptance of the revised policy.',
    ),
  ]),
  _Section('12. Contact', [
    _Para(
      'For privacy questions, data deletion requests, or correction requests, '
      'contact us at $_contactEmail.',
    ),
  ]),
];

const _terms = <_Section>[
  _Section('1. Acceptance of Terms', [
    _Para(
      'By accessing or using Choseno ("the platform," "the service," "we," or '
      '"us"), you agree to be bound by these Terms of Service and our Privacy '
      'Policy. You must be at least 13 years old to use Choseno. If you do '
      'not agree, do not use the platform.',
    ),
  ]),
  _Section('2. Beta Service', [
    _Para(
      'Choseno is an early-stage startup product currently in beta. Features '
      'may be incomplete, change, or stop working without notice, and data '
      'may be lost or reset. We strive to deliver every feature described on '
      'the website and app, but we do not guarantee that any feature, '
      'content, or data will be available, accurate, complete, or work as '
      'intended.',
    ),
  ]),
  _Section('3. Description of Service', [
    _Para(
      'Choseno is an independent, user-generated civic platform that allows '
      'citizens to anonymously review, rate, and discuss elected officials '
      'and political candidates in their electoral districts. Choseno is not '
      'a political party, a PAC, or an election authority. It is a neutral '
      'public forum for civic conversation.',
    ),
    _Para(
      'Choseno may also display informational content such as election '
      'details, candidate information, and news summaries, some of which is '
      'created with the help of AI tools and may contain errors or omissions. '
      'This content is provided for general information only. Please verify '
      'important details, such as election dates, polling places, and '
      'candidate information, with official government sources.',
    ),
  ]),
  _Section('4. User-Generated Content', [
    _Para(
      'Choseno hosts user-generated content (UGC). Under Section 230 of the '
      'Communications Decency Act and equivalent applicable laws:',
    ),
    _Bullets([
      'Choseno is not the author or publisher of user-generated content.',
      'Choseno is not liable for user-submitted reviews, ratings, comments, '
      'posts, or discussions.',
      'Users are solely responsible for the content they submit and its '
      'accuracy, legality, and appropriateness.',
      'Choseno does not verify or endorse any user-submitted content.',
    ]),
  ]),
  _Section('5. User Conduct', [
    _Para(
      'By using Choseno, you agree not to:',
    ),
    _Bullets([
      'Post false, defamatory, or knowingly misleading information about any '
      'person',
      'Harass, threaten, or intimidate any individual, candidate, or elected '
      'official',
      'Post content that is illegal, obscene, or violates any third party\'s '
      'rights',
      'Attempt to manipulate ratings through fake accounts or coordinated '
      'inauthentic behavior',
      'Use the platform for commercial advertising or political fundraising',
      'Impersonate any politician, candidate, or other person',
      'Scrape, crawl, or extract platform data in bulk without written '
      'permission',
      'Attempt to hack, disrupt, or gain unauthorized access to the platform '
      'or other users\' accounts',
    ]),
  ]),
  _Section('6. Anonymous Ghost ID System', [
    _Para(
      'Choseno uses a rotating "Ghost ID" system designed to protect user '
      'anonymity. Your public activity is not intentionally linked to your '
      'real identity, but we cannot guarantee absolute anonymity. Choseno may '
      'be required to disclose account information if compelled by a valid '
      'court order or law enforcement request. Anonymity does not grant '
      'permission to engage in illegal conduct.',
    ),
  ]),
  _Section('7. Public Official & Candidate Information', [
    _Para(
      'Politician and candidate profile data on Choseno is sourced from '
      'publicly available government records and campaign filings. We do not '
      'guarantee its accuracy or completeness. If you are a public official '
      'and believe information about you is incorrect, contact us at '
      '$_contactEmail and we will look into it.',
    ),
  ]),
  _Section('8. Content Moderation', [
    _Para(
      'Choseno reserves the right, but not the obligation, to remove content '
      'that violates these Terms. We are not responsible for failing to '
      'remove any particular content. Moderation decisions are made at our '
      'sole discretion.',
    ),
    _Para(
      'To report content that you believe violates these Terms, use the '
      'in-platform report button or contact us at $_contactEmail.',
    ),
  ]),
  _Section('9. Disclaimer of Warranties', [
    _Para(
      'Choseno is provided "as is" and "as available," without warranties of '
      'any kind, express or implied, including accuracy, reliability, '
      'availability, merchantability, fitness for a particular purpose, and '
      'non-infringement. We do not warrant that the platform will be '
      'uninterrupted, error-free, or free of harmful components, or that any '
      'data displayed on it is accurate.',
    ),
  ]),
  _Section('10. Security & Data Disclaimer', [
    _Para(
      'We use commercially reasonable measures to protect the platform and '
      'your information, but no system is completely secure. We cannot '
      'guarantee that unauthorized access, hacking, data loss, or data '
      'disclosure will never occur. To the fullest extent permitted by law, '
      'Choseno is not liable for any loss or harm resulting from them. You '
      'use the platform at your own risk and are responsible for keeping your '
      'login credentials secure.',
    ),
  ]),
  _Section('11. Limitation of Liability', [
    _Para(
      'To the fullest extent permitted by law, Choseno and its founders, '
      'operators, employees, and affiliates are not liable for any indirect, '
      'incidental, special, consequential, or punitive damages, or for any '
      'loss of data, profits, or goodwill, arising from your use of the '
      'platform or from content posted by users, including defamatory '
      'statements, inaccurate ratings, security incidents, or service '
      'interruptions.',
    ),
    _Para(
      'Our total liability for any claim relating to the platform is limited '
      'to the greater of \$100 or the amount you paid us in the preceding 12 '
      'months. Some jurisdictions do not allow certain limitations, so some '
      'of the above may not apply to you.',
    ),
  ]),
  _Section('12. Indemnification', [
    _Para(
      'You agree to indemnify and hold harmless Choseno and its founders, '
      'operators, and affiliates from any claims, damages, or expenses '
      '(including reasonable legal fees) arising from content you post or '
      'your violation of these Terms.',
    ),
  ]),
  _Section('13. Suspension & Termination', [
    _Para(
      'We may suspend or terminate your access at any time, with or without '
      'notice, including for violating these Terms. You may stop using '
      'Choseno and delete your account at any time as described in our '
      'Privacy Policy.',
    ),
  ]),
  _Section('14. Intellectual Property', [
    _Para(
      'The Choseno name, logo, and platform design are owned by Choseno. '
      'User-generated content remains the property of its authors, subject to '
      'the non-exclusive license granted in our Privacy Policy. You may not '
      'reproduce, copy, or distribute Choseno\'s platform design or '
      'proprietary features without written permission.',
    ),
  ]),
  _Section('15. Governing Law', [
    _Para(
      'These Terms are governed by the laws of the applicable jurisdiction in '
      'which Choseno operates. Disputes shall first be addressed through '
      'good-faith negotiation before pursuing legal remedies.',
    ),
  ]),
  _Section('16. Changes to These Terms', [
    _Para(
      'We may revise these Terms from time to time. We will notify users of '
      'significant changes through the platform. Continued use of Choseno '
      'after a revision constitutes acceptance of the updated Terms.',
    ),
  ]),
  _Section('17. Contact', [
    _Para(
      'Questions about these Terms? Contact us at $_contactEmail.',
    ),
  ]),
];

class StaticContentScreen extends StatelessWidget {
  const StaticContentScreen({super.key, required this.page});

  final StaticPage page;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final meta = page.meta;
    return Scaffold(
      appBar: DetailAppBar(title: page.title),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(ChosenoSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                page.title,
                style: ChosenoTypography.display(
                  color: palette.textMain,
                  fontSize: 28,
                ),
              ),
              if (meta != null) ...[
                const SizedBox(height: 6),
                Text(
                  meta,
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontSize: 13,
                  ),
                ),
              ],
              const SizedBox(height: ChosenoSpacing.lg),
              for (final section in page.sections)
                _SectionView(section: section, palette: palette),
              const Divider(height: 32),
              Wrap(
                spacing: ChosenoSpacing.lg,
                runSpacing: 8,
                children: [
                  for (final (label, route) in page.related)
                    InkWell(
                      onTap: () => context.push(route),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text(
                          label,
                          style: ChosenoTypography.body(
                            color: palette.primary,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: ChosenoSpacing.lg),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionView extends StatelessWidget {
  const _SectionView({required this.section, required this.palette});

  final _Section section;
  final ChosenoPalette palette;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ChosenoSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (section.heading != null) ...[
            Text(
              section.heading!,
              style: ChosenoTypography.display(
                color: palette.textMain,
                fontSize: 20,
              ),
            ),
            const SizedBox(height: 10),
          ],
          for (final block in section.blocks)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _blockView(block),
            ),
        ],
      ),
    );
  }

  TextStyle get _body => ChosenoTypography.body(
    color: palette.textSecondary,
    fontSize: 15,
    height: 1.55,
  );

  Widget _blockView(_Block block) => switch (block) {
    _Para(:final text) => _linkified(text),
    _Labeled(:final label, :final text) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: ChosenoTypography.body(
            color: palette.textMain,
            fontSize: 15,
            fontWeight: FontWeight.w600,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 2),
        _linkified(text),
      ],
    ),
    _Bullets(:final items) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('•  ', style: _body),
                Expanded(child: Text(item, style: _body)),
              ],
            ),
          ),
      ],
    ),
  };

  /// Renders [text] with the contact email tappable.
  Widget _linkified(String text) {
    final i = text.indexOf(_contactEmail);
    if (i < 0) return Text(text, style: _body);
    return Text.rich(
      TextSpan(
        style: _body,
        children: [
          TextSpan(text: text.substring(0, i)),
          TextSpan(
            text: _contactEmail,
            style: _body.copyWith(
              color: palette.primary,
              decoration: TextDecoration.underline,
            ),
            recognizer: TapGestureRecognizer()
              ..onTap = () => launchUrl(Uri.parse('mailto:$_contactEmail')),
          ),
          TextSpan(text: text.substring(i + _contactEmail.length)),
        ],
      ),
    );
  }
}
