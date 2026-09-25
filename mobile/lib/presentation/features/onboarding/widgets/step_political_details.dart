// Step 4, Politician only — party dropdown (scoped to the country the
// Location step resolved), education, hometown, free-text bio/platform.
// No office is chosen here (docs/FLUTTER_MOBILE_APP_GUIDE.md §4.C — a
// politician nominates for a real seat later, from My Elections).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/political_parties/entities/political_party.dart';
import '../../political_parties/providers/political_parties_providers.dart';

/// Country-scoped party list. A `FutureProvider.family` (not a plain
/// `FutureProvider`) since the country only becomes known once Step 2
/// resolves a location — re-runs automatically if the resolved country
/// changes.
final politicalPartiesForCountryProvider =
    FutureProvider.family<List<PoliticalParty>, String?>((ref, country) async {
      final result = await ref
          .watch(politicalPartiesRepositoryProvider)
          .getPoliticalParties(country: country);
      return result.when(
        ok: (parties) => parties,
        err: (failure) => throw failure,
      );
    });

class StepPoliticalDetails extends ConsumerStatefulWidget {
  const StepPoliticalDetails({
    super.key,
    required this.country,
    required this.politicalPartyId,
    required this.education,
    required this.hometown,
    required this.bio,
    required this.onPartyChanged,
    required this.onEducationChanged,
    required this.onHometownChanged,
    required this.onBioChanged,
    this.avatarUrl,
    this.uploadingAvatar = false,
    this.avatarError,
    this.onPickAvatar,
    this.fullName,
  });

  final String? country;
  final int? politicalPartyId;
  final String education;
  final String hometown;
  final String bio;
  final ValueChanged<int?> onPartyChanged;
  final ValueChanged<String> onEducationChanged;
  final ValueChanged<String> onHometownChanged;
  final ValueChanged<String> onBioChanged;

  /// Optional profile photo — the web's onboarding step offers the same
  /// upload (`uploadAvatarImage`, ≤5MB, `politician-avatars` bucket).
  final String? avatarUrl;
  final bool uploadingAvatar;
  final String? avatarError;
  final VoidCallback? onPickAvatar;
  final String? fullName;

  @override
  ConsumerState<StepPoliticalDetails> createState() =>
      _StepPoliticalDetailsState();
}

class _StepPoliticalDetailsState extends ConsumerState<StepPoliticalDetails> {
  late final _educationController = TextEditingController(
    text: widget.education,
  );
  late final _hometownController = TextEditingController(text: widget.hometown);
  late final _bioController = TextEditingController(text: widget.bio);

  @override
  void dispose() {
    _educationController.dispose();
    _hometownController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final partiesAsync = ref.watch(
      politicalPartiesForCountryProvider(widget.country),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Your political details',
          style: ChosenoTypography.display(
            color: palette.textMain,
            fontSize: 30,
          ),
        ),
        const SizedBox(height: ChosenoSpacing.lg),
        if (widget.onPickAvatar != null) ...[
          Row(
            children: [
              AppAvatar(
                imageUrl: widget.avatarUrl,
                fallbackText: widget.fullName,
                radius: 36,
              ),
              const SizedBox(width: ChosenoSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppButton(
                      label: widget.avatarUrl == null
                          ? 'Add a photo'
                          : 'Change photo',
                      icon: Icons.photo_camera_outlined,
                      variant: AppButtonVariant.outline,
                      loading: widget.uploadingAvatar,
                      onPressed: widget.uploadingAvatar
                          ? null
                          : widget.onPickAvatar,
                    ),
                    if (widget.avatarError != null)
                      Padding(
                        padding: const EdgeInsets.only(top: ChosenoSpacing.xs),
                        child: Text(
                          widget.avatarError!,
                          style: ChosenoTypography.body(
                            color: palette.danger,
                            fontSize: 12,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.lg),
        ],
        partiesAsync.when(
          data: (parties) => DropdownButtonFormField<int?>(
            initialValue: widget.politicalPartyId,
            decoration: const InputDecoration(
              labelText: 'Political party (optional)',
            ),
            items: [
              const DropdownMenuItem<int?>(
                value: null,
                child: Text('No party / independent'),
              ),
              ...parties.map(
                (p) => DropdownMenuItem<int?>(value: p.id, child: Text(p.name)),
              ),
            ],
            onChanged: widget.onPartyChanged,
          ),
          loading: () => const LoadingIndicator(size: 20),
          error: (_, _) => Text(
            'Could not load parties.',
            style: ChosenoTypography.body(color: palette.danger),
          ),
        ),
        const SizedBox(height: ChosenoSpacing.md),
        AppTextField(
          label: 'Education',
          controller: _educationController,
          onChanged: widget.onEducationChanged,
        ),
        const SizedBox(height: ChosenoSpacing.md),
        AppTextField(
          label: 'Hometown',
          controller: _hometownController,
          onChanged: widget.onHometownChanged,
        ),
        const SizedBox(height: ChosenoSpacing.md),
        TextField(
          controller: _bioController,
          onChanged: widget.onBioChanged,
          maxLines: 4,
          decoration: const InputDecoration(labelText: 'Bio / platform'),
        ),
      ],
    );
  }
}
