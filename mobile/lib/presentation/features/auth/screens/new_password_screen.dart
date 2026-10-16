// Password reset, step 3: choose the new password. Reached automatically once
// a reset code/link is accepted (the router holds the person here while
// passwordRecoveryPendingProvider is true). Mirrors the website's
// /auth/reset-password.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../providers/auth_providers.dart';

class NewPasswordScreen extends ConsumerStatefulWidget {
  const NewPasswordScreen({super.key});

  @override
  ConsumerState<NewPasswordScreen> createState() => _NewPasswordScreenState();
}

class _NewPasswordScreenState extends ConsumerState<NewPasswordScreen> {
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_busy) return;
    if (_password.text.length < 6) {
      setState(() => _error = 'Use at least 6 characters.');
      return;
    }
    if (_password.text != _confirm.text) {
      setState(() => _error = "The two passwords don't match.");
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final error = await ref
        .read(authControllerProvider.notifier)
        .setNewPassword(_password.text);
    if (!mounted) return;
    // On success the router leaves this screen on its own.
    setState(() {
      _busy = false;
      _error = error;
    });
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return PopScope(
      // No way back to the form with a half-finished reset; Cancel signs out.
      canPop: false,
      child: Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(
                horizontal: ChosenoSpacing.lg + 4,
                vertical: ChosenoSpacing.xl,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(
                      Icons.lock_open_outlined,
                      size: 48,
                      color: palette.primary,
                    ),
                    const SizedBox(height: ChosenoSpacing.md),
                    Text(
                      'Choose a new password',
                      textAlign: TextAlign.center,
                      style: ChosenoTypography.display(
                        color: palette.textMain,
                        fontSize: 26,
                      ),
                    ),
                    const SizedBox(height: ChosenoSpacing.sm),
                    Text(
                      "Code accepted. Pick a new password — you'll be signed in right after.",
                      textAlign: TextAlign.center,
                      style: ChosenoTypography.body(
                        color: palette.textMuted,
                        fontSize: 14,
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: ChosenoSpacing.lg),
                    AppTextField(
                      label: 'New password',
                      controller: _password,
                      obscureText: true,
                      autofillHints: const [AutofillHints.newPassword],
                      onChanged: (_) => setState(() => _error = null),
                    ),
                    const SizedBox(height: ChosenoSpacing.md),
                    AppTextField(
                      label: 'Confirm new password',
                      controller: _confirm,
                      obscureText: true,
                      autofillHints: const [AutofillHints.newPassword],
                      onChanged: (_) => setState(() => _error = null),
                    ),
                    const SizedBox(height: ChosenoSpacing.md),
                    AppButton(
                      label: 'Update password',
                      loading: _busy,
                      onPressed: _busy ? null : _save,
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
                      label: 'Cancel',
                      variant: AppButtonVariant.text,
                      tone: AppButtonTone.defaultTone,
                      onPressed: _busy
                          ? null
                          : () => ref
                                .read(authControllerProvider.notifier)
                                .cancelPasswordReset(),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
