// "Who's running" for one election (`/elections/e/<slug>`) or one place
// (`/elections/<boundary-slug>`): every race with its date, countdown and
// candidate count. Mobile counterpart of the web's election hub and
// per-place pages.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/election_seat_summary.dart';
import '../../find_my_district/widgets/election_seat_card.dart';
import '../providers/election_directory_providers.dart';

class RaceListScreen extends ConsumerWidget {
  const RaceListScreen.election({
    super.key,
    required String this.electionId,
    this.title = 'Election',
  }) : shapeId = null;

  const RaceListScreen.place({
    super.key,
    required int this.shapeId,
    this.title = 'Who\'s running here',
  }) : electionId = null;

  final String? electionId;
  final int? shapeId;
  final String title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final AsyncValue<List<ElectionSeatSummary>> seats = electionId != null
        ? ref.watch(seatsForElectionProvider(electionId!))
        : ref.watch(seatsForShapeProvider(shapeId!));
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: seats.when(
        data: (rows) {
          if (rows.isEmpty) {
            return const EmptyState(
              icon: Icons.event_busy_outlined,
              title: 'No races yet',
              message: 'Nothing is open here right now. Check back soon.',
            );
          }
          final sorted = [...rows]
            ..sort((a, b) {
              final rank = _rank(
                a.boundaryType,
              ).compareTo(_rank(b.boundaryType));
              if (rank != 0) return rank;
              return b.candidateCount.compareTo(a.candidateCount);
            });
          return ListView(
            padding: const EdgeInsets.all(ChosenoSpacing.lg),
            children: [
              Text(
                '${rows.length} race${rows.length == 1 ? '' : 's'} · '
                '${rows.fold<int>(0, (n, s) => n + s.candidateCount)} candidates',
                style: ChosenoTypography.body(
                  color: palette.textMuted,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: ChosenoSpacing.md),
              for (final s in sorted)
                Padding(
                  padding: const EdgeInsets.only(bottom: ChosenoSpacing.sm + 2),
                  child: ElectionSeatCard(
                    seat: s,
                    onTap: () => context.push(AppRoutes.seat(s.id)),
                  ),
                ),
            ],
          );
        },
        loading: () => const Center(child: LoadingIndicator()),
        error: (_, _) => Center(
          child: Text(
            'Could not load these races.',
            style: ChosenoTypography.body(color: palette.danger),
          ),
        ),
      ),
    );
  }

  /// Local races first, then provincial/state, federal, everything else —
  /// the same relevance order the web banner uses.
  static int _rank(String? type) {
    final t = (type ?? '').toLowerCase();
    if (t.contains('municipal') ||
        t.contains('school') ||
        t.contains('ward') ||
        t.contains('city')) {
      return 0;
    }
    if (t.contains('provincial') ||
        t.contains('state house') ||
        t.contains('state senate')) {
      return 1;
    }
    if (t.contains('federal')) return 2;
    return 3;
  }
}
