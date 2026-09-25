// Screen E from docs/FLUTTER_MOBILE_APP_GUIDE.md §4.E (parent repo) — own
// account settings, read-only summary + a link into Edit. Not yet ported:
// avatar display/upload, rotation-history line ("Rotated N times, last on
// <date>" — that history isn't tracked by any RPC ported so far), and the
// Admin locked-message branch (irrelevant — this app has no Admin role).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/haptics.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/profile/entities/user_profile.dart';
import '../../../common/widgets/app_shell.dart';
import '../../../common/widgets/screen_header.dart';
import '../../auth/providers/auth_providers.dart';
import '../providers/profile_providers.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _confirmBurn(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Burn your identity?'),
        content: const Text(
          'This locks in your current score, then gives you a brand new anonymous Ghost ID. '
          'Every past post and comment stays attached to the old one, permanently — there is no undo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              AppHaptics.destructiveConfirm();
              Navigator.of(context).pop(true);
            },
            child: const Text('Burn identity'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(burnIdentityControllerProvider.notifier).call();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final profileAsync = ref.watch(ownProfileProvider);
    final membershipsAsync = ref.watch(userBoundaryMembershipsProvider);

    return Scaffold(
      body: SafeArea(
        child: profileAsync.when(
          data: (profile) {
            if (profile == null) return const SizedBox.shrink();
            final isPolitician = profile.role == UserRole.politician;
            return Column(
              children: [
                ScreenHeader(
                  title: 'Profile',
                  actions: [
                    HeaderIconButton(
                      icon: Icons.edit_rounded,
                      tooltip: 'Edit profile',
                      onTap: () => context.push(AppRoutes.profileEdit),
                    ),
                  ],
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(
                      ChosenoSpacing.lg,
                      ChosenoSpacing.md,
                      ChosenoSpacing.lg,
                      kBottomNavClearance + ChosenoSpacing.lg,
                    ),
                    children: [
                      AppCard(
                        variant: AppCardVariant.hero,
                        padding: const EdgeInsets.all(ChosenoSpacing.lg),
                        child: Column(
                          children: [
                            AppAvatar(
                              imageUrl: profile.politicianAvatarUrl,
                              fallbackText: profile.fullName,
                              fallbackIcon: Icons.person_outline,
                              radius: 44,
                            ),
                            const SizedBox(height: ChosenoSpacing.md),
                            Text(
                              profile.fullName?.isNotEmpty == true
                                  ? profile.fullName!
                                  : 'Anonymous',
                              textAlign: TextAlign.center,
                              style: ChosenoTypography.display(
                                color: palette.textMain,
                                fontSize: 30,
                              ),
                            ),
                            const SizedBox(height: ChosenoSpacing.sm),
                            AppBadge(
                              label: isPolitician ? 'Politician' : 'Citizen',
                              tone: AppBadgeTone.primary,
                            ),
                            const SizedBox(height: ChosenoSpacing.lg),
                            Divider(color: palette.borderLight),
                            const SizedBox(height: ChosenoSpacing.md),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                'YOUR DISTRICTS',
                                style: ChosenoTypography.body(
                                  color: palette.textTertiary,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 11,
                                ).copyWith(letterSpacing: 0.8),
                              ),
                            ),
                            const SizedBox(height: ChosenoSpacing.sm),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: membershipsAsync.when(
                                data: (memberships) => memberships.isEmpty
                                    ? Text(
                                        'No boundaries on file yet.',
                                        style: ChosenoTypography.body(
                                          color: palette.textMuted,
                                          fontSize: 13,
                                        ),
                                      )
                                    : Wrap(
                                        spacing: ChosenoSpacing.sm,
                                        runSpacing: ChosenoSpacing.sm,
                                        children: memberships
                                            .map(
                                              (m) => AppBadge(
                                                label: m.name,
                                                tone: AppBadgeTone.neutral,
                                              ),
                                            )
                                            .toList(),
                                      ),
                                loading: () => const LoadingIndicator(size: 16),
                                error: (_, _) => const SizedBox.shrink(),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: ChosenoSpacing.lg),
                      if (isPolitician) ...[
                        AppCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Political details',
                                style: ChosenoTypography.display(
                                  color: palette.textMain,
                                  fontSize: 22,
                                ),
                              ),
                              const SizedBox(height: ChosenoSpacing.md),
                              if (profile.myWallSlug != null) ...[
                                AppButton(
                                  label: 'View my wall',
                                  icon: Icons.account_circle_outlined,
                                  onPressed: () => context.push(
                                    AppRoutes.wall(profile.myWallSlug!),
                                  ),
                                ),
                                const SizedBox(height: ChosenoSpacing.sm + 2),
                              ],
                              AppButton(
                                label: 'My elections',
                                icon: Icons.how_to_vote_outlined,
                                variant: AppButtonVariant.outline,
                                onPressed: () =>
                                    context.push(AppRoutes.myElections),
                              ),
                              const SizedBox(height: ChosenoSpacing.sm + 2),
                              AppButton(
                                label: 'Switch to citizen account',
                                variant: AppButtonVariant.text,
                                onPressed: () => ref
                                    .read(switchRoleControllerProvider.notifier)
                                    .switchTo(UserRole.normal),
                              ),
                            ],
                          ),
                        ),
                      ] else ...[
                        AppCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Privacy & Ghost ID',
                                style: ChosenoTypography.display(
                                  color: palette.textMain,
                                  fontSize: 22,
                                ),
                              ),
                              const SizedBox(height: ChosenoSpacing.md),
                              if (profile.currentGhostId != null)
                                Text(
                                  'Ghost ${profile.currentGhostId!.substring(0, 8)}',
                                  style: ChosenoTypography.body(
                                    color: palette.textTertiary,
                                    fontSize: 14,
                                  ),
                                ),
                              const SizedBox(height: ChosenoSpacing.sm),
                              Consumer(
                                builder: (context, ref, _) {
                                  final scoreAsync = ref.watch(
                                    civicScoreProvider,
                                  );
                                  return scoreAsync.when(
                                    data: (score) => Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          '$score',
                                          style: ChosenoTypography.display(
                                            color: palette.primary,
                                            fontSize: 40,
                                          ),
                                        ),
                                        const SizedBox(
                                          width: ChosenoSpacing.sm,
                                        ),
                                        Padding(
                                          padding: const EdgeInsets.only(
                                            bottom: 8,
                                          ),
                                          child: Text(
                                            'civic impact score',
                                            style: ChosenoTypography.body(
                                              color: palette.textMuted,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    loading: () =>
                                        const LoadingIndicator(size: 16),
                                    error: (_, _) => Text(
                                      'Could not load score.',
                                      style: ChosenoTypography.body(
                                        color: palette.danger,
                                        fontSize: 12,
                                      ),
                                    ),
                                  );
                                },
                              ),
                              const SizedBox(height: ChosenoSpacing.md),
                              AppButton(
                                label: 'Rotate Ghost ID',
                                variant: AppButtonVariant.outline,
                                tone: AppButtonTone.danger,
                                onPressed: () => _confirmBurn(context, ref),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: ChosenoSpacing.lg),
                      AppButton(
                        label: 'Sign out',
                        variant: AppButtonVariant.outline,
                        tone: AppButtonTone.danger,
                        onPressed: () =>
                            ref.read(authControllerProvider.notifier).signOut(),
                      ),
                      const SizedBox(height: ChosenoSpacing.xl),
                      Wrap(
                        alignment: WrapAlignment.center,
                        spacing: ChosenoSpacing.lg,
                        runSpacing: ChosenoSpacing.sm,
                        children: [
                          _LegalLink(label: 'About', route: AppRoutes.about),
                          _LegalLink(
                            label: 'Privacy',
                            route: AppRoutes.privacy,
                          ),
                          _LegalLink(label: 'Terms', route: AppRoutes.terms),
                          _LegalLink(
                            label: 'Corrections',
                            route: AppRoutes.correctionsPolicy,
                          ),
                          _LegalLink(
                            label: 'Editorial Standards',
                            route: AppRoutes.editorialStandards,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
          loading: () => const Center(child: LoadingIndicator()),
          error: (error, _) => Center(
            child: EmptyState(
              icon: Icons.error_outline,
              title: 'Could not load your profile',
              message: '$error',
            ),
          ),
        ),
      ),
    );
  }
}

class _LegalLink extends StatelessWidget {
  const _LegalLink({required this.label, required this.route});

  final String label;
  final String route;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return InkWell(
      onTap: () => context.push(route),
      child: Text(
        label,
        style: ChosenoTypography.body(
          color: palette.textMuted,
          fontSize: 12,
        ).copyWith(decoration: TextDecoration.underline),
      ),
    );
  }
}
