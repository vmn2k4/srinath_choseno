// Port of `PostCard.tsx`'s Feed configuration (vote-bar on) — see
// docs/FLUTTER_MOBILE_APP_GUIDE.md §5 in the parent repo. Simplified for
// v1: no image/video/link-preview rendering (composer doesn't produce
// them yet either), no @mention highlighting, no report action, no
// civic-score badge (that needs the Profile domain's score fields, not
// yet ported).
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/haptics.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/posts/entities/post.dart';

class FeedPostTile extends StatefulWidget {
  const FeedPostTile({
    super.key,
    required this.post,
    required this.onVote,
    required this.onComment,
  });

  final Post post;
  final void Function(int voteType) onVote;
  final void Function(String content) onComment;

  @override
  State<FeedPostTile> createState() => _FeedPostTileState();
}

class _FeedPostTileState extends State<FeedPostTile> {
  bool _commentsExpanded = false;
  final _commentController = TextEditingController();

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  void _submitComment() {
    if (_commentController.text.trim().isEmpty) return;
    widget.onComment(_commentController.text);
    _commentController.clear();
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final post = widget.post;

    final score = post.likesCount - post.dislikesCount;
    return AppCard(
      padding: const EdgeInsets.fromLTRB(
        ChosenoSpacing.lg,
        ChosenoSpacing.md + 2,
        ChosenoSpacing.lg,
        ChosenoSpacing.sm + 2,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: palette.primary.withValues(alpha: 0.14),
                child: Icon(
                  Icons.person_outline,
                  size: 20,
                  color: palette.primary,
                ),
              ),
              const SizedBox(width: ChosenoSpacing.md - 2),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Ghost ${post.ghostId.substring(0, 6)}',
                      style: ChosenoTypography.body(
                        color: palette.textMain,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      DateFormat.MMMd().add_jm().format(post.createdAt),
                      style: ChosenoTypography.body(
                        color: palette.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.md),
          // Larger, higher-contrast body copy (post-content-typography
          // decision: text-base + text-main, the Facebook/Reddit reading
          // size — this is what people actually came to read).
          Text(
            post.content,
            style: ChosenoTypography.body(
              color: palette.textMain,
              fontSize: 16,
              height: 1.5,
            ),
          ),
          const SizedBox(height: ChosenoSpacing.md),
          Row(
            children: [
              _VotePill(
                score: score,
                onUp: () {
                  AppHaptics.tap();
                  widget.onVote(1);
                },
                onDown: () {
                  AppHaptics.tap();
                  widget.onVote(-1);
                },
              ),
              const SizedBox(width: ChosenoSpacing.sm),
              InkWell(
                borderRadius: BorderRadius.circular(ChosenoRadii.full),
                onTap: () =>
                    setState(() => _commentsExpanded = !_commentsExpanded),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ChosenoSpacing.md,
                    vertical: ChosenoSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: palette.surfaceHover,
                    borderRadius: BorderRadius.circular(ChosenoRadii.full),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.mode_comment_outlined,
                        size: 17,
                        color: palette.textMuted,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${post.commentCount}',
                        style: ChosenoTypography.body(
                          color: palette.textMuted,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (_commentsExpanded) ...[
            const SizedBox(height: ChosenoSpacing.md),
            Divider(color: palette.borderLight),
            const SizedBox(height: ChosenoSpacing.sm),
            ...post.comments.map(
              (c) => Padding(
                padding: const EdgeInsets.only(bottom: ChosenoSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Ghost ${c.ghostId.substring(0, 6)}',
                      style: ChosenoTypography.body(
                        color: palette.textTertiary,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      c.content,
                      style: ChosenoTypography.body(
                        color: palette.textMain,
                        fontSize: 14,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: AppTextField(
                    label: 'Add a comment',
                    controller: _commentController,
                  ),
                ),
                const SizedBox(width: ChosenoSpacing.xs),
                IconButton.filled(
                  icon: const Icon(Icons.send, size: 18),
                  onPressed: _submitComment,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Up / score / down as one pill — a single, easy-to-hit control instead of
/// two loose icon buttons.
class _VotePill extends StatelessWidget {
  const _VotePill({
    required this.score,
    required this.onUp,
    required this.onDown,
  });

  final int score;
  final VoidCallback onUp;
  final VoidCallback onDown;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: palette.surfaceHover,
        borderRadius: BorderRadius.circular(ChosenoRadii.full),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.arrow_upward, size: 19),
            color: palette.success,
            onPressed: onUp,
          ),
          // The count ticks over with a quick scale so a vote visibly
          // "lands" — the small dopamine hit that makes voting feel good.
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            transitionBuilder: (child, animation) => ScaleTransition(
              scale: animation,
              child: FadeTransition(opacity: animation, child: child),
            ),
            child: Text(
              '$score',
              key: ValueKey(score),
              style: ChosenoTypography.body(
                color: palette.textMain,
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.arrow_downward, size: 19),
            color: palette.danger,
            onPressed: onDown,
          ),
        ],
      ),
    );
  }
}
