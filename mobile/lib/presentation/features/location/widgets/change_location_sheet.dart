// A bottom sheet wrapping the same address search + tap-to-pick map used on
// Find My District, for one-off "what's on the ballot over there" lookups
// (the Elections tab's finder widget on the web). Resolves the picked point
// to boundaries via `find_boundaries_by_point` and hands them back — it
// never writes to the profile.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/boundaries/entities/matched_boundary.dart';
import '../../boundaries/providers/boundaries_providers.dart';
import 'address_search_field.dart';
import 'location_picker_map.dart';

Future<List<MatchedBoundary>?> showChangeLocationSheet(BuildContext context) {
  return showModalBottomSheet<List<MatchedBoundary>>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => const _ChangeLocationSheet(),
  );
}

class _ChangeLocationSheet extends ConsumerStatefulWidget {
  const _ChangeLocationSheet();

  @override
  ConsumerState<_ChangeLocationSheet> createState() =>
      _ChangeLocationSheetState();
}

class _ChangeLocationSheetState extends ConsumerState<_ChangeLocationSheet> {
  LatLng? _point;
  bool _busy = false;
  String? _error;

  Future<void> _resolve(LatLng point) async {
    setState(() {
      _point = point;
      _busy = true;
      _error = null;
    });
    final result = await ref
        .read(boundariesRepositoryProvider)
        .findBoundariesByPoint(lat: point.latitude, lng: point.longitude);
    if (!mounted) return;
    result.when(
      ok: (boundaries) {
        if (boundaries.isEmpty) {
          setState(() {
            _busy = false;
            _error = 'No configured boundaries cover this location yet.';
          });
        } else {
          Navigator.of(context).pop(boundaries);
        }
      },
      err: (_) => setState(() {
        _busy = false;
        _error = "Couldn't look up that location. Please try again.";
      }),
    );
  }

  Future<void> _useGps() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(() {
          _busy = false;
          _error = 'Location permission denied.';
        });
        return;
      }
      final p = await Geolocator.getCurrentPosition();
      await _resolve(LatLng(p.latitude, p.longitude));
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = 'Could not detect your location.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        ChosenoSpacing.lg,
        0,
        ChosenoSpacing.lg,
        MediaQuery.of(context).viewInsets.bottom + ChosenoSpacing.lg,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            const SectionHeader(
              icon: Icons.travel_explore,
              title: 'Look up a location',
              subtitle: 'See the races on the ballot somewhere else.',
            ),
            const SizedBox(height: ChosenoSpacing.lg),
            AddressSearchField(
              onSelected: (s) => _resolve(LatLng(s.lat, s.lng)),
            ),
            const SizedBox(height: ChosenoSpacing.md),
            LocationPickerMap(height: 260, point: _point, onPick: _resolve),
            const SizedBox(height: ChosenoSpacing.md),
            AppButton(
              label: 'Use my current location',
              icon: Icons.my_location,
              variant: AppButtonVariant.outline,
              loading: _busy,
              onPressed: _busy ? null : _useGps,
            ),
            if (_error != null) ...[
              const SizedBox(height: ChosenoSpacing.md),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: ChosenoTypography.body(
                  color: palette.danger,
                  fontSize: 13,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
