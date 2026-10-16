// "Check your email": enter the 6-digit code from the confirmation email, or
// tap the button in it (which opens the app via choseno://auth/confirm and
// signs in on its own — this screen just disappears when the session lands).
// Also where a login with an unconfirmed email ends up, with a fresh email
// already on its way (autoResend). Resend is rate-limited by Supabase, so it
// has a cooldown instead of failing silently.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../providers/auth_providers.dart';

class ConfirmEmailScreen extends ConsumerStatefulWidget {
  const ConfirmEmailScreen({
    super.key,
    required this.email,
    this.autoResend = false,
  });

  final String email;
  final bool autoResend;

  @override
  ConsumerState<ConfirmEmailScreen> createState() => _ConfirmEmailScreenState();
}

class _ConfirmEmailScreenState extends ConsumerState<ConfirmEmailScreen> {
  static const _cooldownSeconds = 60;

  // The email-code length is a Supabase project setting (the live project
  // issues 8 digits, the local config says 6), so accept 6–10 digits and let
  // the server decide.
  static const _minCode = 6;
  static const _maxCode = 10;

  final _code = TextEditingController();
  Timer? _timer;
  late int _cooldown = widget.autoResend ? 0 : _cooldownSeconds;
  bool _busy = false;
  String? _error;
  String? _info;

  @override
  void initState() {
    super.initState();
    if (widget.autoResend) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _resend(silent: true),
      );
    } else {
      _startCooldown(_cooldownSeconds);
    }
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
        .verifySignupCode(email: widget.email, code: code);
    if (!mounted) return;
    // On success the auth stream fires and the router moves on; nothing to do.
    setState(() {
      _busy = false;
      _error = error;
    });
  }

  Future<void> _resend({bool silent = false}) async {
    if (_busy || _cooldown > 0) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final error = await ref
        .read(authControllerProvider.notifier)
        .resendConfirmation(widget.email);
    if (!mounted) return;
    final wait = RegExp(r'after (\d+) seconds?').firstMatch(error ?? '');
    setState(() {
      _busy = false;
      if (error == null) {
        _info =
            'We sent a new code to ${widget.email}. The previous code no longer works.';
      } else if (wait != null) {
        _info = null;
        _error = silent
            ? null
            : 'Please wait ${wait.group(1)} seconds before requesting another code.';
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
      appBar: AppBar(
        leading: BackButton(
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/auth'),
        ),
      ),
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
                    'Check your email',
                    textAlign: TextAlign.center,
                    style: ChosenoTypography.display(
                      color: palette.textMain,
                      fontSize: 26,
                    ),
                  ),
                  const SizedBox(height: ChosenoSpacing.sm),
                  Text(
                    'We sent a confirmation email to ${widget.email}. Tap the button in it to finish in the app, or enter the code below.',
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
                    label: 'Confirm email',
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
                    label: 'Wrong email? Start over',
                    variant: AppButtonVariant.text,
                    tone: AppButtonTone.defaultTone,
                    onPressed: () =>
                        context.canPop() ? context.pop() : context.go('/auth'),
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
