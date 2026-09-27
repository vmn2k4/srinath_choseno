// Screen A.9 from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo) — a
// politician's standing wall (distinct from a per-election Candidacy Wall,
// §4.A.8, not yet built). Read side + the signed-in Support toggle only —
// not yet ported: the composer (createWallPost), the owner-only View
// Supporters dashboard + realtime subscription, the QR-code share popover,
// and the News-mentions sub-page (§4.A.9's second half).
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/haptics.dart';
import '../../../../core/utils/share_link.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../common/widgets/app_shell.dart' show kBottomNavClearance;
import '../../../../domain/politician_wall/entities/politician_wall_profile.dart';
import '../../../../domain/posts/entities/post.dart';
import '../providers/politician_wall_providers.dart';

class PoliticianWallScreen extends ConsumerStatefulWidget {
  const PoliticianWallScreen({
    super.key,
    required this.ghostIdOrSlug,
    this.isTab = false,
  });

  final String ghostIdOrSlug;

  /// True when shown as a bottom-nav tab (the signed-in politician's own
  /// wall) rather than pushed over the shell: no back arrow, and the list
  /// clears the floating nav bar.
  final bool isTab;

  @override
  ConsumerState<PoliticianWallScreen> createState() =>
      _PoliticianWallScreenState();
}

class _PoliticianWallScreenState extends ConsumerState<PoliticianWallScreen> {
  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(wallProfileProvider(widget.ghostIdOrSlug));

    final body = profileAsync.when(
      data: (profile) {
        // Fire support-status/count loads once the profile id is known —
        // safe to call every build, load() no-ops past the first
        // successful resolution since the notifier just re-reads state.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          ref.read(wallSupportControllerProvider.notifier).load(profile.id);
        });
        return _WallBody(profile: profile, isTab: widget.isTab);
      },
      loading: () => const Center(child: LoadingIndicator()),
      error: (error, _) => Center(
        child: EmptyState(
          icon: Icons.search_off,
          title: 'Wall not found',
          // In a debug build, say exactly what was looked up and why it
          // failed — a bare "not found" hides slug mismatches vs. errors.
          message: kDebugMode
              ? 'Looked up "${widget.ghostIdOrSlug}"\n$error'
              : 'This wall could not be found.',
          actionLabel: 'Try again',
          onAction: () =>
              ref.invalidate(wallProfileProvider(widget.ghostIdOrSlug)),
        ),
      ),
    );

    if (widget.isTab) {
      return Scaffold(body: SafeArea(bottom: false, child: body));
    }
    final profile = profileAsync.value;
    return Scaffold(
      appBar: AppBar(
        actions: [
          if (profile != null)
            IconButton(
              icon: const Icon(Icons.share_outlined),
              tooltip: 'Share',
              onPressed: () => shareChosenoLink(
                AppRoutes.wall(profile.wallSlug ?? profile.currentGhostId),
              ),
            ),
        ],
      ),
      body: body,
    );
  }
}

class _WallBody extends ConsumerWidget {
  const _WallBody({required this.profile, required this.isTab});

  final PoliticianWallProfile profile;
  final bool isTab;

  Future<void> _launch(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final supporterCountAsync = ref.watch(
      wallSupporterCountProvider(profile.id),
    );
    final isSupportingAsync = ref.watch(wallSupportControllerProvider);
    final postsAsync = ref.watch(wallPostsProvider(profile.currentGhostId));

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(wallSupporterCountProvider(profile.id));
        ref.invalidate(wallPostsProvider(profile.currentGhostId));
      },
      child: ListView(
        padding: EdgeInsets.fromLTRB(
          ChosenoSpacing.lg,
          ChosenoSpacing.sm,
          ChosenoSpacing.lg,
          isTab ? kBottomNavClearance + ChosenoSpacing.lg : ChosenoSpacing.xxl,
        ),
        children: [
          AppCard(
            variant: AppCardVariant.hero,
            padding: const EdgeInsets.all(ChosenoSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                AppAvatar(
                  imageUrl: profile.displayPhotoUrl,
                  fallbackText: profile.fullName,
                  radius: 48,
                ),
                const SizedBox(height: ChosenoSpacing.md),
                Text(
                  profile.fullName,
                  textAlign: TextAlign.center,
                  style: ChosenoTypography.display(
                    color: palette.textMain,
                    fontSize: 32,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: ChosenoSpacing.sm),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: ChosenoSpacing.sm,
                  runSpacing: ChosenoSpacing.xs,
                  children: [
                    if (profile.politicalTargetRole != null)
                      AppBadge(
                        label: profile.politicalTargetRole!.trim(),
                        tone: AppBadgeTone.primary,
                      ),
                    if (profile.partyName != null)
                      AppBadge(
                        label: profile.partyName!,
                        tone: AppBadgeTone.neutral,
                      ),
                  ],
                ),
                if (profile.targetBoundaryName != null) ...[
                  const SizedBox(height: ChosenoSpacing.md),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.place_outlined,
                        size: 16,
                        color: palette.textMuted,
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          profile.targetBoundaryName!,
                          textAlign: TextAlign.center,
                          style: ChosenoTypography.body(
                            color: palette.textMuted,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: ChosenoSpacing.lg),
                supporterCountAsync.when(
                  data: (count) => Column(
                    children: [
                      Text(
                        '$count',
                        style: ChosenoTypography.display(
                          color: palette.primary,
                          fontSize: 34,
                        ),
                      ),
                      Text(
                        count == 1 ? 'supporter' : 'supporters',
                        style: ChosenoTypography.body(
                          color: palette.textMuted,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  loading: () => const SizedBox(height: 56),
                  error: (_, _) => const SizedBox.shrink(),
                ),
                const SizedBox(height: ChosenoSpacing.md),
                isSupportingAsync.when(
                  data: (isSupporting) => SizedBox(
                    width: double.infinity,
                    child: AppButton(
                      label: isSupporting ? 'Supported' : 'Support',
                      icon: isSupporting
                          ? Icons.favorite
                          : Icons.favorite_border,
                      variant: isSupporting
                          ? AppButtonVariant.primary
                          : AppButtonVariant.outline,
                      onPressed: () {
                        AppHaptics.tap();
                        ref
                            .read(wallSupportControllerProvider.notifier)
                            .toggle();
                      },
                    ),
                  ),
                  loading: () => const AppButton(label: '', loading: true),
                  error: (_, _) => const SizedBox.shrink(),
                ),
                if (profile.contactEmail != null ||
                    profile.contactPhone != null ||
                    profile.sourceUrl != null) ...[
                  const SizedBox(height: ChosenoSpacing.sm),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: ChosenoSpacing.sm,
                    children: [
                      if (profile.contactEmail != null)
                        AppButton(
                          label: 'Email',
                          variant: AppButtonVariant.text,
                          icon: Icons.mail_outline,
                          onPressed: () =>
                              _launch('mailto:${profile.contactEmail}'),
                        ),
                      if (profile.contactPhone != null)
                        AppButton(
                          label: 'Call',
                          variant: AppButtonVariant.text,
                          icon: Icons.call_outlined,
                          onPressed: () =>
                              _launch('tel:${profile.contactPhone}'),
                        ),
                      if (profile.sourceUrl != null)
                        AppButton(
                          label: 'Official',
                          variant: AppButtonVariant.text,
                          icon: Icons.open_in_new,
                          onPressed: () => _launch(profile.sourceUrl!),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (profile.bio != null && profile.bio!.trim().isNotEmpty) ...[
            const SizedBox(height: ChosenoSpacing.lg),
            AppCard(
              padding: const EdgeInsets.all(ChosenoSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'About',
                    style: ChosenoTypography.body(
                      color: palette.textMain,
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: ChosenoSpacing.sm),
                  Text(
                    profile.bio!,
                    style: ChosenoTypography.body(
                      color: palette.textSecondary,
                      fontSize: 15,
                      height: 1.55,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: ChosenoSpacing.xl),
          const SectionHeader(
            icon: Icons.forum_outlined,
            title: 'Posts',
            subtitle: 'What people are saying on this wall.',
          ),
          const SizedBox(height: ChosenoSpacing.md),
          postsAsync.when(
            data: (posts) => posts.isEmpty
                ? const EmptyState(
                    icon: Icons.chat_bubble_outline,
                    title: 'No posts yet',
                    message: 'Posts on this wall will show up here.',
                  )
                : Column(
                    children: posts
                        .map(
                          (p) => Padding(
                            padding: const EdgeInsets.only(
                              bottom: ChosenoSpacing.md,
                            ),
                            child: _PostTile(post: p),
                          ),
                        )
                        .toList(),
                  ),
            loading: () => const Padding(
              padding: EdgeInsets.all(ChosenoSpacing.lg),
              child: Center(child: LoadingIndicator()),
            ),
            error: (_, _) => Text(
              'Could not load posts.',
              style: ChosenoTypography.body(color: palette.danger),
            ),
          ),
        ],
      ),
    );
  }
}

class _PostTile extends StatelessWidget {
  const _PostTile({required this.post});
  final Post post;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
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
              Icon(
                Icons.mode_comment_outlined,
                size: 13,
                color: palette.textMuted,
              ),
              const SizedBox(width: 4),
              Text(
                '${post.commentCount}',
                style: ChosenoTypography.body(
                  color: palette.textMuted,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
