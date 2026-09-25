// Screen F from docs/FLUTTER_MOBILE_APP_GUIDE.md §4.F (parent repo) —
// Politician only. See my_elections_providers.dart's header comment for
// what's not yet ported.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/haptics.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/election_seat_summary.dart';
import '../../../../domain/elections/entities/my_candidacy.dart';
import '../../../../domain/elections/entities/my_election_admin_application.dart';
import '../providers/my_elections_providers.dart';

AppBadgeTone _statusTone(String status) => switch (status) {
  'approved' => AppBadgeTone.success,
  'rejected' => AppBadgeTone.danger,
  'pending' => AppBadgeTone.warning,
  _ => AppBadgeTone.neutral,
};

class MyElectionsScreen extends ConsumerWidget {
  const MyElectionsScreen({super.key});

  Future<void> _confirmWithdraw(
    BuildContext context,
    WidgetRef ref,
    MyCandidacy candidacy,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Withdraw this candidacy?'),
        content: Text(
          'You\'ll no longer be listed as a candidate for ${candidacy.roleTitle ?? 'this seat'}.',
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
            child: const Text('Withdraw'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(myElectionsActionsProvider).withdraw(candidacy.id);
    }
  }

  Future<void> _apply(
    BuildContext context,
    WidgetRef ref,
    String seatId,
  ) async {
    AppHaptics.tap();
    final success = await ref
        .read(myElectionsActionsProvider)
        .applyForSeat(seatId);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          success
              ? 'Application submitted.'
              : 'Could not apply — nominations may be closed.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final candidaciesAsync = ref.watch(myCandidaciesProvider);
    final openSeatsAsync = ref.watch(openSeatsNearYouProvider);
    final adminApplicationsAsync = ref.watch(
      myElectionAdminApplicationsProvider,
    );

    return Scaffold(
      appBar: AppBar(title: const Text('My Elections')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myCandidaciesProvider);
          ref.invalidate(openSeatsNearYouProvider);
          ref.invalidate(myElectionAdminApplicationsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            ChosenoSpacing.lg,
            ChosenoSpacing.sm,
            ChosenoSpacing.lg,
            ChosenoSpacing.xxl,
          ),
          children: [
            const SectionHeader(
              icon: Icons.flag_outlined,
              title: 'My candidacies',
              subtitle: 'Seats you have applied for.',
            ),
            const SizedBox(height: ChosenoSpacing.md),
            candidaciesAsync.when(
              data: (candidacies) => candidacies.isEmpty
                  ? const EmptyState(
                      icon: Icons.flag_outlined,
                      title: 'No candidacies yet',
                      message:
                          'Apply for an open seat below to start your campaign page.',
                    )
                  : Column(
                      children: candidacies
                          .map(
                            (c) => Padding(
                              padding: const EdgeInsets.only(
                                bottom: ChosenoSpacing.sm,
                              ),
                              child: AppCard(
                                variant: AppCardVariant.row,
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text(
                                            c.roleTitle ?? 'Candidacy',
                                            style: ChosenoTypography.body(
                                              color: palette.textMain,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          if (c.boundaryName != null)
                                            Text(
                                              c.boundaryName!,
                                              style: ChosenoTypography.body(
                                                color: palette.textMuted,
                                                fontSize: 12,
                                              ),
                                            ),
                                          const SizedBox(
                                            height: ChosenoSpacing.xs,
                                          ),
                                          AppBadge(
                                            label: c.status,
                                            tone: _statusTone(c.status),
                                            size: AppBadgeSize.xs,
                                          ),
                                        ],
                                      ),
                                    ),
                                    AppButton.icon(
                                      icon: Icons.edit_outlined,
                                      onPressed: () => context.push(
                                        AppRoutes.candidateApplication(c.id),
                                      ),
                                    ),
                                    AppButton.icon(
                                      icon: Icons.close,
                                      tone: AppButtonTone.danger,
                                      onPressed: () =>
                                          _confirmWithdraw(context, ref, c),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
              loading: () => const Padding(
                padding: EdgeInsets.all(ChosenoSpacing.lg),
                child: Center(child: LoadingIndicator()),
              ),
              error: (_, _) => Text(
                'Could not load your candidacies.',
                style: ChosenoTypography.body(color: palette.danger),
              ),
            ),
            const SizedBox(height: ChosenoSpacing.xl),
            const SectionHeader(
              icon: Icons.near_me_outlined,
              title: 'Open seats near you',
              subtitle: 'Nominations open in your districts.',
            ),
            const SizedBox(height: ChosenoSpacing.md),
            openSeatsAsync.when(
              data: (seats) => seats.isEmpty
                  ? const EmptyState(
                      icon: Icons.event_busy_outlined,
                      title: 'No open seats',
                      message:
                          'There are no seats open for nomination in your districts right now.',
                    )
                  : Column(
                      children: seats
                          .map(
                            (s) => _OpenSeatRow(
                              seat: s,
                              onApply: () => _apply(context, ref, s.id),
                            ),
                          )
                          .toList(),
                    ),
              loading: () => const Padding(
                padding: EdgeInsets.all(ChosenoSpacing.lg),
                child: Center(child: LoadingIndicator()),
              ),
              error: (_, _) => Text(
                'Could not load open seats.',
                style: ChosenoTypography.body(color: palette.danger),
              ),
            ),
            const SizedBox(height: ChosenoSpacing.xl),
            const SectionHeader(
              icon: Icons.shield_outlined,
              title: 'Admin applications',
              subtitle: 'Seats you volunteered to administer.',
            ),
            const SizedBox(height: ChosenoSpacing.md),
            adminApplicationsAsync.when(
              data: (applications) => applications.isEmpty
                  ? const EmptyState(
                      icon: Icons.shield_outlined,
                      title: 'No applications yet',
                      message:
                          "Volunteer to administer a seat from its detail page.",
                    )
                  : Column(
                      children: applications
                          .map((a) => _AdminApplicationRow(application: a))
                          .toList(),
                    ),
              loading: () => const Padding(
                padding: EdgeInsets.all(ChosenoSpacing.lg),
                child: Center(child: LoadingIndicator()),
              ),
              error: (_, _) => Text(
                'Could not load your admin applications.',
                style: ChosenoTypography.body(color: palette.danger),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OpenSeatRow extends StatelessWidget {
  const _OpenSeatRow({required this.seat, required this.onApply});

  final ElectionSeatSummary seat;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: ChosenoSpacing.sm + 2),
      child: AppCard(
        variant: AppCardVariant.row,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    seat.roleTitle,
                    style: ChosenoTypography.body(
                      color: palette.textMain,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (seat.boundaryName != null)
                    Text(
                      seat.boundaryName!,
                      style: ChosenoTypography.body(
                        color: palette.textMuted,
                        fontSize: 12,
                      ),
                    ),
                ],
              ),
            ),
            AppButton(label: 'Apply', onPressed: onApply),
          ],
        ),
      ),
    );
  }
}

class _AdminApplicationRow extends StatelessWidget {
  const _AdminApplicationRow({required this.application});

  final MyElectionAdminApplication application;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: ChosenoSpacing.sm + 2),
      child: AppCard(
        variant: AppCardVariant.row,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              application.roleTitle ?? 'Seat Administrator',
              style: ChosenoTypography.body(
                color: palette.textMain,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (application.boundaryName != null)
              Text(
                application.boundaryName!,
                style: ChosenoTypography.body(
                  color: palette.textMuted,
                  fontSize: 12,
                ),
              ),
            const SizedBox(height: ChosenoSpacing.xs),
            AppBadge(
              label: application.status,
              tone: _statusTone(application.status),
              size: AppBadgeSize.xs,
            ),
          ],
        ),
      ),
    );
  }
}
