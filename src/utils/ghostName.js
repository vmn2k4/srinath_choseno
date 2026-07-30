// Deterministic "Ghost-AdjectiveNoun" label derived from a ghost_id UUID.
// No new storage: same input always maps to the same words, so it's a
// drop-in replacement for the raw "Ghost-<hex>" fragment everywhere it's
// currently rendered, without adding any new lookup that could tie a ghost
// id to anything else.

const ADJECTIVES = [
  'Quiet', 'Brave', 'Steady', 'Watchful', 'Candid', 'Bold', 'Fair', 'Wary',
  'Loyal', 'Nimble', 'Keen', 'Civic', 'Local', 'Guarded', 'Frank', 'Stalwart',
  'Earnest', 'Diligent', 'Plain', 'Sturdy', 'Vigilant', 'Humble', 'Ardent', 'Sound',
];

const NOUNS = [
  'Falcon', 'Wolf', 'Heron', 'Fox', 'Owl', 'Otter', 'Lynx', 'Raven',
  'Badger', 'Hawk', 'Sparrow', 'Elk', 'Wren', 'Marten', 'Egret', 'Beaver',
  'Osprey', 'Coyote', 'Finch', 'Stag', 'Kestrel', 'Heron', 'Magpie', 'Curlew',
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getGhostDisplayName(ghostId) {
  if (!ghostId) return 'Ghost-Unknown';
  const hash = hashString(ghostId);
  const adjective = ADJECTIVES[hash % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(hash / ADJECTIVES.length) % NOUNS.length];
  return `Ghost-${adjective}${noun}`;
}
