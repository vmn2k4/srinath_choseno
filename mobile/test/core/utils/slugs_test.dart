import 'package:choseno_mobile/core/utils/slugs.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Slugs.slugifyText', () {
    test('lowercases, replaces runs of non-alphanumerics with one hyphen', () {
      expect(Slugs.slugifyText('John Doe'), 'john-doe');
      expect(
        Slugs.slugifyText('Councillor - Vancouver'),
        'councillor-vancouver',
      );
    });

    test('trims leading/trailing hyphens', () {
      expect(Slugs.slugifyText('  Jane!!'), 'jane');
    });
  });

  group('Slugs.buildPoliticianWallSlug', () {
    test('joins name and role', () {
      expect(
        Slugs.buildPoliticianWallSlug('Jane Smith', 'Mayor'),
        'jane-smith-mayor',
      );
    });

    test('falls back to just the name when role is null/empty', () {
      expect(Slugs.buildPoliticianWallSlug('Jane Smith', null), 'jane-smith');
      expect(Slugs.buildPoliticianWallSlug('Jane Smith', ''), 'jane-smith');
    });

    test('falls back to "politician" when both are null/empty', () {
      expect(Slugs.buildPoliticianWallSlug(null, null), 'politician');
      expect(Slugs.buildPoliticianWallSlug('', ''), 'politician');
    });
  });
}
