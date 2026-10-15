// Screen E from docs/FLUTTER_MOBILE_APP_GUIDE.md §4.E (parent repo) — own
// account settings, read-only summary + a link into Edit. Not yet ported:
// avatar display/upload, rotation-history line ("Rotated N times, last on
// <date>" — that history isn't tracked by any RPC ported so far), and the
// Admin locked-message branch (irrelevant — this app has no Admin role).
import '../../../../core/errors/app_failure.dart';
import '../../../../core/theme/theme_controller.dart';
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

    // A failed role switch used to fail silently — say why.
    ref.listen(switchRoleControllerProvider, (_, next) {
      if (next is AsyncError) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Text(
                "Couldn't switch account type: ${next.error is AppFailure ? (next.error as AppFailure).message : next.error}",
              ),
            ),
          );
      }
    });

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
                      ChosenoSpacing.sm,
                      ChosenoSpacing.lg,
                      kBottomNavClearance + ChosenoSpacing.md,
                    ),
                    children: [
                      // Identity: photo, name, role — one row.
                      AppCard(
                        padding: const EdgeInsets.all(ChosenoSpacing.md),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                AppAvatar(
                                  imageUrl: profile.politicianAvatarUrl,
                                  fallbackText: profile.fullName,
                                  fallbackIcon: Icons.person_outline,
                                  radius: 28,
                                ),
                                const SizedBox(width: ChosenoSpacing.md),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        profile.fullName?.isNotEmpty == true
                                            ? profile.fullName!
                                            : 'Anonymous',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: ChosenoTypography.display(
                                          color: palette.textMain,
                                          fontSize: 22,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      AppBadge(
                                        label: isPolitician
                                            ? 'Politician'
                                            : 'Citizen',
                                        tone: AppBadgeTone.primary,
                                        size: AppBadgeSize.xs,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: ChosenoSpacing.sm + 2),
                            // Districts as one tidy line, not a wall of chips.
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(
                                  Icons.place_outlined,
                                  size: 16,
                                  color: palette.textMuted,
                                ),
                                const SizedBox(width: ChosenoSpacing.xs + 2),
                                Expanded(
                                  child: membershipsAsync.when(
                                    data: (memberships) {
                                      final names = memberships
                                          .map((m) => m.name)
                                          .toSet()
                                          .toList();
                                      return Text(
                                        names.isEmpty
                                            ? 'No location set yet'
                                            : names.join(' · '),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: ChosenoTypography.body(
                                          color: palette.textMuted,
                                          fontSize: 13,
                                          height: 1.35,
                                        ),
                                      );
                                    },
                                    loading: () => const SizedBox(
                                      height: 16,
                                      child: LoadingIndicator(size: 14),
                                    ),
                                    error: (_, _) => const SizedBox.shrink(),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: ChosenoSpacing.sm + 2),
                      if (isPolitician)
                        Row(
                          children: [
                            if (profile.myWallSlug != null) ...[
                              Expanded(
                                child: AppButton(
                                  label: 'My wall',
                                  icon: Icons.account_circle_outlined,
                                  onPressed: () => context.push(
                                    AppRoutes.wall(profile.myWallSlug!),
                                  ),
                                ),
                              ),
                              const SizedBox(width: ChosenoSpacing.sm),
                            ],
                            Expanded(
                              child: AppButton(
                                label: 'My elections',
                                icon: Icons.how_to_vote_outlined,
                                variant: AppButtonVariant.outline,
                                onPressed: () =>
                                    context.push(AppRoutes.myElections),
                              ),
                            ),
                          ],
                        )
                      else
                        // Score and anonymous identity side by side.
                        IntrinsicHeight(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(
                                child: _StatTile(
                                  label: 'Civic impact',
                                  child: Consumer(
                                    builder: (context, ref, _) => ref
                                        .watch(civicScoreProvider)
                                        .when(
                                          data: (score) => Text(
                                            '$score',
                                            style: ChosenoTypography.display(
                                              color: palette.primary,
                                              fontSize: 28,
                                            ),
                                          ),
                                          loading: () =>
                                              const LoadingIndicator(size: 16),
                                          error: (_, _) => Text(
                                            '—',
                                            style: ChosenoTypography.display(
                                              color: palette.textMuted,
                                              fontSize: 28,
                                            ),
                                          ),
                                        ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: ChosenoSpacing.sm),
                              Expanded(
                                child: _StatTile(
                                  label: 'Ghost ID',
                                  trailing: GestureDetector(
                                    onTap: () => _confirmBurn(context, ref),
                                    child: Text(
                                      'Rotate',
                                      style: ChosenoTypography.body(
                                        color: palette.danger,
                                        fontWeight: FontWeight.w600,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                  child: Text(
                                    profile.currentGhostId != null
                                        ? profile.currentGhostId!.substring(
                                            0,
                                            8,
                                          )
                                        : '—',
                                    style: ChosenoTypography.body(
                                      color: palette.textMain,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 16,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      const SizedBox(height: ChosenoSpacing.sm + 2),
                      const _AppearanceCard(),
                      const SizedBox(height: ChosenoSpacing.sm + 2),
                      AppButton(
                        label: 'Sign out',
                        icon: Icons.logout_rounded,
                        variant: AppButtonVariant.outline,
                        tone: AppButtonTone.danger,
                        onPressed: () =>
                            ref.read(authControllerProvider.notifier).signOut(),
                      ),
                      const SizedBox(height: ChosenoSpacing.sm),
                      Wrap(
                        alignment: WrapAlignment.center,
                        spacing: ChosenoSpacing.md,
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
                            label: 'Standards',
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

/// A small labelled tile: label on top, a value below, optional action.
class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.child, this.trailing});

  final String label;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return AppCard(
      padding: const EdgeInsets.all(ChosenoSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontWeight: FontWeight.w600,
                    fontSize: 11,
                  ).copyWith(letterSpacing: 0.6),
                ),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: 4),
          child,
        ],
      ),
    );
  }
}

/// Appearance picker — one row: label plus a chip per theme. Persisted by
/// [ThemeController].
class _AppearanceCard extends ConsumerWidget {
  const _AppearanceCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final current = ref.watch(themeControllerProvider);
    return AppCard(
      padding: const EdgeInsets.symmetric(
        horizontal: ChosenoSpacing.md,
        vertical: ChosenoSpacing.sm + 2,
      ),
      child: Row(
        children: [
          Icon(Icons.palette_outlined, size: 18, color: palette.textMuted),
          const SizedBox(width: ChosenoSpacing.sm),
          // Three equal segments — always fits, whatever the label widths.
          for (final t in AppThemeChoice.values)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(left: ChosenoSpacing.xs),
                child: ChoiceChip(
                  visualDensity: VisualDensity.compact,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  padding: EdgeInsets.zero,
                  labelPadding: const EdgeInsets.symmetric(horizontal: 4),
                  avatar: CircleAvatar(
                    backgroundColor: t.palette.primary,
                    radius: 5,
                  ),
                  label: Text(t.shortLabel, overflow: TextOverflow.ellipsis),
                  selected: current == t,
                  onSelected: (_) =>
                      ref.read(themeControllerProvider.notifier).select(t),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
