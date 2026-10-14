// Screen A.9 from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo) — a
// politician's standing wall (distinct from a per-election Candidacy Wall,
// §4.A.8, not yet built). Read side + the signed-in Support toggle only —
// not yet ported: the composer (createWallPost), the owner-only View
// Supporters dashboard + realtime subscription, the QR-code share popover,
// and the News-mentions sub-page (§4.A.9's second half).
import '../../../../core/widgets/expandable_text.dart';
import '../widgets/wall_composer.dart';
import '../widgets/wall_post_tile.dart';
import '../../../common/widgets/screen_header.dart';
import '../../../common/widgets/detail_app_bar.dart';
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
import '../../auth/providers/auth_providers.dart';
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
      return Scaffold(
        body: SafeArea(
          bottom: false,
          child: Column(
            children: [
              const ScreenHeader(title: 'My Wall'),
              Expanded(child: body),
            ],
          ),
        ),
      );
    }
    final profile = profileAsync.value;
    return Scaffold(
      appBar: DetailAppBar(
        title: profile?.fullName,
        actions: [
          if (profile != null)
            HeaderIconButton(
              icon: Icons.ios_share_rounded,
              tooltip: 'Share',
              onTap: () => shareChosenoLink(
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
            padding: const EdgeInsets.all(ChosenoSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    AppAvatar(
                      imageUrl: profile.displayPhotoUrl,
                      fallbackText: profile.fullName,
                      radius: 28,
                    ),
                    const SizedBox(width: ChosenoSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            profile.fullName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: ChosenoTypography.display(
                              color: palette.textMain,
                              fontSize: 22,
                              height: 1.15,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            [
                              if (profile.politicalTargetRole != null)
                                profile.politicalTargetRole!.trim(),
                              if (profile.partyName != null) profile.partyName!,
                            ].join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: ChosenoTypography.body(
                              color: palette.textSecondary,
                              fontWeight: FontWeight.w500,
                              fontSize: 13,
                            ),
                          ),
                          if (profile.targetBoundaryName != null)
                            Row(
                              children: [
                                Icon(
                                  Icons.place_outlined,
                                  size: 13,
                                  color: palette.textMuted,
                                ),
                                const SizedBox(width: 2),
                                Flexible(
                                  child: Text(
                                    profile.targetBoundaryName!,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: ChosenoTypography.body(
                                      color: palette.textMuted,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: ChosenoSpacing.sm + 2),
                Row(
                  children: [
                    supporterCountAsync.when(
                      data: (count) => Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: '$count',
                              style: ChosenoTypography.body(
                                color: palette.primary,
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              ),
                            ),
                            TextSpan(
                              text: count == 1 ? ' supporter' : ' supporters',
                              style: ChosenoTypography.body(
                                color: palette.textMuted,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      loading: () => const SizedBox.shrink(),
                      error: (_, _) => const SizedBox.shrink(),
                    ),
                    const Spacer(),
                    if (profile.sourceUrl != null)
                      HeaderIconButton(
                        icon: Icons.open_in_new,
                        tooltip: 'Official page',
                        onTap: () => _launch(profile.sourceUrl!),
                      ),
                    if (profile.contactEmail != null) ...[
                      const SizedBox(width: ChosenoSpacing.xs),
                      HeaderIconButton(
                        icon: Icons.mail_outline,
                        tooltip: 'Email',
                        onTap: () => _launch('mailto:${profile.contactEmail}'),
                      ),
                    ],
                    if (profile.contactPhone != null) ...[
                      const SizedBox(width: ChosenoSpacing.xs),
                      HeaderIconButton(
                        icon: Icons.call_outlined,
                        tooltip: 'Call',
                        onTap: () => _launch('tel:${profile.contactPhone}'),
                      ),
                    ],
                    // You can't support yourself — the button is for visitors.
                    if (!isTab &&
                        ref.watch(authStateChangesProvider).value?.id !=
                            profile.id) ...[
                      const SizedBox(width: ChosenoSpacing.sm),
                      isSupportingAsync.when(
                        data: (isSupporting) => AppButton(
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
                        loading: () =>
                            const AppButton(label: '', loading: true),
                        error: (_, _) => const SizedBox.shrink(),
                      ),
                    ],
                  ],
                ),
                if (profile.bio != null && profile.bio!.trim().isNotEmpty) ...[
                  const SizedBox(height: ChosenoSpacing.sm),
                  ExpandableText(
                    text: profile.bio!.trim(),
                    maxLines: 2,
                    style: ChosenoTypography.body(
                      color: palette.textSecondary,
                      fontSize: 13,
                      height: 1.45,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: ChosenoSpacing.sm + 2),
          WallComposer(
            wallGhostId: profile.currentGhostId,
            ownerName: profile.fullName,
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
                            child: WallPostTile(post: p),
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
