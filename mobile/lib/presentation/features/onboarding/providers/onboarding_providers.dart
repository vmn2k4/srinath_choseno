// Onboarding's form state + submit action. Unlike Auth's AsyncNotifier
// (which only ever holds "is a network call in flight"), this one also
// holds the multi-step form's in-progress values — there's no server-side
// draft for an onboarding-in-progress the way there is for
// e.g. Candidate Application's statement (autosaved on blur on web), so
// everything lives in memory until the final submit.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/boundaries/entities/matched_boundary.dart';
import '../../../../domain/profile/entities/user_profile.dart';
import '../../auth/providers/auth_providers.dart';
import '../../location/providers/location_providers.dart';
import '../../profile/providers/profile_providers.dart';

@immutable
class OnboardingFormState {
  const OnboardingFormState({
    this.step = 0,
    this.role = UserRole.normal,
    this.lat,
    this.lng,
    this.matchedBoundaries = const [],
    this.locating = false,
    this.locationError,
    this.fullName = '',
    this.politicalPartyId,
    this.education = '',
    this.hometown = '',
    this.bio = '',
    this.avatarUrl,
    this.uploadingAvatar = false,
    this.avatarError,
    this.submitting = false,
    this.submitError,
  });

  final int step;
  final UserRole role;
  final double? lat;
  final double? lng;
  final List<MatchedBoundary> matchedBoundaries;
  final bool locating;
  final String? locationError;
  final String fullName;
  final int? politicalPartyId;
  final String education;
  final String hometown;
  final String bio;
  final String? avatarUrl;
  final bool uploadingAvatar;
  final String? avatarError;
  final bool submitting;
  final String? submitError;

  /// 3 steps for a Citizen, 4 for a Politician (docs/FLUTTER_MOBILE_APP_GUIDE.md §4.C).
  int get totalSteps => role == UserRole.politician ? 4 : 3;

  String? get country =>
      matchedBoundaries.isNotEmpty ? matchedBoundaries.first.country : null;

  String? get constituency => matchedBoundaries.isEmpty
      ? null
      : matchedBoundaries.map((b) => b.name).join(', ');

  OnboardingFormState copyWith({
    int? step,
    UserRole? role,
    double? lat,
    double? lng,
    List<MatchedBoundary>? matchedBoundaries,
    bool? locating,
    String? locationError,
    bool clearLocationError = false,
    String? fullName,
    int? politicalPartyId,
    String? education,
    String? hometown,
    String? bio,
    String? avatarUrl,
    bool? uploadingAvatar,
    String? avatarError,
    bool clearAvatarError = false,
    bool? submitting,
    String? submitError,
    bool clearSubmitError = false,
  }) {
    return OnboardingFormState(
      step: step ?? this.step,
      role: role ?? this.role,
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
      matchedBoundaries: matchedBoundaries ?? this.matchedBoundaries,
      locating: locating ?? this.locating,
      locationError: clearLocationError
          ? null
          : (locationError ?? this.locationError),
      fullName: fullName ?? this.fullName,
      politicalPartyId: politicalPartyId ?? this.politicalPartyId,
      education: education ?? this.education,
      hometown: hometown ?? this.hometown,
      bio: bio ?? this.bio,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      uploadingAvatar: uploadingAvatar ?? this.uploadingAvatar,
      avatarError: clearAvatarError ? null : (avatarError ?? this.avatarError),
      submitting: submitting ?? this.submitting,
      submitError: clearSubmitError ? null : (submitError ?? this.submitError),
    );
  }
}

class OnboardingController extends Notifier<OnboardingFormState> {
  @override
  OnboardingFormState build() => const OnboardingFormState();

  void selectRole(UserRole role) => state = state.copyWith(role: role);

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

  /// A map tap, address-search hit, or GPS fix — resolves every boundary
  /// the point falls inside and persists the membership immediately (the
  /// web's StepLocation `lookupBoundaries`: lookup, then sync).
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
          locationError: boundaries.isEmpty
              ? 'No configured boundaries cover this location yet. You can still continue.'
              : null,
        );
      },
      err: (_) {
        state = state.copyWith(
          locating: false,
          locationError: 'Could not resolve location boundaries.',
        );
      },
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
    final userId = ref.read(authStateChangesProvider).value?.id;
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

  Future<bool> submit() async {
    final userId = ref.read(authStateChangesProvider).value?.id;
    if (userId == null) {
      state = state.copyWith(submitError: 'You must be signed in.');
      return false;
    }

    state = state.copyWith(submitting: true, clearSubmitError: true);
    final result = await ref.read(completeOnboardingProvider)(
      userId: userId,
      role: state.role,
      fullName: state.fullName.trim().isEmpty ? null : state.fullName.trim(),
      country: state.country,
      constituency: state.constituency,
      politicalPartyId: state.politicalPartyId,
      education: state.education.trim().isEmpty ? null : state.education.trim(),
      hometown: state.hometown.trim().isEmpty ? null : state.hometown.trim(),
      bio: state.bio.trim().isEmpty ? null : state.bio.trim(),
      avatarUrl: state.avatarUrl,
      targetBoundaryId: state.matchedBoundaries.isEmpty
          ? null
          : '${state.matchedBoundaries.first.id}',
      targetBoundaryName: state.constituency,
    );

    return result.when(
      ok: (_) async {
        state = state.copyWith(submitting: false);
        // Router's onboarding guard (core/router/app_router.dart) reads
        // ownProfileProvider — refresh it now rather than waiting for an
        // unrelated auth event to trigger a re-fetch.
        await ref.read(ownProfileProvider.notifier).refresh();
        return true;
      },
      err: (failure) async {
        state = state.copyWith(submitting: false, submitError: failure.message);
        return false;
      },
    );
  }
}

final onboardingControllerProvider =
    NotifierProvider<OnboardingController, OnboardingFormState>(
      OnboardingController.new,
    );
