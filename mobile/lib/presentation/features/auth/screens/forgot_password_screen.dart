// "Forgot password?": enter the account email, get an email with a button and
// a 6-digit code, then enter the code on the next screen. Mirrors the
// website's /auth/forgot-password, with the code so it all stays in the app.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../providers/auth_providers.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  bool get _valid =>
      RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(_email.text.trim());

  Future<void> _send() async {
    if (!_valid || _busy) return;
    final email = _email.text.trim();
    setState(() {
      _busy = true;
      _error = null;
    });
    final error = await ref
        .read(authControllerProvider.notifier)
        .requestPasswordReset(email);
    if (!mounted) return;
    final tooSoon = RegExp(r'after (\d+) seconds?').firstMatch(error ?? '');
    setState(() => _busy = false);
    // A "wait N seconds" answer means a code was just sent — carry on to the
    // code screen instead of blocking the person.
    if (error == null || tooSoon != null) {
      context.push(AppRoutes.resetPasswordFor(email));
    } else {
      setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(
              horizontal: ChosenoSpacing.lg + 4,
              vertical: ChosenoSpacing.lg,
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.lock_reset, size: 48, color: palette.primary),
                  const SizedBox(height: ChosenoSpacing.md),
                  Text(
                    'Reset your password',
                    textAlign: TextAlign.center,
                    style: ChosenoTypography.display(
                      color: palette.textMain,
                      fontSize: 26,
                    ),
                  ),
                  const SizedBox(height: ChosenoSpacing.sm),
                  Text(
                    "Enter the email you signed up with and we'll send you a code to choose a new password.",
                    textAlign: TextAlign.center,
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 14,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: ChosenoSpacing.lg),
                  AppTextField(
                    label: 'Email',
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    onChanged: (_) => setState(() => _error = null),
                  ),
                  const SizedBox(height: ChosenoSpacing.md),
                  AppButton(
                    label: 'Send code',
                    loading: _busy,
                    onPressed: _valid && !_busy ? _send : null,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: ChosenoSpacing.sm),
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: ChosenoTypography.body(
                        color: palette.danger,
                        fontSize: 13,
                      ),
                    ),
                  ],
                  const SizedBox(height: ChosenoSpacing.sm),
                  AppButton(
                    label: 'Back to sign in',
                    variant: AppButtonVariant.text,
                    tone: AppButtonTone.defaultTone,
                    onPressed: () =>
                        context.canPop() ? context.pop() : context.go('/auth'),
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
