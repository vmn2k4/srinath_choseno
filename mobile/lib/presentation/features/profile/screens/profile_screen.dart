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
                      _Hero(
                        profile: profile,
                        isPolitician: isPolitician,
                        districts:
                            membershipsAsync.value
                                ?.map((m) => m.name)
                                .toSet()
                                .toList() ??
                            const [],
                        loadingDistricts: membershipsAsync.isLoading,
                      ),
                      const SizedBox(height: ChosenoSpacing.sm + 2),
                      IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Expanded(
                              child: _StatTile(
                                icon: Icons.insights_rounded,
                                label: 'Civic impact',
                                child: Consumer(
                                  builder: (context, ref, _) => ref
                                      .watch(civicScoreProvider)
                                      .when(
                                        data: (score) => Text(
                                          '$score',
                                          style: ChosenoTypography.display(
                                            color: palette.textMain,
                                            fontSize: 26,
                                          ),
                                        ),
                                        loading: () =>
                                            const LoadingIndicator(size: 16),
                                        error: (_, _) => Text(
                                          '—',
                                          style: ChosenoTypography.display(
                                            color: palette.textMuted,
                                            fontSize: 26,
                                          ),
                                        ),
                                      ),
                                ),
                              ),
                            ),
                            const SizedBox(width: ChosenoSpacing.sm),
                            Expanded(
                              child: _StatTile(
                                icon: Icons.visibility_off_outlined,
                                label: 'Ghost ID',
                                trailing: isPolitician
                                    ? null
                                    : GestureDetector(
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
                                      ? profile.currentGhostId!.substring(0, 8)
                                      : '—',
                                  style: ChosenoTypography.body(
                                    color: palette.textMain,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 18,
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
                      _SettingsList(
                        rows: [
                          if (isPolitician) ...[
                            if (profile.myWallSlug != null)
                              _SettingsRow(
                                icon: Icons.account_circle_outlined,
                                label: 'My wall',
                                onTap: () => context.push(
                                  AppRoutes.wall(profile.myWallSlug!),
                                ),
                              ),
                            _SettingsRow(
                              icon: Icons.how_to_vote_outlined,
                              label: 'My elections',
                              onTap: () => context.push(AppRoutes.myElections),
                            ),
                          ],
                          _SettingsRow(
                            icon: Icons.info_outline_rounded,
                            label: 'About Choseno',
                            onTap: () => context.push(AppRoutes.about),
                          ),
                          _SettingsRow(
                            icon: Icons.lock_outline_rounded,
                            label: 'Privacy',
                            onTap: () => context.push(AppRoutes.privacy),
                          ),
                          _SettingsRow(
                            icon: Icons.description_outlined,
                            label: 'Terms',
                            onTap: () => context.push(AppRoutes.terms),
                          ),
                          _SettingsRow(
                            icon: Icons.fact_check_outlined,
                            label: 'Corrections and standards',
                            onTap: () =>
                                context.push(AppRoutes.editorialStandards),
                          ),
                        ],
                      ),
                      const SizedBox(height: ChosenoSpacing.sm),
                      Center(
                        child: TextButton.icon(
                          onPressed: () => ref
                              .read(authControllerProvider.notifier)
                              .signOut(),
                          icon: Icon(
                            Icons.logout_rounded,
                            size: 18,
                            color: palette.danger,
                          ),
                          label: Text(
                            'Sign out',
                            style: ChosenoTypography.body(
                              color: palette.danger,
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                            ),
                          ),
                        ),
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

/// Top card: a soft brand-tinted banner, a ringed avatar, the name and role,
/// the districts as a few chips, and an Edit button.
class _Hero extends StatelessWidget {
  const _Hero({
    required this.profile,
    required this.isPolitician,
    required this.districts,
    required this.loadingDistricts,
  });

  final UserProfile profile;
  final bool isPolitician;
  final List<String> districts;
  final bool loadingDistricts;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final name = profile.fullName?.isNotEmpty == true
        ? profile.fullName!
        : 'Anonymous';
    const maxChips = 1;
    final shown = districts.take(maxChips).toList();
    final extra = districts.length - shown.length;

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(ChosenoRadii.card),
        border: Border.all(color: palette.borderLight),
      ),
      child: Column(
        children: [
          // Banner (a quiet brand tint — flat, no gradient) with the avatar
          // overlapping its lower edge.
          SizedBox(
            height: 70,
            child: Stack(
              alignment: Alignment.topCenter,
              children: [
                Container(
                  height: 40,
                  color: palette.primary.withValues(alpha: 0.08),
                ),
                Positioned(
                  top: 12,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: palette.surface,
                      shape: BoxShape.circle,
                      border: Border.all(color: palette.borderLight),
                    ),
                    child: AppAvatar(
                      imageUrl: profile.politicianAvatarUrl,
                      fallbackText: name,
                      fallbackIcon: Icons.person_outline,
                      radius: 26,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Column(
            children: [
              const SizedBox(height: 4),
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: ChosenoTypography.display(
                  color: palette.textMain,
                  fontSize: 24,
                ),
              ),
              const SizedBox(height: 6),
              AppBadge(
                label: isPolitician ? 'Politician' : 'Citizen',
                tone: AppBadgeTone.primary,
                size: AppBadgeSize.xs,
              ),
              const SizedBox(height: ChosenoSpacing.sm + 2),
              if (loadingDistricts)
                const LoadingIndicator(size: 16)
              else if (districts.isEmpty)
                Text(
                  'No location set yet',
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontSize: 13,
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ChosenoSpacing.md,
                  ),
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    spacing: ChosenoSpacing.xs + 2,
                    runSpacing: ChosenoSpacing.xs + 2,
                    children: [
                      for (final d in shown)
                        _Chip(icon: Icons.place_outlined, label: d),
                      if (extra > 0)
                        _Chip(label: '+$extra more', emphasized: true),
                    ],
                  ),
                ),
              const SizedBox(height: ChosenoSpacing.md),
            ],
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, this.icon, this.emphasized = false});

  final String label;
  final IconData? icon;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: emphasized
            ? palette.primary.withValues(alpha: 0.10)
            : palette.surfaceHover,
        borderRadius: BorderRadius.circular(ChosenoRadii.full),
        border: Border.all(
          color: emphasized
              ? palette.primary.withValues(alpha: 0.25)
              : palette.borderLight,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: palette.primary),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: ChosenoTypography.body(
                color: emphasized ? palette.primary : palette.textSecondary,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// An icon-led stat: tinted icon tile, small caps label, big value.
class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.label,
    required this.child,
    this.trailing,
  });

  final IconData icon;
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
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: palette.primary.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: palette.primary),
              ),
              const SizedBox(width: ChosenoSpacing.sm),
              Expanded(
                child: Text(
                  label,
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: ChosenoSpacing.sm),
          child,
        ],
      ),
    );
  }
}

class _SettingsRow {
  const _SettingsRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
}

/// A grouped list: one bordered card, hairline dividers, icon + label +
/// chevron per row — the standard native settings pattern.
class _SettingsList extends StatelessWidget {
  const _SettingsList({required this.rows});

  final List<_SettingsRow> rows;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(ChosenoRadii.card),
        border: Border.all(color: palette.borderLight),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            InkWell(
              onTap: rows[i].onTap,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: ChosenoSpacing.md,
                  vertical: ChosenoSpacing.sm + 1,
                ),
                child: Row(
                  children: [
                    Icon(rows[i].icon, size: 20, color: palette.textMuted),
                    const SizedBox(width: ChosenoSpacing.md),
                    Expanded(
                      child: Text(
                        rows[i].label,
                        style: ChosenoTypography.body(
                          color: palette.textMain,
                          fontWeight: FontWeight.w500,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 20,
                      color: palette.textDark,
                    ),
                  ],
                ),
              ),
            ),
            if (i < rows.length - 1)
              Divider(
                height: 1,
                indent: ChosenoSpacing.md + 20 + ChosenoSpacing.md,
                color: palette.borderLight,
              ),
          ],
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
