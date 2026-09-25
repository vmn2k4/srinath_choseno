// Edit Profile's form state + save action — deliberately reuses
// Onboarding's step widgets (StepUsername, StepLocation,
// StepPoliticalDetails) verbatim rather than a parallel set, per
// docs/FLUTTER_MOBILE_APP_GUIDE.md §4.E's note that Onboarding and Edit
// Profile "must call the exact same upsert functions... build these as
// genuinely shared widgets." 2 steps for a Citizen, 3 for a Politician
// (Basic Info → Location → Political Details) — one fewer than
// Onboarding's 3/4, since Role isn't re-askable here (that's the separate
// "Switch to Citizen Account" one-click action on the Profile view, §4.E).
//
// The form is PRE-FILLED from what's already stored (`loadExisting`) and a
// save only overwrites what was actually changed: `profiles` and
// `politician_profiles` are upserted as whole rows, so a blank form would
// silently null the user's country/constituency, office title, target
// boundary and avatar — the data-loss bug this shape exists to prevent.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/boundaries/entities/matched_boundary.dart';
import '../../../../domain/profile/entities/user_profile.dart';
import '../../location/providers/location_providers.dart';
import 'profile_providers.dart';

@immutable
class EditProfileFormState {
  const EditProfileFormState({
    this.step = 0,
    required this.role,
    this.loaded = false,
    this.fullName = '',
    this.matchedBoundaries = const [],
    this.locationChanged = false,
    this.lat,
    this.lng,
    this.locating = false,
    this.locationError,
    this.politicalPartyId,
    this.education = '',
    this.hometown = '',
    this.bio = '',
    this.avatarUrl,
    this.uploadingAvatar = false,
    this.avatarError,
    this.saving = false,
    this.saveError,
  });

  final int step;
  final UserRole role;

  /// False until the existing profile/politician/districts data has been
  /// read — the screen shows a spinner instead of an empty form.
  final bool loaded;
  final String fullName;
  final List<MatchedBoundary> matchedBoundaries;

  /// True only once the user picked a new location this session; until
  /// then a save leaves country/constituency/memberships alone.
  final bool locationChanged;
  final double? lat;
  final double? lng;
  final bool locating;
  final String? locationError;
  final int? politicalPartyId;
  final String education;
  final String hometown;
  final String bio;
  final String? avatarUrl;
  final bool uploadingAvatar;
  final String? avatarError;
  final bool saving;
  final String? saveError;

  int get totalSteps => role == UserRole.politician ? 3 : 2;

  String? get country =>
      matchedBoundaries.isNotEmpty ? matchedBoundaries.first.country : null;
  String? get constituency => matchedBoundaries.isEmpty
      ? null
      : matchedBoundaries.map((b) => b.name).join(', ');

  EditProfileFormState copyWith({
    int? step,
    bool? loaded,
    String? fullName,
    List<MatchedBoundary>? matchedBoundaries,
    bool? locationChanged,
    double? lat,
    double? lng,
    bool? locating,
    String? locationError,
    bool clearLocationError = false,
    int? politicalPartyId,
    String? education,
    String? hometown,
    String? bio,
    String? avatarUrl,
    bool? uploadingAvatar,
    String? avatarError,
    bool clearAvatarError = false,
    bool? saving,
    String? saveError,
    bool clearSaveError = false,
  }) {
    return EditProfileFormState(
      step: step ?? this.step,
      role: role,
      loaded: loaded ?? this.loaded,
      fullName: fullName ?? this.fullName,
      matchedBoundaries: matchedBoundaries ?? this.matchedBoundaries,
      locationChanged: locationChanged ?? this.locationChanged,
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
      locating: locating ?? this.locating,
      locationError: clearLocationError
          ? null
          : (locationError ?? this.locationError),
      politicalPartyId: politicalPartyId ?? this.politicalPartyId,
      education: education ?? this.education,
      hometown: hometown ?? this.hometown,
      bio: bio ?? this.bio,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      uploadingAvatar: uploadingAvatar ?? this.uploadingAvatar,
      avatarError: clearAvatarError ? null : (avatarError ?? this.avatarError),
      saving: saving ?? this.saving,
      saveError: clearSaveError ? null : (saveError ?? this.saveError),
    );
  }
}

class EditProfileController extends Notifier<EditProfileFormState> {
  @override
  EditProfileFormState build() {
    final profile = ref.watch(ownProfileProvider).value;
    return EditProfileFormState(
      role: profile?.role ?? UserRole.normal,
      fullName: profile?.fullName ?? '',
    );
  }

  /// Reads the stored politician details + saved districts so the form
  /// opens filled in. Safe to call once from the screen's initState.
  Future<void> loadExisting() async {
    final profile = ref.read(ownProfileProvider).value;
    if (profile == null) {
      state = state.copyWith(loaded: true);
      return;
    }
    final districts = await ref.read(accountDistrictsProvider.future);
    var next = state.copyWith(matchedBoundaries: districts);
    if (profile.role == UserRole.politician) {
      final details =
          (await ref
                  .read(profileRepositoryProvider)
                  .getPoliticianDetails(profile.id))
              .valueOrNull;
      if (details != null) {
        next = next.copyWith(
          politicalPartyId: details.politicalPartyId,
          education: details.education ?? '',
          hometown: details.hometown ?? '',
          bio: details.bio ?? '',
          avatarUrl: details.avatarUrl,
        );
      }
    }
    state = next.copyWith(loaded: true);
  }

  void goToStep(int step) => state = state.copyWith(step: step);
  void nextStep() {
    if (state.step < state.totalSteps - 1) {
      state = state.copyWith(step: state.step + 1);
    }
  }

  void previousStep() {
    if (state.step > 0) state = state.copyWith(step: state.step - 1);
  }

  void setFullName(String value) => state = state.copyWith(fullName: value);
  void setPoliticalPartyId(int? value) =>
      state = state.copyWith(politicalPartyId: value);
  void setEducation(String value) => state = state.copyWith(education: value);
  void setHometown(String value) => state = state.copyWith(hometown: value);
  void setBio(String value) => state = state.copyWith(bio: value);

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
        state = state.copyWith(
          locating: false,
          matchedBoundaries: boundaries,
          locationChanged: true,
          locationError: boundaries.isEmpty
              ? 'No configured boundaries cover this location yet.'
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

  Future<void> uploadAvatar(Uint8List bytes, String extension) async {
    final userId = ref.read(ownProfileProvider).value?.id;
    if (userId == null) return;
    state = state.copyWith(uploadingAvatar: true, clearAvatarError: true);
    final result = await ref
        .read(profileRepositoryProvider)
        .uploadAvatar(userId, bytes, extension);
    result.when(
      ok: (url) =>
          state = state.copyWith(uploadingAvatar: false, avatarUrl: url),
      err: (_) => state = state.copyWith(
        uploadingAvatar: false,
        avatarError: 'Failed to upload image. Please try again.',
      ),
    );
  }

  void setAvatarError(String message) =>
      state = state.copyWith(avatarError: message);

  Future<bool> save() async {
    final profile = ref.read(ownProfileProvider).value;
    if (profile == null) return false;
    final userId = profile.id;
    state = state.copyWith(saving: true, clearSaveError: true);

    final repo = ref.read(profileRepositoryProvider);
    final coreResult = await repo.upsertProfileCore(
      userId: userId,
      role: state.role,
      fullName: state.fullName.trim().isEmpty ? null : state.fullName.trim(),
      // Untouched location → carry what's stored forward; only a fresh
      // pick replaces it.
      country: state.locationChanged ? state.country : profile.country,
      constituency: state.locationChanged
          ? state.constituency
          : profile.constituency,
    );
    if (coreResult.isErr) {
      state = state.copyWith(
        saving: false,
        saveError: 'Could not save your profile.',
      );
      return false;
    }

    if (state.role == UserRole.politician) {
      final ppResult = await repo.upsertPoliticianProfile(
        userId: userId,
        politicalPartyId: state.politicalPartyId,
        education: state.education.trim(),
        hometown: state.hometown.trim(),
        bio: state.bio.trim(),
        avatarUrl: state.avatarUrl,
        targetBoundaryId:
            state.locationChanged && state.matchedBoundaries.isNotEmpty
            ? '${state.matchedBoundaries.first.id}'
            : null,
        targetBoundaryName: state.locationChanged ? state.constituency : null,
      );
      if (ppResult.isErr) {
        state = state.copyWith(
          saving: false,
          saveError: 'Could not save your political details.',
        );
        return false;
      }
    }

    state = state.copyWith(saving: false);
    ref.invalidate(accountDistrictsProvider);
    ref.invalidate(userBoundaryMembershipsProvider);
    await ref.read(ownProfileProvider.notifier).refresh();
    return true;
  }
}

final editProfileControllerProvider =
    NotifierProvider<EditProfileController, EditProfileFormState>(
      EditProfileController.new,
    );
