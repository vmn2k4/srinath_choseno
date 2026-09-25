// Screen C from docs/FLUTTER_MOBILE_APP_GUIDE.md §4.C (parent repo).
// Required first-run flow, gating every other authenticated screen until
// `profiles.onboarding_completed = true` — the router's second guard layer
// (core/router/app_router.dart) checks that field via ownProfileProvider.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/utils/avatar_picker.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/profile/entities/user_profile.dart';
import '../providers/onboarding_providers.dart';
import '../widgets/step_location.dart';
import '../widgets/step_political_details.dart';
import '../widgets/step_role.dart';
import '../widgets/step_username.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _pageController = PageController();

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _syncPage(int step) {
    if (_pageController.hasClients && _pageController.page?.round() != step) {
      _pageController.animateToPage(
        step,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _submit() async {
    final success = await ref
        .read(onboardingControllerProvider.notifier)
        .submit();
    if (success && mounted) {
      // Nothing to navigate to explicitly — ownProfileProvider.refresh()
      // (called inside submit()) flips onboarding_completed, and the
      // router's redirect logic takes it from here, same pattern as
      // SignInScreen.
    }
  }

  Future<void> _pickAvatar() async {
    final controller = ref.read(onboardingControllerProvider.notifier);
    final picked = await pickAvatarFromGallery();
    if (picked == null) return;
    if (picked.error != null) {
      controller.setAvatarError(picked.error!);
      return;
    }
    await controller.uploadAvatar(picked.photo!.bytes, picked.photo!.extension);
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final formState = ref.watch(onboardingControllerProvider);
    final controller = ref.read(onboardingControllerProvider.notifier);

    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _syncPage(formState.step),
    );

    final isLastStep = formState.step == formState.totalSteps - 1;
    final canAdvance = switch (formState.step) {
      0 => true, // Role — StepRole advances on tap itself
      1 =>
        formState
            .matchedBoundaries
            .isNotEmpty, // Location — must resolve at least one boundary
      2 =>
        formState.role != UserRole.politician ||
            formState.fullName
                .trim()
                .isNotEmpty, // Username — required for politicians
      _ => true, // Political Details — every field optional
    };

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                ChosenoSpacing.sm,
                ChosenoSpacing.sm,
                ChosenoSpacing.lg,
                0,
              ),
              child: Row(
                children: [
                  SizedBox(
                    width: 48,
                    child: formState.step > 0
                        ? IconButton(
                            icon: const Icon(Icons.arrow_back),
                            onPressed: controller.previousStep,
                          )
                        : null,
                  ),
                  Expanded(
                    child: Row(
                      children: [
                        for (var i = 0; i < formState.totalSteps; i++)
                          Expanded(
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 250),
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              height: 4,
                              decoration: BoxDecoration(
                                color: i <= formState.step
                                    ? palette.primary
                                    : palette.surfaceHover,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: ChosenoSpacing.md),
                  Text(
                    '${formState.step + 1}/${formState.totalSteps}',
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: PageView(
                controller: _pageController,
                physics:
                    const NeverScrollableScrollPhysics(), // steps advance via buttons only, not a swipe
                children: [
                  _StepScaffold(
                    child: StepRole(
                      selected: formState.role,
                      onSelect: (role) {
                        controller.selectRole(role);
                        controller.nextStep();
                      },
                    ),
                  ),
                  _StepScaffold(
                    child: StepLocation(
                      locating: formState.locating,
                      locationError: formState.locationError,
                      matchedBoundaries: formState.matchedBoundaries,
                      onDetect: controller.detectLocation,
                      onPick: controller.pickLocation,
                      pointLat: formState.lat,
                      pointLng: formState.lng,
                    ),
                  ),
                  _StepScaffold(
                    child: StepUsername(
                      role: formState.role,
                      fullName: formState.fullName,
                      onChanged: controller.setFullName,
                    ),
                  ),
                  if (formState.role == UserRole.politician)
                    _StepScaffold(
                      child: StepPoliticalDetails(
                        country: formState.country,
                        politicalPartyId: formState.politicalPartyId,
                        education: formState.education,
                        hometown: formState.hometown,
                        bio: formState.bio,
                        onPartyChanged: controller.setPoliticalPartyId,
                        onEducationChanged: controller.setEducation,
                        onHometownChanged: controller.setHometown,
                        onBioChanged: controller.setBio,
                        avatarUrl: formState.avatarUrl,
                        uploadingAvatar: formState.uploadingAvatar,
                        avatarError: formState.avatarError,
                        onPickAvatar: _pickAvatar,
                        fullName: formState.fullName,
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                ChosenoSpacing.lg + 4,
                ChosenoSpacing.sm,
                ChosenoSpacing.lg + 4,
                ChosenoSpacing.lg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (formState.submitError != null) ...[
                    Text(
                      formState.submitError!,
                      style: ChosenoTypography.body(
                        color: palette.danger,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: ChosenoSpacing.sm),
                  ],
                  // Step 0 (Role) advances itself on tap — no Continue
                  // button shown there, matching the web spec exactly.
                  if (formState.step != 0)
                    AppButton(
                      label: isLastStep ? 'Finish' : 'Continue',
                      loading: formState.submitting,
                      onPressed: !canAdvance || formState.submitting
                          ? null
                          : (isLastStep ? _submit : controller.nextStep),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StepScaffold extends StatelessWidget {
  const _StepScaffold({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(
        ChosenoSpacing.lg + 4,
        ChosenoSpacing.lg,
        ChosenoSpacing.lg + 4,
        ChosenoSpacing.lg,
      ),
      child: child,
    );
  }
}
