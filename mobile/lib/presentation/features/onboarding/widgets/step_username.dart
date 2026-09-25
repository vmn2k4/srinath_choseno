// Step 3 — Citizen: optional display name + a plain-language Ghost ID
// explainer. Politician: required public full name. Same widget renders
// both, branching on role, matching the website's StepUsername.
//
// StatefulWidget so the TextEditingController persists across rebuilds —
// constructing a fresh controller from `fullName` on every build (as a
// stateless first draft of this file did) resets the cursor/selection on
// every keystroke's resulting rebuild, which is a real, easy-to-miss bug,
// not just a style preference.
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/profile/entities/user_profile.dart';

class StepUsername extends StatefulWidget {
  const StepUsername({
    super.key,
    required this.role,
    required this.fullName,
    required this.onChanged,
  });

  final UserRole role;
  final String fullName;
  final ValueChanged<String> onChanged;

  @override
  State<StepUsername> createState() => _StepUsernameState();
}

class _StepUsernameState extends State<StepUsername> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.fullName,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final isPolitician = widget.role == UserRole.politician;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          isPolitician ? 'Your public name' : 'Pick a display name',
          style: ChosenoTypography.display(
            color: palette.textMain,
            fontSize: 32,
          ),
        ),
        const SizedBox(height: ChosenoSpacing.sm),
        Text(
          isPolitician
              ? 'This will appear on your public campaign Wall — use your real name.'
              : 'Optional. Everything you post is still tied to an anonymous, rotating Ghost ID, not your name.',
          style: ChosenoTypography.body(
            color: palette.textMuted,
            fontSize: 14,
            height: 1.45,
          ),
        ),
        const SizedBox(height: ChosenoSpacing.xl),
        AppTextField(
          label: isPolitician ? 'Full name' : 'Display name (optional)',
          controller: _controller,
          onChanged: widget.onChanged,
        ),
        if (!isPolitician) ...[
          const SizedBox(height: ChosenoSpacing.lg),
          AppCard(
            variant: AppCardVariant.dashed,
            child: Text(
              'What\'s a Ghost ID? Every post and comment you make is signed with a rotating anonymous '
              'identifier, never your real name. You can burn it at any time from Profile to start fresh.',
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
