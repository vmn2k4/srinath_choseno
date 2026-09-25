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
import '../widgets/branch_holder_card.dart';
import '../widgets/election_seat_card.dart';

class FindMyDistrictScreen extends ConsumerStatefulWidget {
  const FindMyDistrictScreen({super.key});

  @override
  ConsumerState<FindMyDistrictScreen> createState() =>
      _FindMyDistrictScreenState();
}

class _FindMyDistrictScreenState extends ConsumerState<FindMyDistrictScreen> {
  bool? _pickerOpen;

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
            const ScreenHeader(title: 'District'),
            Expanded(
              child: RefreshIndicator(
                onRefresh: controller.detectLocation,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(
                    ChosenoSpacing.lg,
                    ChosenoSpacing.md,
                    ChosenoSpacing.lg,
                    kBottomNavClearance + ChosenoSpacing.lg,
                  ),
                  children: [
                    SectionHeader(
                      icon: Icons.my_location,
                      title: 'Find your district',
                      subtitle:
                          'Every electoral boundary covering a spot — who represents it and what is on the ballot.',
                      trailing: state.boundaries.isNotEmpty
                          ? AppButton(
                              label: pickerOpen ? 'Hide map' : 'Change',
                              variant: AppButtonVariant.text,
                              onPressed: () =>
                                  setState(() => _pickerOpen = !pickerOpen),
                            )
                          : null,
                    ),
                    const SizedBox(height: ChosenoSpacing.lg),
                    AnimatedSize(
                      duration: const Duration(milliseconds: 240),
                      curve: Curves.easeOutCubic,
                      alignment: Alignment.topCenter,
                      child: pickerOpen
                          ? _Picker(state: state, controller: controller)
                          : const SizedBox(width: double.infinity),
                    ),
                    if (state.lookingUp) ...[
                      const SizedBox(height: ChosenoSpacing.xl),
                      const Center(child: LoadingIndicator()),
                    ] else if (state.locationError != null) ...[
                      const SizedBox(height: ChosenoSpacing.md),
                      _ErrorNote(message: state.locationError!),
                    ],
                    if (!state.lookingUp && state.boundaries.isNotEmpty) ...[
                      const SizedBox(height: ChosenoSpacing.xl),
                      SectionHeader(
                        icon: Icons.layers_outlined,
                        title: 'Your boundaries',
                        subtitle:
                            '${state.boundaries.length} found at this location',
                      ),
                      if (state.hasPoint) ...[
                        const SizedBox(height: ChosenoSpacing.md),
                        AppButton(
                          label: state.myLocationSaved
                              ? 'Saved as your location'
                              : 'Set as my location',
                          icon: state.myLocationSaved
                              ? Icons.check_circle
                              : Icons.push_pin_outlined,
                          variant: state.myLocationSaved
                              ? AppButtonVariant.outline
                              : AppButtonVariant.primary,
                          loading: state.savingMyLocation,
                          onPressed:
                              state.myLocationSaved || state.savingMyLocation
                              ? null
                              : controller.setAsMyLocation,
                        ),
                      ],
                      const SizedBox(height: ChosenoSpacing.md),
                      for (final b in state.boundaries)
                        Padding(
                          padding: const EdgeInsets.only(
                            bottom: ChosenoSpacing.sm + 2,
                          ),
                          child: AppCard(
                            variant: AppCardVariant.row,
                            padding: const EdgeInsets.symmetric(
                              horizontal: ChosenoSpacing.md,
                              vertical: ChosenoSpacing.md,
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: palette.primary.withValues(
                                      alpha: 0.12,
                                    ),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(
                                    Icons.layers_outlined,
                                    size: 20,
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
                                          fontWeight: FontWeight.w700,
                                          fontSize: 15,
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
                    if (state.seatsLoading || state.seats.isNotEmpty) ...[
                      const SizedBox(height: ChosenoSpacing.xl),
                      const SectionHeader(
                        icon: Icons.auto_awesome,
                        title: 'Races in your area',
                        subtitle:
                            'Open seats and candidates in these boundaries.',
                      ),
                      const SizedBox(height: ChosenoSpacing.md),
                      if (state.seatsLoading)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(ChosenoSpacing.lg),
                            child: LoadingIndicator(),
                          ),
                        )
                      else
                        ...state.seats.map(
                          (seat) => Padding(
                            padding: const EdgeInsets.only(
                              bottom: ChosenoSpacing.sm + 2,
                            ),
                            child: ElectionSeatCard(
                              seat: seat,
                              onTap: () =>
                                  context.push(AppRoutes.seat(seat.id)),
                            ),
                          ),
                        ),
                    ],
                    if (state.branchesLoading || state.branches.isNotEmpty) ...[
                      const SizedBox(height: ChosenoSpacing.xl),
                      const SectionHeader(
                        icon: Icons.account_tree_outlined,
                        title: 'Chain of representation',
                        subtitle: 'The people who hold office for you.',
                      ),
                      const SizedBox(height: ChosenoSpacing.md),
                      if (state.branchesLoading)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(ChosenoSpacing.lg),
                            child: LoadingIndicator(),
                          ),
                        )
                      else ...[
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: [
                              _BranchTab(
                                label: 'All',
                                selected: state.activeBranchKey == 'all',
                                onTap: () => controller.selectBranchTab('all'),
                              ),
                              ...state.branches.map(
                                (b) => _BranchTab(
                                  label: b.label,
                                  selected: state.activeBranchKey == b.key,
                                  onTap: () =>
                                      controller.selectBranchTab(b.key),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: ChosenoSpacing.lg),
                        for (final branch in state.visibleBranches) ...[
                          if (branch.districtName != null)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: ChosenoSpacing.sm,
                              ),
                              child: Text(
                                '${branch.label} · ${branch.districtName}'
                                    .toUpperCase(),
                                style: ChosenoTypography.body(
                                  color: palette.textTertiary,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 11,
                                ).copyWith(letterSpacing: 0.8),
                              ),
                            ),
                          if (branch.top != null)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: ChosenoSpacing.sm + 2,
                              ),
                              child: BranchHolderCard(
                                node: branch.top!,
                                emphasized: true,
                                onViewWall: () =>
                                    _openWall(context, branch.top!),
                              ),
                            ),
                          ...branch.bottom.map(
                            (node) => Padding(
                              padding: const EdgeInsets.only(
                                bottom: ChosenoSpacing.sm + 2,
                              ),
                              child: BranchHolderCard(
                                node: node,
                                onViewWall: () => _openWall(context, node),
                              ),
                            ),
                          ),
                          const SizedBox(height: ChosenoSpacing.md),
                        ],
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
          onSelected: (s) => controller.pickPoint(s.lat, s.lng),
        ),
        const SizedBox(height: ChosenoSpacing.md),
        LocationPickerMap(
          height: 300,
          point: state.hasPoint
              ? LatLng(state.pointLat!, state.pointLng!)
              : null,
          onPick: (p) => controller.pickPoint(p.latitude, p.longitude),
        ),
        const SizedBox(height: ChosenoSpacing.md),
        AppButton(
          label: 'Use my current location',
          icon: Icons.my_location,
          variant: AppButtonVariant.outline,
          loading: state.locating,
          onPressed: state.locating ? null : controller.detectLocation,
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

class _BranchTab extends StatelessWidget {
  const _BranchTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(right: ChosenoSpacing.sm),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
        showCheckmark: false,
        selectedColor: palette.primary,
        labelStyle: ChosenoTypography.body(
          color: selected ? palette.textOnPrimary : palette.textMain,
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
        backgroundColor: palette.surfaceHover,
        side: BorderSide.none,
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(horizontal: ChosenoSpacing.sm),
      ),
    );
  }
}
