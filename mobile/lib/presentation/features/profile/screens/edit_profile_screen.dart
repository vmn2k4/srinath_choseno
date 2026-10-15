// Edit profile — one compact form (no wizard). Name, photo and, for
// politicians, party / education / hometown / bio; the location is a
// collapsed row that opens the map only when you want to change it. Save is
// pinned at the bottom. (The multi-step flow lives on in Onboarding, where
// it makes sense for a first-time user.)
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/avatar_picker.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/profile/entities/user_profile.dart';
import '../../../common/widgets/detail_app_bar.dart';
import '../../location/widgets/address_search_field.dart';
import '../../location/widgets/location_picker_map.dart';
import '../../onboarding/widgets/step_political_details.dart'
    show politicalPartiesForCountryProvider;
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

  @override
  Widget build(BuildContext context) {
    final loaded = ref.watch(
      editProfileControllerProvider.select((s) => s.loaded),
    );
    return Scaffold(
      appBar: const DetailAppBar(title: 'Edit profile'),
      body: SafeArea(
        child: loaded
            ? const _EditForm()
            : const Center(child: LoadingIndicator()),
      ),
    );
  }
}

class _EditForm extends ConsumerStatefulWidget {
  const _EditForm();

  @override
  ConsumerState<_EditForm> createState() => _EditFormState();
}

class _EditFormState extends ConsumerState<_EditForm> {
  late final TextEditingController _name;
  late final TextEditingController _education;
  late final TextEditingController _hometown;
  late final TextEditingController _bio;
  bool _mapOpen = false;

  @override
  void initState() {
    super.initState();
    final s = ref.read(editProfileControllerProvider);
    _name = TextEditingController(text: s.fullName);
    _education = TextEditingController(text: s.education);
    _hometown = TextEditingController(text: s.hometown);
    _bio = TextEditingController(text: s.bio);
  }

  @override
  void dispose() {
    _name.dispose();
    _education.dispose();
    _hometown.dispose();
    _bio.dispose();
    super.dispose();
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

  Future<void> _save() async {
    final ok = await ref.read(editProfileControllerProvider.notifier).save();
    if (ok && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final s = ref.watch(editProfileControllerProvider);
    final c = ref.read(editProfileControllerProvider.notifier);
    final isPolitician = s.role == UserRole.politician;
    final parties = isPolitician
        ? ref.watch(politicalPartiesForCountryProvider(s.country))
        : null;

    final boundaryNames = s.matchedBoundaries
        .map((b) => b.name)
        .toSet()
        .toList();

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              ChosenoSpacing.lg,
              ChosenoSpacing.sm,
              ChosenoSpacing.lg,
              ChosenoSpacing.md,
            ),
            children: [
              // Photo (politicians) + name, side by side.
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (isPolitician) ...[
                    GestureDetector(
                      onTap: s.uploadingAvatar ? null : _pickAvatar,
                      child: Stack(
                        alignment: Alignment.bottomRight,
                        children: [
                          AppAvatar(
                            imageUrl: s.avatarUrl,
                            fallbackText: s.fullName,
                            radius: 30,
                          ),
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: palette.primary,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: palette.surface,
                                width: 2,
                              ),
                            ),
                            child: s.uploadingAvatar
                                ? SizedBox(
                                    width: 12,
                                    height: 12,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: palette.textOnPrimary,
                                    ),
                                  )
                                : Icon(
                                    Icons.photo_camera,
                                    size: 12,
                                    color: palette.textOnPrimary,
                                  ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: ChosenoSpacing.md),
                  ],
                  Expanded(
                    child: AppTextField(
                      label: isPolitician
                          ? 'Public full name'
                          : 'Display name (optional)',
                      controller: _name,
                      onChanged: c.setFullName,
                    ),
                  ),
                ],
              ),
              if (s.avatarError != null)
                Padding(
                  padding: const EdgeInsets.only(top: ChosenoSpacing.xs),
                  child: Text(
                    s.avatarError!,
                    style: ChosenoTypography.body(
                      color: palette.danger,
                      fontSize: 12,
                    ),
                  ),
                ),
              if (!isPolitician)
                Padding(
                  padding: const EdgeInsets.only(top: ChosenoSpacing.xs + 2),
                  child: Text(
                    'Posts stay tied to your anonymous Ghost ID, not this name.',
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 12,
                    ),
                  ),
                ),
              if (isPolitician) ...[
                const SizedBox(height: ChosenoSpacing.md),
                parties!.when(
                  data: (list) => DropdownButtonFormField<int?>(
                    initialValue: s.politicalPartyId,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Political party',
                    ),
                    items: [
                      const DropdownMenuItem<int?>(
                        value: null,
                        child: Text('Independent / none'),
                      ),
                      ...list.map(
                        (p) => DropdownMenuItem<int?>(
                          value: p.id,
                          child: Text(p.name, overflow: TextOverflow.ellipsis),
                        ),
                      ),
                    ],
                    onChanged: c.setPoliticalPartyId,
                  ),
                  loading: () => const LinearProgressIndicator(minHeight: 2),
                  error: (_, _) => Text(
                    'Could not load parties.',
                    style: ChosenoTypography.body(color: palette.danger),
                  ),
                ),
                const SizedBox(height: ChosenoSpacing.md),
                AppTextField(
                  label: 'Education',
                  controller: _education,
                  onChanged: c.setEducation,
                ),
                const SizedBox(height: ChosenoSpacing.md),
                AppTextField(
                  label: 'Hometown',
                  controller: _hometown,
                  onChanged: c.setHometown,
                ),
                const SizedBox(height: ChosenoSpacing.md),
                TextField(
                  controller: _bio,
                  onChanged: c.setBio,
                  minLines: 3,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Bio / platform',
                    alignLabelWithHint: true,
                  ),
                ),
              ],
              const SizedBox(height: ChosenoSpacing.md),
              // Location: one row; the map opens on demand.
              AppCard(
                padding: const EdgeInsets.all(ChosenoSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    InkWell(
                      onTap: () => setState(() => _mapOpen = !_mapOpen),
                      child: Row(
                        children: [
                          Icon(
                            Icons.place_outlined,
                            size: 18,
                            color: palette.primary,
                          ),
                          const SizedBox(width: ChosenoSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Location',
                                  style: ChosenoTypography.body(
                                    color: palette.textMain,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                                Text(
                                  boundaryNames.isEmpty
                                      ? 'Not set'
                                      : boundaryNames.join(' · '),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: ChosenoTypography.body(
                                    color: palette.textMuted,
                                    fontSize: 12,
                                    height: 1.3,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            _mapOpen ? 'Done' : 'Change',
                            style: ChosenoTypography.body(
                              color: palette.primary,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_mapOpen) ...[
                      const SizedBox(height: ChosenoSpacing.md),
                      AddressSearchField(
                        onSelected: (g) => c.pickLocation(g.lat, g.lng),
                      ),
                      const SizedBox(height: ChosenoSpacing.sm),
                      LocationPickerMap(
                        height: 220,
                        point: s.lat != null && s.lng != null
                            ? LatLng(s.lat!, s.lng!)
                            : null,
                        onPick: (p) => c.pickLocation(p.latitude, p.longitude),
                      ),
                      const SizedBox(height: ChosenoSpacing.sm),
                      AppButton(
                        label: 'Use my current location',
                        icon: Icons.my_location,
                        variant: AppButtonVariant.outline,
                        loading: s.locating,
                        onPressed: s.locating ? null : c.detectLocation,
                      ),
                      if (s.locationError != null)
                        Padding(
                          padding: const EdgeInsets.only(
                            top: ChosenoSpacing.xs + 2,
                          ),
                          child: Text(
                            s.locationError!,
                            style: ChosenoTypography.body(
                              color: palette.danger,
                              fontSize: 12,
                            ),
                          ),
                        ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        // Pinned save bar.
        Container(
          padding: const EdgeInsets.fromLTRB(
            ChosenoSpacing.lg,
            ChosenoSpacing.sm,
            ChosenoSpacing.lg,
            ChosenoSpacing.md,
          ),
          decoration: BoxDecoration(
            color: palette.background,
            border: Border(top: BorderSide(color: palette.borderLight)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (s.saveError != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: ChosenoSpacing.xs + 2),
                  child: Text(
                    s.saveError!,
                    style: ChosenoTypography.body(
                      color: palette.danger,
                      fontSize: 13,
                    ),
                  ),
                ),
              AppButton(
                label: 'Save changes',
                loading: s.saving,
                onPressed: s.saving ? null : _save,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
