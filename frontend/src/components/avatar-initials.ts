/**
 * POLISH-CLASSIC-DOMUS-297 second pass (break-ui, P6): the initials of a display name, as plain logic (no DOM) so a unit spec can
 * import it. Used by sw-avatar.
 */
/** The script of a letter, coarse: enough to never pair a Hebrew initial with a Latin one. */
function scriptOf(ch: string): string {
  if (/\p{Script=Hebrew}/u.test(ch)) return 'he';
  if (/\p{Script=Arabic}/u.test(ch)) return 'ar';
  if (/\p{Script=Cyrillic}/u.test(ch)) return 'cy';
  if (/\p{Script=Latin}/u.test(ch)) return 'la';
  return 'other';
}

/** The letter graphemes of a word (a whole grapheme, never half a surrogate pair; emoji and digits dropped). */
function letters(word: string): string[] {
  const seg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const graphemes = seg ? Array.from(seg.segment(word), (s) => s.segment) : Array.from(word);
  return graphemes.filter((g) => /^\p{L}/u.test(g));
}
const firstLetter = (word: string): string => letters(word)[0] ?? '';

/**
 * POLISH-CLASSIC-DOMUS-297 (break-ui, P6): the initials of a display name. Letters only, counted in graphemes: the first letter of the
 * first word and of the LAST word ("Aleksandra ... Montgomery III" -> the last word with a letter that is not a roman numeral suffix),
 * the second one only when it is in the same script as the first (a Hebrew + Latin pair read as noise). A name with no letter at
 * all (an emoji, a number) returns '' and the avatar draws the person icon instead. Upper-cased where the script has case.
 */
export function avatarInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => firstLetter(w));
  if (!words.length) return '';
  const first = firstLetter(words[0]);
  // one word: its first two letters, as before ("יוני" -> "יו", "Jo" -> "Jo"), now in graphemes and one script
  if (words.length === 1) {
    const [a, b] = letters(words[0]);
    return b && scriptOf(b) === scriptOf(a) ? a + b : a;
  }
  const tail = words.slice(1).filter((w) => !/^(I{1,3}|IV|V|VI{0,3}|Jr\.?|Sr\.?)$/i.test(w));
  const last = tail.length ? firstLetter(tail[tail.length - 1]) : '';
  const pair = last && scriptOf(last) === scriptOf(first) ? first + last : first;
  return pair.toLocaleUpperCase();
}
