// Screen A.3. Renders `body` as plain text for now, not parsed markdown —
// add a markdown renderer (e.g. `flutter_markdown`) here when headings/
// links/images in article bodies actually need to render, rather than
// pulling in a rendering dependency before any screen needs it. The
// comment thread (anonymous, Ghost-ID, sign-in to post — same RPC as
// Feed's) is not yet ported either.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/share_link.dart';
import '../../../../core/widgets/widgets.dart';
import '../providers/news_polls_providers.dart';
import '../providers/news_providers.dart';
import '../widgets/news_article_polls_section.dart';
import '../widgets/news_article_tagged_politicians_section.dart';

class NewsArticleScreen extends ConsumerWidget {
  const NewsArticleScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final articleAsync = ref.watch(newsArticleBySlugProvider(slug));

    return Scaffold(
      appBar: AppBar(
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined),
            tooltip: 'Share',
            onPressed: () => shareChosenoLink('/news/$slug'),
          ),
        ],
      ),
      body: articleAsync.when(
        data: (article) {
          final dateLabel = article.displayDate != null
              ? DateFormat.yMMMMd().format(article.displayDate!)
              : null;
          // Fire the polls load once the article id is known — safe to call
          // every build, same convention as PoliticianWallScreen/
          // CandidacyWallScreen's own postFrameCallback load() calls.
          WidgetsBinding.instance.addPostFrameCallback((_) {
            ref.read(newsArticlePollsControllerProvider.notifier).load(article.id);
          });
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              ChosenoSpacing.md,
              ChosenoSpacing.sm,
              ChosenoSpacing.md,
              ChosenoSpacing.xxl,
            ),
            children: [
              Row(
                children: [
                  if (article.category != null)
                    AppBadge(
                      label: article.category!,
                      tone: AppBadgeTone.primary,
                      size: AppBadgeSize.xs,
                    ),
                  if (article.readingTimeMinutes != null) ...[
                    const SizedBox(width: ChosenoSpacing.sm),
                    Text(
                      '${article.readingTimeMinutes} min read',
                      style: ChosenoTypography.body(
                        color: palette.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: ChosenoSpacing.md),
              Text(
                article.headline,
                style: ChosenoTypography.display(
                  color: palette.textMain,
                  fontSize: 34,
                  height: 1.1,
                ),
              ),
              if (article.displayableHeroImageUrl != null) ...[
                const SizedBox(height: ChosenoSpacing.md),
                ClipRRect(
                  borderRadius: BorderRadius.circular(ChosenoRadii.card),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Image.network(
                      article.displayableHeroImageUrl!,
                      fit: BoxFit.cover,
                      loadingBuilder: (context, child, progress) {
                        if (progress == null) return child;
                        return Container(
                          color: palette.surfaceActive,
                          child: const Center(child: LoadingIndicator()),
                        );
                      },
                      errorBuilder: (context, error, stackTrace) =>
                          Container(color: palette.surfaceActive),
                    ),
                  ),
                ),
              ],
              if (dateLabel != null) ...[
                const SizedBox(height: ChosenoSpacing.md),
                Text(
                  dateLabel,
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontSize: 13,
                  ),
                ),
              ],
              const SizedBox(height: ChosenoSpacing.lg),
              Divider(color: palette.borderLight),
              const SizedBox(height: ChosenoSpacing.lg),
              // Left-aligned, not justified — on a narrow phone column
              // (short lines, no hyphenation support) justified text
              // stretches inter-word spacing unevenly into visible
              // "rivers" of whitespace, which reads worse than a plain
              // ragged-right edge. Same choice Apple News/Medium/etc. make
              // for body copy at phone widths.
              if (article.body != null)
                Text(
                  article.body!,
                  style: ChosenoTypography.body(
                    color: palette.textMain,
                    fontSize: 17,
                    height: 1.65,
                  ),
                ),
              NewsArticleTaggedPoliticiansSection(
                politicians: article.taggedPoliticians,
                newsArticleId: article.id,
              ),
              // NewsArticlePollsSection renders nothing at all (not even
              // its own top divider/spacing) once loaded with zero polls,
              // so it never leaves a blank gap on an article without one.
              const NewsArticlePollsSection(),
            ],
          );
        },
        loading: () => const Center(child: LoadingIndicator()),
        error: (error, _) => Center(
          child: Text(
            'This article could not be found.',
            style: ChosenoTypography.body(color: palette.danger),
          ),
        ),
      ),
    );
  }
}
