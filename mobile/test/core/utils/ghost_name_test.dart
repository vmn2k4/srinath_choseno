import 'package:choseno_mobile/core/utils/ghost_name.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // Expected values computed with the website's getGhostDisplayName
  // (src/lib/utils/ghostName.ts) so both platforms agree.
  test('matches the website for the same ghost id', () {
    expect(
      ghostDisplayName('9a7105e2-1111-4a2b-8c3d-aaaaaaaaaaaa'),
      'Ghost-BoldFinch',
    );
    expect(
      ghostDisplayName('caa021f0-2222-4b3c-9d4e-bbbbbbbbbbbb'),
      'Ghost-QuietCoyote',
    );
    expect(
      ghostDisplayName('00000000-0000-0000-0000-000000000000'),
      'Ghost-QuietBadger',
    );
    expect(ghostDisplayName('ZZZ'), 'Ghost-PlainFox');
  });

  test('is stable and handles a missing id', () {
    expect(ghostDisplayName('abc'), ghostDisplayName('abc'));
    expect(ghostDisplayName(null), 'Ghost-Unknown');
    expect(ghostDisplayName(''), 'Ghost-Unknown');
  });
}
