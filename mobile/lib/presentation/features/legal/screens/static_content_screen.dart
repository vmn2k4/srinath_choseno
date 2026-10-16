// Screen A.12 from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo) — one
// generic screen fed by an enum. No data layer: the copy below mirrors the
// website pages (src/app/{about,privacy,terms,corrections-policy,
// editorial-standards}) and the `about` strings in
// src/lib/i18n/locales/en.json. When those change, update this file too.
import '../../../common/widgets/detail_app_bar.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';

enum StaticPage { about, privacy, terms, correctionsPolicy, editorialStandards }

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
    StaticPage.correctionsPolicy => 'Corrections Policy',
    StaticPage.editorialStandards => 'Editorial Standards',
  };

  String? get meta => switch (this) {
    StaticPage.about => null,
    StaticPage.privacy || StaticPage.terms => 'Effective date: August 10, 2026',
    StaticPage.correctionsPolicy ||
    StaticPage.editorialStandards => 'Last updated: August 17, 2026',
  };

  /// Other legal pages offered at the bottom of each page.
  List<(String, String)> get related => switch (this) {
    StaticPage.about => const [
      ('Terms of Service', AppRoutes.terms),
      ('Privacy Policy', AppRoutes.privacy),
      ('Editorial Standards', AppRoutes.editorialStandards),
    ],
    StaticPage.privacy => const [
      ('Terms of Service', AppRoutes.terms),
      ('About Choseno', AppRoutes.about),
    ],
    StaticPage.terms => const [
      ('Privacy Policy', AppRoutes.privacy),
      ('About Choseno', AppRoutes.about),
    ],
    StaticPage.correctionsPolicy => const [
      ('Editorial Standards', AppRoutes.editorialStandards),
    ],
    StaticPage.editorialStandards => const [
      ('Corrections Policy', AppRoutes.correctionsPolicy),
      ('About Choseno', AppRoutes.about),
    ],
  };

  List<_Section> get sections => switch (this) {
    StaticPage.about => _about,
    StaticPage.privacy => _privacy,
    StaticPage.terms => _terms,
    StaticPage.correctionsPolicy => _corrections,
    StaticPage.editorialStandards => _editorial,
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
      'Choseno ("we," "our," or "the platform") is an independent civic social '
      'media platform that lets citizens anonymously rate, review, and discuss '
      'elected officials and political candidates. We take your privacy '
      'seriously. This policy explains what data we collect, why we collect it, '
      'and how it is protected.',
    ),
  ]),
  _Section('2. Information We Collect', [
    _Labeled(
      'Account Information',
      'If you create an account (via email or Google Sign-In), we store your '
          'email address and name solely for authentication purposes. We do not '
          'sell, trade, or share your personal account information with any '
          'third parties.',
    ),
    _Labeled(
      'Ghost IDs & Anonymity',
      'All public activity on Choseno — posts, ratings, and comments — is tied '
          'to a rotating, anonymized "Ghost ID," not your real name or account '
          'identity. Your Ghost ID rotates periodically. No other user, '
          'including politicians on the platform, can link your Ghost ID to '
          'your real identity.',
    ),
    _Labeled(
      'Usage & Analytics Data',
      'We collect standard web analytics data (page views, session durations, '
          'referral sources) through Google Analytics to improve platform '
          'performance. This data is aggregated and anonymized. It is not '
          'linked to your personal identity.',
    ),
    _Labeled(
      'Location (Boundary Matching Only)',
      'To show you elections and candidates relevant to your area, we may ask '
          'for your location or address. This is used only to match you to your '
          'electoral boundaries. We do not store your precise location '
          'permanently.',
    ),
  ]),
  _Section('3. User-Generated Content', [
    _Para(
      'Choseno is a social media platform. Content posted by users — including '
      'ratings, reviews, comments, and wall posts — is user-generated. Choseno '
      'does not verify, endorse, or take responsibility for user-generated '
      'content. Users are solely responsible for the accuracy and legality of '
      'content they post.',
    ),
    _Para(
      'By posting on Choseno, you grant Choseno a non-exclusive license to '
      'display your content on the platform. Content posted publicly may be '
      'visible to search engines and AI indexing systems.',
    ),
  ]),
  _Section('4. Public Politician & Candidate Data', [
    _Para(
      'Politician and candidate profile information (name, office sought, party '
      'affiliation, campaign website) is sourced from publicly available '
      'government records and official election filings. This is public '
      'information and is displayed under fair use of public civic data. If you '
      'are a public official and believe information about you is factually '
      'incorrect, please contact us at $_contactEmail.',
    ),
  ]),
  _Section('5. How We Use Your Data', [
    _Bullets([
      'To authenticate and maintain your account',
      'To match you to your electoral districts and relevant candidates',
      'To display anonymized community discussions and ratings',
      'To improve platform performance through aggregated analytics',
      'To send optional notification emails if you opt in (no marketing spam)',
    ]),
  ]),
  _Section('6. Data Sharing', [
    _Para(
      'We do not sell your personal data. We do not share your personal data '
      'with political parties, advertisers, or data brokers. We may share '
      'aggregated, anonymized platform statistics publicly to demonstrate '
      'platform health and engagement.',
    ),
    _Para(
      'We use Supabase for our backend database and authentication. Supabase is '
      'a SOC 2 Type II certified platform with data stored in the United '
      'States.',
    ),
  ]),
  _Section('7. Cookies', [
    _Para(
      'Choseno uses essential cookies for session authentication and '
      'non-essential analytics cookies (Google Analytics) on the website. You '
      'can disable analytics cookies through your browser settings. Essential '
      'session cookies are required for the platform to function.',
    ),
  ]),
  _Section('8. Your Rights', [
    _Para(
      'You can delete your account and associated personal data at any time in '
      'the app (Profile → Delete account) or at choseno.com/delete-account. You '
      'may also contact us at $_contactEmail. Note that anonymized public '
      'content (ratings, posts) may remain on the platform as they cannot be '
      'linked back to your identity after deletion.',
    ),
  ]),
  _Section('9. Children\'s Privacy', [
    _Para(
      'Choseno is not intended for use by anyone under the age of 13. We do not '
      'knowingly collect personal data from children. If you believe a child '
      'has created an account, please contact us immediately.',
    ),
  ]),
  _Section('10. Changes to This Policy', [
    _Para(
      'We may update this privacy policy from time to time. Significant changes '
      'will be communicated via the platform. Continued use of Choseno after a '
      'policy update constitutes acceptance of the revised policy.',
    ),
  ]),
  _Section('11. Contact', [
    _Para(
      'For privacy-related questions, data deletion requests, or factual '
      'correction requests, contact us at $_contactEmail.',
    ),
  ]),
];

const _terms = <_Section>[
  _Section('1. Acceptance of Terms', [
    _Para(
      'By accessing or using Choseno ("the platform," "the service," "we," or '
      '"us"), you agree to be bound by these Terms of Service and our Privacy '
      'Policy. If you do not agree, do not use the platform.',
    ),
  ]),
  _Section('2. Description of Service', [
    _Para(
      'Choseno is an independent, user-generated civic social media platform '
      'that allows citizens to anonymously review, rate, and discuss elected '
      'officials and political candidates in their electoral districts. Choseno '
      'is not a news organization, a political party, a PAC, or an election '
      'authority. It is a neutral public forum for civic conversation.',
    ),
  ]),
  _Section('3. User-Generated Content — Platform Liability Shield', [
    _Para(
      'Choseno is a social media platform that hosts user-generated content '
      '(UGC). Under Section 230 of the Communications Decency Act and '
      'equivalent applicable laws:',
    ),
    _Bullets([
      'Choseno is not the author or publisher of user-generated content.',
      'Choseno is not liable for any user-submitted reviews, ratings, comments, '
          'posts, or discussions.',
      'Users are solely responsible for the content they submit and its '
          'accuracy, legality, and appropriateness.',
      'Choseno does not verify or endorse any user-submitted content.',
    ]),
  ]),
  _Section('4. User Conduct', [
    _Para('By using Choseno, you agree not to:'),
    _Bullets([
      'Post false, defamatory, or knowingly misleading information about any '
          'person',
      'Harass, threaten, or intimidate any individual, candidate, or elected '
          'official',
      'Post content that is illegal, obscene, or violates any third party\'s '
          'rights',
      'Attempt to manipulate ratings through fake accounts or coordinated '
          'inauthentic behavior',
      'Use the platform for any commercial advertising or political '
          'fundraising',
      'Impersonate any politician, candidate, or other person',
      'Scrape, crawl, or extract platform data in bulk without written '
          'permission',
    ]),
  ]),
  _Section('5. Anonymous Ghost ID System', [
    _Para(
      'Choseno uses a rotating "Ghost ID" system to protect user anonymity. '
      'Your public activity is never directly linked to your real identity. '
      'However, Choseno may be legally required to disclose account information '
      'if compelled by a valid court order or law enforcement request related '
      'to illegal activity. Anonymity does not grant permission to engage in '
      'illegal conduct.',
    ),
  ]),
  _Section('6. Public Official & Candidate Information', [
    _Para(
      'Politician and candidate profile data displayed on Choseno is sourced '
      'from publicly available official government records and campaign '
      'filings. This constitutes fair use of public civic information. Public '
      'officials have a reduced expectation of privacy regarding their '
      'exercise of public duties.',
    ),
    _Para(
      'If you are a public official and believe information displayed about '
      'you is factually incorrect, contact us at $_contactEmail and we will '
      'investigate.',
    ),
  ]),
  _Section('7. Content Moderation', [
    _Para(
      'Choseno reserves the right — but not the obligation — to remove content '
      'that violates these Terms of Service. We are not responsible for failing '
      'to remove any particular content. Content removal decisions are made at '
      'our sole discretion.',
    ),
    _Para(
      'To report content that you believe violates these terms, use the '
      'in-platform report button or contact us at $_contactEmail.',
    ),
  ]),
  _Section('8. Disclaimer of Warranties', [
    _Para(
      'Choseno is provided "as is" and "as available" without warranties of '
      'any kind, either express or implied. We do not warrant that the platform '
      'will be uninterrupted, error-free, or free of viruses or other harmful '
      'components. We do not warrant the accuracy of any candidate or '
      'politician data displayed on the platform.',
    ),
  ]),
  _Section('9. Limitation of Liability', [
    _Para(
      'To the maximum extent permitted by applicable law, Choseno, its '
      'founders, operators, and affiliates shall not be liable for any '
      'indirect, incidental, special, consequential, or punitive damages '
      'arising from your use of the platform or from any content posted by '
      'users, including but not limited to defamatory statements, inaccurate '
      'ratings, or any other user-generated content.',
    ),
  ]),
  _Section('10. Intellectual Property', [
    _Para(
      'The Choseno name, logo, and platform design are owned by Choseno. '
      'User-generated content remains the intellectual property of its '
      'authors, subject to the non-exclusive license granted in our Privacy '
      'Policy. You may not reproduce, copy, or distribute Choseno\'s platform '
      'design or proprietary features without written permission.',
    ),
  ]),
  _Section('11. Governing Law', [
    _Para(
      'These Terms of Service are governed by the laws of the applicable '
      'jurisdiction in which Choseno operates. Any disputes shall be resolved '
      'through good-faith negotiation before pursuing legal remedies.',
    ),
  ]),
  _Section('12. Changes to These Terms', [
    _Para(
      'We may revise these Terms from time to time. We will notify users of '
      'significant changes through the platform. Continued use of Choseno '
      'following any revision constitutes acceptance of the updated Terms.',
    ),
  ]),
  _Section('13. Contact', [
    _Para('Questions about these terms? Contact us at $_contactEmail.'),
  ]),
];

const _corrections = <_Section>[
  _Section('1. Reporting an error', [
    _Para(
      'If you find a factual error in a Choseno news article — including if you '
      'are the subject of the story — email $_contactEmail with the article\'s '
      'URL and a description of what\'s wrong. Where possible, include a source '
      'that supports the correct information; it speeds up verification.',
    ),
  ]),
  _Section('2. How we review a correction request', [
    _Para(
      'We re-check the disputed claim against the article\'s original cited '
      'sources and, where relevant, against the platform\'s own underlying '
      'civic data (candidate filings, office/seat records). If the claim '
      'doesn\'t hold up, we correct it. We aim to respond to correction '
      'requests within a few business days.',
    ),
  ]),
  _Section('3. How a correction is disclosed', [
    _Para(
      'Minor corrections (typos, formatting) are fixed silently. Substantive '
      'corrections — anything that changes a fact, a name, a figure, or the '
      'meaning of a claim — update the article\'s content and its "last '
      'updated" timestamp, which is visible on the article and carried in its '
      'structured data so search engines and AI systems reading the page see '
      'the corrected version, not a stale cached claim.',
    ),
  ]),
  _Section('4. Removal requests', [
    _Para(
      'We correct factual errors; we don\'t remove accurate coverage of a '
      'public official\'s public actions or filings on request. If you believe '
      'an entire article should not exist — for example, it concerns a private '
      'individual rather than a public official, or was published in error — '
      'say so in your email and we\'ll review it on those grounds '
      'specifically.',
    ),
  ]),
  _Section('5. Contact', [
    _Para(
      '$_contactEmail — see also our Editorial Standards for how stories are '
      'sourced and reviewed before publication.',
    ),
  ]),
];

const _editorial = <_Section>[
  _Section('1. Who publishes this', [
    _Para(
      'Choseno\'s civic news coverage is published by the Choseno Civic News '
      'Desk, operated by Choseno, an independent hyperlocal civic platform. We '
      'are not affiliated with any political party, candidate, or government '
      'office, and we do not accept payment from politicians or campaigns in '
      'exchange for coverage.',
    ),
  ]),
  _Section('2. How stories are sourced', [
    _Para(
      'Every published article is built from publicly available source '
      'material — government filings, official statements, municipal records, '
      'election filings, and reporting from other outlets — cited under a '
      '"Sources" section at the bottom of the article whenever it exists. We do '
      'not publish unsourced claims as fact. Stories tagged to a specific '
      'politician or seat are drawn from the same public record used elsewhere '
      'on Choseno (candidate filings, boundary/office data) so a claim about '
      'who holds or is running for a seat is checkable against the platform\'s '
      'own underlying data, not just the prose.',
    ),
  ]),
  _Section('3. AI-assisted drafting, human-gated publishing', [
    _Para(
      'Choseno is a small, independent team. Story drafts are assembled with AI '
      'assistance from the cited public sources to keep pace with the volume of '
      'civic activity across many jurisdictions — the same reason large '
      'outlets increasingly use AI-assisted tooling in their newsrooms. Every '
      'article is reviewed against its cited sources before it moves from '
      'draft to published status; nothing goes live automatically off an '
      'unreviewed model output. We\'d rather disclose this plainly than have a '
      'reader assume a byline means something it doesn\'t.',
    ),
  ]),
  _Section('4. Neutrality & non-partisanship', [
    _Para(
      'Coverage of candidates and elected officials is written to describe '
      'verifiable actions, statements, and filings — not to endorse or oppose '
      'anyone. Choseno\'s rating and review features are entirely separate, '
      'user-generated opinion content (clearly distinguished on every '
      'politician wall) and are never presented as Choseno\'s own editorial '
      'position.',
    ),
  ]),
  _Section('5. What we don\'t do', [
    _Para(
      'We don\'t run anonymous sourcing for serious factual claims, we don\'t '
      'accept payment for coverage, and we don\'t alter a published article\'s '
      'substance without noting it (see our Corrections Policy).',
    ),
  ]),
  _Section('6. Questions or concerns', [
    _Para(
      'If you believe a story is inaccurate, unfair, or missing important '
      'context — including if you are the subject of an article — contact us '
      'at $_contactEmail. See the Corrections Policy for how we handle and log '
      'factual corrections.',
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
