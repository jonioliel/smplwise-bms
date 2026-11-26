/** Bidi helpers for text typed or formatted by someone else that lands inside a right-to-left page. */
import { currentUiLang } from './ui-lang-boot';

const LRI = '\u2066'; // left-to-right isolate
const PDI = '\u2069'; // pop directional isolate

/** The runs that must keep their own left-to-right order inside Hebrew / Arabic text (UXFIX-RTL, finding 2): an ISO or dotted
 * date with an optional time ("2026-10-28 19:30", "20.10.2026 17:38") and a number glued to its unit ("1.3 TB", "400V"). Without an isolate
 * the neutral space between date and time takes the paragraph direction and the pair reads reversed, "TB 1.3". */
const RUNS = new RegExp(
  [
    String.raw`\d{4}-\d{2}-\d{2}(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?`,
    String.raw`\d{1,2}[./]\d{1,2}[./]\d{2,4}(?:,? \d{1,2}:\d{2}(?::\d{2})?)?`,
    String.raw`\d+(?:[.,]\d+)?\s?(?:[KMGTP]i?B|kWh|kW|[MG]Hz|Hz|ms|fps|[MK]bps|V|A|W)(?![A-Za-z0-9])`,
  ].map((p) => String.raw`(?<![\w${LRI}])(?:${p})`).join('|'),
  'g',
);

/** Wraps the date / time / number-with-unit runs of a string in a left-to-right isolate. Idempotent. */
export function isolateRuns(text: string): string {
  return text.replace(RUNS, (m) => `${LRI}${m}${PDI}`);
}

/** A whole value (a formatted date-time, a size) shown as one left-to-right run next to Hebrew text and commas. */
export function ltrIsolate(text: string | null | undefined): string {
  const s = String(text ?? '');
  return s && !s.startsWith(LRI) ? `${LRI}${s}${PDI}` : s;
}

/** Names typed in Hebrew that carry a negative number ("קומה -1") render as "1-" in an RTL run: the hyphen is a
 * neutral that takes the paragraph direction. A left-to-right mark before the sign keeps "-1" together (F16).
 * Dates, times and numbers with a unit inside the text are isolated the same way (isolateRuns). */
export function bidi(text: string | null | undefined): string {
  return isolateRuns(String(text ?? '').replace(/(^|[^\w])(-\d)/g, '$1\u200E$2'));
}

/** A bare number (a floor level) shown inside Hebrew text. */
export function ltrNum(n: number | string | null | undefined): string {
  return n === null || n === undefined ? '' : `\u200E${n}`;
}

/** The step separator of a path written in running text ("Settings ‹ Security"). The page is right-to-left, the first step is read first on
 * the right, so the arrow points left; U+203A does not mirror and pointed back at the step already read (UXFIX-RTL, finding 5). */
export const CRUMB_SEP = '\u2039';

/** Joins the steps of a path with the separator that points the reading direction. */
export function crumbPath(parts: ReadonlyArray<string | null | undefined>): string {
  return parts.filter((p): p is string => !!p).join(` ${CRUMB_SEP} `);
}

/** MEDIUM-REST-2540 (deep review SCR-27): the arrow of a change "before -> after" in running text points from the value read first to
 * the value read second. Hebrew reads right to left, so the arrow points left; English points right. Neither arrow mirrors, so a fixed
 * "→" inside a Hebrew line read "60 → 40" for 40 -> 60, and a fixed "←" read "to ← from" in English. */
export function changeArrow(rtl: boolean = pageRtl()): string {
  return rtl ? '\u2190' : '\u2192';
}

/** The page reads right to left (Hebrew, the default; i18n/ui-lang-boot.ts sets `<html dir>` the same way). */
function pageRtl(): boolean {
  return currentUiLang() === 'he';
}

const FSI = '\u2068'; // first-strong isolate: a value keeps its own direction and never swaps places with its neighbour

/** "before ARROW after" as one string: each value isolated, the arrow by the page's reading direction. */
export function changeText(from: string | number | null | undefined, to: string | number | null | undefined, rtl: boolean = pageRtl()): string {
  return `${FSI}${String(from ?? '')}${PDI} ${changeArrow(rtl)} ${FSI}${String(to ?? '')}${PDI}`;
}
