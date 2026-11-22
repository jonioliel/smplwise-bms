/**
 * CR-CMP2-GEN-REST-2460 (owner N10): the DOM-free rules of `sw-load-bar` - how full the bar is and which tone it takes - kept apart from
 * the element so the node unit specs read them without a browser.
 */

/** The bar's tone: `normal` (the accent), `warn` and `bad` (the shared warning / danger inks). */
type LoadTone = 'normal' | 'warn' | 'bad';

/** How full the bar is, 0..1: a missing, negative or non-finite value is an empty bar, a value over `max` a full one. */
export function loadFraction(value: number | null | undefined, max = 100): number {
  if (value === null || value === undefined || !Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

/** The tone of a value against the screen's two limits: above `badAbove` is `bad`, above `warnAbove` is `warn` (a limit that is not
 * given never fires; the danger limit wins when both pass). No value is `normal`. */
export function loadTone(value: number | null | undefined, warnAbove?: number | null, badAbove?: number | null): LoadTone {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'normal';
  if (badAbove !== null && badAbove !== undefined && value > badAbove) return 'bad';
  if (warnAbove !== null && warnAbove !== undefined && value > warnAbove) return 'warn';
  return 'normal';
}
