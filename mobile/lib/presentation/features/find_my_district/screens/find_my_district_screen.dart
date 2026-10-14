// Screen A.10 from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo) — the
// mobile port of FindMyDistrictClient.tsx: an address search + tap-to-pick
// map (InteractiveLocationPicker.tsx), the boundaries that point falls in,
// the open races in them, and the chain of representation. The account's
// saved districts load first; a lookup never overwrites them — only the
// explicit "Set as my location" button does.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/branch_holder_node.dart';
import '../../../common/widgets/app_shell.dart';
import '../../../common/widgets/screen_header.dart';
import '../../location/widgets/address_search_field.dart';
import '../../location/widgets/location_picker_map.dart';
import '../providers/find_my_district_providers.dart';
import '../widgets/representation_tree.dart';

class FindMyDistrictScreen extends ConsumerStatefulWidget {
  const FindMyDistrictScreen({super.key});

  @override
  ConsumerState<FindMyDistrictScreen> createState() =>
      _FindMyDistrictScreenState();
}

class _FindMyDistrictScreenState extends ConsumerState<FindMyDistrictScreen> {
  bool? _pickerOpen;
  bool _boundariesOpen = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () =>
          ref.read(findMyDistrictControllerProvider.notifier).loadFromAccount(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final state = ref.watch(findMyDistrictControllerProvider);
    final controller = ref.read(findMyDistrictControllerProvider.notifier);
    // Collapsed once results exist (there's no reason to keep a map in the
    // way of them); open on a fresh visit with nothing resolved yet.
    final pickerOpen = _pickerOpen ?? state.boundaries.isEmpty;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const ScreenHeader(title: 'Representatives'),
            Expanded(
              child: RefreshIndicator(
                onRefresh: controller.reloadFromAccount,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(
                    ChosenoSpacing.lg,
                    ChosenoSpacing.md,
                    ChosenoSpacing.lg,
                    kBottomNavClearance + ChosenoSpacing.lg,
                  ),
                  children: [
                    // Top row: where these representatives are for. The icon
                    // opens / folds the map to change the location.
                    if (state.boundaries.isNotEmpty) ...[
                      SectionHeader(
                        icon: Icons.account_tree_outlined,
                        title: 'Your representatives',
                        trailing: HeaderIconButton(
                          icon: pickerOpen
                              ? Icons.expand_less_rounded
                              : Icons.edit_location_alt_outlined,
                          tooltip: pickerOpen ? 'Hide map' : 'Change location',
                          onTap: () =>
                              setState(() => _pickerOpen = !pickerOpen),
                        ),
                      ),
                      const SizedBox(height: ChosenoSpacing.md),
                    ],
                    AnimatedSize(
                      duration: const Duration(milliseconds: 240),
                      curve: Curves.easeOutCubic,
                      alignment: Alignment.topCenter,
                      child: pickerOpen
                          ? _Picker(state: state, controller: controller)
                          : const SizedBox(width: double.infinity),
                    ),
                    if (state.lookingUp) ...[
                      const SizedBox(height: ChosenoSpacing.lg),
                      const Center(child: LoadingIndicator()),
                    ] else if (state.locationError != null) ...[
                      const SizedBox(height: ChosenoSpacing.md),
                      _ErrorNote(message: state.locationError!),
                    ],
                    if (state.branchesLoading || state.branches.isNotEmpty) ...[
                      if (state.branchesLoading)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(ChosenoSpacing.lg),
                            child: LoadingIndicator(),
                          ),
                        )
                      else
                        RepresentationTree(
                          branches: state.branches,
                          onOpen: (node) => _openWall(context, node),
                        ),
                    ],
                    // Boundary names stay out of the way until asked for.
                    if (!state.lookingUp && state.boundaries.isNotEmpty) ...[
                      const SizedBox(height: ChosenoSpacing.sm),
                      InkWell(
                        borderRadius: BorderRadius.circular(ChosenoRadii.sm),
                        onTap: () =>
                            setState(() => _boundariesOpen = !_boundariesOpen),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: ChosenoSpacing.sm,
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.layers_outlined,
                                size: 18,
                                color: palette.primary,
                              ),
                              const SizedBox(width: ChosenoSpacing.sm),
                              Expanded(
                                child: Text(
                                  'Your boundaries (${state.boundaries.length})',
                                  style: ChosenoTypography.body(
                                    color: palette.textMain,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 15,
                                  ),
                                ),
                              ),
                              Icon(
                                _boundariesOpen
                                    ? Icons.expand_less_rounded
                                    : Icons.expand_more_rounded,
                                color: palette.textMuted,
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (_boundariesOpen) ...[
                        const SizedBox(height: ChosenoSpacing.xs),
                        for (final b in state.boundaries)
                          Padding(
                            padding: const EdgeInsets.only(
                              bottom: ChosenoSpacing.xs + 2,
                            ),
                            child: AppCard(
                              variant: AppCardVariant.row,
                              padding: const EdgeInsets.symmetric(
                                horizontal: ChosenoSpacing.sm + 4,
                                vertical: ChosenoSpacing.sm + 2,
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 32,
                                    height: 32,
                                    decoration: BoxDecoration(
                                      color: palette.primary.withValues(
                                        alpha: 0.12,
                                      ),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(
                                      Icons.layers_outlined,
                                      size: 17,
                                      color: palette.primary,
                                    ),
                                  ),
                                  const SizedBox(width: ChosenoSpacing.md),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          b.name,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: ChosenoTypography.body(
                                            color: palette.textMain,
                                            fontWeight: FontWeight.w600,
                                            fontSize: 14,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          [
                                            if (b.boundaryType != null)
                                              b.boundaryType!,
                                            if (b.country != null) b.country!,
                                          ].join(' · '),
                                          style: ChosenoTypography.body(
                                            color: palette.textMuted,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openWall(BuildContext context, BranchHolderNode node) {
    // Prefer the stored wall_slug (skips a redirect hop, see
    // getWallOwnerProfileBySlug's own comment) — fall back to the ghost id
    // only when no slug is on file yet.
    final idOrSlug = node.wallSlug ?? node.ghostId;
    if (idOrSlug == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This official has no public wall yet.')),
      );
      return;
    }
    context.push(AppRoutes.wall(idOrSlug));
  }
}

class _Picker extends StatelessWidget {
  const _Picker({required this.state, required this.controller});

  final FindMyDistrictState state;
  final FindMyDistrictController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AddressSearchField(
          onSelected: (s) => controller.pickPoint(s.lat, s.lng, fromMap: true),
        ),
        const SizedBox(height: ChosenoSpacing.md),
        LocationPickerMap(
          height: 300,
          point: state.hasPoint
              ? LatLng(state.pointLat!, state.pointLng!)
              : null,
          onPick: (p) =>
              controller.pickPoint(p.latitude, p.longitude, fromMap: true),
        ),
        const SizedBox(height: ChosenoSpacing.md),
        // Side by side. "Set as mine" appears after a deliberate pick — a tap on
        // the map or a searched place — never for the saved districts that
        // load on open, and not for a GPS fix.
        Row(
          children: [
            Expanded(
              child: AppButton(
                label: 'Use GPS',
                icon: Icons.my_location,
                variant: AppButtonVariant.outline,
                loading: state.locating,
                onPressed: state.locating ? null : controller.detectLocation,
              ),
            ),
            if (state.pointFromMap &&
                !state.lookingUp &&
                state.boundaries.isNotEmpty) ...[
              const SizedBox(width: ChosenoSpacing.sm),
              Expanded(
                child: AppButton(
                  label: state.myLocationSaved ? 'Saved' : 'Set as mine',
                  icon: state.myLocationSaved
                      ? Icons.check_circle
                      : Icons.push_pin_outlined,
                  variant: state.myLocationSaved
                      ? AppButtonVariant.outline
                      : AppButtonVariant.primary,
                  loading: state.savingMyLocation,
                  onPressed: state.myLocationSaved || state.savingMyLocation
                      ? null
                      : controller.setAsMyLocation,
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _ErrorNote extends StatelessWidget {
  const _ErrorNote({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Container(
      padding: const EdgeInsets.all(ChosenoSpacing.md),
      decoration: BoxDecoration(
        color: palette.danger.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(ChosenoRadii.sm * 2),
        border: Border.all(color: palette.danger.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline, size: 18, color: palette.danger),
          const SizedBox(width: ChosenoSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: ChosenoTypography.body(
                color: palette.danger,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
