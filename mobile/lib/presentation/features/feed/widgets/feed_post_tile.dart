// Port of `PostCard.tsx`'s Feed configuration (vote-bar on) — see
// docs/FLUTTER_MOBILE_APP_GUIDE.md §5 in the parent repo. Shows the photo,
// video thumbnail/player and link card, a share button and the
// report/block menu. Still missing: @mention highlighting and the
// civic-score badge.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../politician_wall/widgets/wall_post_tile.dart'
    show PostImage, LinkCard;
import 'package:intl/intl.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/utils/ghost_name.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/share_link.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/haptics.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/posts/entities/post.dart';
import '../../../common/widgets/content_safety_sheets.dart';
import '../../../common/widgets/vote_pill.dart';
import '../providers/content_safety_providers.dart';
import '../../../common/widgets/post_video_thumbnail.dart';

class FeedPostTile extends ConsumerStatefulWidget {
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
  ConsumerState<FeedPostTile> createState() => _FeedPostTileState();
}

class _FeedPostTileState extends ConsumerState<FeedPostTile> {
  bool _commentsExpanded = false;
  bool _hidden = false;
  final _commentController = TextEditingController();

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _menu(String type, String id, String ghostId) async {
    final hide = await showContentActionsSheet(
      context,
      ref,
      targetType: type,
      targetId: id,
      ghostId: ghostId,
    );
    if (hide && mounted) setState(() => _hidden = true);
  }

  Future<void> _open(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  void _showImage(String url) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: Stack(
          children: [
            Center(child: InteractiveViewer(child: Image.network(url))),
            SafeArea(
              child: Align(
                alignment: Alignment.topRight,
                child: IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.of(dialogContext).pop(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
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
    if (_hidden) return const SizedBox.shrink();
    final blocked = ref.watch(blockedAuthorsProvider).value ?? const <String>{};

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
                      post.author?.fullName ?? ghostDisplayName(post.ghostId),
                      style: ChosenoTypography.body(
                        color: palette.textMain,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      '${post.author != null ? 'Politician · ' : ''}${DateFormat.MMMd().add_jm().format(post.createdAt)}',
                      style: ChosenoTypography.body(
                        color: palette.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(
                width: 36,
                height: 36,
                child: IconButton(
                  padding: EdgeInsets.zero,
                  tooltip: 'Report or block',
                  icon: Icon(
                    Icons.flag_outlined,
                    size: 20,
                    color: palette.textMuted,
                  ),
                  onPressed: () => _menu('post', post.id, post.ghostId),
                ),
              ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.md),
          // Larger, higher-contrast body copy (post-content-typography
          // decision: text-base + text-main, the Facebook/Reddit reading
          // size — this is what people actually came to read).
          if (post.content.trim().isNotEmpty)
            Text(
              post.content,
              style: ChosenoTypography.body(
                color: palette.textMain,
                fontSize: 16,
                height: 1.5,
              ),
            ),
          if (post.imageUrl != null)
            PostImage(
              url: post.imageUrl!,
              aspectRatio: 4 / 3,
              onTap: () => _showImage(post.imageUrl!),
            ),
          if (post.videoUrl != null) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            PostVideoThumbnail(url: post.videoUrl!),
          ],
          if (post.linkUrl != null) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            LinkCard(
              url: post.linkUrl!,
              title: post.linkTitle,
              description: post.linkDescription,
              image: post.linkImage,
              onTap: () => _open(post.linkUrl!),
            ),
          ],
          const SizedBox(height: ChosenoSpacing.md),
          Row(
            children: [
              VotePill(
                likes: post.likesCount,
                dislikes: post.dislikesCount,
                onLike: () {
                  AppHaptics.tap();
                  widget.onVote(1);
                },
                onDislike: () {
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
              const Spacer(),
              IconButton(
                tooltip: 'Share this post',
                icon: Icon(Icons.ios_share_outlined, color: palette.textMuted),
                onPressed: () => shareChosenoLink(AppRoutes.post(post.id)),
              ),
            ],
          ),
          if (_commentsExpanded) ...[
            const SizedBox(height: ChosenoSpacing.md),
            Divider(color: palette.borderLight),
            const SizedBox(height: ChosenoSpacing.sm),
            ...post.comments
                .where((c) => !blocked.contains(c.ghostId))
                .map(
                  (c) => Padding(
                    padding: const EdgeInsets.only(bottom: ChosenoSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              ghostDisplayName(c.ghostId),
                              style: ChosenoTypography.body(
                                color: palette.textTertiary,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            ...[
                              const Spacer(),
                              InkWell(
                                onTap: () => _menu('comment', c.id, c.ghostId),
                                child: Padding(
                                  padding: const EdgeInsets.all(4),
                                  child: Icon(
                                    Icons.flag_outlined,
                                    size: 16,
                                    color: palette.textMuted,
                                  ),
                                ),
                              ),
                            ],
                          ],
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
