/**
 * Pure text helpers with no I/O — stateless string transforms shared across
 * layers (utils per docs/CODE_LAYERS.md).
 */

// Matches emoji, emoji-presentation symbols, flag regional indicators, and
// the invisible modifiers (variation selector U+FE0F, ZWJ U+200D) that often
// ride along with them. Deliberately narrower than the U+2000-U+3300
// "kitchen sink" ranges some emoji-strip snippets use — those also eat
// legitimate punctuation this app's news copy depends on, like em dashes in
// the dateline style ("CITY, Prov. — ...") and the ★ star bullets used in a
// few UI labels. \p{Extended_Pictographic} is the standard Unicode property
// for "this is an emoji-style pictograph", so it doesn't false-positive on
// those. Built fresh per call (not a module-level const) so the `g` flag's
// lastIndex never leaks stale state between a .test() and a later .replace().
const VARIATION_SELECTOR = String.fromCharCode(0xfe0f);
const ZERO_WIDTH_JOINER = String.fromCharCode(0x200d);

function emojiPattern(): RegExp {
  return new RegExp(
    `\\p{Extended_Pictographic}|\\p{Regional_Indicator}|${VARIATION_SELECTOR}|${ZERO_WIDTH_JOINER}`,
    "gu"
  );
}

export function containsEmoji(text: string): boolean {
  return emojiPattern().test(text);
}

/** Strips emoji (and their invisible modifiers) from text, then collapses any doubled-up spacing the removal leaves behind. */
export function stripEmoji(text: string): string {
  return text.replace(emojiPattern(), "").replace(/[ \t]{2,}/g, " ").trim();
}
