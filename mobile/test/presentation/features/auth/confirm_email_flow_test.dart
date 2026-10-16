import 'package:choseno_mobile/core/errors/app_failure.dart';
import 'package:choseno_mobile/core/errors/result.dart';
import 'package:choseno_mobile/core/router/app_router.dart';
import 'package:choseno_mobile/core/router/deep_link_service.dart';
import 'package:choseno_mobile/core/theme/app_theme.dart';
import 'package:choseno_mobile/core/theme/theme_config.dart';
import 'package:choseno_mobile/domain/auth/entities/app_user.dart';
import 'package:choseno_mobile/domain/auth/entities/sign_up_outcome.dart';
import 'package:choseno_mobile/domain/auth/repositories/auth_repository.dart';
import 'package:choseno_mobile/presentation/features/auth/providers/auth_providers.dart';
import 'package:choseno_mobile/presentation/features/auth/screens/confirm_email_screen.dart';
import 'package:choseno_mobile/presentation/features/auth/screens/sign_in_screen.dart';
import 'package:choseno_mobile/core/widgets/widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class _Repo implements AuthRepository {
  _Repo({
    this.signUpResult = const Result.ok(SignUpOutcome.needsEmailConfirmation),
  });

  final Result<SignUpOutcome> signUpResult;

  /// A login before confirming the email: what Supabase really answers.
  final Result<AppUser> signInResult = const Result.err(
    ServerFailure('Email not confirmed', code: 'email_not_confirmed'),
  );
  Result<AppUser>? verifyResult;

  final verifyCalls = <({String email, String code})>[];
  final resendCalls = <String>[];
  String? resendError;

  @override
  AppUser? get currentUser => null;
  @override
  Stream<AppUser?> get authStateChanges => const Stream.empty();

  @override
  Future<Result<SignUpOutcome>> signUpWithPassword({
    required String email,
    required String password,
  }) async => signUpResult;

  @override
  Future<Result<AppUser>> signInWithPassword({
    required String email,
    required String password,
  }) async => signInResult;

  @override
  Future<Result<AppUser>> verifySignupCode({
    required String email,
    required String code,
  }) async {
    verifyCalls.add((email: email, code: code));
    return verifyResult ??
        const Result.err(ServerFailure('Token has expired or is invalid'));
  }

  @override
  Future<Result<AppUser>> verifySignupTokenHash(String tokenHash) async =>
      verifyResult ?? const Result.err(ServerFailure('bad'));

  @override
  Future<Result<AppUser>> verifyRecoveryCode({
    required String email,
    required String code,
  }) async => verifyResult ?? const Result.err(ServerFailure('bad'));

  @override
  Future<Result<AppUser>> verifyRecoveryTokenHash(String tokenHash) async =>
      verifyResult ?? const Result.err(ServerFailure('bad'));

  @override
  Future<Result<void>> resendSignupEmail(String email) async {
    resendCalls.add(email);
    return resendError == null
        ? const Result.ok(null)
        : Result.err(ServerFailure(resendError!));
  }

  @override
  Future<Result<AppUser>> signInWithGoogle() async =>
      const Result.err(NetworkFailure());
  @override
  Future<Result<void>> signOut() async => const Result.ok(null);
  @override
  Future<Result<void>> deleteAccount() async => const Result.ok(null);
  @override
  Future<Result<void>> resetPasswordForEmail(String email) async =>
      const Result.ok(null);
  @override
  Future<Result<void>> updatePassword(String newPassword) async =>
      const Result.ok(null);
}

Future<void> _pumpApp(WidgetTester tester, _Repo repo) async {
  tester.view.physicalSize = const Size(1200, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => const SignInScreen()),
      GoRoute(
        path: AppRoutes.confirmEmail,
        builder: (_, state) => ConfirmEmailScreen(
          email: state.uri.queryParameters['email'] ?? '',
          autoResend: state.uri.queryParameters['resend'] == '1',
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

/// The always-visible "Create account" half of the pill switch at the top of
/// the sign-in sheet.
final _createAccountSwitch = find.byKey(const Key('auth-mode-signup'));

Future<void> _submitForm(WidgetTester tester, String button) async {
  await tester.enterText(find.byType(TextField).at(0), 'new@example.com');
  await tester.enterText(find.byType(TextField).at(1), 'secret123');
  await tester.tap(find.widgetWithText(AppButton, button));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the sign-in screen shows a Create account switch up front', (
    tester,
  ) async {
    await _pumpApp(tester, _Repo());

    // Visible without scrolling or finding a link under the card.
    expect(_createAccountSwitch, findsOneWidget);
    expect(find.text('Welcome back'), findsOneWidget);

    await tester.tap(_createAccountSwitch);
    await tester.pumpAndSettle();

    expect(find.text('Create your account'), findsOneWidget);
    expect(find.text('Welcome back'), findsNothing);
  });

  testWidgets('sign-up that needs confirmation opens the code screen', (
    tester,
  ) async {
    final repo = _Repo();
    await _pumpApp(tester, repo);
    // Switch to the sign-up form.
    await tester.tap(_createAccountSwitch);
    await tester.pumpAndSettle();
    await _submitForm(tester, 'Create account');

    expect(find.text('Check your email'), findsOneWidget);
    expect(find.textContaining('new@example.com'), findsWidgets);
    // A normal sign-up already got an email: no automatic resend.
    expect(repo.resendCalls, isEmpty);
  });

  testWidgets(
    'signing in with an unconfirmed email opens the code screen and sends a fresh email',
    (tester) async {
      final repo = _Repo();
      await _pumpApp(tester, repo);
      await _submitForm(tester, 'Sign in');

      expect(find.text('Check your email'), findsOneWidget);
      expect(repo.resendCalls, ['new@example.com']);
      // No raw "Email not confirmed" error was shown.
      expect(find.text('Email not confirmed'), findsNothing);
    },
  );

  testWidgets('a code of any normal length (8 digits live) is accepted', (
    tester,
  ) async {
    final repo = _Repo();
    await _pumpApp(tester, repo);
    await _submitForm(tester, 'Sign in');

    // The live project emails 8-digit codes; nothing is sent until Confirm.
    await tester.enterText(find.byType(TextField), '30858585');
    await tester.pump();
    expect(repo.verifyCalls, isEmpty);
    await tester.tap(find.text('Confirm email'));
    await tester.pumpAndSettle();

    expect(repo.verifyCalls, [(email: 'new@example.com', code: '30858585')]);
    // The fake rejects it: a plain-language message, not the raw one.
    expect(find.textContaining("isn't right or has expired"), findsOneWidget);
  });

  testWidgets('resend is on a cooldown after sign-up', (tester) async {
    final repo = _Repo();
    await _pumpApp(tester, repo);
    await tester.tap(_createAccountSwitch);
    await tester.pumpAndSettle();
    await _submitForm(tester, 'Create account');

    expect(find.textContaining('Resend code in'), findsOneWidget);
    expect(repo.resendCalls, isEmpty);
  });

  testWidgets(
    'an already-registered email shows the real reason, not the code screen',
    (tester) async {
      final repo = _Repo(
        signUpResult: const Result.err(
          ServerFailure('An account with this email already exists.'),
        ),
      );
      await _pumpApp(tester, repo);
      await tester.tap(_createAccountSwitch);
      await tester.pumpAndSettle();
      await _submitForm(tester, 'Create account');

      expect(find.text('Check your email'), findsNothing);
      expect(find.textContaining('already exists'), findsOneWidget);
    },
  );

  testWidgets(
    'a failed confirmation link leaves a notice on the sign-in screen',
    (tester) async {
      await _pumpApp(tester, _Repo());
      ProviderScope.containerOf(tester.element(find.byType(SignInScreen)))
          .read(authNoticeProvider.notifier)
          .show('That confirmation link didn\'t work.');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text("That confirmation link didn't work."), findsOneWidget);
    },
  );

  group('choseno://auth/confirm link', () {
    test('accepts the sign-up and password-reset links', () {
      expect(
        parseAuthConfirmLink(
          Uri.parse(
            'choseno://auth/confirm?token_hash=abcdef1234567890&type=signup',
          ),
        ),
        (tokenHash: 'abcdef1234567890', type: 'signup'),
      );
      expect(
        parseAuthConfirmLink(
          Uri.parse(
            'choseno://auth/confirm?token_hash=abcdef1234567890&type=recovery',
          ),
        ),
        (tokenHash: 'abcdef1234567890', type: 'recovery'),
      );
    });

    test('rejects other types, hosts, schemes and malformed tokens', () {
      for (final bad in [
        'choseno://auth/confirm?token_hash=abcdef1234567890&type=magiclink',
        'choseno://auth/confirm?token_hash=abcdef1234567890',
        'choseno://wall/confirm?token_hash=abcdef1234567890&type=signup',
        'https://www.choseno.com/auth/confirm?token_hash=abcdef1234567890&type=signup',
        'choseno://auth/confirm?token_hash=short&type=signup',
        'choseno://auth/confirm?token_hash=has%20space1234&type=signup',
      ]) {
        expect(parseAuthConfirmLink(Uri.parse(bad)), isNull, reason: bad);
      }
    });
  });
}
