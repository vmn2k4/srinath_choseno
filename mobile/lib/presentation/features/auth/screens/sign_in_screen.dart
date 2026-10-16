// Screen B from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo) — single
// form toggled between Sign In / Sign Up. This is the one fully-built
// screen in the initial scaffold, meant as the pattern every other feature
// screen copies: watch a Riverpod controller, call it, react to
// AsyncLoading/AsyncError/AsyncData, never touch a repository or Supabase
// directly from widget code.
//
// Google sign-in uses the native account picker (google_sign_in) and hands
// the ID token to Supabase; it shows only when GOOGLE_WEB_CLIENT_ID is set.
// Layout: one light column on a faint SVG contour-map backdrop — the Choseno
// mark, a big greeting, transparent underline fields, the primary button,
// Google, and a Create account / Sign in link. It fits a phone viewport with no
// scrolling (it only scrolls with the keyboard open or on a very small screen).
// Password reset lives on its own screens (forgot_password_screen.dart).
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';
import '../../../../domain/auth/entities/sign_up_outcome.dart';

import '../../../../core/config/env_config.dart';
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

    // Signed in right away: authStateChangesProvider fires and the router's
    // redirect logic takes over (core/router/app_router.dart). If the email
    // still needs confirming — right after sign-up, or a login before the
    // link/code was used — go to the code screen instead.
    final needsConfirmation = _isSignUp
        ? await controller.signUp(email: email, password: password) ==
              SignUpOutcome.needsEmailConfirmation
        : await controller.signIn(email: email, password: password) ==
              SignInOutcome.needsEmailConfirmation;

    if (needsConfirmation && mounted) {
      context.push(AppRoutes.confirmEmailFor(email, resend: !_isSignUp));
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

    // A confirmation link that couldn't be used (expired, already used) leaves
    // a notice here; show it once.
    ref.listen(authNoticeProvider, (previous, next) {
      if (next != null) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(next)));
        ref.read(authNoticeProvider.notifier).show(null);
      }
    });

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

    final keyboardOpen = MediaQuery.of(context).viewInsets.bottom > 0;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: palette.isLight
          ? SystemUiOverlayStyle.dark
          : SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: palette.background,
        body: Stack(
          children: [
            // Faint electoral-map backdrop (SVG) behind everything.
            Positioned.fill(
              child: SvgPicture.asset(
                'assets/svg/auth_backdrop.svg',
                fit: BoxFit.cover,
                alignment: Alignment.topCenter,
              ),
            ),
            SafeArea(
              child: LayoutBuilder(
                builder: (context, constraints) => SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ChosenoSpacing.lg + 4,
                    vertical: ChosenoSpacing.md,
                  ),
                  // The whole page is one column centred in the viewport: on a
                  // normal phone it fits with no scrolling, and it only scrolls
                  // when the keyboard or a very small screen leaves no room.
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight - ChosenoSpacing.md * 2,
                    ),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 420),
                        child: _content(
                          palette,
                          isLoading: isLoading,
                          profileError: profileError,
                          // The illustration takes the height the form leaves
                          // spare (the form block is ~470pt), so it is as big
                          // as fits without scrolling; hidden with the
                          // keyboard open.
                          artHeight: keyboardOpen
                              ? 0
                              : (constraints.maxHeight - 500)
                                    .clamp(0.0, 320.0)
                                    .toDouble(),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _content(
    ChosenoPalette palette, {
    required bool isLoading,
    required Object? profileError,
    required double artHeight,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _header(palette, artHeight: artHeight),
        const SizedBox(height: ChosenoSpacing.lg),
        _AuthField(
          label: 'Email',
          controller: _emailController,
          icon: Icons.mail_outline_rounded,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
        ),
        const SizedBox(height: ChosenoSpacing.sm),
        _AuthField(
          label: 'Password',
          controller: _passwordController,
          icon: Icons.lock_outline_rounded,
          password: true,
          autofillHints: [
            _isSignUp ? AutofillHints.newPassword : AutofillHints.password,
          ],
        ),
        if (!_isSignUp)
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => context.push(AppRoutes.forgotPassword),
              child: const Text('Forgot password?'),
            ),
          )
        else
          const SizedBox(height: ChosenoSpacing.md),
        if (profileError != null) ...[
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
                  onPressed: () =>
                      ref.read(ownProfileProvider.notifier).refresh(),
                ),
              ),
              const SizedBox(width: ChosenoSpacing.sm),
              Expanded(
                child: AppButton(
                  label: 'Sign out',
                  variant: AppButtonVariant.text,
                  tone: AppButtonTone.danger,
                  onPressed: () =>
                      ref.read(authControllerProvider.notifier).signOut(),
                ),
              ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.sm),
        ],
        AppButton(
          label: _isSignUp ? 'Create account' : 'Sign in',
          loading: isLoading,
          onPressed: isLoading ? null : _submit,
        ),
        if (EnvConfig.googleSignInConfigured) ...[
          const SizedBox(height: ChosenoSpacing.md),
          Row(
            children: [
              Expanded(child: Divider(color: palette.borderLight)),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: ChosenoSpacing.md,
                ),
                child: Text(
                  'or',
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontSize: 12,
                  ),
                ),
              ),
              Expanded(child: Divider(color: palette.borderLight)),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.md),
          _GoogleButton(
            onPressed: isLoading
                ? null
                : () => ref
                      .read(authControllerProvider.notifier)
                      .signInWithGoogle(),
          ),
        ],
        const SizedBox(height: ChosenoSpacing.md),
        _ModeLink(
          isSignUp: _isSignUp,
          enabled: !isLoading,
          onTap: () => setState(() => _isSignUp = !_isSignUp),
        ),
      ],
    );
  }

  /// Small centred logo row, then the illustration as the hero — it takes
  /// whatever height the screen has to spare (so it is as big as it can be
  /// without pushing the form into scrolling), on a soft glow.
  Widget _header(ChosenoPalette palette, {required double artHeight}) {
    final brand = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(13),
            boxShadow: const [
              BoxShadow(
                color: Color(0x40F97316),
                blurRadius: 18,
                offset: Offset(0, 5),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(13),
            child: SvgPicture.asset('assets/svg/choseno_mark.svg'),
          ),
        ),
        const SizedBox(width: ChosenoSpacing.sm + 2),
        Text(
          'Choseno',
          style: ChosenoTypography.display(
            color: palette.textMain,
            fontSize: 24,
          ),
        ),
      ],
    );
    if (artHeight < 150) return Center(child: brand);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        brand,
        const SizedBox(height: ChosenoSpacing.md),
        SizedBox(
          height: artHeight,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Soft glow behind the figure.
              Container(
                width: artHeight * 1.05,
                height: artHeight * 1.05,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      palette.primary.withValues(alpha: 0.20),
                      palette.primary.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
              // Original 3D-style illustration (generated for Choseno),
              // background removed so it sits straight on the page.
              Image.asset(
                'assets/images/auth_hero.png',
                height: artHeight,
                fit: BoxFit.contain,
                semanticLabel: 'A friendly figure waving beside a ballot box',
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── look ───────────────────────────────────────────────────────────────────

/// "New here? **Create account**" / "Already have an account? **Sign in**" —
/// always on screen because the page fits the viewport.
class _ModeLink extends StatelessWidget {
  const _ModeLink({
    required this.isSignUp,
    required this.enabled,
    required this.onTap,
  });

  final bool isSignUp;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Semantics(
      button: true,
      label: isSignUp ? 'Sign in' : 'Create account',
      excludeSemantics: true,
      child: InkWell(
        key: Key(isSignUp ? 'auth-mode-signin' : 'auth-mode-signup'),
        borderRadius: BorderRadius.circular(12),
        onTap: enabled ? onTap : null,
        child: SizedBox(
          height: 48,
          child: Center(
            child: Text.rich(
              TextSpan(
                style: ChosenoTypography.body(
                  color: palette.textMuted,
                  fontSize: 14,
                ),
                children: [
                  TextSpan(
                    text: isSignUp
                        ? 'Already have an account?  '
                        : 'New here?  ',
                  ),
                  TextSpan(
                    text: isSignUp ? 'Sign in' : 'Create account',
                    style: ChosenoTypography.body(
                      color: palette.primary,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
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

/// Transparent underline field with a leading icon (and a show/hide eye for
/// passwords) — sits directly on the page backdrop, no filled box.
class _AuthField extends StatefulWidget {
  const _AuthField({
    required this.label,
    required this.controller,
    required this.icon,
    this.password = false,
    this.keyboardType,
    this.autofillHints,
  });

  final String label;
  final TextEditingController controller;
  final IconData icon;
  final bool password;
  final TextInputType? keyboardType;
  final Iterable<String>? autofillHints;

  @override
  State<_AuthField> createState() => _AuthFieldState();
}

class _AuthFieldState extends State<_AuthField> {
  bool _hidden = true;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    UnderlineInputBorder line(Color c, [double w = 1.2]) =>
        UnderlineInputBorder(
          borderSide: BorderSide(color: c, width: w),
        );
    return TextField(
      controller: widget.controller,
      obscureText: widget.password && _hidden,
      keyboardType: widget.keyboardType,
      autofillHints: widget.autofillHints,
      autocorrect: false,
      enableSuggestions: !widget.password,
      style: ChosenoTypography.body(color: palette.textMain, fontSize: 16),
      decoration: InputDecoration(
        labelText: widget.label,
        filled: false,
        contentPadding: const EdgeInsets.symmetric(vertical: 14),
        enabledBorder: line(palette.border),
        border: line(palette.border),
        focusedBorder: line(palette.primary, 2),
        // Flush with the page's left edge (the default adds a 12pt inset that
        // pushed the icon out of line with the heading above it).
        prefixIcon: Padding(
          padding: const EdgeInsets.only(right: 12),
          child: Icon(widget.icon, color: palette.textMuted, size: 20),
        ),
        prefixIconConstraints: const BoxConstraints(
          minWidth: 32,
          minHeight: 24,
        ),
        suffixIcon: widget.password
            ? IconButton(
                tooltip: _hidden ? 'Show password' : 'Hide password',
                icon: Icon(
                  _hidden
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  color: palette.textMuted,
                  size: 20,
                ),
                onPressed: () => setState(() => _hidden = !_hidden),
              )
            : null,
      ),
    );
  }
}

/// Google's branded sign-in button: white fill, Google's official "G" logo, dark
/// label. Deliberately not an [AppButton] outline, whose muted tone reads as
/// disabled.
class _GoogleButton extends StatelessWidget {
  const _GoogleButton({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Continue with Google',
      excludeSemantics: true,
      child: Opacity(
        opacity: onPressed == null ? 0.6 : 1,
        child: Material(
          color: Colors.white,
          elevation: 1,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ChosenoRadii.control),
            side: const BorderSide(color: Color(0xFFDADCE0)),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onPressed,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Image.asset(
                    'assets/images/google_g.png',
                    width: 20,
                    height: 20,
                  ),
                  const SizedBox(width: ChosenoSpacing.sm + 2),
                  Text(
                    'Continue with Google',
                    style: ChosenoTypography.body(
                      color: const Color(0xFF3C4043),
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
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
