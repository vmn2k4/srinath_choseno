// Screen D from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo) — the main
// signed-in home screen, now living behind the bottom nav shell
// (presentation/common/widgets/app_shell.dart) — no AppBar here, per
// product direction to feel like a native app (Snapchat-style chrome).
// Cross-navigation to Find My District/Elections/News/Profile moved to
// the bottom nav; "My Wall" moved to the Profile screen itself (it
// duplicated the bottom-nav Profile tab when it lived here as a header
// action).
//
// Tabs are wired to a real `TabController` + `TabBarView` (not just a
// `TabBar` whose `onTap` flips a variable) specifically so swiping between
// tabs works — an earlier version of this screen only supported tapping,
// a real gap on a touch device. See feed_providers.dart's header comment
// for the full list of what's not yet ported.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../common/widgets/app_shell.dart';
import '../../../common/widgets/screen_header.dart';
import '../providers/feed_providers.dart';
import '../widgets/feed_composer.dart';
import '../widgets/feed_post_tile.dart';

class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key});

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends ConsumerState<FeedScreen>
    with SingleTickerProviderStateMixin {
  TabController? _tabController;
  int _tabCount = -1;
  int _lastNotifiedIndex = -1;

  void _syncTabController(FeedState state) {
    if (_tabController != null && _tabCount == state.tabs.length) return;
    _tabController?.dispose();
    _tabCount = state.tabs.length;
    _lastNotifiedIndex = state.selectedIndex;
    _tabController = TabController(
      length: state.tabs.length,
      initialIndex: state.selectedIndex.clamp(0, state.tabs.length - 1),
      vsync: this,
    )..addListener(_handleTabControllerChange);
  }

  void _handleTabControllerChange() {
    final controller = _tabController;
    if (controller == null || controller.index == _lastNotifiedIndex) return;
    _lastNotifiedIndex = controller.index;
    ref.read(feedControllerProvider.notifier).selectTab(controller.index);
  }

  @override
  void dispose() {
    _tabController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final feedAsync = ref.watch(feedControllerProvider);
    final controller = ref.read(feedControllerProvider.notifier);

    return Scaffold(
      body: SafeArea(
        child: feedAsync.when(
          data: (state) {
            if (state.tabs.isEmpty) {
              return Column(
                children: [
                  const ScreenHeader(title: 'Home'),
                  Expanded(
                    child: Center(
                      child: EmptyState(
                        icon: Icons.location_searching,
                        title: 'Set your location',
                        message:
                            'Your feed is built from your districts. Find your district to see what your neighbours are saying.',
                        actionLabel: 'Find my district',
                        onAction: () => context.go(AppRoutes.findMyDistrict),
                      ),
                    ),
                  ),
                ],
              );
            }

            _syncTabController(state);
            final tabController = _tabController!;

            return Column(
              children: [
                // "My Wall" used to live here as a header action — removed
                // per feedback that it duplicated the bottom-nav Profile
                // tab (which now also shows the politician's own avatar,
                // see AppShell). It lives on the Profile screen instead.
                ScreenHeader(
                  title: 'Home',
                  actions: [
                    HeaderIconButton(
                      icon: Icons.edit_square,
                      tooltip: 'New post',
                      onTap: () => showFeedComposeSheet(
                        context,
                        onSubmit: controller.submitPost,
                      ),
                    ),
                  ],
                ),
                TabBar(
                  controller: tabController,
                  isScrollable: true,
                  tabAlignment: TabAlignment.start,
                  padding: const EdgeInsets.symmetric(
                    horizontal: ChosenoSpacing.md,
                  ),
                  labelPadding: const EdgeInsets.symmetric(
                    horizontal: ChosenoSpacing.md,
                  ),
                  labelColor: palette.primary,
                  unselectedLabelColor: palette.textMuted,
                  labelStyle: ChosenoTypography.body(
                    color: palette.primary,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                  unselectedLabelStyle: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontWeight: FontWeight.w500,
                    fontSize: 15,
                  ),
                  indicatorColor: palette.primary,
                  indicatorSize: TabBarIndicatorSize.label,
                  dividerColor: palette.borderLight,
                  tabs: state.tabs.map((t) => Tab(text: t.label)).toList(),
                ),
                Expanded(
                  child: TabBarView(
                    controller: tabController,
                    children: List.generate(state.tabs.length, (index) {
                      final posts = state.postsByIndex[index];
                      return RefreshIndicator(
                        onRefresh: controller.refreshCurrentTab,
                        child: posts == null
                            ? const SkeletonList()
                            : posts.isEmpty
                            ? ListView(
                                children: const [
                                  SizedBox(height: ChosenoSpacing.xl),
                                  EmptyState(
                                    icon: Icons.forum_outlined,
                                    title: 'Nothing here yet',
                                    message:
                                        'Be the first to post in this community.',
                                  ),
                                ],
                              )
                            : ListView.separated(
                                padding: const EdgeInsets.fromLTRB(
                                  ChosenoSpacing.lg,
                                  ChosenoSpacing.md,
                                  ChosenoSpacing.lg,
                                  kBottomNavClearance,
                                ),
                                itemCount: posts.length,
                                separatorBuilder: (_, _) =>
                                    const SizedBox(height: ChosenoSpacing.md),
                                itemBuilder: (context, i) => FadeSlideIn(
                                  index: i,
                                  child: FeedPostTile(
                                    post: posts[i],
                                    onVote: (voteType) =>
                                        controller.vote(posts[i].id, voteType),
                                    onComment: (content) => controller
                                        .submitComment(posts[i].id, content),
                                  ),
                                ),
                              ),
                      );
                    }),
                  ),
                ),
              ],
            );
          },
          loading: () => Column(
            children: [
              const ScreenHeader(title: 'Home'),
              const Expanded(child: SkeletonList()),
            ],
          ),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(ChosenoSpacing.lg),
              child: Text(
                'Could not load your feed.',
                style: ChosenoTypography.body(color: palette.danger),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
