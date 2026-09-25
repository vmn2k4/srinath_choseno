// The tap-to-pick map of the website's InteractiveLocationPicker.tsx
// (Leaflet + OSM tiles + a marker), as a flutter_map widget. Tap anywhere
// to drop the pin; the parent decides what a pick means (resolve boundaries,
// preview, save). The default centre is the same Vancouver fallback the web
// uses when no location is known yet.
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/haptics.dart';

const _defaultCenter = LatLng(49.2827, -123.1207);

class LocationPickerMap extends StatefulWidget {
  const LocationPickerMap({
    super.key,
    required this.onPick,
    this.point,
    this.height = 260,
  });

  /// The currently selected point, or null when nothing is picked yet.
  final LatLng? point;
  final ValueChanged<LatLng> onPick;
  final double height;

  @override
  State<LocationPickerMap> createState() => _LocationPickerMapState();
}

class _LocationPickerMapState extends State<LocationPickerMap> {
  final _controller = MapController();

  @override
  void didUpdateWidget(covariant LocationPickerMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    final point = widget.point;
    if (point != null && point != oldWidget.point) {
      _controller.move(point, 13);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final point = widget.point;
    return ClipRRect(
      borderRadius: BorderRadius.circular(ChosenoRadii.card),
      child: SizedBox(
        height: widget.height,
        child: Stack(
          children: [
            FlutterMap(
              mapController: _controller,
              options: MapOptions(
                initialCenter: point ?? _defaultCenter,
                initialZoom: point != null ? 13 : 9,
                minZoom: 3,
                maxZoom: 18,
                onTap: (_, latLng) {
                  AppHaptics.tap();
                  widget.onPick(latLng);
                },
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.choseno.mobile',
                  maxZoom: 19,
                ),
                if (point != null)
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: point,
                        width: 44,
                        height: 44,
                        alignment: Alignment.topCenter,
                        child: Icon(
                          Icons.location_on,
                          size: 44,
                          color: palette.primary,
                          shadows: const [
                            Shadow(blurRadius: 8, color: Colors.black54),
                          ],
                        ),
                      ),
                    ],
                  ),
                const SimpleAttributionWidget(
                  source: Text('© OpenStreetMap · © CARTO'),
                  backgroundColor: Color(0x99000000),
                ),
              ],
            ),
            if (point == null)
              Positioned(
                left: ChosenoSpacing.md,
                right: ChosenoSpacing.md,
                top: ChosenoSpacing.md,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ChosenoSpacing.md,
                    vertical: ChosenoSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: palette.surface.withValues(alpha: 0.88),
                    borderRadius: BorderRadius.circular(ChosenoRadii.full),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.touch_app_outlined,
                        size: 16,
                        color: palette.primary,
                      ),
                      const SizedBox(width: ChosenoSpacing.xs),
                      Flexible(
                        child: Text(
                          'Tap the map to drop a pin',
                          style: ChosenoTypography.body(
                            color: palette.textMain,
                            fontSize: 13,
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
