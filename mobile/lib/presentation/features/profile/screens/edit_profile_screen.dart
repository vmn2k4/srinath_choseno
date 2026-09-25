import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/avatar_picker.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/profile/entities/user_profile.dart';
import '../../onboarding/widgets/step_location.dart';
import '../../onboarding/widgets/step_political_details.dart';
import '../../onboarding/widgets/step_username.dart';
import '../providers/edit_profile_providers.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(editProfileControllerProvider.notifier).loadExisting(),
    );
  }

  Future<void> _pickAvatar() async {
    final controller = ref.read(editProfileControllerProvider.notifier);
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
    final formState = ref.watch(editProfileControllerProvider);
    final controller = ref.read(editProfileControllerProvider.notifier);
    final isLastStep = formState.step == formState.totalSteps - 1;

    final titles = [
      'Basic info',
      'Location',
      if (formState.role == UserRole.politician) 'Political details',
    ];

    final steps = <Widget>[
      StepUsername(
        role: formState.role,
        fullName: formState.fullName,
        onChanged: controller.setFullName,
      ),
      StepLocation(
        locating: formState.locating,
        locationError: formState.locationError,
        matchedBoundaries: formState.matchedBoundaries,
        onDetect: controller.detectLocation,
        onPick: controller.pickLocation,
        pointLat: formState.lat,
        pointLng: formState.lng,
      ),
      if (formState.role == UserRole.politician)
        StepPoliticalDetails(
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
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Edit profile · ${titles[formState.step]}',
          style: ChosenoTypography.body(
            color: palette.textMain,
            fontWeight: FontWeight.w700,
            fontSize: 16,
          ),
        ),
        leading: formState.step > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: controller.previousStep,
              )
            : null,
      ),
      body: SafeArea(
        child: !formState.loaded
            ? const Center(child: LoadingIndicator())
            : Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: ChosenoSpacing.lg + 4,
                    ),
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
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(
                        ChosenoSpacing.lg + 4,
                        ChosenoSpacing.lg,
                        ChosenoSpacing.lg + 4,
                        ChosenoSpacing.lg,
                      ),
                      child: steps[formState.step],
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
                        if (formState.saveError != null) ...[
                          Text(
                            formState.saveError!,
                            style: ChosenoTypography.body(
                              color: palette.danger,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: ChosenoSpacing.sm),
                        ],
                        AppButton(
                          label: isLastStep ? 'Save changes' : 'Continue',
                          loading: formState.saving,
                          onPressed: formState.saving
                              ? null
                              : () async {
                                  if (isLastStep) {
                                    final success = await controller.save();
                                    if (success && context.mounted) {
                                      Navigator.of(context).pop();
                                    }
                                  } else {
                                    controller.nextStep();
                                  }
                                },
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
