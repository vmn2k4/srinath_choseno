// Screens A.2/A.3 from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo).
// A.4 (category/topic browsing) and the comment thread are not yet
// ported — see the guide's own note that A.4 is "the same screen shape,
// just a different filter," low priority relative to this plain list.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../common/widgets/app_shell.dart';
import '../../../common/widgets/screen_header.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/news/entities/news_article.dart';
import '../providers/news_providers.dart';

class NewsListScreen extends ConsumerWidget {
  const NewsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final articlesAsync = ref.watch(publishedNewsArticlesProvider);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const ScreenHeader(title: 'News'),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(publishedNewsArticlesProvider);
                  await ref.read(publishedNewsArticlesProvider.future);
                },
                child: articlesAsync.when(
                  data: (articles) => ListView(
                    padding: const EdgeInsets.fromLTRB(
                      ChosenoSpacing.lg,
                      ChosenoSpacing.md,
                      ChosenoSpacing.lg,
                      kBottomNavClearance + ChosenoSpacing.lg,
                    ),
                    children: [
                      if (articles.isEmpty)
                        const EmptyState(
                          icon: Icons.article_outlined,
                          title: 'No articles yet',
                          message: 'Check back soon for the latest coverage.',
                        )
                      else
                        for (final (i, article) in articles.indexed)
                          FadeSlideIn(
                            index: i,
                            child: Padding(
                              padding: const EdgeInsets.only(
                                bottom: ChosenoSpacing.md,
                              ),
                              child: _NewsArticleCard(article: article),
                            ),
                          ),
                    ],
                  ),
                  loading: () => const SkeletonList(count: 3),
                  error: (error, _) => Center(
                    child: Text(
                      'Could not load news.',
                      style: ChosenoTypography.body(color: palette.danger),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NewsArticleCard extends StatelessWidget {
  const _NewsArticleCard({required this.article});
  final NewsArticle article;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final dateLabel = article.displayDate != null
        ? DateFormat.yMMMd().format(article.displayDate!)
        : null;

    return AppCard(
      variant: AppCardVariant.standard,
      onTap: () => context.push('/news/${article.slug}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              if (article.isBreakingNews) ...[
                const AppBadge(
                  label: 'Breaking',
                  tone: AppBadgeTone.danger,
                  size: AppBadgeSize.xs,
                ),
                const SizedBox(width: ChosenoSpacing.xs),
              ],
              if (article.category != null)
                AppBadge(
                  label: article.category!,
                  tone: AppBadgeTone.neutral,
                  size: AppBadgeSize.xs,
                ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.sm),
          Text(
            article.headline,
            style: ChosenoTypography.display(
              color: palette.textMain,
              fontSize: 22,
              height: 1.15,
            ),
          ),
          if (article.summary != null) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            Text(
              article.summary!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: 14,
                height: 1.45,
              ),
            ),
          ],
          if (dateLabel != null) ...[
            const SizedBox(height: ChosenoSpacing.md),
            Text(
              dateLabel,
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: 12,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
