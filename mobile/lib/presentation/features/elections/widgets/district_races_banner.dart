// Port of DistrictRacesBanner.tsx — "Races on your ballot". Until the user
// taps "Use my location" it is a Find-my-district promo; after a fresh GPS
// fix it shows the races in the districts they belong to (local races first)
// plus district chips. Only ever a fresh fix, never a saved location — a
// wrong district is worse than the promo. Taps are logged for the same
// "did they engage after finding their district" metric as the web.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/utils/boundary_level.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/boundaries/entities/matched_boundary.dart';
import '../../../../domain/elections/entities/election_seat_summary.dart';
import '../../boundaries/providers/boundaries_providers.dart';
import '../../find_my_district/widgets/election_seat_card.dart';
import '../../location/providers/location_providers.dart';
import '../providers/elections_providers.dart';

int _localRank(String? type) {
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

class DistrictRacesBanner extends ConsumerStatefulWidget {
  const DistrictRacesBanner({
    super.key,
    this.title = "Who's on your ballot?",
    this.description =
        'Find your district to see every race you can vote in and the candidates running in it.',
  });

  final String title;
  final String description;

  @override
  ConsumerState<DistrictRacesBanner> createState() =>
      _DistrictRacesBannerState();
}

class _DistrictRacesBannerState extends ConsumerState<DistrictRacesBanner> {
  static const _visibleLimit = 4;

  bool _locating = false;
  String? _error;
  List<MatchedBoundary> _boundaries = const [];
  List<ElectionSeatSummary>? _seats; // null while loading

  Future<void> _locate() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    final point = await currentDevicePoint();
    if (!mounted) return;
    final p = point.valueOrNull;
    if (p == null) {
      setState(() {
        _locating = false;
        _error = "Couldn't get your location. Try Find my district instead.";
      });
      return;
    }
    final result = await ref
        .read(boundariesRepositoryProvider)
        .findBoundariesByPoint(lat: p.lat, lng: p.lng);
    if (!mounted) return;
    final matched = (result.valueOrNull ?? const <MatchedBoundary>[])
        .where((b) => !(b.boundaryType ?? '').toLowerCase().contains('polling'))
        .toList();
    final repo = ref.read(electionsRepositoryProvider);
    unawaited(
      repo.logDistrictLookup(
        source: 'district_banner',
        method: 'gps',
        boundaryCount: matched.length,
      ),
    );
    setState(() {
      _locating = false;
      _boundaries = matched;
      _seats = matched.isEmpty ? const [] : null;
    });
    if (matched.isEmpty) return;
    final seats = await repo.getActiveSeatsByShapeIds(
      matched.map((b) => b.id).toList(),
    );
    if (!mounted) return;
    final sorted = [...(seats.valueOrNull ?? const <ElectionSeatSummary>[])]
      ..sort((a, b) {
        final r = _localRank(
          a.boundaryType,
        ).compareTo(_localRank(b.boundaryType));
        if (r != 0) return r;
        final d = (a.electionDate ?? DateTime(9999)).compareTo(
          b.electionDate ?? DateTime(9999),
        );
        return d != 0 ? d : b.candidateCount.compareTo(a.candidateCount);
      });
    setState(() => _seats = sorted);
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    if (_boundaries.isEmpty) {
      return AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.auto_awesome, size: 18, color: palette.primary),
                const SizedBox(width: ChosenoSpacing.xs),
                Expanded(
                  child: Text(
                    widget.title,
                    style: ChosenoTypography.body(
                      color: palette.textMain,
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ChosenoSpacing.xs),
            Text(
              widget.description,
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: 13,
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: ChosenoSpacing.xs),
                child: Text(
                  _error!,
                  style: ChosenoTypography.body(
                    color: palette.danger,
                    fontSize: 12,
                  ),
                ),
              ),
            const SizedBox(height: ChosenoSpacing.sm),
            AppButton(
              label: _locating ? 'Locating…' : 'Use my location',
              icon: Icons.my_location,
              loading: _locating,
              onPressed: _locating ? null : _locate,
            ),
            AppButton(
              label: 'Find my district',
              variant: AppButtonVariant.text,
              onPressed: () => context.go(AppRoutes.findMyDistrict),
            ),
          ],
        ),
      );
    }

    final seats = _seats;
    final visible = (seats ?? const <ElectionSeatSummary>[])
        .take(_visibleLimit)
        .toList();
    final hidden = (seats?.length ?? 0) - visible.length;
    final repo = ref.read(electionsRepositoryProvider);
    return AppCard(
      variant: AppCardVariant.hero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.auto_awesome, size: 18, color: palette.primary),
              const SizedBox(width: ChosenoSpacing.xs),
              Text(
                seats == null || seats.isNotEmpty
                    ? 'Races on your ballot'
                    : 'Your districts',
                style: ChosenoTypography.body(
                  color: palette.textMain,
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.sm),
          if (seats == null)
            Text(
              'Loading elections in your area…',
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: 13,
              ),
            )
          else if (seats.isEmpty)
            Text(
              'No elections are currently open in your districts.',
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: 13,
              ),
            )
          else ...[
            for (final s in visible)
              Padding(
                padding: const EdgeInsets.only(bottom: ChosenoSpacing.sm),
                child: ElectionSeatCard(
                  seat: s,
                  onTap: () {
                    unawaited(
                      repo.logDistrictBannerClick(
                        targetType: 'seat',
                        targetId: s.id,
                      ),
                    );
                    context.push(AppRoutes.seat(s.id));
                  },
                ),
              ),
            if (hidden > 0)
              AppButton(
                label:
                    '+ $hidden more ${hidden == 1 ? 'race' : 'races'} in your area',
                variant: AppButtonVariant.text,
                onPressed: () => context.go(AppRoutes.findMyDistrict),
              ),
          ],
          const Divider(),
          Text(
            'YOUR DISTRICTS',
            style: ChosenoTypography.body(
              color: palette.textMuted,
              fontWeight: FontWeight.w700,
              fontSize: 10,
            ).copyWith(letterSpacing: 0.8),
          ),
          const SizedBox(height: ChosenoSpacing.xs),
          Wrap(
            spacing: ChosenoSpacing.xs,
            runSpacing: ChosenoSpacing.xs,
            children: [
              for (final b
                  in [..._boundaries]..sort(
                    (a, b) => boundaryTypeRank(
                      a.boundaryType,
                    ).compareTo(boundaryTypeRank(b.boundaryType)),
                  ))
                ActionChip(
                  avatar: Icon(
                    Icons.layers_outlined,
                    size: 14,
                    color: palette.primary,
                  ),
                  label: Text(
                    boundaryLevelLabel(b.boundaryType) == null
                        ? b.name
                        : '${b.name} · ${boundaryLevelLabel(b.boundaryType)}',
                  ),
                  onPressed: () {
                    unawaited(
                      repo.logDistrictBannerClick(
                        targetType: 'boundary',
                        targetId: '${b.id}',
                      ),
                    );
                    context.push(AppRoutes.place(b.id, name: b.name));
                  },
                ),
            ],
          ),
          AppButton(
            label: 'Not right? Change',
            variant: AppButtonVariant.text,
            onPressed: () => context.go(AppRoutes.findMyDistrict),
          ),
        ],
      ),
    );
  }
}
