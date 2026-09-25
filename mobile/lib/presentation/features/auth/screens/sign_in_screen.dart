// Screen B from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo) — single
// form toggled between Sign In / Sign Up. This is the one fully-built
// screen in the initial scaffold, meant as the pattern every other feature
// screen copies: watch a Riverpod controller, call it, react to
// AsyncLoading/AsyncError/AsyncData, never touch a repository or Supabase
// directly from widget code.
//
// Not yet ported from the guide: Google OAuth (needs google_sign_in +
// platform config), the deep-link password-recovery flow (needs app_links
// wired to a route, see core/router/app_router.dart's TODO), and the
// founder-count nudge. Forgot-password is stubbed as a snackbar-only
// action pending the reset-password screen.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../profile/providers/profile_providers.dart';
import '../providers/auth_providers.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSignUp = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final controller = ref.read(authControllerProvider.notifier);
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    final success = _isSignUp
        ? await controller.signUp(email: email, password: password)
        : await controller.signIn(email: email, password: password);

    if (success && mounted) {
      // On success, authStateChangesProvider fires and the router's
      // redirect logic takes over — see core/router/app_router.dart.
      // Nothing to navigate to here explicitly.
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final authState = ref.watch(authControllerProvider);
    // Signed in, but the router keeps you on this screen until the profile
    // (role/onboarding) has loaded — without showing that, a slow or failed
    // profile load looks exactly like "login did nothing".
    final signedIn = ref.watch(authStateChangesProvider).value != null;
    final profileState = ref.watch(ownProfileProvider);
    final profileLoading = signedIn && profileState.isLoading;
    final profileError =
        signedIn && profileState.hasError && !profileState.isLoading
        ? profileState.error
        : null;
    final isLoading = authState.isLoading || profileLoading;

    ref.listen(authControllerProvider, (previous, next) {
      final error = next.error;
      if (error != null && next is AsyncError) {
        // AppFailure.toString() returns its .message (see
        // core/errors/app_failure.dart) — every failure this controller
        // can produce is one, so '$error' is always the real reason.
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    });

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(
              horizontal: ChosenoSpacing.lg + 4,
              vertical: ChosenoSpacing.xl,
            ),
            child: ConstrainedBox(
              // Single-column form width — DESIGN.md's Layout section
              // reserves a fixed reading width for the auth card
              // specifically, not the full-width dashboard convention
              // other screens use.
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 72,
                      height: 72,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        gradient: ChosenoGradients.primary(palette),
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: palette.primary.withValues(alpha: 0.35),
                            blurRadius: 32,
                            offset: const Offset(0, 12),
                          ),
                        ],
                      ),
                      child: Text(
                        'C',
                        style: ChosenoTypography.display(
                          color: palette.textOnPrimary,
                          fontSize: 38,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: ChosenoSpacing.lg),
                  Text(
                    'Choseno',
                    textAlign: TextAlign.center,
                    style: ChosenoTypography.display(
                      color: palette.textMain,
                      fontSize: 44,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: ChosenoSpacing.sm),
                  Text(
                    'Know who represents you.\nRate every politician in your area.',
                    textAlign: TextAlign.center,
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 15,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: ChosenoSpacing.xl),
                  AppCard(
                    variant: AppCardVariant.hero,
                    padding: const EdgeInsets.all(ChosenoSpacing.lg),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          _isSignUp ? 'Create your account' : 'Welcome back',
                          style: ChosenoTypography.display(
                            color: palette.textMain,
                            fontSize: 24,
                          ),
                        ),
                        const SizedBox(height: ChosenoSpacing.lg),
                        AppTextField(
                          label: 'Email',
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                        ),
                        const SizedBox(height: ChosenoSpacing.md),
                        AppTextField(
                          label: 'Password',
                          controller: _passwordController,
                          obscureText: true,
                          autofillHints: [
                            _isSignUp
                                ? AutofillHints.newPassword
                                : AutofillHints.password,
                          ],
                        ),
                        if (profileError != null) ...[
                          const SizedBox(height: ChosenoSpacing.md),
                          Text(
                            "You're signed in, but your profile couldn't be loaded: $profileError",
                            style: ChosenoTypography.body(
                              color: palette.danger,
                              fontSize: 13,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: ChosenoSpacing.sm),
                          Row(
                            children: [
                              Expanded(
                                child: AppButton(
                                  label: 'Retry',
                                  variant: AppButtonVariant.outline,
                                  onPressed: () => ref
                                      .read(ownProfileProvider.notifier)
                                      .refresh(),
                                ),
                              ),
                              const SizedBox(width: ChosenoSpacing.sm),
                              Expanded(
                                child: AppButton(
                                  label: 'Sign out',
                                  variant: AppButtonVariant.text,
                                  tone: AppButtonTone.danger,
                                  onPressed: () => ref
                                      .read(authControllerProvider.notifier)
                                      .signOut(),
                                ),
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: ChosenoSpacing.lg),
                        AppButton(
                          label: _isSignUp ? 'Create account' : 'Sign in',
                          loading: isLoading,
                          onPressed: isLoading ? null : _submit,
                        ),
                        if (!_isSignUp) ...[
                          const SizedBox(height: ChosenoSpacing.xs),
                          AppButton(
                            label: 'Forgot password?',
                            variant: AppButtonVariant.text,
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Reset-password screen not yet built — see the Flutter guide §4.B.',
                                  ),
                                ),
                              );
                            },
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: ChosenoSpacing.md),
                  AppButton(
                    label: _isSignUp
                        ? 'Already have an account? Sign in'
                        : "New here? Create an account",
                    variant: AppButtonVariant.text,
                    onPressed: isLoading
                        ? null
                        : () => setState(() => _isSignUp = !_isSignUp),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
