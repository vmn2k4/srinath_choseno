// Step 2 — "the core mechanic of the whole app"
// (docs/SCREENS_AND_FEATURES.md in the parent repo). Port of the web's
// StepLocation: the same address search + tap-to-pick map + GPS the Find My
// District screen uses (InteractiveLocationPicker.tsx), resolving every
// boundary the chosen point falls in. Shared verbatim by Edit Profile.
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/boundaries/entities/matched_boundary.dart';
import '../../../../domain/geocoding/entities/geocode_suggestion.dart';
import '../../location/widgets/address_search_field.dart';
import '../../location/widgets/location_picker_map.dart';

class StepLocation extends StatelessWidget {
  const StepLocation({
    super.key,
    required this.locating,
    required this.locationError,
    required this.matchedBoundaries,
    required this.onDetect,
    required this.onPick,
    this.pointLat,
    this.pointLng,
  });

  final bool locating;
  final String? locationError;
  final List<MatchedBoundary> matchedBoundaries;
  final VoidCallback onDetect;
  final void Function(double lat, double lng) onPick;
  final double? pointLat;
  final double? pointLng;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Verify your district',
          style: ChosenoTypography.display(
            color: palette.textMain,
            fontSize: 30,
          ),
        ),
        const SizedBox(height: ChosenoSpacing.sm),
        Text(
          'Search an address or tap the map. We resolve every electoral boundary that spot falls inside — municipal, provincial/state, and federal.',
          style: ChosenoTypography.body(
            color: palette.textMuted,
            fontSize: 14,
            height: 1.45,
          ),
        ),
        const SizedBox(height: ChosenoSpacing.lg),
        AddressSearchField(
          onSelected: (GeocodeSuggestion s) => onPick(s.lat, s.lng),
        ),
        const SizedBox(height: ChosenoSpacing.md),
        LocationPickerMap(
          height: 260,
          point: pointLat != null && pointLng != null
              ? LatLng(pointLat!, pointLng!)
              : null,
          onPick: (p) => onPick(p.latitude, p.longitude),
        ),
        const SizedBox(height: ChosenoSpacing.md),
        AppButton(
          label: 'Use my current location',
          icon: Icons.my_location,
          variant: AppButtonVariant.outline,
          loading: locating,
          onPressed: locating ? null : onDetect,
        ),
        if (locationError != null) ...[
          const SizedBox(height: ChosenoSpacing.md),
          Text(
            locationError!,
            style: ChosenoTypography.body(color: palette.danger, fontSize: 13),
          ),
        ],
        if (matchedBoundaries.isNotEmpty) ...[
          const SizedBox(height: ChosenoSpacing.lg),
          Container(
            padding: const EdgeInsets.all(ChosenoSpacing.md),
            decoration: BoxDecoration(
              color: palette.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(ChosenoRadii.sm * 2),
              border: Border.all(color: palette.primary.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.check_circle, size: 18, color: palette.primary),
                    const SizedBox(width: ChosenoSpacing.sm),
                    Text(
                      'Found ${matchedBoundaries.length} boundaries',
                      style: ChosenoTypography.body(
                        color: palette.textMain,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: ChosenoSpacing.sm),
                Wrap(
                  spacing: ChosenoSpacing.sm,
                  runSpacing: ChosenoSpacing.sm,
                  children: matchedBoundaries
                      .map(
                        (b) => AppBadge(
                          label:
                              '${b.name}${b.boundaryType != null ? ' · ${b.boundaryType}' : ''}',
                          tone: AppBadgeTone.accent,
                        ),
                      )
                      .toList(),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
