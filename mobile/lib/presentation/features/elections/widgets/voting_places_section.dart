// Port of VotingPlacesSection.tsx — "Where to vote" rail on a race page.
// Opt-in GPS only (never prompts on load), day filter, nearest-first sort.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/voting_place.dart';
import '../../location/providers/location_providers.dart';
import '../providers/elections_providers.dart';

const _initialCount = 5;

/// Loader notes that just restate what the schedule rows already show.
final _genericNote = RegExp(
  r'^(advance and election day|election day only|advance voting only)$',
  caseSensitive: false,
);

final votingPlacesProvider = FutureProvider.autoDispose
    .family<List<VotingPlace>, ({int shapeId, String date})>((ref, key) async {
      final result = await ref
          .watch(electionsRepositoryProvider)
          .getVotingPlacesForShape(key.shapeId, key.date);
      final places = result.when(ok: (p) => p, err: (_) => <VotingPlace>[]);
      // Drop days that have already passed (BC time, so a visitor elsewhere
      // still sees days that are upcoming locally), then empty places.
      final today = DateFormat(
        'yyyy-MM-dd',
      ).format(DateTime.now().toUtc().subtract(const Duration(hours: 8)));
      return places
          .map(
            (p) => p.withSchedules(
              p.schedules
                  .where((s) => s.voteDate.compareTo(today) >= 0)
                  .toList(),
            ),
          )
          .where((p) => p.schedules.isNotEmpty)
          .toList();
    });

double _distanceKm(double aLat, double aLng, double bLat, double bLng) {
  const rad = math.pi / 180;
  final dLat = (bLat - aLat) * rad;
  final dLng = (bLng - aLng) * rad;
  final h =
      math.pow(math.sin(dLat / 2), 2) +
      math.cos(aLat * rad) *
          math.cos(bLat * rad) *
          math.pow(math.sin(dLng / 2), 2);
  return 12742 * math.asin(math.sqrt(h));
}

String _fmtTime(String? t) {
  if (t == null || t.isEmpty) return '';
  final parts = t.split(':');
  final h = int.parse(parts[0]);
  final m = parts.length > 1 ? int.parse(parts[1]) : 0;
  final suffix = h >= 12 ? 'pm' : 'am';
  final hr = h % 12 == 0 ? 12 : h % 12;
  return m != 0 ? '$hr:${m.toString().padLeft(2, '0')}$suffix' : '$hr$suffix';
}

String _fmtDate(String d) {
  final p = d.split('-').map(int.parse).toList();
  return DateFormat('EEE, MMM d').format(DateTime(p[0], p[1], p[2]));
}

String _scheduleLine(VotingPlaceSchedule s) {
  final hours = s.opensAt != null && s.closesAt != null
      ? '${_fmtTime(s.opensAt)}–${_fmtTime(s.closesAt)}'
      : 'hours TBA';
  return '${_fmtDate(s.voteDate)} · $hours';
}

class VotingPlacesSection extends ConsumerStatefulWidget {
  const VotingPlacesSection({
    super.key,
    required this.mapShapeId,
    required this.electionDate,
    required this.jurisdictionName,
    this.initialOrigin,
  });

  final int mapShapeId;
  final DateTime electionDate;
  final String jurisdictionName;

  /// A location the parent already has (e.g. the pin on Find My District).
  final ({double lat, double lng})? initialOrigin;

  @override
  ConsumerState<VotingPlacesSection> createState() =>
      _VotingPlacesSectionState();
}

class _VotingPlacesSectionState extends ConsumerState<VotingPlacesSection> {
  ({double lat, double lng})? _origin;
  bool _locating = false;
  String? _geoError;
  bool _showAll = false;
  String _day = 'all';
  bool _sortByName = false;

  @override
  void initState() {
    super.initState();
    _origin = widget.initialOrigin;
  }

  @override
  void didUpdateWidget(VotingPlacesSection old) {
    super.didUpdateWidget(old);
    final next = widget.initialOrigin;
    if (next != null && next != old.initialOrigin) _origin = next;
  }

  Future<void> _locate() async {
    setState(() {
      _locating = true;
      _geoError = null;
    });
    final result = await currentDevicePoint();
    if (!mounted) return;
    result.when(
      ok: (p) => setState(() {
        _locating = false;
        _origin = p;
      }),
      err: (_) => setState(() {
        _locating = false;
        _geoError =
            "Couldn't get your location. Showing all voting places instead.";
      }),
    );
  }

  Future<void> _openMaps(VotingPlace p) {
    final query = p.lat != null && p.lng != null
        ? '${p.lat},${p.lng}'
        : '${p.name} ${p.address ?? ''}';
    return launchUrl(
      Uri.https('www.google.com', '/maps/search/', {
        'api': '1',
        'query': query,
      }),
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final key = (
      shapeId: widget.mapShapeId,
      date: DateFormat('yyyy-MM-dd').format(widget.electionDate),
    );
    final places = ref.watch(votingPlacesProvider(key)).value ?? const [];
    if (places.isEmpty) return const SizedBox.shrink();

    final days =
        places
            .expand((p) => p.schedules.map((s) => s.voteDate))
            .toSet()
            .toList()
          ..sort();
    final origin = _origin;

    final rows = <({VotingPlace place, double? km})>[];
    for (final p in places) {
      final scheduled = _day == 'all'
          ? p
          : p.withSchedules(
              p.schedules.where((s) => s.voteDate == _day).toList(),
            );
      if (scheduled.schedules.isEmpty) continue;
      final km = origin != null && p.lat != null && p.lng != null
          ? _distanceKm(origin.lat, origin.lng, p.lat!, p.lng!)
          : null;
      rows.add((place: scheduled, km: km));
    }
    if (origin != null && !_sortByName) {
      rows.sort(
        (a, b) => (a.km ?? double.infinity).compareTo(b.km ?? double.infinity),
      );
    } else {
      rows.sort((a, b) => a.place.name.compareTo(b.place.name));
    }
    final visible = _showAll ? rows : rows.take(_initialCount).toList();
    final checked = places
        .map((p) => p.lastCheckedAt)
        .fold('', (m, v) => v.compareTo(m) > 0 ? v : m);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          icon: Icons.place_outlined,
          title: 'Where to vote in ${widget.jurisdictionName}',
        ),
        const SizedBox(height: ChosenoSpacing.xs),
        Text(
          origin != null && !_sortByName
              ? 'Closest voting places first.'
              : origin != null
              ? 'Sorted by name.'
              : 'Share your location to see the closest voting place.',
          style: ChosenoTypography.body(color: palette.textMuted, fontSize: 13),
        ),
        if (origin == null) ...[
          const SizedBox(height: ChosenoSpacing.sm),
          Align(
            alignment: Alignment.centerLeft,
            child: AppButton(
              label: _locating ? 'Locating…' : 'Find closest to me',
              icon: Icons.near_me_outlined,
              loading: _locating,
              onPressed: _locating ? null : _locate,
            ),
          ),
        ],
        if (_geoError != null)
          Padding(
            padding: const EdgeInsets.only(top: ChosenoSpacing.xs),
            child: Text(
              _geoError!,
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: 12,
              ),
            ),
          ),
        const SizedBox(height: ChosenoSpacing.sm),
        Wrap(
          spacing: ChosenoSpacing.xs,
          runSpacing: ChosenoSpacing.xs,
          children: [
            for (final d in ['all', ...days])
              ChoiceChip(
                label: Text(d == 'all' ? 'All days' : _fmtDate(d)),
                selected: _day == d,
                onSelected: (_) => setState(() {
                  _day = d;
                  _showAll = false;
                }),
              ),
          ],
        ),
        if (origin != null)
          Padding(
            padding: const EdgeInsets.only(top: ChosenoSpacing.xs),
            child: Wrap(
              spacing: ChosenoSpacing.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  'Sort by',
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontSize: 12,
                  ),
                ),
                ChoiceChip(
                  label: const Text('Closest'),
                  selected: !_sortByName,
                  onSelected: (_) => setState(() => _sortByName = false),
                ),
                ChoiceChip(
                  label: const Text('Name'),
                  selected: _sortByName,
                  onSelected: (_) => setState(() => _sortByName = true),
                ),
              ],
            ),
          ),
        const SizedBox(height: ChosenoSpacing.sm),
        for (final row in visible)
          Padding(
            padding: const EdgeInsets.only(bottom: ChosenoSpacing.sm),
            child: _VotingPlaceCard(
              place: row.place,
              km: row.km,
              onDirections: () => _openMaps(row.place),
            ),
          ),
        if (rows.length > _initialCount)
          Align(
            alignment: Alignment.centerLeft,
            child: AppButton(
              label: _showAll
                  ? 'Show fewer'
                  : 'Show all ${rows.length} voting places',
              variant: AppButtonVariant.text,
              onPressed: () => setState(() => _showAll = !_showAll),
            ),
          ),
        Padding(
          padding: const EdgeInsets.only(top: ChosenoSpacing.xs),
          child: Text(
            "Collected from ${widget.jurisdictionName}'s official election information"
            "${checked.length >= 10 ? ', last checked ${checked.substring(0, 10)}' : ''}. "
            'Locations and hours can change — confirm with your local government before you go.',
            style: ChosenoTypography.body(
              color: palette.textDark,
              fontSize: 11,
            ),
          ),
        ),
        const SizedBox(height: ChosenoSpacing.lg),
      ],
    );
  }
}

class _VotingPlaceCard extends StatelessWidget {
  const _VotingPlaceCard({
    required this.place,
    required this.km,
    required this.onDirections,
  });

  final VotingPlace place;
  final double? km;
  final VoidCallback onDirections;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final schedules = [...place.schedules]
      ..sort((a, b) => a.voteDate.compareTo(b.voteDate));
    final groups = [
      ('Advance voting', schedules.where((s) => !s.isElectionDay).toList()),
      ('Election day', schedules.where((s) => s.isElectionDay).toList()),
    ];
    return AppCard(
      variant: AppCardVariant.row,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      place.name,
                      style: ChosenoTypography.body(
                        color: palette.textMain,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    if (place.address != null)
                      Text(
                        place.address!,
                        style: ChosenoTypography.body(
                          color: palette.textMuted,
                          fontSize: 13,
                        ),
                      ),
                  ],
                ),
              ),
              if (km != null)
                Text(
                  '${km! < 10 ? km!.toStringAsFixed(1) : km!.round()} km',
                  style: ChosenoTypography.body(
                    color: palette.primary,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
            ],
          ),
          for (final (label, rows) in groups)
            if (rows.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: ChosenoSpacing.sm),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.schedule, size: 14, color: palette.primary),
                        const SizedBox(width: ChosenoSpacing.xs),
                        Text(
                          label,
                          style: ChosenoTypography.body(
                            color: palette.textMain,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                    for (final s in rows)
                      Text(
                        '${_scheduleLine(s)}${s.notes != null ? ' (${s.notes})' : ''}',
                        style: ChosenoTypography.body(
                          color: palette.textMuted,
                          fontSize: 13,
                        ),
                      ),
                  ],
                ),
              ),
          if (place.notes != null && !_genericNote.hasMatch(place.notes!))
            Padding(
              padding: const EdgeInsets.only(top: ChosenoSpacing.sm),
              child: Text(
                place.notes!,
                style: ChosenoTypography.body(
                  color: palette.textDark,
                  fontSize: 12,
                ),
              ),
            ),
          const SizedBox(height: ChosenoSpacing.xs),
          AppButton(
            label: 'Get directions',
            icon: Icons.directions_outlined,
            variant: AppButtonVariant.text,
            onPressed: onDirections,
          ),
        ],
      ),
    );
  }
}
