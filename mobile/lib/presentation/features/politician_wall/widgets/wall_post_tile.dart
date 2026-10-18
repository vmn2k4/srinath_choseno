// Port of PostCard.tsx's wall configuration: author header (a "News" badge for
// articles mirrored onto the wall, otherwise the poster's Ghost name), the
// post text (headline + body for news), its image, "Read Full Article", a
// link preview, the like / dislike pill and the comment thread.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/config/env_config.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/haptics.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/utils/ghost_name.dart';
import '../../../../core/utils/share_link.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../data/posts/link_preview_fetcher.dart';
import '../../../../domain/posts/entities/post.dart';
import '../../../common/widgets/vote_pill.dart';
import '../../../common/widgets/post_video_thumbnail.dart';
import '../../../common/widgets/facebook_video_embed.dart';
import '../../../../core/utils/facebook_video.dart';
import '../../../../core/utils/youtube.dart';
import '../../../common/widgets/content_safety_sheets.dart';
import '../../feed/providers/content_safety_providers.dart';
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
  const WallPostTile({
    super.key,
    required this.post,
    this.initiallyExpanded = false,
    this.commentBlockedMessage,
  });

  final Post post;

  /// Open with the comment thread showing (the single-post page).
  final bool initiallyExpanded;

  /// When set, shown in place of the comment box — the viewer can read the
  /// conversation but isn't allowed to join it.
  final String? commentBlockedMessage;

  @override
  ConsumerState<WallPostTile> createState() => _WallPostTileState();
}

class _WallPostTileState extends ConsumerState<WallPostTile> {
  late int _likes = widget.post.likesCount;
  late int _dislikes = widget.post.dislikesCount;
  late List<({String? id, String ghostId, String content})> _comments = [
    for (final c in widget.post.comments)
      (id: c.id, ghostId: c.ghostId, content: c.content),
  ];
  bool _hidden = false;
  late bool _expanded = widget.initiallyExpanded;
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
    if (!await ensureTermsAccepted(context)) return;
    setState(() => _sending = true);
    final result = await ref
        .read(feedRepositoryProvider)
        .createComment(widget.post.id, text);
    if (!mounted) return;
    result.when(
      ok: (_) => setState(() {
        _comments = [..._comments, (id: null, ghostId: 'you', content: text)];
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
    final blocked = ref.watch(blockedAuthorsProvider).value ?? const <String>{};
    if (_hidden || (!post.isNews && blocked.contains(post.ghostId))) {
      return const SizedBox.shrink();
    }
    final slug = post.newsArticleSlug;
    // The mirrored post often has no image of its own; use the article's hero image, then its generated
    // share card in public storage. (The site's own on-demand
    // /news/<slug>/opengraph-image route can't be used here: Vercel's bot
    // protection answers non-browser clients with a challenge, so the app
    // would only ever get an HTTP 429.) If that card is missing too, the
    // image collapses rather than leaving a blank box.
    final imageUrl =
        post.imageUrl ??
        post.newsImageUrl ??
        (post.isNews && slug != null
            ? '${EnvConfig.supabaseUrl}/storage/v1/object/public/news-images/og-cards/$slug.png'
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
                  post.author?.fullName ?? ghostDisplayName(post.ghostId),
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
              if (!post.isNews) ...[
                const Spacer(),
                SizedBox(
                  width: 32,
                  height: 32,
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
            LinkifiedText(
              content,
              style: ChosenoTypography.body(
                color: palette.textMain,
                fontSize: 15,
                height: 1.5,
              ),
            ),
          if (imageUrl != null)
            PostImage(
              url: imageUrl,
              aspectRatio: post.isNews ? 1200 / 630 : 4 / 3,
              onTap: () => _showImage(imageUrl),
            ),
          if (post.videoUrl != null) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            PostVideoThumbnail(url: post.videoUrl!),
          ],
          if (post.linkUrl != null || inlineUrl != null) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            FetchedLinkCard(
              url: post.linkUrl ?? inlineUrl!,
              title: post.linkTitle,
              description: post.linkDescription,
              image: post.linkImage,
              video: post.linkVideo,
              onTap: () => _open(post.linkUrl ?? inlineUrl!),
            ),
          ],
          const SizedBox(height: ChosenoSpacing.sm),
          Row(
            children: [
              VotePill(
                likes: _likes,
                dislikes: _dislikes,
                onLike: () => _vote(1),
                onDislike: () => _vote(-1),
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
              const Spacer(),
              if (post.isNews && slug != null)
                TextButton.icon(
                  onPressed: () => context.push('/news/$slug'),
                  icon: const Icon(Icons.arrow_forward, size: 16),
                  label: const Text('Article'),
                ),
              IconButton(
                tooltip: 'Share this post',
                icon: Icon(Icons.ios_share_outlined, color: palette.textMuted),
                onPressed: () => shareChosenoLink(AppRoutes.post(post.id)),
              ),
            ],
          ),
          if (_expanded) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            Divider(color: palette.borderLight, height: 1),
            const SizedBox(height: ChosenoSpacing.sm),
            for (final c in _comments.where(
              (c) => !blocked.contains(c.ghostId),
            ))
              Padding(
                padding: const EdgeInsets.only(bottom: ChosenoSpacing.sm + 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          c.ghostId == 'you'
                              ? 'You'
                              : ghostDisplayName(c.ghostId),
                          style: ChosenoTypography.body(
                            color: palette.textTertiary,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                        if (c.id != null) ...[
                          const Spacer(),
                          InkWell(
                            onTap: () => _menu('comment', c.id!, c.ghostId),
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
            if (widget.commentBlockedMessage != null)
              Container(
                padding: const EdgeInsets.all(ChosenoSpacing.md),
                decoration: BoxDecoration(
                  color: palette.surfaceHover,
                  borderRadius: BorderRadius.circular(ChosenoRadii.sm * 2),
                ),
                child: Text(
                  widget.commentBlockedMessage!,
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
              )
            else
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

/// A [LinkCard] that fills in its own title / description / image when the post
/// saved none (a link posted before its preview finished loading) — like the
/// web, which fetches the preview at render time for such posts.
class FetchedLinkCard extends StatefulWidget {
  const FetchedLinkCard({
    super.key,
    required this.url,
    required this.onTap,
    this.title,
    this.description,
    this.image,
    this.video,
  });

  final String url;
  final String? title;
  final String? description;
  final String? image;
  final String? video;
  final VoidCallback onTap;

  static final Map<String, Map<String, dynamic>?> _cache = {};

  @override
  State<FetchedLinkCard> createState() => _FetchedLinkCardState();
}

class _FetchedLinkCardState extends State<FetchedLinkCard> {
  Map<String, dynamic>? _meta;

  bool get _needsFetch => widget.title == null && widget.image == null;

  @override
  void initState() {
    super.initState();
    if (!_needsFetch) return;
    if (FetchedLinkCard._cache.containsKey(widget.url)) {
      _meta = FetchedLinkCard._cache[widget.url];
      return;
    }
    fetchLinkMetadata(widget.url).then((m) {
      FetchedLinkCard._cache[widget.url] = m;
      if (mounted) setState(() => _meta = m);
    });
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.title ?? _meta?['title'] as String?;
    final description = widget.description ?? _meta?['description'] as String?;
    final video = widget.video ?? _meta?['video'] as String?;
    // Plays in the post, like the web: YouTube and Facebook links need only
    // the URL; a news clip (direct file) comes from the preview's `video`.
    final facebookEmbed = facebookVideoEmbedUrl(widget.url);
    final playable = parseYouTubeId(widget.url) != null
        ? widget.url
        : (facebookEmbed == null ? video : null);
    if (playable != null || facebookEmbed != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (facebookEmbed != null)
            FacebookVideoEmbed(embedUrl: facebookEmbed)
          else
            PostVideoThumbnail(
              url: playable!,
              posterUrl: widget.image ?? _meta?['image'] as String?,
              landscape: parseYouTubeId(widget.url) == null,
            ),
          if (title != null || description != null) ...[
            const SizedBox(height: ChosenoSpacing.xs),
            InkWell(
              onTap: widget.onTap,
              child: Text(
                title ?? description!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: ChosenoTypography.body(
                  color: ChosenoTheme.of(context).textMain,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ],
      );
    }
    return LinkCard(
      url: widget.url,
      title: title,
      description: description,
      image: widget.image ?? _meta?['image'] as String?,
      onTap: widget.onTap,
    );
  }
}

/// A compact link card: image (if any), title, description, host.
class LinkCard extends StatelessWidget {
  const LinkCard({
    super.key,
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
class PostImage extends StatefulWidget {
  const PostImage({
    super.key,
    required this.url,
    required this.aspectRatio,
    required this.onTap,
  });

  final String url;
  final double aspectRatio;
  final VoidCallback onTap;

  @override
  State<PostImage> createState() => PostImageState();
}

class PostImageState extends State<PostImage> {
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
