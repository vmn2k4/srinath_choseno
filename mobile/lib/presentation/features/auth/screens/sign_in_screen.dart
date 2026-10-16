// Screen B from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo) — single
// form toggled between Sign In / Sign Up. This is the one fully-built
// screen in the initial scaffold, meant as the pattern every other feature
// screen copies: watch a Riverpod controller, call it, react to
// AsyncLoading/AsyncError/AsyncData, never touch a repository or Supabase
// directly from widget code.
//
// Google sign-in uses the native account picker (google_sign_in) and hands
// the ID token to Supabase; it shows only when GOOGLE_WEB_CLIENT_ID is set.
// Layout: a dark brand header (the Choseno mark, an SVG contour-map backdrop,
// three value chips) with a rounded sheet rising over it that holds the form.
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
      // Clock/battery in white over the dark header.
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _heroBottom,
        body: CustomScrollView(
          physics: const ClampingScrollPhysics(),
          slivers: [
            SliverFillRemaining(
              hasScrollBody: false,
              child: Column(
                children: [
                  _Hero(compact: keyboardOpen),
                  Expanded(
                    child: Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: palette.surface,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(32),
                        ),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x33000000),
                            blurRadius: 24,
                            offset: Offset(0, -6),
                          ),
                        ],
                      ),
                      child: SafeArea(
                        top: false,
                        child: Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 440),
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(
                                ChosenoSpacing.lg + 4,
                                ChosenoSpacing.lg,
                                ChosenoSpacing.lg + 4,
                                ChosenoSpacing.md,
                              ),
                              child: _form(
                                palette,
                                isLoading: isLoading,
                                profileError: profileError,
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
          ],
        ),
      ),
    );
  }

  Widget _form(
    ChosenoPalette palette, {
    required bool isLoading,
    required Object? profileError,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ModeSwitch(
          isSignUp: _isSignUp,
          enabled: !isLoading,
          onChanged: (v) => setState(() => _isSignUp = v),
        ),
        const SizedBox(height: ChosenoSpacing.md + 2),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          layoutBuilder: (current, previous) => Stack(
            alignment: Alignment.topLeft,
            children: [...previous, if (current != null) current],
          ),
          child: SizedBox(
            key: ValueKey(_isSignUp),
            width: double.infinity,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _isSignUp ? 'Create your account' : 'Welcome back',
                  style: ChosenoTypography.display(
                    color: palette.textMain,
                    fontSize: 26,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _isSignUp
                      ? 'Free, and anonymous by default.'
                      : 'Sign in to see your district.',
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: ChosenoSpacing.md),
        _AuthField(
          label: 'Email',
          controller: _emailController,
          icon: Icons.mail_outline_rounded,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
        ),
        const SizedBox(height: ChosenoSpacing.md),
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
          const SizedBox(height: ChosenoSpacing.xs),
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
                  'or continue with',
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
      ],
    );
  }
}

// ── look ───────────────────────────────────────────────────────────────────

const _heroTop = Color(0xFF0B1220);
const _heroBottom = Color(0xFF14264F);

/// The dark brand header: contour-map backdrop (SVG), the Choseno mark with a
/// warm glow, the wordmark, and three value chips. Collapses while the
/// keyboard is open so the form keeps the room.
class _Hero extends StatelessWidget {
  const _Hero({required this.compact});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top;
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_heroTop, _heroBottom],
        ),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: SvgPicture.asset(
              'assets/svg/auth_backdrop.svg',
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
            ),
          ),
          SizedBox(
            width: double.infinity,
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                ChosenoSpacing.lg,
                topInset + (compact ? ChosenoSpacing.md : ChosenoSpacing.lg),
                ChosenoSpacing.lg,
                ChosenoSpacing.xl,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: compact ? 56 : 76,
                    height: compact ? 56 : 76,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(compact ? 16 : 24),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x66F97316),
                          blurRadius: 36,
                          spreadRadius: 1,
                        ),
                        BoxShadow(
                          color: Color(0x553B82F6),
                          blurRadius: 28,
                          offset: Offset(0, 10),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(compact ? 16 : 24),
                      child: SvgPicture.asset('assets/svg/choseno_mark.svg'),
                    ),
                  ),
                  const SizedBox(height: ChosenoSpacing.sm + 2),
                  Text(
                    'Choseno',
                    style: ChosenoTypography.display(
                      color: Colors.white,
                      fontSize: compact ? 26 : 34,
                    ),
                  ),
                  AnimatedSize(
                    duration: const Duration(milliseconds: 200),
                    alignment: Alignment.topCenter,
                    child: compact
                        ? const SizedBox(width: double.infinity)
                        : Column(
                            children: [
                              const SizedBox(height: 6),
                              Text(
                                'Know who represents you.\nRate every politician in your area.',
                                textAlign: TextAlign.center,
                                style: ChosenoTypography.body(
                                  color: Colors.white70,
                                  fontSize: 15,
                                  height: 1.45,
                                ),
                              ),
                              const SizedBox(height: ChosenoSpacing.md),
                              const Wrap(
                                alignment: WrapAlignment.center,
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  _Chip('assets/svg/auth_pin.svg', 'Districts'),
                                  _Chip('assets/svg/auth_star.svg', 'Reviews'),
                                  _Chip(
                                    'assets/svg/auth_ballot.svg',
                                    'Elections',
                                  ),
                                ],
                              ),
                            ],
                          ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.asset, this.label);

  final String asset;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SvgPicture.asset(asset, width: 16, height: 16),
          const SizedBox(width: 6),
          Text(
            label,
            style: ChosenoTypography.body(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// Sign in | Create account as one sliding pill (always visible, so new users
/// can see there is a sign-up without scrolling).
class _ModeSwitch extends StatelessWidget {
  const _ModeSwitch({
    required this.isSignUp,
    required this.enabled,
    required this.onChanged,
  });

  final bool isSignUp;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    Widget segment(Key key, String label, bool signUp) {
      final selected = isSignUp == signUp;
      return Expanded(
        child: Semantics(
          button: true,
          selected: selected,
          label: label,
          excludeSemantics: true,
          child: GestureDetector(
            key: key,
            behavior: HitTestBehavior.opaque,
            onTap: enabled ? () => onChanged(signUp) : null,
            child: SizedBox(
              height: 44,
              child: Center(
                child: AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 200),
                  style: ChosenoTypography.body(
                    color: selected ? Colors.white : palette.textMuted,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                  child: Text(label),
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: palette.surfaceHover,
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: palette.borderLight),
      ),
      child: Stack(
        children: [
          AnimatedAlign(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            alignment: isSignUp ? Alignment.centerRight : Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: 0.5,
              child: Container(
                height: 44,
                decoration: BoxDecoration(
                  gradient: ChosenoGradients.primary(palette),
                  borderRadius: BorderRadius.circular(100),
                  boxShadow: [
                    BoxShadow(
                      color: palette.primary.withValues(alpha: 0.35),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Row(
            children: [
              segment(const Key('auth-mode-signin'), 'Sign in', false),
              segment(const Key('auth-mode-signup'), 'Create account', true),
            ],
          ),
        ],
      ),
    );
  }
}

/// Text field with a leading icon (and a show/hide eye for passwords) on the
/// app's standard input styling.
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
    return TextField(
      controller: widget.controller,
      obscureText: widget.password && _hidden,
      keyboardType: widget.keyboardType,
      autofillHints: widget.autofillHints,
      autocorrect: false,
      enableSuggestions: !widget.password,
      decoration: InputDecoration(
        labelText: widget.label,
        prefixIcon: Icon(widget.icon, color: palette.textMuted, size: 20),
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
