// Port of NewsArticleLinkedPoliticians.tsx's "rate the people mentioned in
// this article" strip — one row per tagged politician (avatar, name,
// avg rating) with a Rate button that opens the same rating sheet as
// everywhere else (rate_politician_sheet.dart), carrying this article's id
// so the rating records a "via <headline>" source, same as web.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/politician_engagement.dart';
import '../../../../domain/news/entities/tagged_politician.dart';
import '../../politician_ratings/widgets/rate_politician_sheet.dart';
import '../providers/news_article_politicians_providers.dart';

class NewsArticleTaggedPoliticiansSection extends ConsumerWidget {
  const NewsArticleTaggedPoliticiansSection({
    super.key,
    required this.politicians,
    required this.newsArticleId,
  });

  final List<TaggedPolitician> politicians;
  final String newsArticleId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (politicians.isEmpty) return const SizedBox.shrink();
    final palette = ChosenoTheme.of(context);
    final ids = politicians.map((p) => p.id).toList();
    final engagementAsync = ref.watch(taggedPoliticiansEngagementProvider(ids));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Divider(color: palette.borderLight),
        const SizedBox(height: ChosenoSpacing.lg),
        Text(
          'Rate the people mentioned in this article',
          style: ChosenoTypography.body(
            color: palette.textMain,
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: ChosenoSpacing.sm),
        for (final politician in politicians) ...[
          _TaggedPoliticianRow(
            politician: politician,
            newsArticleId: newsArticleId,
            engagement: engagementAsync.value?[politician.id],
            ids: ids,
          ),
          const SizedBox(height: ChosenoSpacing.xs),
        ],
      ],
    );
  }
}

class _TaggedPoliticianRow extends ConsumerWidget {
  const _TaggedPoliticianRow({
    required this.politician,
    required this.newsArticleId,
    required this.engagement,
    required this.ids,
  });

  final TaggedPolitician politician;
  final String newsArticleId;
  final PoliticianEngagement? engagement;
  final List<String> ids;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final engagement = this.engagement;

    return AppCard(
      variant: AppCardVariant.row,
      child: Row(
        children: [
          AppAvatar(
            imageUrl: politician.photoUrl,
            fallbackText: politician.fullName,
            radius: 18,
          ),
          const SizedBox(width: ChosenoSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  politician.fullName,
                  style: ChosenoTypography.body(
                    color: palette.textMain,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                if (engagement != null)
                  Row(
                    children: [
                      AppStarRating(value: engagement.avgRating, size: 12),
                      const SizedBox(width: ChosenoSpacing.xs),
                      Text(
                        engagement.ratingCount > 0
                            ? '${engagement.avgRating.toStringAsFixed(1)} (${engagement.ratingCount})'
                            : 'New',
                        style: ChosenoTypography.body(
                          color: palette.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          AppButton(
            label: 'Rate',
            icon: Icons.star_border_rounded,
            variant: AppButtonVariant.outline,
            onPressed: () async {
              final submitted = await showRatePoliticianSheet(
                context,
                politicianId: politician.id,
                politicianName: politician.fullName,
                newsArticleId: newsArticleId,
              );
              if (submitted == true) {
                ref.invalidate(taggedPoliticiansEngagementProvider(ids));
              }
            },
          ),
        ],
      ),
    );
  }
}
