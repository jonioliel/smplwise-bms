/**
 * DROPDOWNFIT-295 (owner, 2026-10-24): the label of a dropdown ALWAYS fits inside its control - never an ellipsis, never a clipped word.
 * One helper for every dropdown of the product (`sw-dropdown`'s label and the native selects of `sw-field`):
 *   1. the label keeps the control's own font size when it fits;
 *   2. otherwise the font size steps down (0.5 px) until it fits, but not below the floor (FIT_MIN_PX, and not below FIT_MIN_RATIO of the base);
 *   3. at the floor a text label wraps to a second line (and breaks inside a very long word) instead of being cut.
 * Only the label shrinks, never the control: heights, radii, rings, icons and chevrons stay the shared capsule metrics.
 * Pure DOM, no Lit: the callers decide when to run it (after a render, on a resize, when the web font arrives).
 */
export const FIT_MIN_PX = 11;
export const FIT_MIN_RATIO = 0.72;
const STEP = 0.5;

/** The smallest font size (px) the label may shrink to, given the control's base size. */
export function fitFloor(basePx: number): number {
  return Math.min(basePx, Math.max(FIT_MIN_PX, Math.round(basePx * FIT_MIN_RATIO * 2) / 2));
}

/** The next font size down from `px`, or `null` when `px` is already at the floor. Exported for the unit spec. */
export function fitNextSize(px: number, floor: number): number | null {
  const next = Math.max(floor, px - STEP);
  return next < px ? next : null;
}

/** Fits a text element (a block / flex item with `overflow: hidden`, `white-space: nowrap`): shrink, then wrap at the floor. */
export function fitTextElement(el: HTMLElement): void {
  el.style.removeProperty('font-size');
  el.removeAttribute('data-fit');
  const overflows = () => el.scrollWidth > el.clientWidth + 0.5;
  if (!el.isConnected || el.clientWidth <= 0 || !overflows()) return;
  const base = parseFloat(getComputedStyle(el).fontSize) || 16;
  const floor = fitFloor(base);
  let px: number | null = base;
  while (overflows()) {
    px = fitNextSize(px ?? floor, floor);
    if (px === null) break;
    el.style.fontSize = `${px}px`;
  }
  if (overflows()) {
    el.setAttribute('data-fit', 'wrap'); // CSS: white-space normal, overflow-wrap anywhere, a tight line height
    el.style.fontSize = `${floor}px`;
  } else el.setAttribute('data-fit', 'shrunk');
}

let canvas: CanvasRenderingContext2D | null = null;
function measure(text: string, font: string): number {
  canvas ??= document.createElement('canvas').getContext('2d');
  if (!canvas) return 0;
  canvas.font = font;
  return canvas.measureText(text).width;
}

/**
 * Fits a native `<select>`: its closed text cannot wrap, so it only shrinks (down to the floor). `'floor'` means even the floor
 * does not fit - the toolbar must give the field more width (the wall's phone bar wraps its fields at a 128 px basis so it never happens).
 */
export function fitSelectElement(sel: HTMLSelectElement): 'ok' | 'shrunk' | 'floor' {
  sel.style.removeProperty('font-size');
  sel.removeAttribute('data-fit');
  if (!sel.isConnected || sel.clientWidth <= 0) return 'ok';
  const cs = getComputedStyle(sel);
  const avail = sel.clientWidth - parseFloat(cs.paddingInlineStart) - parseFloat(cs.paddingInlineEnd);
  const text = sel.selectedOptions[0]?.textContent?.trim() ?? '';
  if (!text || avail <= 0) return 'ok';
  const base = parseFloat(cs.fontSize) || 16;
  const fontAt = (px: number) => `${cs.fontStyle} ${cs.fontWeight} ${px}px ${cs.fontFamily}`;
  if (measure(text, fontAt(base)) <= avail) return 'ok';
  const floor = fitFloor(base);
  let px: number | null = base;
  while (px !== null && measure(text, fontAt(px)) > avail) px = fitNextSize(px, floor);
  if (px !== null) {
    sel.style.fontSize = `${px}px`;
    sel.setAttribute('data-fit', 'shrunk');
    return 'shrunk';
  }
  sel.style.fontSize = `${floor}px`;
  sel.setAttribute('data-fit', 'floor');
  return 'floor';
}

/** Runs `fn` on the next frame, once per element: a burst of resize callbacks costs one measure. */
export function fitSchedule(fn: () => void, slot: { raf: number }): void {
  if (slot.raf) return;
  slot.raf = requestAnimationFrame(() => {
    slot.raf = 0;
    fn();
  });
}
