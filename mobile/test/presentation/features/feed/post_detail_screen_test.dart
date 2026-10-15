import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:choseno_mobile/core/errors/result.dart';
import 'package:choseno_mobile/core/theme/app_theme.dart';
import 'package:choseno_mobile/core/theme/theme_config.dart';
import 'package:choseno_mobile/domain/feed/repositories/feed_repository.dart';
import 'package:choseno_mobile/domain/posts/entities/post.dart';
import 'package:choseno_mobile/domain/posts/entities/post_detail.dart';
import 'package:choseno_mobile/presentation/features/feed/providers/feed_repository_providers.dart';
import 'package:choseno_mobile/presentation/features/feed/screens/post_detail_screen.dart';

class _FakeFeed implements FeedRepository {
  _FakeFeed(this.detail);
  final PostDetail? detail;

  @override
  Future<Result<PostDetail?>> getPostDetail(String postId) async =>
      Result.ok(detail);

  @override
  Future<Result<Set<String>>> getBlockedGhostIds() async =>
      const Result.ok(<String>{});

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

PostDetail _detail({required bool canComment}) => PostDetail(
  post: Post(
    id: 'p1',
    ghostId: 'abcdef123456',
    content: 'Potholes on King George Blvd',
    createdAt: DateTime(2026, 10, 15),
  ),
  areaNames: const ['Surrey', 'Cloverdale'],
  canComment: canComment,
);

Future<void> _pump(WidgetTester tester, PostDetail? detail) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [feedRepositoryProvider.overrideWithValue(_FakeFeed(detail))],
      child: MaterialApp(
        theme: AppTheme.build(ChosenoPalette.pulse),
        home: const PostDetailScreen(postId: 'p1'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('a local viewer gets the comment box', (tester) async {
    await _pump(tester, _detail(canComment: true));
    expect(find.text('Potholes on King George Blvd'), findsOneWidget);
    expect(find.text('Add a comment'), findsOneWidget);
    expect(find.textContaining('Only people in'), findsNothing);
    expect(find.byTooltip('Share this post'), findsOneWidget);
  });

  testWidgets('an outsider can read but sees why they cannot comment', (
    tester,
  ) async {
    await _pump(tester, _detail(canComment: false));
    expect(find.text('Potholes on King George Blvd'), findsOneWidget);
    expect(find.text('Add a comment'), findsNothing);
    expect(
      find.textContaining('Only people in Surrey, Cloverdale can join'),
      findsOneWidget,
    );
    expect(find.byTooltip('Share this post'), findsOneWidget);
  });

  testWidgets('a missing post shows a friendly message', (tester) async {
    await _pump(tester, null);
    expect(find.text("This post isn't available"), findsOneWidget);
  });
}
