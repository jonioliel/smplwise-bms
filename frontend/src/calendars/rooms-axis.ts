/**
 * ROUND4-LEFTOVERS-2390 (polish round 4, calendars D22): the hour labels of the rooms timeline's axis around the "now" pill.
 *
 * The axis drew the pill over the hour labels by a fixed share of the axis (3 % on a desktop, 9 % on the phone), so on a narrower
 * track (1024, a skin with a larger type scale) the pill still touched or covered the neighbouring hour, and near the start or the
 * end of the day it hung over the axis edge. This works in pixels instead: the pill keeps its place on the line but stays inside
 * the axis, and every hour label whose box would meet the pill's box (with a small gap) is left out. Pure: the widths come from the
 * rendered axis (the screen measures them); before the first measure the old share rule applies.
 */

export interface AxisInput {
  /** where "now" falls on the axis, 0-100 (outside that range: no pill) */
  nowPct: number;
  /** hours on the axis (the labels are 0..hours, the first one aligned to the start, the last one to the end) */
  hours: number;
  /** the axis width in px; 0 before it was measured */
  axisPx: number;
  /** the pill's width in px */
  pillPx: number;
  /** the widest hour label in px */
  labelPx: number;
  /** the free space kept between the pill and a label */
  gapPx?: number;
  /** the share rule used before the axis is measured, in percent of the axis */
  fallbackPct: number;
}

export interface AxisFit {
  /** the pill's left edge in px (kept inside the axis); null = place it by percent, centred on the line */
  pillLeftPx: number | null;
  /** the label indexes (0..hours) left out because the pill would meet them */
  hidden: Set<number>;
}

export const AXIS_GAP_PX = 6;

export function axisFit(o: AxisInput): AxisFit {
  const hidden = new Set<number>();
  if (!(o.nowPct > 0 && o.nowPct < 100) || o.hours <= 0) return { pillLeftPx: null, hidden };
  if (!(o.axisPx > 0) || !(o.pillPx > 0)) {
    for (let k = 0; k <= o.hours; k++) if (Math.abs((k / o.hours) * 100 - o.nowPct) < o.fallbackPct) hidden.add(k);
    return { pillLeftPx: null, hidden };
  }
  const gap = o.gapPx ?? AXIS_GAP_PX;
  const now = (o.nowPct / 100) * o.axisPx;
  const pillL = Math.min(Math.max(now - o.pillPx / 2, 0), Math.max(0, o.axisPx - o.pillPx));
  const pillR = pillL + o.pillPx;
  for (let k = 0; k <= o.hours; k++) {
    const x = (k / o.hours) * o.axisPx;
    // the first label starts at the axis start, the last one ends at the axis end, the rest are centred on their hour
    const l = k === 0 ? 0 : k === o.hours ? o.axisPx - o.labelPx : x - o.labelPx / 2;
    const r = l + o.labelPx;
    if (r + gap > pillL && l - gap < pillR) hidden.add(k);
  }
  return { pillLeftPx: Math.round(pillL * 10) / 10, hidden };
}
