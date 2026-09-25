// Screen I.8 from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo) —
// deliberately small and mechanical, matching that section's own note:
// "keep it that way rather than over-investing in polish for a rarely-hit
// recovery flow." No `next` redirect-target param yet (go_router's
// `redirect:` in app_router.dart always sends the viewer to Home once this
// resolves, rather than back to wherever they were headed — acceptable
// for how rarely this screen is hit; revisit if it turns out to matter).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../onboarding/widgets/step_location.dart';
import '../providers/set_location_providers.dart';

class SetLocationScreen extends ConsumerWidget {
  const SetLocationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(setLocationControllerProvider);
    final controller = ref.read(setLocationControllerProvider.notifier);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  ChosenoSpacing.lg + 4,
                  ChosenoSpacing.xl,
                  ChosenoSpacing.lg + 4,
                  ChosenoSpacing.lg,
                ),
                child: StepLocation(
                  locating: state.locating,
                  locationError: state.locationError,
                  matchedBoundaries: state.matchedBoundaries,
                  onDetect: controller.detectLocation,
                  onPick: controller.pickLocation,
                  pointLat: state.lat,
                  pointLng: state.lng,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                ChosenoSpacing.lg + 4,
                ChosenoSpacing.sm,
                ChosenoSpacing.lg + 4,
                ChosenoSpacing.lg,
              ),
              child: SizedBox(
                width: double.infinity,
                child: AppButton(
                  label: 'Continue',
                  loading: state.saving,
                  onPressed: (state.hasLocation && !state.saving)
                      ? controller.finish
                      : null,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
