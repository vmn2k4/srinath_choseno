// Port of SetLocationClient.tsx — the location-only counterpart to
// Onboarding's StepLocation, reached only via the router's
// LocationRequiredGate-equivalent guard (core/router/app_router.dart) for
// a politician account claimed through the (not-yet-built) interview-
// invite flow, which sets `onboarding_completed = true` directly and
// skips the normal stepper's location step — see
// docs/FLUTTER_MOBILE_APP_GUIDE.md §4.I.8/§1 in the parent repo.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/boundaries/entities/matched_boundary.dart';
import '../../boundaries/providers/boundaries_providers.dart';
import '../../location/providers/location_providers.dart';
import '../../profile/providers/profile_providers.dart';

@immutable
class SetLocationState {
  const SetLocationState({
    this.locating = false,
    this.locationError,
    this.matchedBoundaries = const [],
    this.saving = false,
    this.lat,
    this.lng,
  });

  final bool locating;
  final String? locationError;
  final List<MatchedBoundary> matchedBoundaries;
  final bool saving;
  final double? lat;
  final double? lng;

  bool get hasLocation => matchedBoundaries.isNotEmpty;

  SetLocationState copyWith({
    bool? locating,
    String? locationError,
    bool clearLocationError = false,
    List<MatchedBoundary>? matchedBoundaries,
    bool? saving,
    double? lat,
    double? lng,
  }) {
    return SetLocationState(
      locating: locating ?? this.locating,
      locationError: clearLocationError
          ? null
          : (locationError ?? this.locationError),
      matchedBoundaries: matchedBoundaries ?? this.matchedBoundaries,
      saving: saving ?? this.saving,
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
    );
  }
}

class SetLocationController extends Notifier<SetLocationState> {
  double? _lat;
  double? _lng;

  @override
  SetLocationState build() => const SetLocationState();

  Future<void> pickLocation(double lat, double lng) async {
    state = state.copyWith(
      locating: true,
      clearLocationError: true,
      lat: lat,
      lng: lng,
    );
    final result = await resolveAndSyncLocation(ref, lat: lat, lng: lng);
    result.when(
      ok: (boundaries) {
        _lat = lat;
        _lng = lng;
        state = state.copyWith(
          locating: false,
          matchedBoundaries: boundaries,
          locationError: boundaries.isEmpty
              ? 'No configured boundaries cover this location yet. You can still continue.'
              : null,
        );
      },
      err: (_) => state = state.copyWith(
        locating: false,
        locationError: 'Could not resolve location boundaries.',
      ),
    );
  }

  Future<void> detectLocation() async {
    state = state.copyWith(locating: true, clearLocationError: true);
    final point = await currentDevicePoint();
    await point.when(
      ok: (p) => pickLocation(p.lat, p.lng),
      err: (f) async {
        state = state.copyWith(locating: false, locationError: f.message);
      },
    );
  }

  Future<bool> finish() async {
    final profile = ref.read(ownProfileProvider).value;
    if (profile == null || _lat == null || _lng == null) return false;
    state = state.copyWith(saving: true);

    final constituency = state.matchedBoundaries.map((b) => b.name).join(', ');
    final country = state.matchedBoundaries.isNotEmpty
        ? state.matchedBoundaries.first.country
        : profile.country;

    final result = await ref
        .read(profileRepositoryProvider)
        .upsertProfileCore(
          userId: profile.id,
          role: profile.role,
          fullName: profile.fullName,
          country: country,
          constituency: constituency.isEmpty ? null : constituency,
        );

    state = state.copyWith(saving: false);
    if (result.isErr) return false;

    // Router's LocationRequiredGate-equivalent guard reads
    // needsLocationProvider (see boundaries_providers.dart) — invalidate
    // it now rather than waiting for an unrelated event, same "explicit
    // signal on save" fix the web's useLocationGate().clearNeedsLocation()
    // makes (see this feature's own doc comment in app_router.dart).
    ref.invalidate(needsLocationProvider);
    await ref.read(ownProfileProvider.notifier).refresh();
    return true;
  }
}

final setLocationControllerProvider =
    NotifierProvider<SetLocationController, SetLocationState>(
      SetLocationController.new,
    );
