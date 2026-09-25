// Step 1 of 3/4 — advances immediately on tap, no confirm button (matches
// docs/FLUTTER_MOBILE_APP_GUIDE.md §4.C's spec exactly). Built as a shared
// widget under onboarding/widgets/ (not inline in the screen) specifically
// so Edit Profile's Basic Info step can reuse it later without
// duplicating — see the parent repo's Flutter guide note that Onboarding
// and Edit Profile "must call the exact same upsert functions... build
// these as genuinely shared widgets."
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/profile/entities/user_profile.dart';

class StepRole extends StatelessWidget {
  const StepRole({super.key, required this.selected, required this.onSelect});

  final UserRole selected;
  final ValueChanged<UserRole> onSelect;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Who are you joining as?',
          style: ChosenoTypography.display(
            color: palette.textMain,
            fontSize: 34,
          ),
        ),
        const SizedBox(height: ChosenoSpacing.sm),
        Text(
          'You can change this later from your profile.',
          style: ChosenoTypography.body(color: palette.textMuted, fontSize: 14),
        ),
        const SizedBox(height: ChosenoSpacing.xl),
        _RoleCard(
          icon: Icons.groups_2_outlined,
          title: 'Citizen',
          description:
              'Follow local elections, post anonymously under a Ghost ID, and rate your representatives.',
          selected: selected == UserRole.normal,
          onTap: () => onSelect(UserRole.normal),
        ),
        const SizedBox(height: ChosenoSpacing.md),
        _RoleCard(
          icon: Icons.flag_outlined,
          title: 'Politician',
          description:
              'Run for office, publish a public campaign wall, and answer your community\'s questions.',
          selected: selected == UserRole.politician,
          onTap: () => onSelect(UserRole.politician),
        ),
      ],
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String description;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return AppCard(
      variant: AppCardVariant.row,
      onTap: onTap,
      padding: const EdgeInsets.all(ChosenoSpacing.lg),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: palette.primary.withValues(alpha: selected ? 0.22 : 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: palette.primary, size: 26),
          ),
          const SizedBox(width: ChosenoSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: ChosenoTypography.body(
                    color: palette.textMain,
                    fontWeight: FontWeight.w700,
                    fontSize: 17,
                  ),
                ),
                const SizedBox(height: ChosenoSpacing.xs),
                Text(
                  description,
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: ChosenoSpacing.sm),
          Icon(
            selected ? Icons.check_circle : Icons.radio_button_unchecked,
            color: selected ? palette.primary : palette.textMuted,
          ),
        ],
      ),
    );
  }
}
