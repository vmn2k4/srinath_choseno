// Screen A.7 + the Community Support panel (§4.I.7) from
// docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo). See
// seat_detail_providers.dart's header comment for what's not yet ported
// (Candidate Interview tab, anonymous support, Nominate Yourself). The
// Seat Administrator panel below is the self-service half of §4.I.5 only
// — see seat_admin_providers.dart's header comment for what isn't ported.
import '../../../common/widgets/screen_header.dart';
import '../../../common/widgets/detail_app_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/haptics.dart';
import '../../../../core/utils/share_link.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/election_candidate.dart';
import '../providers/seat_admin_providers.dart';
import '../providers/seat_detail_providers.dart';
import '../widgets/pitch_gallery_sheet.dart';
import '../widgets/share_picks_sheet.dart';
import '../widgets/voting_places_section.dart';

class SeatDetailScreen extends ConsumerWidget {
  const SeatDetailScreen({super.key, required this.seatId});

  final String seatId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final dataAsync = ref.watch(seatDetailControllerProvider(seatId));

    return Scaffold(
      appBar: DetailAppBar(
        title: dataAsync.value?.seat.roleTitle ?? 'Race',
        subtitle: dataAsync.value?.seat.boundaryName,
        actions: [
          HeaderIconButton(
            icon: Icons.ios_share_rounded,
            tooltip: 'Share',
            onTap: () => shareChosenoLink('/elections/seat/$seatId'),
          ),
        ],
      ),
      body: dataAsync.when(
        data: (data) {
          final dateLabel = data.seat.electionDate != null
              ? DateFormat.yMMMd().format(data.seat.electionDate!)
              : null;
          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(seatDetailControllerProvider(seatId)),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                ChosenoSpacing.lg,
                ChosenoSpacing.sm,
                ChosenoSpacing.lg,
                ChosenoSpacing.xxl,
              ),
              children: [
                AppCard(
                  variant: AppCardVariant.hero,
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'ELECTION DAY',
                              style: ChosenoTypography.body(
                                color: palette.textMuted,
                                fontWeight: FontWeight.w700,
                                fontSize: 11,
                              ).copyWith(letterSpacing: 0.8),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              dateLabel ?? 'Date to be announced',
                              style: ChosenoTypography.display(
                                color: palette.textMain,
                                fontSize: 22,
                              ),
                            ),
                            if (data.seat.electionDate != null &&
                                _countdown(data.seat.electionDate!).isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: AppBadge(
                                  label: _countdown(
                                    data.seat.electionDate!,
                                  ).replaceFirst(' · ', ''),
                                  tone: AppBadgeTone.primary,
                                  size: AppBadgeSize.xs,
                                ),
                              ),
                          ],
                        ),
                      ),
                      Column(
                        children: [
                          Text(
                            '${data.candidates.length}',
                            style: ChosenoTypography.display(
                              color: palette.primary,
                              fontSize: 30,
                            ),
                          ),
                          Text(
                            data.candidates.length == 1
                                ? 'candidate'
                                : 'candidates',
                            style: ChosenoTypography.body(
                              color: palette.textMuted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (data.candidates.any(
                  (c) => (c.introVideoUrl ?? '').trim().isNotEmpty,
                )) ...[
                  const SizedBox(height: ChosenoSpacing.md),
                  AppButton(
                    label: 'Watch candidate pitches',
                    icon: Icons.play_circle_outline,
                    onPressed: () => showPitchGallery(
                      context,
                      candidates: data.candidates,
                      onSelectCandidate: (c) =>
                          context.push(AppRoutes.candidacy(c.id)),
                    ),
                  ),
                ],
                if (data.candidates.isNotEmpty) ...[
                  const SizedBox(height: ChosenoSpacing.sm),
                  AppButton(
                    label: 'Share my picks',
                    icon: Icons.ios_share,
                    variant: AppButtonVariant.outline,
                    onPressed: () => showSharePicksSheet(
                      context,
                      seatId: seatId,
                      roleTitle: data.seat.roleTitle,
                      place: data.seat.boundaryName,
                      candidates: data.candidates,
                    ),
                  ),
                ],
                const SizedBox(height: ChosenoSpacing.xl),
                const SectionHeader(
                  icon: Icons.trending_up,
                  title: 'Community support',
                ),
                const SizedBox(height: ChosenoSpacing.sm),
                Text(
                  data.leader != null
                      ? '${data.leader!.fullName} is currently leading with ${_pct(data, data.leader!.politicianId)}% community support.'
                      : data.isTie
                      ? 'It\'s a tie for the lead.'
                      : data.candidates.isEmpty
                      ? 'Candidates for this seat haven\'t been added yet.'
                      : 'No community support recorded yet — be the first to support a candidate.',
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: ChosenoSpacing.sm),
                ...data.rankedCandidates.map(
                  (candidate) => Padding(
                    padding: const EdgeInsets.only(
                      bottom: ChosenoSpacing.sm + 2,
                    ),
                    child: _CandidateResultRow(
                      candidate: candidate,
                      supporterCount: data.supporterCountFor(
                        candidate.politicianId,
                      ),
                      percent: _pct(data, candidate.politicianId),
                      isTopRow:
                          data.totalSupport > 0 &&
                          data.supporterCountFor(candidate.politicianId) ==
                              data.supporterCountFor(
                                data.rankedCandidates.first.politicianId,
                              ),
                      isLeader: data.leader?.id == candidate.id,
                      isTiedTop:
                          data.isTie &&
                          data.totalSupport > 0 &&
                          data.supporterCountFor(candidate.politicianId) ==
                              data.supporterCountFor(
                                data.rankedCandidates.first.politicianId,
                              ),
                      isSupporting: data.mySupportedIds.contains(
                        candidate.politicianId,
                      ),
                      onToggleSupport: () {
                        AppHaptics.tap();
                        ref
                            .read(seatDetailControllerProvider(seatId).notifier)
                            .toggleSupport(candidate.politicianId);
                      },
                      onOpenCandidacy: () =>
                          context.push(AppRoutes.candidacy(candidate.id)),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: ChosenoSpacing.sm),
                  child: Text(
                    'Community Support reflects Choseno user activity, not a scientific poll or official election result.',
                    style: ChosenoTypography.body(
                      color: palette.textDark,
                      fontSize: 11,
                    ),
                  ),
                ),
                const SizedBox(height: ChosenoSpacing.lg),
                if (data.seat.mapShapeId != null &&
                    data.seat.electionDate != null)
                  VotingPlacesSection(
                    mapShapeId: data.seat.mapShapeId!,
                    electionDate: data.seat.electionDate!,
                    jurisdictionName: data.seat.boundaryName ?? 'your area',
                  ),
                _SeatAdminPanel(seatId: seatId),
              ],
            ),
          );
        },
        loading: () => const Center(child: LoadingIndicator()),
        error: (error, _) => Center(
          child: Text(
            'This seat could not be found.',
            style: ChosenoTypography.body(color: palette.danger),
          ),
        ),
      ),
    );
  }

  /// " · Today" / " · Tomorrow" / " · in N days" (web race cards show a
  /// countdown beside the date); empty once the day has passed.
  String _countdown(DateTime electionDate) {
    final now = DateTime.now();
    final days = DateTime(
      electionDate.year,
      electionDate.month,
      electionDate.day,
    ).difference(DateTime(now.year, now.month, now.day)).inDays;
    if (days < 0) return '';
    if (days == 0) return ' · Today';
    if (days == 1) return ' · Tomorrow';
    return ' · in $days days';
  }

  double _pct(SeatDetailData data, String politicianId) {
    if (data.totalSupport == 0) return 0;
    return (data.supporterCountFor(politicianId) / data.totalSupport * 1000)
            .round() /
        10;
  }
}

class _CandidateResultRow extends StatelessWidget {
  const _CandidateResultRow({
    required this.candidate,
    required this.supporterCount,
    required this.percent,
    required this.isTopRow,
    required this.isLeader,
    required this.isTiedTop,
    required this.isSupporting,
    required this.onToggleSupport,
    required this.onOpenCandidacy,
  });

  final ElectionCandidate candidate;
  final int supporterCount;
  final double percent;
  final bool isTopRow;
  final bool isLeader;
  final bool isTiedTop;
  final bool isSupporting;
  final VoidCallback onToggleSupport;
  final VoidCallback onOpenCandidacy;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return AppCard(
      variant: AppCardVariant.row,
      onTap: onOpenCandidacy,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              AppAvatar(
                imageUrl: candidate.avatarUrl,
                fallbackText: candidate.fullName,
                radius: 16,
              ),
              const SizedBox(width: ChosenoSpacing.sm),
              Expanded(
                child: Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: ChosenoSpacing.xs,
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
                    if (isLeader)
                      const AppBadge(
                        label: 'Leading',
                        tone: AppBadgeTone.success,
                        size: AppBadgeSize.xs2,
                      ),
                    if (isTiedTop)
                      const AppBadge(
                        label: 'Tied',
                        tone: AppBadgeTone.warning,
                        size: AppBadgeSize.xs2,
                      ),
                  ],
                ),
              ),
              AppButton(
                label: isSupporting ? 'Supported' : 'Support',
                icon: isSupporting ? Icons.favorite : Icons.favorite_border,
                variant: isSupporting
                    ? AppButtonVariant.primary
                    : AppButtonVariant.outline,
                tone: AppButtonTone.success,
                onPressed: onToggleSupport,
              ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.sm),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(ChosenoRadii.full),
                  child: LinearProgressIndicator(
                    value: percent / 100,
                    minHeight: 8,
                    backgroundColor: palette.surfaceActive,
                    color: isTopRow ? palette.primary : palette.primaryLighter,
                  ),
                ),
              ),
              const SizedBox(width: ChosenoSpacing.sm),
              Text(
                '$percent%',
                style: ChosenoTypography.body(
                  color: palette.textMain,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
              const SizedBox(width: ChosenoSpacing.xs),
              Text(
                '($supporterCount)',
                style: ChosenoTypography.body(
                  color: palette.textMuted,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Self-service half of §4.I.5 — see seat_admin_providers.dart's header
/// comment for what isn't ported (review, and the admin console itself).
class _SeatAdminPanel extends ConsumerStatefulWidget {
  const _SeatAdminPanel({required this.seatId});

  final String seatId;

  @override
  ConsumerState<_SeatAdminPanel> createState() => _SeatAdminPanelState();
}

class _SeatAdminPanelState extends ConsumerState<_SeatAdminPanel> {
  bool _expanded = false;
  bool _formOpen = false;
  String? _validationError;
  final _motivationController = TextEditingController();
  final _socialController = TextEditingController();
  final _emailController = TextEditingController();

  @override
  void dispose() {
    _motivationController.dispose();
    _socialController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  void _submit() {
    final email = _emailController.text.trim();
    final motivation = _motivationController.text.trim();
    if (motivation.isEmpty || email.isEmpty) {
      setState(
        () => _validationError = 'Motivation and contact email are required.',
      );
      return;
    }
    setState(() => _validationError = null);
    ref
        .read(seatAdminApplyControllerProvider(widget.seatId).notifier)
        .submit(
          motivation: motivation,
          contactEmail: email,
          socialMediaInfo: _socialController.text.trim().isEmpty
              ? null
              : _socialController.text.trim(),
        );
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final statusAsync = ref.watch(seatAdminStatusProvider(widget.seatId));
    final applyState = ref.watch(
      seatAdminApplyControllerProvider(widget.seatId),
    );

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Row(
              children: [
                Icon(Icons.shield_outlined, size: 18, color: palette.primary),
                const SizedBox(width: ChosenoSpacing.xs),
                Text(
                  'Seat Administrator',
                  style: ChosenoTypography.body(
                    color: palette.textMain,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(width: ChosenoSpacing.xs),
                statusAsync.value?.isApprovedAdmin == true
                    ? const AppBadge(
                        label: 'Approved',
                        tone: AppBadgeTone.success,
                        size: AppBadgeSize.xs2,
                      )
                    : statusAsync.value?.isPending == true
                    ? const AppBadge(
                        label: 'Pending',
                        tone: AppBadgeTone.warning,
                        size: AppBadgeSize.xs2,
                      )
                    : const SizedBox.shrink(),
                const Spacer(),
                Icon(
                  _expanded ? Icons.expand_less : Icons.expand_more,
                  color: palette.textMuted,
                ),
              ],
            ),
          ),
          if (_expanded) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            statusAsync.when(
              data: (status) {
                if (status.isApprovedAdmin) {
                  return Text(
                    'You are the approved Administrator for this seat.',
                    style: ChosenoTypography.body(
                      color: palette.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  );
                }
                if (status.isPending) {
                  return Text(
                    'Your application to administer this seat is under review.',
                    style: ChosenoTypography.body(
                      color: palette.warning,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  );
                }
                if (status.isRejected) {
                  return Text(
                    'Your application to administer this seat was not approved.',
                    style: ChosenoTypography.body(
                      color: palette.danger,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  );
                }
                if (status.hasApprovedAdmin) {
                  return Text(
                    'This seat already has an assigned election administrator.',
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 12,
                    ),
                  );
                }
                if (applyState.submitted) {
                  return Text(
                    'Application submitted for review.',
                    style: ChosenoTypography.body(
                      color: palette.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  );
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Volunteer to moderate this seat and help add candidates who are missing from the platform.',
                      style: ChosenoTypography.body(
                        color: palette.textMuted,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: ChosenoSpacing.sm),
                    if (!_formOpen)
                      AppButton(
                        label: 'Volunteer to Administer This Seat',
                        variant: AppButtonVariant.outline,
                        onPressed: () => setState(() => _formOpen = true),
                      )
                    else ...[
                      TextField(
                        controller: _motivationController,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText:
                              "Tell us about yourself and why you're interested",
                        ),
                      ),
                      const SizedBox(height: ChosenoSpacing.xs),
                      AppTextField(
                        label: 'Social media or community links (optional)',
                        controller: _socialController,
                      ),
                      const SizedBox(height: ChosenoSpacing.xs),
                      AppTextField(
                        label: 'Contact Email',
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                      ),
                      if (_validationError != null ||
                          applyState.error != null) ...[
                        const SizedBox(height: ChosenoSpacing.xs),
                        Text(
                          _validationError ?? applyState.error!,
                          style: ChosenoTypography.body(
                            color: palette.danger,
                            fontSize: 12,
                          ),
                        ),
                      ],
                      const SizedBox(height: ChosenoSpacing.sm),
                      AppButton(
                        label: 'Submit Application',
                        loading: applyState.submitting,
                        onPressed: applyState.submitting ? null : _submit,
                      ),
                    ],
                  ],
                );
              },
              loading: () => const LoadingIndicator(size: 16),
              error: (_, _) => const SizedBox.shrink(),
            ),
          ],
        ],
      ),
    );
  }
}
