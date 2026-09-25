import 'package:choseno_mobile/domain/posts/entities/post.dart';
import 'package:choseno_mobile/presentation/features/feed/providers/feed_providers.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final post = Post(
    id: 'p1',
    ghostId: 'g1',
    content: 'hello',
    createdAt: DateTime(2026),
  );

  group('FeedState', () {
    test('currentPosts reads the selected tab\'s cached list', () {
      const tabs = [InternationalTab(), CountryTab('Canada')];
      final state = FeedState(
        tabs: tabs,
        selectedIndex: 1,
        postsByIndex: {
          1: [post],
        },
      );
      expect(state.currentPosts, [post]);
    });

    test(
      'currentPosts is empty when the selected tab has no cache entry yet',
      () {
        const tabs = [InternationalTab()];
        const state = FeedState(tabs: tabs, selectedIndex: 0);
        expect(state.currentPosts, isEmpty);
      },
    );

    test(
      'isLoadingCurrent is true only when loadingIndex matches the selected tab',
      () {
        const tabs = [InternationalTab(), CountryTab('Canada')];
        const loadingOther = FeedState(
          tabs: tabs,
          selectedIndex: 0,
          loadingIndex: 1,
        );
        const loadingSelected = FeedState(
          tabs: tabs,
          selectedIndex: 1,
          loadingIndex: 1,
        );
        expect(loadingOther.isLoadingCurrent, isFalse);
        expect(loadingSelected.isLoadingCurrent, isTrue);
      },
    );
  });

  group('Post.engagementScore', () {
    test('sums likes and comment count, ignoring dislikes', () {
      final engaged = Post(
        id: 'p2',
        ghostId: 'g2',
        content: 'x',
        createdAt: DateTime(2026),
        likesCount: 10,
        dislikesCount: 4,
        comments: const [],
      );
      expect(engaged.engagementScore, 10);
    });
  });
}
