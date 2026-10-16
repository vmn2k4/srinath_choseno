import 'package:choseno_mobile/core/errors/app_failure.dart';
import 'package:choseno_mobile/core/errors/result.dart';
import 'package:choseno_mobile/core/router/app_router.dart';
import 'package:choseno_mobile/core/theme/app_theme.dart';
import 'package:choseno_mobile/core/theme/theme_config.dart';
import 'package:choseno_mobile/domain/auth/entities/app_user.dart';
import 'package:choseno_mobile/domain/auth/entities/sign_up_outcome.dart';
import 'package:choseno_mobile/domain/auth/repositories/auth_repository.dart';
import 'package:choseno_mobile/presentation/features/auth/providers/auth_providers.dart';
import 'package:choseno_mobile/presentation/features/auth/screens/forgot_password_screen.dart';
import 'package:choseno_mobile/presentation/features/auth/screens/reset_password_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

const _user = AppUser(id: 'u1', email: 'me@example.com');

class _Repo implements AuthRepository {
  final resetRequests = <String>[];
  final recoveryCodes = <({String email, String code})>[];
  final newPasswords = <String>[];
  var signedOut = false;

  Result<void> resetResult = const Result.ok(null);
  Result<AppUser> recoveryResult = const Result.ok(_user);
  Result<void> updateResult = const Result.ok(null);

  @override
  Future<Result<void>> resetPasswordForEmail(String email) async {
    resetRequests.add(email);
    return resetResult;
  }

  @override
  Future<Result<AppUser>> verifyRecoveryCode({
    required String email,
    required String code,
  }) async {
    recoveryCodes.add((email: email, code: code));
    return recoveryResult;
  }

  @override
  Future<Result<void>> updatePassword(String newPassword) async {
    newPasswords.add(newPassword);
    return updateResult;
  }

  @override
  Future<Result<void>> signOut() async {
    signedOut = true;
    return const Result.ok(null);
  }

  @override
  AppUser? get currentUser => null;
  @override
  Stream<AppUser?> get authStateChanges => const Stream.empty();
  @override
  Future<Result<AppUser>> signInWithPassword({
    required String email,
    required String password,
  }) async => const Result.err(NetworkFailure());
  @override
  Future<Result<SignUpOutcome>> signUpWithPassword({
    required String email,
    required String password,
  }) async => const Result.err(NetworkFailure());
  @override
  Future<Result<AppUser>> verifySignupCode({
    required String email,
    required String code,
  }) async => const Result.err(NetworkFailure());
  @override
  Future<Result<AppUser>> verifySignupTokenHash(String tokenHash) async =>
      const Result.err(NetworkFailure());
  @override
  Future<Result<AppUser>> verifyRecoveryTokenHash(String tokenHash) async =>
      recoveryResult;
  @override
  Future<Result<void>> resendSignupEmail(String email) async =>
      const Result.ok(null);
  @override
  Future<Result<AppUser>> signInWithGoogle() async =>
      const Result.err(NetworkFailure());
  @override
  Future<Result<void>> deleteAccount() async => const Result.ok(null);
}

Future<void> _pumpForgot(WidgetTester tester, _Repo repo) async {
  tester.view.physicalSize = const Size(1200, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => const ForgotPasswordScreen()),
      GoRoute(
        path: AppRoutes.resetPassword,
        builder: (_, state) => ResetPasswordScreen(
          email: state.uri.queryParameters['email'] ?? '',
        ),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [authRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp.router(
        theme: AppTheme.build(ChosenoPalette.pulse),
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

ProviderContainer _container(_Repo repo) {
  final c = ProviderContainer(
    overrides: [authRepositoryProvider.overrideWithValue(repo)],
  );
  addTearDown(c.dispose);
  return c;
}

void main() {
  testWidgets(
    'entering an email sends the reset email and opens the code screen',
    (tester) async {
      final repo = _Repo();
      await _pumpForgot(tester, repo);

      // Send is disabled until the email looks valid.
      await tester.enterText(find.byType(TextField), 'nope');
      await tester.pump();
      await tester.tap(find.text('Send code'));
      await tester.pumpAndSettle();
      expect(repo.resetRequests, isEmpty);

      await tester.enterText(find.byType(TextField), 'me@example.com');
      await tester.pump();
      await tester.tap(find.text('Send code'));
      await tester.pumpAndSettle();

      expect(repo.resetRequests, ['me@example.com']);
      expect(find.text('Enter your code'), findsOneWidget);
      expect(find.textContaining('me@example.com'), findsWidgets);
    },
  );

  testWidgets(
    'a Supabase "wait N seconds" answer still moves to the code screen',
    (tester) async {
      final repo = _Repo()
        ..resetResult = const Result.err(
          ServerFailure(
            'For security purposes, you can only request this after 45 seconds.',
          ),
        );
      await _pumpForgot(tester, repo);
      await tester.enterText(find.byType(TextField), 'me@example.com');
      await tester.pump();
      await tester.tap(find.text('Send code'));
      await tester.pumpAndSettle();

      expect(find.text('Enter your code'), findsOneWidget);
    },
  );

  test('a good code starts the recovery hold; a bad one releases it', () async {
    final repo = _Repo();
    final c = _container(repo);
    final controller = c.read(authControllerProvider.notifier);

    expect(c.read(passwordRecoveryPendingProvider), isFalse);
    final ok = await controller.verifyRecoveryCode(
      email: 'me@example.com',
      code: '482 913',
    );
    expect(ok, isNull);
    // Spaces from "482 913" are stripped; the router is told to hold the
    // person on the new-password screen.
    expect(repo.recoveryCodes.single.code, '482913');
    expect(c.read(passwordRecoveryPendingProvider), isTrue);

    repo.recoveryResult = const Result.err(
      ServerFailure('Token has expired or is invalid'),
    );
    final bad = await controller.verifyRecoveryCode(
      email: 'me@example.com',
      code: '111111',
    );
    expect(bad, contains("isn't right or has expired"));
    expect(c.read(passwordRecoveryPendingProvider), isFalse);
  });

  test('saving the new password ends the hold; a failure keeps it', () async {
    final repo = _Repo();
    final c = _container(repo);
    final controller = c.read(authControllerProvider.notifier);
    c.read(passwordRecoveryPendingProvider.notifier).set(true);

    repo.updateResult = const Result.err(
      ServerFailure('New password should be different from the old password.'),
    );
    final failed = await controller.setNewPassword('same-as-before');
    expect(failed, contains('different from the old password'));
    expect(c.read(passwordRecoveryPendingProvider), isTrue);

    repo.updateResult = const Result.ok(null);
    final saved = await controller.setNewPassword('brand-new-pass');
    expect(saved, isNull);
    expect(repo.newPasswords, ['same-as-before', 'brand-new-pass']);
    expect(c.read(passwordRecoveryPendingProvider), isFalse);
  });

  test('cancelling a reset signs the temporary session out', () async {
    final repo = _Repo();
    final c = _container(repo);
    c.read(passwordRecoveryPendingProvider.notifier).set(true);

    await c.read(authControllerProvider.notifier).cancelPasswordReset();

    expect(repo.signedOut, isTrue);
    expect(c.read(passwordRecoveryPendingProvider), isFalse);
  });
}
