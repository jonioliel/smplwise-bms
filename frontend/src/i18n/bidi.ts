/** Names typed in Hebrew that carry a negative number ("קומה -1") render as "1-" in an RTL run: the hyphen is a
 * neutral that takes the paragraph direction. A left-to-right mark before the sign keeps "-1" together (F16). */
export function bidi(text: string | null | undefined): string {
  return String(text ?? '').replace(/(^|[^\w])(-\d)/g, '$1\u200E$2');
}

/** A bare number (a floor level) shown inside Hebrew text. */
export function ltrNum(n: number | string | null | undefined): string {
  return n === null || n === undefined ? '' : `\u200E${n}`;
}
