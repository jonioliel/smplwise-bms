/**
 * Contrast, computed in code (Bubble foundation, 2026-10-02). WCAG 2.x relative luminance and contrast ratio, colour parsing
 * for the token values (#rgb, #rrggbb, rgb(), rgba(), and an "r, g, b" triplet), alpha compositing, and the one function the
 * runtime needs: the LOWEST sheet alpha at which text on a translucent sheet still reads at 4.5:1 over the worst plausible
 * content behind it. design/look.ts clamps the transparency dial to that floor; tests/unit-design-tokens.spec.ts asserts every
 * allowed alpha above it passes and that the floor itself is where it says.
 *
 * Model: blur only averages what is behind the sheet, so a large uniform area of a colour is the worst case. The sheet sits over
 * the dimming overlay (`--sw-overlay`) over the content; content candidates: the page background, a lit pill fill, the accent,
 * a vivid hue ring, pure white, near black. Pure functions, no DOM.
 */
export type RGBA = [number, number, number, number];

export function parseColor(c: string): RGBA | null {
  const s = c.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [...m[1].split('').map((h) => parseInt(h + h, 16)), 1] as RGBA;
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s); // #rrggbb, or #rrggbbaa (palette borders and glass layers)
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), m[2] ? parseInt(m[2], 16) / 255 : 1];
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  m = /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/.exec(s); // an "r, g, b" triplet (--sw-sheet-rgb)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), 1];
  return null;
}

/** `fg` (with its alpha) composited over an opaque `bg`. */
export const over = (fg: RGBA, bg: RGBA): RGBA => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1) as RGBA;
export const withAlpha = (c: RGBA, a: number): RGBA => [c[0], c[1], c[2], a];

export function luminance(c: RGBA): number {
  const [r, g, b] = [c[0], c[1], c[2]].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: RGBA, b: RGBA): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const WCAG_TEXT = 4.5;

export interface SheetModel {
  /** The sheet colour (opaque) and the dimming overlay (with its alpha). */
  sheet: RGBA;
  overlay: RGBA;
  /** The text colours that must read on the sheet. */
  texts: RGBA[];
  /** Opaque content candidates behind the sheet. */
  behind: RGBA[];
}

/** The colour of the sheet at `alpha` over the overlay over `content`. */
export function sheetOver(m: SheetModel, alpha: number, content: RGBA): RGBA {
  return over(withAlpha(m.sheet, alpha), over(m.overlay, content));
}

/** The lowest contrast of any text over the sheet at `alpha`, across every content candidate. */
export function worstTextContrast(m: SheetModel, alpha: number): number {
  let worst = Infinity;
  for (const content of m.behind) {
    const bg = sheetOver(m, alpha, content);
    for (const t of m.texts) worst = Math.min(worst, contrastRatio(over(t, bg), bg));
  }
  return worst;
}

/**
 * The lowest alpha (to the step) at which every text reads at `min` over every content candidate. Contrast is not monotonic
 * in alpha in general, so the floor is the lowest alpha from which EVERY alpha up to 1 passes. Returns 1 when even opaque fails
 * (the token pair itself is wrong: the test for the solid surface catches that).
 */
export function alphaFloor(m: SheetModel, min = WCAG_TEXT, step = 0.01): number {
  let floor = 1;
  for (let a = 1; a >= 0 - 1e-9; a -= step) {
    const alpha = Math.round(a * 100) / 100;
    if (worstTextContrast(m, alpha) >= min) floor = alpha;
    else break;
  }
  return floor;
}

/** The sheet model of a skin's merged token table in one scheme (what look.ts and the test both use). */
export function sheetModelOf(v: (name: string) => string): SheetModel | null {
  const sheet = parseColor(v('--sw-sheet-rgb'));
  const overlay = parseColor(v('--sw-overlay'));
  if (!sheet || !overlay) return null;
  const texts = ['--sw-text', '--sw-text-2', '--sw-heading'].map((n) => parseColor(v(n))).filter((c): c is RGBA => !!c);
  const behind = ['--sw-bg', '--sw-lit', '--sw-accent', '--sw-hue-2', '--sw-surface'].map((n) => parseColor(v(n))).filter((c): c is RGBA => !!c);
  behind.push([255, 255, 255, 1], [10, 10, 14, 1]);
  return { sheet, overlay, texts, behind };
}

// ---- the lite tier (performance dial): translucent layers WITHOUT blur ----

/** The lowest alpha a tinted layer of the lite tier is drawn at, whatever the computed floor says: lite means near-solid. */
export const LITE_MIN_ALPHA = 0.86;

/**
 * The model of an un-blurred translucent layer (a glass pill, a floating corner pill) over live content: nothing averages what
 * is behind it, so a single saturated or extreme pixel is the worst case, and there is no dimming overlay under it. The
 * candidates are the sheet model's plus the pure primaries.
 */
export function liteLayerModel(m: SheetModel): SheetModel {
  return { ...m, overlay: [0, 0, 0, 0], behind: [...m.behind, [255, 0, 0, 1], [0, 0, 255, 1], [0, 255, 0, 1], [255, 255, 0, 1]] };
}

/** The lowest alpha at which every text reads at `min` on an un-blurred translucent layer over every candidate behind it. */
export const liteAlphaFloor = (m: SheetModel, min = WCAG_TEXT): number => alphaFloor(liteLayerModel(m), min);

/** The alpha the lite tier draws its tinted layers at (`--sw-lite-alpha`): the computed floor, never below LITE_MIN_ALPHA. */
export const liteAlpha = (m: SheetModel): number => Math.max(LITE_MIN_ALPHA, liteAlphaFloor(m));

// ---- MD1 material dials: the state wash on a tile (styles/material.ts) ----

/** The strongest wash the dials can ask for: the neon preset's 34 % at tint = strong (x1.8), rounded up to the step. */
export const WASH_MAX = 62;
/** The tones a tile may be washed with: the lit fill, the accent, the state colours, the climate pair and the eight decorative hues. */
export const WASH_TONES = ['--sw-lit', '--sw-accent', '--sw-success', '--sw-warning', '--sw-danger', '--sw-cool', '--sw-heat', '--sw-hue-1', '--sw-hue-2', '--sw-hue-3', '--sw-hue-4', '--sw-hue-5', '--sw-hue-6', '--sw-hue-7', '--sw-hue-8'];

export interface WashModel {
  /** The opaque surfaces a washed tile sits on (a translucent skin surface is composited over the page background first). */
  bases: RGBA[];
  tones: RGBA[];
  texts: RGBA[];
}

/** The wash model of a skin's merged token table (with a palette's inline tokens over it) in one scheme. */
export function washModelOf(v: (name: string) => string): WashModel | null {
  const bg = parseColor(v('--sw-bg'));
  if (!bg) return null;
  const opaque = (c: RGBA | null): RGBA | null => (c ? (c[3] >= 1 ? c : over(c, bg)) : null);
  const bases = ['--sw-surface', '--sw-surface-solid'].map((n) => opaque(parseColor(v(n)))).filter((c): c is RGBA => !!c);
  const tones = WASH_TONES.map((n) => parseColor(v(n))).filter((c): c is RGBA => !!c);
  const texts = ['--sw-text', '--sw-text-2'].map((n) => parseColor(v(n))).filter((c): c is RGBA => !!c);
  return bases.length && tones.length && texts.length ? { bases, tones, texts } : null;
}

/** The lowest contrast of any text over any tone washed at `share` percent (the start of the 135deg wash, its strongest point) on any base. */
export function worstWashContrast(m: WashModel, share: number): number {
  let worst = Infinity;
  for (const base of m.bases) {
    for (const tone of m.tones) {
      const washed = over(withAlpha(tone, share / 100), base);
      for (const t of m.texts) worst = Math.min(worst, contrastRatio(over(t, washed), washed));
    }
  }
  return worst;
}

/**
 * The wash cap (`--sw-m-wash-cap`, percent): the highest share, from WASH_MAX down in steps of 2, from which every lower share keeps
 * every text at `min` over every tone on every base. 0 when even the faintest wash fails (the surface pair itself is wrong: the
 * solid-surface contrast test catches that). design/apply.ts sets it on <html>; the tile's wash is min(wash x tint, cap).
 */
export function washCap(m: WashModel, min = WCAG_TEXT, step = 2): number {
  let cap = 0;
  for (let s = step; s <= WASH_MAX; s += step) {
    if (worstWashContrast(m, s) >= min) cap = s;
    else break;
  }
  return cap;
}
