// Screen A.5 from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo) — the
// mobile port of ElectionsPageClient.tsx. Scoped to the signed-in account's
// own districts (the web's `getActiveSeatsByShapeIds` over the account's
// boundary memberships), never the whole platform. "Look up a location"
// swaps in another place's boundaries for the session; it never touches
// the profile.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/boundaries/entities/matched_boundary.dart';
import '../../../common/widgets/app_shell.dart';
import '../../../common/widgets/screen_header.dart';
import '../../find_my_district/widgets/election_seat_card.dart';
import '../../location/widgets/change_location_sheet.dart';
import '../providers/elections_scope_providers.dart';

class ElectionsListScreen extends ConsumerWidget {
  const ElectionsListScreen({super.key});

  Future<void> _changeLocation(BuildContext context, WidgetRef ref) async {
    final boundaries = await showChangeLocationSheet(context);
    if (boundaries != null) {
      ref.read(electionsScopeOverrideProvider.notifier).set(boundaries);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final seatsAsync = ref.watch(activeSeatsProvider);
    final boundariesAsync = ref.watch(electionsBoundariesProvider);
    final isOverridden = ref.watch(electionsScopeOverrideProvider) != null;
    final boundaries = boundariesAsync.value ?? const <MatchedBoundary>[];

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const ScreenHeader(title: 'Elections'),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(activeSeatsProvider);
                  await ref.read(activeSeatsProvider.future);
                },
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(
                    ChosenoSpacing.lg,
                    ChosenoSpacing.md,
                    ChosenoSpacing.lg,
                    kBottomNavClearance + ChosenoSpacing.lg,
                  ),
                  children: [
                    _ScopeCard(
                      boundaries: boundaries,
                      loading: boundariesAsync.isLoading,
                      isOverridden: isOverridden,
                      onChange: () => _changeLocation(context, ref),
                      onReset: () => ref
                          .read(electionsScopeOverrideProvider.notifier)
                          .reset(),
                    ),
                    const SizedBox(height: ChosenoSpacing.lg),
                    seatsAsync.when(
                      data: (seats) => seats.isEmpty
                          ? boundaries.isEmpty
                                ? EmptyState(
                                    icon: Icons.location_searching,
                                    title: 'Set your location',
                                    message:
                                        'Races are shown for your own districts. Find your district to see what is on your ballot.',
                                    actionLabel: 'Find my district',
                                    onAction: () =>
                                        context.go(AppRoutes.findMyDistrict),
                                  )
                                : const EmptyState(
                                    icon: Icons.event_busy_outlined,
                                    title: 'No open races',
                                    message:
                                        'There are no open elections in these districts right now. Check back closer to nominations.',
                                  )
                          : Column(
                              children: [
                                for (final (i, seat) in seats.indexed)
                                  FadeSlideIn(
                                    index: i,
                                    child: Padding(
                                      padding: const EdgeInsets.only(
                                        bottom: ChosenoSpacing.sm + 2,
                                      ),
                                      child: ElectionSeatCard(
                                        seat: seat,
                                        onTap: () => context.push(
                                          AppRoutes.seat(seat.id),
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                      loading: () => const SkeletonScope(
                        child: Column(
                          children: [
                            SkeletonCard(lines: 2),
                            SizedBox(height: ChosenoSpacing.md),
                            SkeletonCard(lines: 2),
                            SizedBox(height: ChosenoSpacing.md),
                            SkeletonCard(lines: 2),
                          ],
                        ),
                      ),
                      error: (error, _) => Padding(
                        padding: const EdgeInsets.all(ChosenoSpacing.lg),
                        child: Text(
                          'Could not load elections.',
                          textAlign: TextAlign.center,
                          style: ChosenoTypography.body(color: palette.danger),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScopeCard extends StatelessWidget {
  const _ScopeCard({
    required this.boundaries,
    required this.loading,
    required this.isOverridden,
    required this.onChange,
    required this.onReset,
  });

  final List<MatchedBoundary> boundaries;
  final bool loading;
  final bool isOverridden;
  final VoidCallback onChange;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    const maxShown = 4;
    final shown = boundaries.take(maxShown).toList();
    final extra = boundaries.length - shown.length;
    return AppCard(
      padding: const EdgeInsets.all(ChosenoSpacing.md + 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.place_outlined, size: 18, color: palette.primary),
              const SizedBox(width: ChosenoSpacing.sm),
              Expanded(
                child: Text(
                  isOverridden ? 'Showing another location' : 'Your districts',
                  style: ChosenoTypography.body(
                    color: palette.textMain,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ),
              AppButton(
                label: 'Change',
                variant: AppButtonVariant.text,
                onPressed: onChange,
              ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.sm),
          if (loading)
            const LoadingIndicator(size: 18)
          else if (boundaries.isEmpty)
            Text(
              'No location saved yet.',
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: 13,
              ),
            )
          else
            Wrap(
              spacing: ChosenoSpacing.sm,
              runSpacing: ChosenoSpacing.sm,
              children: [
                for (final b in shown)
                  AppBadge(label: b.name, tone: AppBadgeTone.neutral),
                if (extra > 0)
                  AppBadge(label: '+$extra more', tone: AppBadgeTone.primary),
              ],
            ),
          if (isOverridden) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            AppButton(
              label: 'Back to my districts',
              icon: Icons.undo,
              variant: AppButtonVariant.text,
              onPressed: onReset,
            ),
          ],
        ],
      ),
    );
  }
}
