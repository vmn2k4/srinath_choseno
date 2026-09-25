import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/errors/result.dart';
import '../../../../data/geocoding/geocoding_repository_impl.dart';
import '../../../../domain/boundaries/entities/matched_boundary.dart';
import '../../../../domain/geocoding/repositories/geocoding_repository.dart';
import '../../boundaries/providers/boundaries_providers.dart';
import '../../profile/providers/profile_providers.dart';

final geocodingRepositoryProvider = Provider<GeocodingRepository>(
  (ref) => GeocodingRepositoryImpl(),
);

/// The signed-in account's saved districts (`user_boundary_memberships`) as
/// [MatchedBoundary]s — the app-wide "my location". Elections and Find My
/// District both start from this, exactly like the web's
/// `initialBoundaries`.
final accountDistrictsProvider =
    FutureProvider.autoDispose<List<MatchedBoundary>>((ref) async {
      final memberships = await ref.watch(
        userBoundaryMembershipsProvider.future,
      );
      return memberships
          .map(
            (m) => MatchedBoundary(
              id: m.shapeId,
              name: m.name,
              country: m.country,
              boundaryType: m.boundaryType,
            ),
          )
          .toList();
    });

/// The lookup-then-sync pair Onboarding's and Edit Profile's location step
/// both run the moment a point is chosen (the web's `lookupBoundaries`):
/// find every boundary the point falls in, then persist the memberships.
/// Returns the matched boundaries, or the first failure.
Future<Result<List<MatchedBoundary>>> resolveAndSyncLocation(
  Ref ref, {
  required double lat,
  required double lng,
}) async {
  final repo = ref.read(boundariesRepositoryProvider);
  final found = await repo.findBoundariesByPoint(lat: lat, lng: lng);
  if (found.isErr) return found;
  final synced = await repo.syncUserBoundaryMemberships(lat: lat, lng: lng);
  if (synced.isErr) {
    return Result.err(
      synced.when(
        ok: (_) => const UnknownFailure('Could not save your location.'),
        err: (f) => f,
      ),
    );
  }
  return found;
}

/// Device GPS → point, with the permission/service checks every screen that
/// offers "use my current location" needs. Returns the failure message via
/// [Result.err] so callers can show it inline.
Future<Result<({double lat, double lng})>> currentDevicePoint() async {
  try {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return const Result.err(UnknownFailure('Location permission denied.'));
    }
    if (!await Geolocator.isLocationServiceEnabled()) {
      return const Result.err(
        UnknownFailure('Location services are turned off.'),
      );
    }
    final p = await Geolocator.getCurrentPosition();
    return Result.ok((lat: p.latitude, lng: p.longitude));
  } catch (_) {
    return const Result.err(UnknownFailure('Could not detect your location.'));
  }
}
