// Port of the `/p/[code]` shared-picks page: who the sharer supports (with
// their per-candidate messages), everyone else in the race with Support /
// Pick actions, the race's voting places, and a Report link. Reuses the race
// screen's data controller so Support behaves identically.
import '../../../common/widgets/detail_app_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/election_candidate.dart';
import '../../../../domain/elections/entities/pick_share.dart';
import '../providers/election_directory_providers.dart';
import '../providers/elections_providers.dart';
import '../providers/seat_detail_providers.dart';
import '../widgets/share_picks_sheet.dart';
import '../widgets/voting_places_section.dart';

class PickShareScreen extends ConsumerWidget {
  const PickShareScreen({super.key, required this.code});

  final String code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final shareAsync = ref.watch(pickShareProvider(code));
    return Scaffold(
      appBar: const DetailAppBar(title: 'Shared picks'),
      body: shareAsync.when(
        data: (share) => share == null
            ? const EmptyState(
                icon: Icons.link_off,
                title: 'Share not found',
                message: 'This link was removed or never existed.',
              )
            : _Body(share: share),
        loading: () => const Center(child: LoadingIndicator()),
        error: (_, _) => Center(
          child: Text(
            'Could not load this share.',
            style: ChosenoTypography.body(color: palette.danger),
          ),
        ),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.share});

  final PickShare share;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final dataAsync = ref.watch(seatDetailControllerProvider(share.seatId));
    return dataAsync.when(
      loading: () => const Center(child: LoadingIndicator()),
      error: (_, _) => Center(
        child: Text(
          'Could not load this race.',
          style: ChosenoTypography.body(color: palette.danger),
        ),
      ),
      data: (data) {
        final byId = {for (final c in data.candidates) c.id: c};
        final picked = <(ElectionCandidate, String?)>[
          for (final p in share.picks)
            if (byId[p.candidateId] != null) (byId[p.candidateId]!, p.note),
        ];
        final pickedIds = picked.map((p) => p.$1.id).toSet();
        final others = data.candidates
            .where((c) => !pickedIds.contains(c.id))
            .toList();
        final author = share.authorLabel ?? 'A Choseno voter';
        final names = picked.map((p) => p.$1.fullName).toList();
        final controller = ref.read(
          seatDetailControllerProvider(share.seatId).notifier,
        );

        Widget supportButton(ElectionCandidate c) {
          final on = data.mySupportedIds.contains(c.politicianId);
          return AppButton(
            label: on ? 'Supported' : 'Support',
            icon: on ? Icons.favorite : Icons.favorite_border,
            variant: on ? AppButtonVariant.primary : AppButtonVariant.outline,
            tone: AppButtonTone.success,
            onPressed: () => controller.toggleSupport(c.politicianId),
          );
        }

        return ListView(
          padding: const EdgeInsets.all(ChosenoSpacing.lg),
          children: [
            AppCard(
              variant: AppCardVariant.hero,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const AppBadge(
                    label: 'Shared picks',
                    tone: AppBadgeTone.primary,
                    size: AppBadgeSize.xs,
                  ),
                  const SizedBox(height: ChosenoSpacing.sm),
                  Text(
                    '$author supports ${joinNames(names)}',
                    style: ChosenoTypography.display(
                      color: palette.textMain,
                      fontSize: 24,
                    ),
                  ),
                  const SizedBox(height: ChosenoSpacing.xs),
                  Text(
                    [
                      data.seat.roleTitle,
                      if (data.seat.boundaryName != null)
                        data.seat.boundaryName!,
                    ].join(' · '),
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 13,
                    ),
                  ),
                  if (share.note != null && share.note!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: ChosenoSpacing.sm),
                      child: Text(
                        '“${share.note}”',
                        style: ChosenoTypography.body(
                          color: palette.textMain,
                          fontSize: 16,
                        ).copyWith(fontStyle: FontStyle.italic),
                      ),
                    ),
                  AppButton(
                    label: 'View the full race',
                    variant: AppButtonVariant.text,
                    onPressed: () => context.push(AppRoutes.seat(share.seatId)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: ChosenoSpacing.lg),
            SectionHeader(title: 'Candidates $author supports'),
            const SizedBox(height: ChosenoSpacing.sm),
            for (final (c, note) in picked)
              Padding(
                padding: const EdgeInsets.only(bottom: ChosenoSpacing.sm),
                child: _CandidateTile(
                  candidate: c,
                  note: note,
                  trailing: supportButton(c),
                  onTap: () => context.push(AppRoutes.candidacy(c.id)),
                ),
              ),
            const SizedBox(height: ChosenoSpacing.lg),
            Text(
              "Who's your pick?",
              style: ChosenoTypography.body(
                color: palette.textMain,
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: ChosenoSpacing.sm),
            AppButton(
              label: 'Share your pick',
              icon: Icons.ios_share,
              onPressed: () => showSharePicksSheet(
                context,
                seatId: share.seatId,
                roleTitle: data.seat.roleTitle,
                place: data.seat.boundaryName,
                candidates: data.candidates,
              ),
            ),
            if (others.isNotEmpty) ...[
              const SizedBox(height: ChosenoSpacing.md),
              Text(
                'OTHER CANDIDATES (${others.length})',
                style: ChosenoTypography.body(
                  color: palette.textMuted,
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                ).copyWith(letterSpacing: 0.8),
              ),
              const SizedBox(height: ChosenoSpacing.sm),
              for (final c in others)
                Padding(
                  padding: const EdgeInsets.only(bottom: ChosenoSpacing.sm),
                  child: _CandidateTile(
                    candidate: c,
                    trailing: supportButton(c),
                    onTap: () => context.push(AppRoutes.candidacy(c.id)),
                  ),
                ),
            ],
            const SizedBox(height: ChosenoSpacing.lg),
            if (data.seat.mapShapeId != null && data.seat.electionDate != null)
              VotingPlacesSection(
                mapShapeId: data.seat.mapShapeId!,
                electionDate: data.seat.electionDate!,
                jurisdictionName: data.seat.boundaryName ?? 'your area',
              ),
            Text(
              "This is one voter's personal opinion, shared on Choseno. It is not an endorsement by Choseno.",
              textAlign: TextAlign.center,
              style: ChosenoTypography.body(
                color: palette.textDark,
                fontSize: 11,
              ),
            ),
            AppButton(
              label: 'Report this share',
              icon: Icons.flag_outlined,
              variant: AppButtonVariant.text,
              tone: AppButtonTone.danger,
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                final result = await ref
                    .read(electionsRepositoryProvider)
                    .reportPickShare(share.code);
                messenger.showSnackBar(
                  SnackBar(
                    content: Text(
                      result.isErr
                          ? "Couldn't send your report. Please try again."
                          : 'Thanks — we\'ll review this share.',
                    ),
                  ),
                );
              },
            ),
          ],
        );
      },
    );
  }
}

class _CandidateTile extends StatelessWidget {
  const _CandidateTile({
    required this.candidate,
    required this.trailing,
    required this.onTap,
    this.note,
  });

  final ElectionCandidate candidate;
  final String? note;
  final Widget trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return AppCard(
      variant: AppCardVariant.row,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppAvatar(
                imageUrl: candidate.avatarUrl,
                fallbackText: candidate.fullName,
                radius: 18,
              ),
              const SizedBox(width: ChosenoSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      candidate.fullName,
                      style: ChosenoTypography.body(
                        color: palette.textMain,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    if (candidate.partyName != null)
                      Text(
                        candidate.partyName!,
                        style: ChosenoTypography.body(
                          color: palette.textMuted,
                          fontSize: 12,
                        ),
                      ),
                  ],
                ),
              ),
              trailing,
            ],
          ),
          if (note != null)
            Padding(
              padding: const EdgeInsets.only(top: ChosenoSpacing.sm),
              child: Text(
                '“$note”',
                style: ChosenoTypography.body(
                  color: palette.textMain,
                  fontSize: 14,
                ).copyWith(fontStyle: FontStyle.italic),
              ),
            ),
        ],
      ),
    );
  }
}
