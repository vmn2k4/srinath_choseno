// Password reset, step 2: enter the 6-digit code from the reset email. When it
// is accepted the router moves on to the set-new-password screen by itself
// (see passwordRecoveryPendingProvider). Resend has a cooldown because
// Supabase rate-limits reset emails.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../providers/auth_providers.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key, required this.email});

  final String email;

  @override
  ConsumerState<ResetPasswordScreen> createState() =>
      _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  static const _cooldownSeconds = 60;

  // The email-code length is a Supabase project setting (the live project
  // issues 8 digits, the local config says 6), so accept 6–10 digits and let
  // the server decide.
  static const _minCode = 6;
  static const _maxCode = 10;

  final _code = TextEditingController();
  Timer? _timer;
  int _cooldown = _cooldownSeconds;
  bool _busy = false;
  String? _error;
  String? _info;

  @override
  void initState() {
    super.initState();
    _startCooldown(_cooldownSeconds);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _startCooldown(int seconds) {
    _timer?.cancel();
    setState(() => _cooldown = seconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _cooldown = _cooldown - 1);
      if (_cooldown <= 0) t.cancel();
    });
  }

  Future<void> _verify() async {
    final code = _code.text.trim();
    if (code.length < _minCode || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _info = null;
    });
    final error = await ref
        .read(authControllerProvider.notifier)
        .verifyRecoveryCode(email: widget.email, code: code);
    if (!mounted) return;
    // On success the router takes over (set-new-password screen).
    setState(() {
      _busy = false;
      _error = error;
    });
  }

  Future<void> _resend() async {
    if (_busy || _cooldown > 0) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final error = await ref
        .read(authControllerProvider.notifier)
        .requestPasswordReset(widget.email);
    if (!mounted) return;
    final wait = RegExp(r'after (\d+) seconds?').firstMatch(error ?? '');
    setState(() {
      _busy = false;
      if (error == null) {
        _info = 'We sent a new code. The previous code no longer works.';
      } else if (wait != null) {
        _error =
            'Please wait ${wait.group(1)} seconds before requesting another code.';
      } else {
        _error = error;
      }
    });
    _startCooldown(wait != null ? int.parse(wait.group(1)!) : _cooldownSeconds);
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
                  Icon(
                    Icons.mark_email_unread_outlined,
                    size: 48,
                    color: palette.primary,
                  ),
                  const SizedBox(height: ChosenoSpacing.md),
                  Text(
                    'Enter your code',
                    textAlign: TextAlign.center,
                    style: ChosenoTypography.display(
                      color: palette.textMain,
                      fontSize: 26,
                    ),
                  ),
                  const SizedBox(height: ChosenoSpacing.sm),
                  Text(
                    'If an account exists for ${widget.email}, we sent it a code. Enter it below to choose a new password.',
                    textAlign: TextAlign.center,
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 14,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: ChosenoSpacing.lg),
                  TextField(
                    controller: _code,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(_maxCode),
                    ],
                    style: ChosenoTypography.display(
                      color: palette.textMain,
                      fontSize: 26,
                    ).copyWith(letterSpacing: 4),
                    decoration: const InputDecoration(
                      hintText: 'Code from the email',
                    ),
                    onChanged: (_) => setState(() => _error = null),
                  ),
                  const SizedBox(height: ChosenoSpacing.md),
                  AppButton(
                    label: 'Continue',
                    loading: _busy,
                    onPressed: _code.text.length >= _minCode && !_busy
                        ? _verify
                        : null,
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
                  if (_info != null) ...[
                    const SizedBox(height: ChosenoSpacing.sm),
                    Text(
                      _info!,
                      textAlign: TextAlign.center,
                      style: ChosenoTypography.body(
                        color: palette.success,
                        fontSize: 13,
                      ),
                    ),
                  ],
                  const SizedBox(height: ChosenoSpacing.md),
                  AppButton(
                    label: _cooldown > 0
                        ? 'Resend code in ${_cooldown}s'
                        : 'Resend code',
                    variant: AppButtonVariant.text,
                    onPressed: _cooldown > 0 || _busy ? null : _resend,
                  ),
                  AppButton(
                    label: 'Use a different email',
                    variant: AppButtonVariant.text,
                    tone: AppButtonTone.defaultTone,
                    onPressed: () => context.canPop()
                        ? context.pop()
                        : context.go('/auth/forgot-password'),
                  ),
                  Text(
                    "Can't find it? Check your spam folder.",
                    textAlign: TextAlign.center,
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 12,
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
