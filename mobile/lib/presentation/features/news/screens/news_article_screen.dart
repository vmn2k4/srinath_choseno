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
import '../../../../core/widgets/widgets.dart';
import '../providers/news_providers.dart';

class NewsArticleScreen extends ConsumerWidget {
  const NewsArticleScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final articleAsync = ref.watch(newsArticleBySlugProvider(slug));

    return Scaffold(
      appBar: AppBar(),
      body: articleAsync.when(
        data: (article) {
          final dateLabel = article.displayDate != null
              ? DateFormat.yMMMMd().format(article.displayDate!)
              : null;
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              ChosenoSpacing.lg + 4,
              ChosenoSpacing.sm,
              ChosenoSpacing.lg + 4,
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
              if (article.body != null)
                Text(
                  article.body!,
                  style: ChosenoTypography.body(
                    color: palette.textMain,
                    fontSize: 17,
                    height: 1.65,
                  ),
                ),
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
