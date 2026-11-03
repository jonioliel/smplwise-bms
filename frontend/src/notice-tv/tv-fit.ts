/**
 * TV-FIT-2380 - the pure rules that make the TV board fit a real screen (no DOM):
 *
 *  - the footer's building chips: `rows` = when the chips and the "updated" line do not fit in one row, the chips take a row of
 *    their own (portrait: always), so no chip is lost to the longer "עודכן · <place>" wording; `drop` (the default since TV-CHIPS-2381,
 *    owner 03.11 Q3 = B) = one row, and the chips that leave go by priority: the healthy ones first (alarm, warning and "off" entries
 *    stay longest), and within one state the one last in the board's chip order (Settings › the board › מצב הבניין, editable);
 *  - the safe-area / overscan margin: a percent of each side of the screen, from the board (`display.safe_margin`) or the TV's own
 *    address (`?safe=`, which wins: overscan is a property of the device);
 *  - the company logo sized by area (gap H7 of TVNOTICE-297): a tall crest gets more height, a long banner more width, so both read
 *    about as large as an ordinary 3:1 logo; an ordinary logo keeps its size exactly (factor 1, the pixel baselines do not move).
 */
import type { Display } from './tv-logic';

export type ChipFit = 'rows' | 'drop';
export const CHIP_FITS: ChipFit[] = ['rows', 'drop'];

/** The chip behaviour in force: the `?chips=` test hook, else the board's `portrait_chips`, else drop (TV-CHIPS-2381: the server's
 * factory value; the feed always carries the effective value, so this fallback only answers a feed without the key). */
export function chipFitOf(d: Pick<Display, 'portrait_chips'> | null | undefined, q?: string | null): ChipFit {
  if (q === 'rows' || q === 'drop') return q;
  return d?.portrait_chips === 'rows' ? 'rows' : 'drop';
}

/** The order in which chips leave a footer that has no room (drop mode): healthy first, then "off", then warnings; an alarm last.
 * Within one state the later chip leaves first (the administrator's order is the priority order). Returns indexes into `states`. */
export function dropOrder(states: readonly string[]): number[] {
  const rank: Record<string, number> = { ok: 0, off: 1, warn: 2, alarm: 3 };
  return states
    .map((s, i) => ({ i, r: rank[s] ?? 0 }))
    .sort((a, b) => a.r - b.r || b.i - a.i)
    .map((x) => x.i);
}

export const SAFE_MARGINS = [0, 1, 2, 3, 4, 5] as const;

/** The safe-area margin in percent: the device's `?safe=` (0..5, halves allowed) over the board's `safe_margin`; anything else = 0. */
export function safeMarginOf(d: Pick<Display, 'safe_margin'> | null | undefined, q?: string | null): number {
  const ok = (v: unknown): number | null => {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 5 ? Math.round(n * 2) / 2 : null;
  };
  return ok(q) ?? ok(d?.safe_margin) ?? 0;
}

/** The inset of the drawing area inside a vw x vh screen for a margin of `pct` percent per side (whole pixels). */
export function safeInset(vw: number, vh: number, pct: number): { x: number; y: number; w: number; h: number } {
  const x = Math.round((vw * pct) / 100);
  const y = Math.round((vh * pct) / 100);
  return { x, y, w: Math.max(1, vw - 2 * x), h: Math.max(1, vh - 2 * y) };
}

/** The reference shape: an ordinary logo is about three times as wide as it is tall. */
export const LOGO_REF_RATIO = 3;
export const LOGO_TALL_MAX = 1.4; // a crest grows to 1.4x the box height at most (the rows it sits in stay rows)
export const LOGO_WIDE_MAX = 1.4; // a banner may take 1.4x the box's width cap at most

/**
 * The company logo's size factors by area for a file of `ratio` = width / height: `h` multiplies the logo box's height (> 1 only for a
 * logo taller than the reference shape), `w` multiplies the box's width cap (> 1 only for a logo wider than it). A logo of the reference
 * shape or close to it (2:1 .. 4:1) keeps factor 1 in both, so an ordinary logo is drawn exactly as before.
 */
export function logoArea(ratio: number): { h: number; w: number; shape: 'tall' | 'wide' | 'box' } {
  if (!Number.isFinite(ratio) || ratio <= 0) return { h: 1, w: 1, shape: 'box' };
  // continuous at the band's edges: the factor starts at 1 on the edge and grows with the square root of the shape's distance from it
  if (ratio < LOGO_BAND[0]) return { h: round2(Math.min(LOGO_TALL_MAX, Math.sqrt(LOGO_BAND[0] / ratio))), w: 1, shape: 'tall' };
  if (ratio > LOGO_BAND[1]) return { h: 1, w: round2(Math.min(LOGO_WIDE_MAX, Math.sqrt(ratio / LOGO_BAND[1]))), shape: 'wide' };
  return { h: 1, w: 1, shape: 'box' };
}

/** The shapes that keep the box as it is (an ordinary logo, LOGO_REF_RATIO in the middle). */
export const LOGO_BAND = [2, 4] as const;

const round2 = (n: number): number => Math.round(n * 100) / 100;
