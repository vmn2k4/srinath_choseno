// Port of PostCard.tsx's wall configuration: author header (a "News" badge for
// articles mirrored onto the wall, otherwise the poster's Ghost name), the
// post text (headline + body for news), its image, "Read Full Article", a
// link preview, the like / dislike pill and the comment thread.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/config/site_config.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/haptics.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/posts/entities/post.dart';
import '../../../common/widgets/vote_pill.dart';
import '../../feed/providers/feed_repository_providers.dart';

final _urlPattern = RegExp(r'https?://[^\s]+');

/// News feeds sometimes leave HTML entities in the text (`&nbsp;`, `&amp;`…).
String _decodeEntities(String s) => s
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll(RegExp(r' {2,}'), ' ');

class WallPostTile extends ConsumerStatefulWidget {
  const WallPostTile({super.key, required this.post});

  final Post post;

  @override
  ConsumerState<WallPostTile> createState() => _WallPostTileState();
}

class _WallPostTileState extends ConsumerState<WallPostTile> {
  late int _likes = widget.post.likesCount;
  late int _dislikes = widget.post.dislikesCount;
  late List<({String ghostId, String content})> _comments = [
    for (final c in widget.post.comments)
      (ghostId: c.ghostId, content: c.content),
  ];
  bool _expanded = false;
  bool _sending = false;
  final _commentController = TextEditingController();

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _vote(int type) async {
    AppHaptics.tap();
    final result = await ref
        .read(feedRepositoryProvider)
        .voteOnPost(widget.post.id, type);
    result.when(
      ok: (c) {
        if (mounted) {
          setState(() {
            _likes = c.likes;
            _dislikes = c.dislikes;
          });
        }
      },
      err: (_) {},
    );
  }

  Future<void> _comment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    final result = await ref
        .read(feedRepositoryProvider)
        .createComment(widget.post.id, text);
    if (!mounted) return;
    result.when(
      ok: (_) => setState(() {
        _comments = [..._comments, (ghostId: 'you', content: text)];
        _commentController.clear();
        _sending = false;
      }),
      err: (f) {
        setState(() => _sending = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(f.message)));
      },
    );
  }

  Future<void> _open(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _showImage(String url) {
    showDialog<void>(
      context: context,
      builder: (_) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: Stack(
          children: [
            Center(child: InteractiveViewer(child: Image.network(url))),
            SafeArea(
              child: Align(
                alignment: Alignment.topRight,
                child: IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final post = widget.post;
    final slug = post.newsArticleSlug;
    // Most articles never got a stored hero image; the site renders one on
    // demand at /news/<slug>/opengraph-image — same fallback as the web.
    final imageUrl =
        post.imageUrl ??
        (post.isNews && slug != null
            ? '${SiteConfig.siteUrl}/news/$slug/opengraph-image'
            : null);
    final content = _decodeEntities(post.content);
    final parts = post.isNews && content.contains('\n\n')
        ? content.split('\n\n')
        : null;
    final inlineUrl = post.linkUrl == null
        ? _urlPattern.firstMatch(post.content)?.group(0)
        : null;
    final date = post.newsDate ?? post.createdAt;

    return AppCard(
      padding: const EdgeInsets.fromLTRB(
        ChosenoSpacing.md,
        ChosenoSpacing.md,
        ChosenoSpacing.md,
        ChosenoSpacing.sm + 2,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 15,
                backgroundColor: palette.primary.withValues(alpha: 0.12),
                child: Icon(
                  post.isNews ? Icons.newspaper : Icons.person_outline,
                  size: 16,
                  color: post.isNews ? palette.accent : palette.textMuted,
                ),
              ),
              const SizedBox(width: ChosenoSpacing.sm),
              if (post.isNews)
                const AppBadge(
                  label: 'News',
                  tone: AppBadgeTone.accent,
                  size: AppBadgeSize.xs,
                )
              else
                Text(
                  'Ghost ${post.ghostId.substring(0, 6)}',
                  style: ChosenoTypography.body(
                    color: palette.textSecondary,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              const SizedBox(width: ChosenoSpacing.sm),
              Text(
                DateFormat.yMMMd().format(date),
                style: ChosenoTypography.body(
                  color: palette.textMuted,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.sm + 2),
          if (parts != null) ...[
            Text(
              parts.first,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: ChosenoTypography.display(
                color: palette.textMain,
                fontSize: 17,
              ),
            ),
            const SizedBox(height: ChosenoSpacing.xs),
            Text(
              parts.skip(1).join('\n\n'),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: ChosenoTypography.body(
                color: palette.textSecondary,
                fontSize: 14,
                height: 1.4,
              ),
            ),
          ] else
            Text(
              content,
              style: ChosenoTypography.body(
                color: palette.textMain,
                fontSize: 15,
                height: 1.5,
              ),
            ),
          if (imageUrl != null)
            _PostImage(
              url: imageUrl,
              aspectRatio: post.isNews ? 1200 / 630 : 4 / 3,
              onTap: () => _showImage(imageUrl),
            ),
          if (post.videoUrl != null) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            AppButton(
              label: 'Watch video',
              icon: Icons.play_circle_outline,
              variant: AppButtonVariant.outline,
              onPressed: () => _open(post.videoUrl!),
            ),
          ],
          if (post.linkUrl != null || inlineUrl != null) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            _LinkCard(
              url: post.linkUrl ?? inlineUrl!,
              title: post.linkTitle,
              description: post.linkDescription,
              image: post.linkImage,
              onTap: () => _open(post.linkUrl ?? inlineUrl!),
            ),
          ],
          const SizedBox(height: ChosenoSpacing.sm),
          Row(
            children: [
              VotePill(
                score: _likes - _dislikes,
                onUp: () => _vote(1),
                onDown: () => _vote(-1),
              ),
              const SizedBox(width: ChosenoSpacing.sm),
              InkWell(
                borderRadius: BorderRadius.circular(ChosenoRadii.full),
                onTap: () => setState(() => _expanded = !_expanded),
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
                        '${_comments.length}',
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
              if (post.isNews && slug != null) ...[
                const Spacer(),
                TextButton.icon(
                  onPressed: () => context.push('/news/$slug'),
                  icon: const Icon(Icons.arrow_forward, size: 16),
                  label: const Text('Article'),
                ),
              ],
            ],
          ),
          if (_expanded) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            Divider(color: palette.borderLight, height: 1),
            const SizedBox(height: ChosenoSpacing.sm),
            for (final c in _comments)
              Padding(
                padding: const EdgeInsets.only(bottom: ChosenoSpacing.sm + 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c.ghostId == 'you'
                          ? 'You'
                          : 'Ghost ${c.ghostId.substring(0, 6)}',
                      style: ChosenoTypography.body(
                        color: palette.textTertiary,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      c.content,
                      style: ChosenoTypography.body(
                        color: palette.textMain,
                        fontSize: 14,
                        height: 1.4,
                      ),
                    ),
                  ],
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
                const SizedBox(width: ChosenoSpacing.sm),
                AppButton.icon(
                  icon: Icons.send_rounded,
                  tone: AppButtonTone.primary,
                  loading: _sending,
                  onPressed: _sending ? null : _comment,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// A compact link card: image (if any), title, description, host.
class _LinkCard extends StatelessWidget {
  const _LinkCard({
    required this.url,
    required this.onTap,
    this.title,
    this.description,
    this.image,
  });

  final String url;
  final String? title;
  final String? description;
  final String? image;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final host = Uri.tryParse(url)?.host.replaceFirst('www.', '') ?? url;
    return InkWell(
      borderRadius: BorderRadius.circular(ChosenoRadii.sm + 2),
      onTap: onTap,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          border: Border.all(color: palette.borderLight),
          borderRadius: BorderRadius.circular(ChosenoRadii.sm + 2),
        ),
        child: Row(
          children: [
            if (image != null)
              SizedBox(
                width: 84,
                height: 72,
                child: Image.network(
                  image!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) =>
                      ColoredBox(color: palette.surfaceActive),
                ),
              ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(ChosenoSpacing.sm + 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title ?? host,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: ChosenoTypography.body(
                        color: palette.textMain,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                    if (description != null)
                      Text(
                        description!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: ChosenoTypography.body(
                          color: palette.textMuted,
                          fontSize: 12,
                        ),
                      ),
                    Text(
                      host,
                      style: ChosenoTypography.body(
                        color: palette.primary,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The post's image. Collapses completely if it can't load (the on-demand
/// article card is sometimes slow or unavailable) so a post never shows an
/// empty grey box.
class _PostImage extends StatefulWidget {
  const _PostImage({
    required this.url,
    required this.aspectRatio,
    required this.onTap,
  });

  final String url;
  final double aspectRatio;
  final VoidCallback onTap;

  @override
  State<_PostImage> createState() => _PostImageState();
}

class _PostImageState extends State<_PostImage> {
  bool _failed = false;

  @override
  Widget build(BuildContext context) {
    if (_failed) return const SizedBox.shrink();
    final palette = ChosenoTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: ChosenoSpacing.sm + 2),
      child: GestureDetector(
        onTap: widget.onTap,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(ChosenoRadii.sm + 2),
          child: AspectRatio(
            aspectRatio: widget.aspectRatio,
            child: Image.network(
              widget.url,
              fit: BoxFit.cover,
              loadingBuilder: (context, child, progress) => progress == null
                  ? child
                  : ColoredBox(color: palette.surfaceActive),
              errorBuilder: (context, error, stack) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted) setState(() => _failed = true);
                });
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      ),
    );
  }
}
