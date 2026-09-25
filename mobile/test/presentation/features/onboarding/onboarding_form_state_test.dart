import 'package:choseno_mobile/domain/boundaries/entities/matched_boundary.dart';
import 'package:choseno_mobile/domain/profile/entities/user_profile.dart';
import 'package:choseno_mobile/presentation/features/onboarding/providers/onboarding_providers.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('OnboardingFormState', () {
    test('totalSteps is 3 for a citizen, 4 for a politician', () {
      const citizen = OnboardingFormState(role: UserRole.normal);
      const politician = OnboardingFormState(role: UserRole.politician);
      expect(citizen.totalSteps, 3);
      expect(politician.totalSteps, 4);
    });

    test(
      'constituency joins matched boundary names, country reads the first one',
      () {
        const state = OnboardingFormState(
          matchedBoundaries: [
            MatchedBoundary(
              id: 1,
              name: 'Ward 3',
              country: 'Canada',
              boundaryType: 'Municipal',
            ),
            MatchedBoundary(
              id: 2,
              name: 'Central Riding',
              country: 'Canada',
              boundaryType: 'Provincial',
            ),
          ],
        );
        expect(state.constituency, 'Ward 3, Central Riding');
        expect(state.country, 'Canada');
      },
    );

    test('constituency/country are null with no matched boundaries', () {
      const state = OnboardingFormState();
      expect(state.constituency, isNull);
      expect(state.country, isNull);
    });

    test(
      'copyWith clears locationError only when clearLocationError is true',
      () {
        const withError = OnboardingFormState(
          locationError: 'no boundaries here',
        );
        final stillHasError = withError.copyWith(locating: true);
        final cleared = withError.copyWith(clearLocationError: true);

        expect(stillHasError.locationError, 'no boundaries here');
        expect(cleared.locationError, isNull);
      },
    );

    test('copyWith clears submitError only when clearSubmitError is true', () {
      const withError = OnboardingFormState(submitError: 'network down');
      final stillHasError = withError.copyWith(submitting: true);
      final cleared = withError.copyWith(clearSubmitError: true);

      expect(stillHasError.submitError, 'network down');
      expect(cleared.submitError, isNull);
    });
  });
}
