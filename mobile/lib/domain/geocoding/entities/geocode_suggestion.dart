import 'package:flutter/foundation.dart';

/// One address-search hit — port of `GeocodeSuggestion`
/// (src/lib/utils/geocode.ts).
@immutable
class GeocodeSuggestion {
  const GeocodeSuggestion({
    required this.displayName,
    required this.lat,
    required this.lng,
  });

  final String displayName;
  final double lat;
  final double lng;
}
