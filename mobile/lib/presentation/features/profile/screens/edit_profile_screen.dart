// Edit profile — ONE form for everyone (citizen and politician alike): your
// name and your location. Party, education, hometown and bio are not
// editable here (politicians keep whatever they already have — the save only
// writes the fields this form changes). Politicians can set a public photo. Location is a card that opens the map
// on demand; Save is pinned at the bottom.
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
  bool _mapOpen = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(
      text: ref.read(editProfileControllerProvider).fullName,
    );
  }

  @override
  void dispose() {
    _name.dispose();
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
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final ok = await ref.read(editProfileControllerProvider.notifier).save();
    if (!ok) return;
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('Profile saved')));
    if (navigator.canPop()) navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final s = ref.watch(editProfileControllerProvider);
    final c = ref.read(editProfileControllerProvider.notifier);
    final isPolitician = s.role == UserRole.politician;

    final seen = <String>{};
    final boundaries = s.matchedBoundaries
        .where((b) => seen.add(b.name))
        .toList();
    final initial =
        (_name.text.trim().isNotEmpty
                ? _name.text.trim()[0]
                : (isPolitician ? 'P' : 'C'))
            .toUpperCase();

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
              // Identity: a tinted initial, the role, and the name field.
              AppCard(
                padding: const EdgeInsets.all(ChosenoSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        if (isPolitician)
                          // Politicians: tap to add / change the public photo.
                          GestureDetector(
                            onTap: s.uploadingAvatar ? null : _pickAvatar,
                            child: Stack(
                              alignment: Alignment.bottomRight,
                              children: [
                                AppAvatar(
                                  imageUrl: s.avatarUrl,
                                  fallbackText: _name.text,
                                  radius: 30,
                                ),
                                Container(
                                  padding: const EdgeInsets.all(5),
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
                          )
                        else
                          Container(
                            width: 52,
                            height: 52,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: palette.primary.withValues(alpha: 0.12),
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              initial,
                              style: ChosenoTypography.display(
                                color: palette.primary,
                                fontSize: 24,
                              ),
                            ),
                          ),
                        const SizedBox(width: ChosenoSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _name.text.trim().isEmpty
                                    ? 'Your name'
                                    : _name.text.trim(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: ChosenoTypography.display(
                                  color: palette.textMain,
                                  fontSize: 20,
                                ),
                              ),
                              const SizedBox(height: 4),
                              AppBadge(
                                label: isPolitician ? 'Politician' : 'Citizen',
                                tone: AppBadgeTone.primary,
                                size: AppBadgeSize.xs,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: ChosenoSpacing.md),
                    AppTextField(
                      label: isPolitician
                          ? 'Public full name'
                          : 'Display name (optional)',
                      controller: _name,
                      onChanged: (v) {
                        c.setFullName(v);
                        setState(() {});
                      },
                    ),
                    const SizedBox(height: ChosenoSpacing.sm),
                    if (isPolitician && s.avatarError != null)
                      Padding(
                        padding: const EdgeInsets.only(
                          bottom: ChosenoSpacing.xs + 2,
                        ),
                        child: Text(
                          s.avatarError!,
                          style: ChosenoTypography.body(
                            color: palette.danger,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    _Note(
                      icon: isPolitician ? Icons.public : Icons.shield_outlined,
                      text: isPolitician
                          ? 'Your name and photo are shown on your public wall.'
                          : 'Posts stay tied to your anonymous Ghost ID, not this name.',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: ChosenoSpacing.sm + 2),
              // Location: boundaries as chips; the map opens on demand.
              AppCard(
                padding: const EdgeInsets.all(ChosenoSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            color: palette.primary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            Icons.place_outlined,
                            size: 17,
                            color: palette.primary,
                          ),
                        ),
                        const SizedBox(width: ChosenoSpacing.sm + 2),
                        Expanded(
                          child: Text(
                            'Your location',
                            style: ChosenoTypography.display(
                              color: palette.textMain,
                              fontSize: 18,
                            ),
                          ),
                        ),
                        TextButton.icon(
                          onPressed: () => setState(() => _mapOpen = !_mapOpen),
                          icon: Icon(
                            _mapOpen
                                ? Icons.expand_less_rounded
                                : Icons.edit_location_alt_outlined,
                            size: 18,
                          ),
                          label: Text(_mapOpen ? 'Done' : 'Change'),
                        ),
                      ],
                    ),
                    const SizedBox(height: ChosenoSpacing.sm),
                    if (boundaries.isEmpty)
                      Text(
                        'No location set yet — tap Change to pick one.',
                        style: ChosenoTypography.body(
                          color: palette.textMuted,
                          fontSize: 13,
                        ),
                      )
                    else
                      Wrap(
                        spacing: ChosenoSpacing.xs + 2,
                        runSpacing: ChosenoSpacing.xs + 2,
                        children: [
                          for (final b in boundaries)
                            _BoundaryChip(name: b.name, type: b.boundaryType),
                        ],
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
              const SizedBox(height: ChosenoSpacing.sm + 2),
              const _Note(
                icon: Icons.how_to_vote_outlined,
                text:
                    'Your location decides your representatives, the races on your ballot, and your Home feed tabs.',
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
                icon: Icons.check_rounded,
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

/// A one-line hint: small icon + muted text.
class _Note extends StatelessWidget {
  const _Note({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 15, color: palette.textMuted),
        const SizedBox(width: ChosenoSpacing.xs + 2),
        Expanded(
          child: Text(
            text,
            style: ChosenoTypography.body(
              color: palette.textMuted,
              fontSize: 12,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}

/// A boundary as a soft chip: layers icon, name, and its level in muted text.
class _BoundaryChip extends StatelessWidget {
  const _BoundaryChip({required this.name, this.type});

  final String name;
  final String? type;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: palette.surfaceHover,
        borderRadius: BorderRadius.circular(ChosenoRadii.full),
        border: Border.all(color: palette.borderLight),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.layers_outlined, size: 13, color: palette.primary),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              name,
              overflow: TextOverflow.ellipsis,
              style: ChosenoTypography.body(
                color: palette.textMain,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ),
          if (type != null) ...[
            const SizedBox(width: 5),
            Text(
              type!,
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: 11,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
