// Find My District's pick location → resolve boundaries → resolve seats +
// representation branches pipeline — ports FindMyDistrictClient.tsx
// (parent repo): the account's saved districts load first (the web's
// `initialBoundaries`), a map tap / address search / GPS fix replaces them
// with a fresh lookup, and "Set as my location" is the only thing that
// writes to the profile (a lookup alone never does — a candidate scoping
// another race must not have their own location silently changed).
// Not ported: the anonymous rep-list preview cap
// (ANON_REP_PREVIEW_LIMIT/REP_LIST_GATING_ENABLED) — this app is
// signed-in only, see docs/FLUTTER_MOBILE_APP_GUIDE.md §4.A.1/§4.A.10.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../../domain/boundaries/entities/map_shape.dart';
import '../../../../domain/boundaries/entities/matched_boundary.dart';
import '../../../../domain/elections/entities/election_seat_summary.dart';
import '../../../../domain/elections/entities/representation_branch.dart';
import '../../boundaries/providers/boundaries_providers.dart';
import '../../location/providers/location_providers.dart';
import '../../profile/providers/profile_providers.dart';
import '../../elections/providers/elections_providers.dart';

@immutable
class FindMyDistrictState {
  const FindMyDistrictState({
    this.locating = false,
    this.locationError,
    this.boundaries = const [],
    this.branches = const [],
    this.branchesLoading = false,
    this.seats = const [],
    this.seatsLoading = false,
    this.activeBranchKey = 'all',
    this.pointLat,
    this.pointLng,
    this.lookingUp = false,
    this.savingMyLocation = false,
    this.myLocationSaved = false,
  });

  final bool locating;
  final String? locationError;
  final List<MatchedBoundary> boundaries;
  final List<RepresentationBranch> branches;
  final bool branchesLoading;
  final List<ElectionSeatSummary> seats;
  final bool seatsLoading;
  final String activeBranchKey;

  /// The point the user last picked (map tap / search hit / GPS) — null
  /// while the screen is still showing the account's saved districts.
  final double? pointLat;
  final double? pointLng;
  final bool lookingUp;
  final bool savingMyLocation;
  final bool myLocationSaved;

  bool get hasPoint => pointLat != null && pointLng != null;

  List<RepresentationBranch> get visibleBranches => activeBranchKey == 'all'
      ? branches
      : branches.where((b) => b.key == activeBranchKey).toList();

  FindMyDistrictState copyWith({
    bool? locating,
    String? locationError,
    bool clearLocationError = false,
    List<MatchedBoundary>? boundaries,
    List<RepresentationBranch>? branches,
    bool? branchesLoading,
    List<ElectionSeatSummary>? seats,
    bool? seatsLoading,
    String? activeBranchKey,
    double? pointLat,
    double? pointLng,
    bool? lookingUp,
    bool? savingMyLocation,
    bool? myLocationSaved,
  }) {
    return FindMyDistrictState(
      locating: locating ?? this.locating,
      locationError: clearLocationError
          ? null
          : (locationError ?? this.locationError),
      boundaries: boundaries ?? this.boundaries,
      branches: branches ?? this.branches,
      branchesLoading: branchesLoading ?? this.branchesLoading,
      seats: seats ?? this.seats,
      seatsLoading: seatsLoading ?? this.seatsLoading,
      activeBranchKey: activeBranchKey ?? this.activeBranchKey,
      pointLat: pointLat ?? this.pointLat,
      pointLng: pointLng ?? this.pointLng,
      lookingUp: lookingUp ?? this.lookingUp,
      savingMyLocation: savingMyLocation ?? this.savingMyLocation,
      myLocationSaved: myLocationSaved ?? this.myLocationSaved,
    );
  }
}

class FindMyDistrictController extends Notifier<FindMyDistrictState> {
  @override
  FindMyDistrictState build() => const FindMyDistrictState();

  void selectBranchTab(String key) =>
      state = state.copyWith(activeBranchKey: key);

  bool _loadedAccount = false;

  /// Seeds the screen with the account's saved districts, once — the web's
  /// `initialBoundaries`, so a returning user lands on their results
  /// instead of an empty "where are you?" prompt.
  Future<void> loadFromAccount() async {
    if (_loadedAccount) return;
    _loadedAccount = true;
    final districts = await ref.read(accountDistrictsProvider.future);
    if (districts.isEmpty || state.boundaries.isNotEmpty) return;
    state = state.copyWith(boundaries: districts, myLocationSaved: true);
    await _resolveBranchesAndSeats(districts);
  }

  /// A map tap, address-search hit, or GPS fix — looks up every boundary
  /// the point falls in and rebuilds seats + representatives from them.
  Future<void> pickPoint(double lat, double lng) async {
    state = state.copyWith(
      pointLat: lat,
      pointLng: lng,
      lookingUp: true,
      clearLocationError: true,
      myLocationSaved: false,
      branches: const [],
      seats: const [],
    );
    final result = await ref
        .read(boundariesRepositoryProvider)
        .findBoundariesByPoint(lat: lat, lng: lng);
    await result.when(
      ok: (boundaries) async {
        state = state.copyWith(
          lookingUp: false,
          boundaries: boundaries,
          locationError: boundaries.isEmpty
              ? 'No configured boundaries cover this location yet.'
              : null,
        );
        await _resolveBranchesAndSeats(boundaries);
      },
      err: (failure) async {
        state = state.copyWith(
          lookingUp: false,
          locationError:
              "Couldn't look up boundaries for that location. Please try again.",
        );
      },
    );
  }

  Future<void> detectLocation() async {
    state = state.copyWith(locating: true, clearLocationError: true);
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        state = state.copyWith(
          locating: false,
          locationError: 'Location permission denied.',
        );
        return;
      }
      if (!await Geolocator.isLocationServiceEnabled()) {
        state = state.copyWith(
          locating: false,
          locationError: 'Location services are turned off.',
        );
        return;
      }
      final position = await Geolocator.getCurrentPosition();
      state = state.copyWith(locating: false);
      await pickPoint(position.latitude, position.longitude);
    } catch (_) {
      state = state.copyWith(
        locating: false,
        locationError: 'Could not detect your location.',
      );
    }
  }

  /// The explicit, opt-in save — the same two writes `SetLocationClient`'s
  /// finish() makes: sync boundary memberships, then upsert the profile
  /// core (country + constituency) carrying the current role/name forward.
  Future<void> setAsMyLocation() async {
    final lat = state.pointLat;
    final lng = state.pointLng;
    final profile = ref.read(ownProfileProvider).value;
    if (lat == null || lng == null || profile == null) return;
    state = state.copyWith(savingMyLocation: true);
    final syncResult = await ref
        .read(boundariesRepositoryProvider)
        .syncUserBoundaryMemberships(lat: lat, lng: lng);
    if (syncResult.isErr) {
      state = state.copyWith(
        savingMyLocation: false,
        locationError: "Couldn't save your location. Please try again.",
      );
      return;
    }
    final boundaries = state.boundaries;
    final saveResult = await ref
        .read(profileRepositoryProvider)
        .upsertProfileCore(
          userId: profile.id,
          role: profile.role,
          fullName: profile.fullName,
          country: boundaries.isNotEmpty
              ? boundaries.first.country
              : profile.country,
          constituency: boundaries.isEmpty
              ? null
              : boundaries.map((b) => b.name).join(', '),
        );
    if (saveResult.isErr) {
      state = state.copyWith(
        savingMyLocation: false,
        locationError: "Couldn't save your location. Please try again.",
      );
      return;
    }
    ref.invalidate(accountDistrictsProvider);
    ref.invalidate(userBoundaryMembershipsProvider);
    ref.invalidate(needsLocationProvider);
    await ref.read(ownProfileProvider.notifier).refresh();
    state = state.copyWith(savingMyLocation: false, myLocationSaved: true);
  }

  Future<void> _resolveBranchesAndSeats(List<MatchedBoundary> matched) async {
    // Polling districts aren't real electoral boundaries — filtered out on
    // web too (FindMyDistrictClient.tsx's resolveAllBranches/resolveAllSeats).
    final resolvable = matched
        .where((b) => !(b.boundaryType ?? '').toLowerCase().contains('polling'))
        .toList();
    if (resolvable.isEmpty) {
      state = state.copyWith(branches: [], seats: []);
      return;
    }

    state = state.copyWith(branchesLoading: true, seatsLoading: true);

    final electionsRepo = ref.read(electionsRepositoryProvider);

    final branchResults = await Future.wait(
      resolvable.map((b) {
        final shape = MapShape(
          id: b.id,
          name: b.name,
          country: b.country,
          boundaryType: b.boundaryType,
        );
        return electionsRepo.resolveRepresentationBranch(shape);
      }),
    );
    final branches = branchResults
        .map((r) => r.valueOrNull)
        .whereType<RepresentationBranch>()
        .toList();

    final seatsResult = await electionsRepo.getActiveSeatsByShapeIds(
      resolvable.map((b) => b.id).toList(),
    );

    state = state.copyWith(
      branches: branches,
      branchesLoading: false,
      seats: seatsResult.valueOrNull ?? const [],
      seatsLoading: false,
    );
  }
}

final findMyDistrictControllerProvider =
    NotifierProvider<FindMyDistrictController, FindMyDistrictState>(
      FindMyDistrictController.new,
    );
