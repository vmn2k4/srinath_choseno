import 'package:flutter/foundation.dart';

/// Port of the website's `MatchedBoundary` (src/lib/utils/guestLocation.ts)
/// — one electoral boundary a lat/lng point falls inside.
@immutable
class MatchedBoundary {
  const MatchedBoundary({
    required this.id,
    required this.name,
    this.country,
    this.boundaryType,
  });

  final int id;
  final String name;
  final String? country;
  final String? boundaryType;
}
