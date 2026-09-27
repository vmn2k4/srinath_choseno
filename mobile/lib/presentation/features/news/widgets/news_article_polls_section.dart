// Port of the web's NewsArticlePoll.tsx — reader-facing poll widget for a
// news article. Always shows the live tally as percentage bars (never
// gated behind "vote to see results"), same as web; voting requires
// sign-in, same convention as everything else that writes (silent no-op
// when signed out, see NewsArticlePollsController.vote's doc comment).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/news_polls/entities/news_article_poll.dart';
import '../../auth/providers/auth_providers.dart';
import '../providers/news_polls_providers.dart';

class NewsArticlePollsSection extends ConsumerWidget {
  const NewsArticlePollsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pollsAsync = ref.watch(newsArticlePollsControllerProvider);
    final isSignedIn = ref.watch(authStateChangesProvider).value != null;
    final palette = ChosenoTheme.of(context);

    return pollsAsync.when(
      // Loading/error render nothing here rather than a spinner/error
      // banner — this is a small below-the-fold widget, not the article's
      // own load (mirrors the web widget's "just appears once fetched").
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (polls) {
        if (polls.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Divider(color: palette.borderLight),
            const SizedBox(height: ChosenoSpacing.lg),
            for (final poll in polls) ...[
              _PollCard(poll: poll, isSignedIn: isSignedIn),
              const SizedBox(height: ChosenoSpacing.md),
            ],
          ],
        );
      },
    );
  }
}

class _PollCard extends ConsumerWidget {
  const _PollCard({required this.poll, required this.isSignedIn});

  final NewsArticlePoll poll;
  final bool isSignedIn;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final total = poll.totalVotes;

    return AppCard(
      variant: AppCardVariant.row,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.bar_chart_rounded, size: 16, color: palette.primary),
              const SizedBox(width: ChosenoSpacing.xs),
              Expanded(
                child: Text(
                  poll.question,
                  style: ChosenoTypography.body(
                    color: palette.textMain,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.sm),
          for (final option in poll.options) ...[
            _PollOptionRow(
              poll: poll,
              option: option,
              percent: total > 0 ? (option.voteCount / total * 100) : 0,
              isMine: poll.myVoteOptionId == option.id,
              isSignedIn: isSignedIn,
            ),
            const SizedBox(height: ChosenoSpacing.xs),
          ],
          Text(
            total == 0
                ? (isSignedIn
                      ? 'No votes yet — be the first.'
                      : 'No votes yet — be the first. · Sign in to vote')
                : '$total vote${total == 1 ? '' : 's'}'
                      '${isSignedIn ? '' : ' · Sign in to vote'}',
            style: ChosenoTypography.body(color: palette.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _PollOptionRow extends ConsumerWidget {
  const _PollOptionRow({
    required this.poll,
    required this.option,
    required this.percent,
    required this.isMine,
    required this.isSignedIn,
  });

  final NewsArticlePoll poll;
  final NewsArticlePollOption option;
  final double percent;
  final bool isMine;
  final bool isSignedIn;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final barColor = isMine ? palette.primary : palette.primaryLighter;

    return Pressable(
      onTap: isSignedIn
          ? () => ref
                .read(newsArticlePollsControllerProvider.notifier)
                .vote(poll.id, option.id)
          : null,
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(
            color: isMine ? palette.primary : palette.borderLight,
          ),
          borderRadius: BorderRadius.circular(ChosenoRadii.sm),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: ChosenoSpacing.sm,
          vertical: ChosenoSpacing.xs,
        ),
        child: Stack(
          children: [
            Positioned.fill(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(ChosenoRadii.sm),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: FractionallySizedBox(
                    widthFactor: (percent / 100).clamp(0, 1),
                    child: Container(
                      color: isMine
                          ? barColor.withValues(alpha: 0.18)
                          : palette.surfaceActive,
                    ),
                  ),
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isMine) ...[
                        Icon(Icons.check, size: 13, color: palette.primary),
                        const SizedBox(width: ChosenoSpacing.xs),
                      ],
                      Flexible(
                        child: Text(
                          option.label,
                          style: ChosenoTypography.body(
                            color: isMine ? palette.primary : palette.textMain,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  '${percent.round()}%',
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
