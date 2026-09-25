import 'package:choseno_mobile/core/errors/app_failure.dart';
import 'package:choseno_mobile/core/errors/result.dart';
import 'package:choseno_mobile/core/theme/app_theme.dart';
import 'package:choseno_mobile/core/theme/theme_config.dart';
import 'package:choseno_mobile/domain/auth/entities/app_user.dart';
import 'package:choseno_mobile/domain/auth/repositories/auth_repository.dart';
import 'package:choseno_mobile/presentation/features/auth/providers/auth_providers.dart';
import 'package:choseno_mobile/presentation/features/auth/screens/sign_in_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository(this.result);

  final Result<AppUser> result;
  String? lastEmail;
  int calls = 0;

  @override
  AppUser? get currentUser => null;

  @override
  Stream<AppUser?> get authStateChanges => const Stream.empty();

  @override
  Future<Result<AppUser>> signInWithPassword({
    required String email,
    required String password,
  }) async {
    calls++;
    lastEmail = email;
    return result;
  }

  @override
  Future<Result<AppUser>> signUpWithPassword({
    required String email,
    required String password,
  }) async => result;

  @override
  Future<Result<void>> signOut() async => const Result.ok(null);

  @override
  Future<Result<void>> resetPasswordForEmail(String email) async =>
      const Result.ok(null);

  @override
  Future<Result<void>> updatePassword(String newPassword) async =>
      const Result.ok(null);
}

Future<void> _pump(WidgetTester tester, _FakeAuthRepository repo) async {
  // Tests render with a fallback font whose glyphs are far wider than
  // Inter's, so give the screen a wide surface instead of asserting on a
  // layout that only exists in the test font.
  tester.view.physicalSize = const Size(1200, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [authRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp(
        theme: AppTheme.build(ChosenoPalette.pulse),
        home: const SignInScreen(),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets(
    'tapping Sign in calls the auth repository with the typed email',
    (tester) async {
      final repo = _FakeAuthRepository(
        const Result.err(ServerFailure('Invalid login credentials')),
      );
      await _pump(tester, repo);

      await tester.enterText(find.byType(TextField).at(0), 'me@example.com');
      await tester.enterText(find.byType(TextField).at(1), 'secret123');
      await tester.tap(find.text('Sign in'));
      await tester.pump();

      expect(repo.calls, 1);
      expect(repo.lastEmail, 'me@example.com');
    },
  );

  testWidgets('a failed sign-in shows the real reason in a snackbar', (
    tester,
  ) async {
    final repo = _FakeAuthRepository(
      const Result.err(ServerFailure('Invalid login credentials')),
    );
    await _pump(tester, repo);

    await tester.enterText(find.byType(TextField).at(0), 'me@example.com');
    await tester.enterText(find.byType(TextField).at(1), 'wrong');
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Invalid login credentials'), findsOneWidget);
  });
}
