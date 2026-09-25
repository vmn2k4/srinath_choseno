// Feed's tab model + controller. Ports the shape of FeedPageClient.tsx's
// tab system (docs/FLUTTER_MOBILE_APP_GUIDE.md §4.D in the parent repo) —
// one tab per boundary membership + Country + International — but NOT
// yet: the "All Feeds" master tab with secondary boundary-type filter
// chips, the active-election banner, or the video-pitch composer. The
// composer here is text-only (see the screen's own header comment).
//
// Politicians see posts sorted by engagement (likes + comments) instead
// of newest-first, on every tab — applied once at fetch time, not
// re-applied after every vote (re-sorting mid-scroll on someone else's
// vote would be a jarring UX, not a fidelity improvement).
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/posts/entities/post.dart';
import '../../../../domain/profile/entities/user_profile.dart';
import '../../auth/providers/auth_providers.dart';
import '../../profile/providers/profile_providers.dart';
import 'feed_repository_providers.dart';

sealed class FeedTab {
  const FeedTab(this.label);
  final String label;
}

class MembershipTab extends FeedTab {
  const MembershipTab(this.shapeId, super.label);
  final int shapeId;
}

class CountryTab extends FeedTab {
  const CountryTab(this.country) : super('Country');
  final String country;
}

class InternationalTab extends FeedTab {
  const InternationalTab() : super('International');
}

@immutable
class FeedState {
  const FeedState({
    required this.tabs,
    required this.selectedIndex,
    this.postsByIndex = const {},
    this.loadingIndex,
    this.posting = false,
    this.postError,
  });

  final List<FeedTab> tabs;
  final int selectedIndex;
  final Map<int, List<Post>> postsByIndex;
  final int? loadingIndex;
  final bool posting;
  final String? postError;

  List<Post> get currentPosts => postsByIndex[selectedIndex] ?? const [];
  bool get isLoadingCurrent => loadingIndex == selectedIndex;

  FeedState copyWith({
    int? selectedIndex,
    Map<int, List<Post>>? postsByIndex,
    int? loadingIndex,
    bool clearLoading = false,
    bool? posting,
    String? postError,
    bool clearPostError = false,
  }) {
    return FeedState(
      tabs: tabs,
      selectedIndex: selectedIndex ?? this.selectedIndex,
      postsByIndex: postsByIndex ?? this.postsByIndex,
      loadingIndex: clearLoading ? null : (loadingIndex ?? this.loadingIndex),
      posting: posting ?? this.posting,
      postError: clearPostError ? null : (postError ?? this.postError),
    );
  }
}

class FeedController extends AsyncNotifier<FeedState> {
  @override
  Future<FeedState> build() async {
    final userId = ref.watch(authStateChangesProvider).value?.id;
    if (userId == null) return const FeedState(tabs: [], selectedIndex: 0);

    final profile = await ref.watch(ownProfileProvider.future);
    final membershipsResult = await ref
        .read(profileRepositoryProvider)
        .getUserBoundaryMemberships(userId);
    final memberships = membershipsResult.valueOrNull ?? const [];

    // Most-local last, matching the website's tab order (§4.D) — the app
    // has no boundary-specificity ranking ported yet (that's
    // `getBoundaryTypesForCountries` on web), so this keeps the raw
    // membership-table order rather than guessing a rank.
    final tabs = <FeedTab>[
      ...memberships.map((m) => MembershipTab(m.shapeId, m.name)),
      if (profile?.country != null) CountryTab(profile!.country!),
      const InternationalTab(),
    ];

    if (tabs.isEmpty) return FeedState(tabs: tabs, selectedIndex: 0);

    final posts = await _fetchTab(tabs.first, profile?.role);
    return FeedState(tabs: tabs, selectedIndex: 0, postsByIndex: {0: posts});
  }

  Future<List<Post>> _fetchTab(FeedTab tab, UserRole? viewerRole) async {
    final repo = ref.read(feedRepositoryProvider);
    final result = switch (tab) {
      MembershipTab(:final shapeId) => await repo.getMembershipScopedPosts([
        shapeId,
      ]),
      CountryTab(:final country) => await repo.getCountryScopedPosts(country),
      InternationalTab() => await repo.getInternationalScopedPosts(),
    };
    final posts = result.valueOrNull ?? const [];
    if (viewerRole == UserRole.politician) {
      return [...posts]
        ..sort((a, b) => b.engagementScore.compareTo(a.engagementScore));
    }
    return posts;
  }

  Future<void> selectTab(int index) async {
    final current = state.value;
    if (current == null || index == current.selectedIndex) return;
    state = AsyncData(current.copyWith(selectedIndex: index));
    if (current.postsByIndex.containsKey(index)) return;

    state = AsyncData(
      current.copyWith(selectedIndex: index, loadingIndex: index),
    );
    final profile = ref.read(ownProfileProvider).value;
    final posts = await _fetchTab(current.tabs[index], profile?.role);
    final latest = state.value;
    if (latest == null) return;
    state = AsyncData(
      latest.copyWith(
        postsByIndex: {...latest.postsByIndex, index: posts},
        clearLoading: true,
      ),
    );
  }

  Future<void> refreshCurrentTab() async {
    final current = state.value;
    if (current == null || current.tabs.isEmpty) return;
    final profile = ref.read(ownProfileProvider).value;
    final posts = await _fetchTab(
      current.tabs[current.selectedIndex],
      profile?.role,
    );
    final latest = state.value;
    if (latest == null) return;
    state = AsyncData(
      latest.copyWith(
        postsByIndex: {...latest.postsByIndex, current.selectedIndex: posts},
      ),
    );
  }

  Future<bool> submitPost(String content) async {
    final current = state.value;
    if (current == null || content.trim().isEmpty) return false;
    state = AsyncData(current.copyWith(posting: true, clearPostError: true));
    final result = await ref
        .read(feedRepositoryProvider)
        .createFeedPost(content.trim());
    return result.when(
      ok: (_) async {
        final latest = state.value;
        if (latest != null) state = AsyncData(latest.copyWith(posting: false));
        await refreshCurrentTab();
        return true;
      },
      err: (failure) async {
        final latest = state.value;
        if (latest != null) {
          state = AsyncData(
            latest.copyWith(posting: false, postError: failure.message),
          );
        }
        return false;
      },
    );
  }

  Future<void> vote(String postId, int voteType) async {
    final current = state.value;
    if (current == null) return;
    final result = await ref
        .read(feedRepositoryProvider)
        .voteOnPost(postId, voteType);
    result.when(
      ok: (counts) {
        final latest = state.value;
        if (latest == null) return;
        final updated = Map<int, List<Post>>.from(latest.postsByIndex);
        for (final entry in updated.entries) {
          updated[entry.key] = entry.value
              .map(
                (p) => p.id == postId
                    ? p.copyWith(
                        likesCount: counts.likes,
                        dislikesCount: counts.dislikes,
                      )
                    : p,
              )
              .toList();
        }
        state = AsyncData(latest.copyWith(postsByIndex: updated));
      },
      err:
          (
            _,
          ) {}, // vote is best-effort UI polish; a failed toggle just leaves counts unchanged
    );
  }

  Future<bool> submitComment(String postId, String content) async {
    if (content.trim().isEmpty) return false;
    final result = await ref
        .read(feedRepositoryProvider)
        .createComment(postId, content.trim());
    if (result.isOk) await refreshCurrentTab();
    return result.isOk;
  }
}

final feedControllerProvider = AsyncNotifierProvider<FeedController, FeedState>(
  FeedController.new,
);
