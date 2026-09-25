import 'package:choseno_mobile/domain/profile/entities/user_profile.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('UserProfile.myWallSlug', () {
    test('null for a citizen, regardless of any wall fields', () {
      const citizen = UserProfile(
        id: 'u1',
        role: UserRole.normal,
        onboardingCompleted: true,
        fullName: 'Jane Smith',
      );
      expect(citizen.myWallSlug, isNull);
    });

    test('prefers the stored wall_slug when the politician has one', () {
      const politician = UserProfile(
        id: 'u1',
        role: UserRole.politician,
        onboardingCompleted: true,
        fullName: 'Jane Smith',
        politicianWallSlug: 'jane-the-mayor',
      );
      expect(politician.myWallSlug, 'jane-the-mayor');
    });

    test('computes a fallback slug from name/designation when wall_slug is '
        'null — the bug this was written to fix: without it, a politician '
        'with no wall_slug assigned yet never sees "My Wall" at all', () {
      const politician = UserProfile(
        id: 'u1',
        role: UserRole.politician,
        onboardingCompleted: true,
        fullName: 'Jane Smith',
        designation: 'Mayor',
      );
      expect(politician.myWallSlug, 'jane-smith-mayor');
    });

    test(
      'fallback still resolves to something with no name or designation',
      () {
        const politician = UserProfile(
          id: 'u1',
          role: UserRole.politician,
          onboardingCompleted: true,
        );
        expect(politician.myWallSlug, 'politician');
      },
    );
  });
}
