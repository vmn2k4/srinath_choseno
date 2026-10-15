// What a shared post link opens: one post with its whole conversation.
// Anyone can read it and see the reactions; only people in the post's
// districts get the comment box (the same rule `create_comment` enforces
// server-side) — everyone else sees why instead.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/posts/entities/post_detail.dart';
import '../../../common/widgets/detail_app_bar.dart';
import '../../politician_wall/widgets/wall_post_tile.dart';
import '../providers/feed_repository_providers.dart';

final postDetailProvider = FutureProvider.autoDispose
    .family<PostDetail?, String>((ref, postId) async {
      final result = await ref
          .watch(feedRepositoryProvider)
          .getPostDetail(postId);
      return result.when(ok: (d) => d, err: (f) => throw f);
    });

class PostDetailScreen extends ConsumerWidget {
  const PostDetailScreen({super.key, required this.postId});

  final String postId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final async = ref.watch(postDetailProvider(postId));
    return Scaffold(
      appBar: const DetailAppBar(title: 'Post'),
      body: async.when(
        data: (detail) {
          if (detail == null) {
            return const EmptyState(
              icon: Icons.chat_bubble_outline,
              title: "This post isn't available",
              message: 'It may have been removed.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(postDetailProvider(postId)),
            child: ListView(
              padding: const EdgeInsets.all(ChosenoSpacing.lg),
              children: [
                WallPostTile(
                  post: detail.post,
                  initiallyExpanded: true,
                  commentBlockedMessage: detail.canComment
                      ? null
                      : 'Only people in ${detail.areaLabel} can join this '
                            'conversation. You can read the thread and see the '
                            'reactions.',
                ),
              ],
            ),
          );
        },
        loading: () => const Center(child: LoadingIndicator()),
        error: (_, _) => Center(
          child: Text(
            "Couldn't load this post.",
            style: ChosenoTypography.body(color: palette.danger),
          ),
        ),
      ),
    );
  }
}
