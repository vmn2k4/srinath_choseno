// Port of src/lib/utils/ghostName.ts — the same deterministic
// "Ghost-AdjectiveNoun" label the website shows for an anonymous author, so a
// person reads as the same name on web and mobile instead of a hex fragment.
// Same input always maps to the same words; nothing is stored. Keep both word
// lists byte-identical to the website's (including its repeated "Heron").
const _adjectives = [
  'Quiet',
  'Brave',
  'Steady',
  'Watchful',
  'Candid',
  'Bold',
  'Fair',
  'Wary',
  'Loyal',
  'Nimble',
  'Keen',
  'Civic',
  'Local',
  'Guarded',
  'Frank',
  'Stalwart',
  'Earnest',
  'Diligent',
  'Plain',
  'Sturdy',
  'Vigilant',
  'Humble',
  'Ardent',
  'Sound',
];

const _nouns = [
  'Falcon',
  'Wolf',
  'Heron',
  'Fox',
  'Owl',
  'Otter',
  'Lynx',
  'Raven',
  'Badger',
  'Hawk',
  'Sparrow',
  'Elk',
  'Wren',
  'Marten',
  'Egret',
  'Beaver',
  'Osprey',
  'Coyote',
  'Finch',
  'Stag',
  'Kestrel',
  'Heron',
  'Magpie',
  'Curlew',
];

int _hashString(String s) {
  var hash = 0;
  for (final unit in s.codeUnits) {
    hash = (hash * 31 + unit) & 0xFFFFFFFF;
  }
  return hash;
}

String ghostDisplayName(String? ghostId) {
  if (ghostId == null || ghostId.isEmpty) return 'Ghost-Unknown';
  final hash = _hashString(ghostId);
  final adjective = _adjectives[hash % _adjectives.length];
  final noun = _nouns[(hash ~/ _adjectives.length) % _nouns.length];
  return 'Ghost-$adjective$noun';
}
