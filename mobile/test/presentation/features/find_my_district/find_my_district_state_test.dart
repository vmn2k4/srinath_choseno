import 'package:choseno_mobile/domain/elections/entities/representation_branch.dart';
import 'package:choseno_mobile/presentation/features/find_my_district/providers/find_my_district_providers.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FindMyDistrictState.visibleBranches', () {
    const federal = RepresentationBranch(key: 'federal', label: 'Federal');
    const municipal = RepresentationBranch(
      key: 'municipal',
      label: 'Municipal',
    );

    test('"all" (the default) returns every branch', () {
      const state = FindMyDistrictState(branches: [federal, municipal]);
      expect(state.visibleBranches, [federal, municipal]);
    });

    test('a specific key narrows to just that branch', () {
      const state = FindMyDistrictState(
        branches: [federal, municipal],
        activeBranchKey: 'municipal',
      );
      expect(state.visibleBranches, [municipal]);
    });

    test('an unmatched key returns an empty list, not a fallback to all', () {
      const state = FindMyDistrictState(
        branches: [federal, municipal],
        activeBranchKey: 'provincial',
      );
      expect(state.visibleBranches, isEmpty);
    });
  });
}
