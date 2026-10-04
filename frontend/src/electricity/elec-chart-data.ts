/** CR-023 round 3: the pure data of the consumption chart (no DOM): the bars of a snapshot's `history`. */
import type { BillHistory } from '../api/electricity-billing';
import { fmtRange, monthShort } from './elec-format';

export interface Bar {
  key: string;
  label: string;
  title: string;
  kwh: number | null;
  kind: 'prev' | 'cur' | 'ly';
  partial: boolean;
  /** this previous period is also the same period last year */
  lyMark?: boolean;
}

/** The bars of a series in reading order, oldest first: last year, previous periods, the current period. Pure (unit specs use it). */
export function chartBars(h: BillHistory | null | undefined): Bar[] {
  if (!h) return [];
  const out: Bar[] = [];
  const ly = h.same_period_last_year;
  const lyIsPrev = !!ly && h.previous.some((p) => p.from === ly.from && p.to === ly.to && p.kwh !== null);
  if (ly && ly.kwh !== null && !lyIsPrev) out.push({ key: 'ly', label: monthShort(ly.to), title: `אותה תקופה אשתקד, ${fmtRange(ly.from, ly.to)}`, kwh: Number(ly.kwh), kind: 'ly', partial: ly.status === 'partial' });
  for (const p of h.previous.slice(-12)) out.push({ key: `p${p.to}`, label: monthShort(p.to), title: fmtRange(p.from, p.to), kwh: p.kwh === null ? null : Number(p.kwh), kind: 'prev', partial: p.status === 'partial', lyMark: !!ly && p.from === ly.from && p.to === ly.to });
  if (h.current) out.push({ key: 'cur', label: monthShort(h.current.to), title: `התקופה הנוכחית, ${fmtRange(h.current.from, h.current.to)}`, kwh: Number(h.current.kwh), kind: 'cur', partial: false });
  return out;
}
/** A series draws a chart only when at least one bar other than the current period has data. */
export const hasComparison = (h: BillHistory | null | undefined): boolean => chartBars(h).some((b) => b.kind !== 'cur' && b.kwh !== null);
