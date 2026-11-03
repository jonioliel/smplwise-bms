/**
 * SETTINGS-TABS-SCROLL-2331 (owner request 2026-11-01): the arithmetic of a scrolling tab strip (sw-tabs in its bar forms), kept free of the
 * DOM so it can be unit-tested. The strip reads boxes from the page and asks these functions which edges hide tabs, how far an arrow
 * click moves, how a mouse wheel turns into a sideways scroll and which tab a key moves the focus to.
 *
 * Directions: "start" / "end" are the reading directions (in Hebrew the start is the RIGHT edge), "left" / "right" the physical ones.
 * `scrollBy({ left })` always takes a physical delta, so the RTL mapping lives here, in one place.
 */

export type Side = 'start' | 'end';
export type Fade = '' | 'left' | 'right' | 'both';

/** Physical extent of the tabs (the union of their boxes) and of the visible box. */
export interface Extent {
  boxLeft: number;
  boxRight: number;
  minLeft: number;
  maxRight: number;
}

/** Below this many pixels a hidden sliver does not count (sub-pixel layout, the snap's rounding). */
export const EDGE_SLOP = 1;

/** Which physical edges hide tabs. */
export function hiddenEdges(e: Extent): { left: boolean; right: boolean } {
  return { left: e.minLeft < e.boxLeft - EDGE_SLOP, right: e.maxRight > e.boxRight + EDGE_SLOP };
}

/** The `data-fade` value of the strip (physical, as before 2.33.1). */
export function fadeOf(e: Extent): Fade {
  const { left, right } = hiddenEdges(e);
  return left && right ? 'both' : left ? 'left' : right ? 'right' : '';
}

/** Which reading-direction sides have more tabs to scroll to (the arrows shown). */
export function moreSides(e: Extent, rtl: boolean): { start: boolean; end: boolean } {
  const { left, right } = hiddenEdges(e);
  return rtl ? { start: right, end: left } : { start: left, end: right };
}

/** The physical sign of a move toward `side`: in RTL the end is to the left (a negative `left`). */
export function sideSign(side: Side, rtl: boolean): 1 | -1 {
  const towardEnd = side === 'end';
  return towardEnd !== rtl ? 1 : -1;
}

/** Share of the visible width one arrow click scrolls (a "page" that keeps one tab of context). */
export const PAGE_SHARE = 0.8;

/** The physical `left` delta of an arrow click toward `side`, clamped to what is still hidden on that side. */
export function pageDelta(side: Side, rtl: boolean, e: Extent): number {
  const width = Math.max(0, e.boxRight - e.boxLeft);
  const sign = sideSign(side, rtl);
  const hidden = sign > 0 ? Math.max(0, e.maxRight - e.boxRight) : Math.max(0, e.boxLeft - e.minLeft);
  return sign * Math.min(Math.round(width * PAGE_SHARE), Math.ceil(hidden));
}

/**
 * A mouse wheel / trackpad gesture over the strip: the physical `left` delta to apply, or 0 to leave the event alone (the page scrolls).
 * A sideways gesture (|dx| >= |dy|) is the browser's own; a vertical wheel turns sideways only while the strip can still move that way
 * (wheel down = toward the end), so reaching an edge hands the wheel back to the page.
 */
export function wheelDelta(dx: number, dy: number, rtl: boolean, e: Extent, lineHeight = 16): number {
  if (!dy || Math.abs(dx) >= Math.abs(dy)) return 0;
  const { left, right } = hiddenEdges(e);
  if (!left && !right) return 0;
  const toward: Side = dy > 0 ? 'end' : 'start';
  const sign = sideSign(toward, rtl);
  if ((sign > 0 && !right) || (sign < 0 && !left)) return 0;
  return sign * Math.abs(dy) * lineHeight;
}

/** A wheel event's delta in pixels (deltaMode 0 = pixels, 1 = lines, 2 = pages). */
export function wheelPixels(delta: number, mode: number, page: number): number {
  return mode === 1 ? delta * 16 : mode === 2 ? delta * page : delta;
}

/**
 * The tab the focus moves to on a key (the ARIA tabs pattern, focus only - Enter / Space opens it): ArrowRight / ArrowLeft step in the
 * physical direction (in RTL ArrowLeft is the NEXT tab), Home / End jump to the first / last. Wraps around. null = not a navigation key.
 */
export function nextIndex(key: string, index: number, count: number, rtl: boolean): number | null {
  if (count <= 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key !== 'ArrowRight' && key !== 'ArrowLeft') return null;
  const forward = (key === 'ArrowLeft') === rtl;
  const at = index < 0 ? (forward ? -1 : count) : index;
  return (at + (forward ? 1 : -1) + count) % count;
}

/** A11Y-R4-LEFTOVERS-2380: which tab is the one Tab stop of a strip (roving tabindex): the selected one, else the first (never none). -1 for an empty strip. */
export function rovingStop(ids: readonly string[], active: string): number {
  if (!ids.length) return -1;
  const at = ids.indexOf(active);
  return at < 0 ? 0 : at;
}

/** The physical `left` delta that brings one tab fully into view with `pad` pixels of room (the fade / the arrow), or 0. */
export function revealDelta(boxLeft: number, boxRight: number, itemLeft: number, itemRight: number, pad: number): number {
  const room = Math.max(0, Math.min(pad, (boxRight - boxLeft - (itemRight - itemLeft)) / 2));
  if (itemLeft < boxLeft + room) return Math.floor(itemLeft - (boxLeft + room));
  if (itemRight > boxRight - room) return Math.ceil(itemRight - (boxRight - room));
  return 0;
}
