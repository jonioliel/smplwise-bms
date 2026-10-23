/**
 * CR-WATER78 slice 3 (section 16): pure helpers of the water billing screens - m3 and money formatting (owner Q10: m3 with 3 decimals,
 * litres under 1 m3), the bill state chips (the electricity states and classes), the account chip (paused / a stale meter / active), the
 * snooze duration labels and end times, the bill lines split into water and sewage, and the snooze settings editor's checks (they mirror
 * the server: services/water_alerts.validate_snooze). No DOM, no network: node-only unit tests (tests/unit-water-billing.spec.ts).
 */
import type { Account, BillLine, BillState, SnoozeSettings } from '../api/water-billing';

const M3 = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const L1 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 });
const ILS = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "36.000" -> "36.000"; null / empty -> "-". The server's decimal string is never re-rounded beyond its 3 places. */
export function fmtM3(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? M3.format(n) : '-';
}

/** A volume for a figure: m3 at or above 1 m3, litres below it (owner Q10). */
export function fmtVolume(m3: string | number | null | undefined): { value: string; unit: 'מ״ק' | 'ליטר' } | null {
  if (m3 === null || m3 === undefined || m3 === '') return null;
  const n = typeof m3 === 'number' ? m3 : Number(m3);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) >= 1 ? { value: M3.format(n), unit: 'מ״ק' } : { value: L1.format(n * 1000), unit: 'ליטר' };
}

export function fmtIls(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? `${ILS.format(n)} ₪` : '';
}

export const BILL_STATE: Record<BillState, { label: string; cls: string }> = {
  draft: { label: 'טיוטה', cls: 'c-mut' },
  issued: { label: 'הונפק', cls: 'c-acc' },
  sent: { label: 'נשלח', cls: 'c-warn' },
  paid: { label: 'שולם', cls: 'c-ok' },
  void: { label: 'בוטל', cls: 'c-err' },
};

/** The account chip of the list and the account page: paused wins, then a stale meter (it is not counted until it reports), else active. */
export function accountChip(a: Pick<Account, 'status' | 'stale_meters'>): { label: string; cls: string } {
  if (a.status === 'paused') return { label: 'מושהה', cls: 'c-mut' };
  if (a.stale_meters.length) return { label: 'מונה לא מדווח', cls: 'c-warn' };
  return { label: 'פעיל', cls: 'c-ok' };
}

export const AUTO_LABEL = { off: 'בלי יצירה אוטומטית', draft: 'ליצור טיוטה', issue: 'להנפיק אוטומטית' } as const;

export function periodLabel(months: 1 | 2, anchorDay: number): string {
  return `${months === 1 ? 'חודשית' : 'דו-חודשית'} · מה-${anchorDay}`;
}

/** The two components of a bill (several pieces when a price or the VAT changed inside the period), summed per component. */
export function linesByComponent(lines: BillLine[]): { water: BillLine[]; sewage: BillLine[] } {
  return { water: lines.filter((l) => l.component === 'water'), sewage: lines.filter((l) => l.component === 'sewage') };
}

/** Snooze duration label: "15 ד׳", "שעה", "4 שעות", "יממה", "3 ימים" (the mockup's labels). */
export function snoozeLabel(min: number): string {
  if (min < 60) return `${min} ד׳`;
  if (min === 60) return 'שעה';
  if (min < 1440) return min % 60 === 0 ? `${min / 60} שעות` : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} שעות`;
  if (min === 1440) return 'יממה';
  return min % 1440 === 0 ? `${min / 1440} ימים` : `${Math.round((min / 1440) * 10) / 10} ימים`;
}

/** When a snooze that starts at `now` ends, as the split button's menu shows it: "HH:MM" today, "מחר HH:MM", "N ימים, HH:MM". */
export function snoozeUntil(now: Date, min: number, timeZone = 'Asia/Jerusalem'): string {
  const end = new Date(now.getTime() + min * 60_000);
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const hm = new Intl.DateTimeFormat('he-IL', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(end);
  const days = Math.round((Date.parse(day(end)) - Date.parse(day(now))) / 86_400_000);
  if (days <= 0) return hm;
  return days === 1 ? `מחר ${hm}` : `${days} ימים, ${hm}`;
}

export const SNOOZE_LIMITS = { min: 5, max: 43200, count: 12 } as const;

/** The settings editor's check before saving (the server repeats it): null = valid, else the Hebrew reason. */
export function snoozeProblem(s: SnoozeSettings): string | null {
  if (!Number.isInteger(s.max) || s.max < SNOOZE_LIMITS.min || s.max > SNOOZE_LIMITS.max) return 'המקסימום הוא בין 5 דקות ל-30 ימים.';
  if (!s.durations.length || s.durations.length > SNOOZE_LIMITS.count) return 'יש להציע בין משך אחד ל-12 משכים.';
  if (s.durations.some((d) => !Number.isInteger(d) || d < SNOOZE_LIMITS.min || d > s.max)) return 'משך נדנוד ארוך מהמקסימום.';
  if (!s.durations.includes(s.default)) return 'ברירת המחדל חייבת להיות אחד מהמשכים המוצעים.';
  return null;
}

/** Minutes from the editor's value and unit (minutes / hours / days). */
export function toMinutes(value: number, unit: 'min' | 'hour' | 'day'): number {
  return Math.round(value * (unit === 'min' ? 1 : unit === 'hour' ? 60 : 1440));
}

/** The price per m3 including VAT of a version (the tariffs card): water + sewage, VAT added for an ex-VAT price. */
export function priceIncVat(water: string, sewage: string, mode: 'ex_vat' | 'inc_vat', vatPercent: string | null): number | null {
  const unit = Number(water) + Number(sewage);
  if (!Number.isFinite(unit)) return null;
  if (mode === 'inc_vat') return Math.round(unit * 100) / 100;
  if (vatPercent === null) return null;
  return Math.round(unit * (1 + Number(vatPercent) / 100) * 100) / 100;
}

/** One signed term of an account's meter formula (the editor's row): +meter or −meter. */
export interface Term {
  sign: 1 | -1;
  meter_id: string;
}

/** The signed terms of a formula AST of + / − over meters; null when the formula holds anything else (a share, a coefficient). */
export function termsOf(ast: unknown): Term[] | null {
  const a = ast as { m?: string; op?: string; args?: unknown[] } | null;
  if (!a || typeof a !== 'object') return null;
  if (typeof a.m === 'string') return [{ sign: 1, meter_id: a.m }];
  if ((a.op === '+' || a.op === '-') && Array.isArray(a.args) && a.args.length >= 2) {
    const parts = a.args.map((x) => termsOf(x));
    if (parts.some((p) => p === null)) return null;
    const [first, ...rest] = parts as Term[][];
    return [...first, ...rest.flatMap((p) => (a.op === '-' ? p.map((t) => ({ ...t, sign: (t.sign * -1) as 1 | -1 })) : p))];
  }
  return null;
}

/** The formula AST of signed terms (the plus terms first, then the minus terms), or null without a plus term. */
export function astOf(terms: Term[]): Record<string, unknown> | null {
  const seen = new Set<string>();
  const clean = terms.filter((t) => t.meter_id && !seen.has(t.meter_id) && seen.add(t.meter_id));
  const plus = clean.filter((t) => t.sign > 0);
  const minus = clean.filter((t) => t.sign < 0);
  if (!plus.length) return null;
  let ast: Record<string, unknown> = { m: plus[0].meter_id };
  for (const t of plus.slice(1)) ast = { op: '+', args: [ast, { m: t.meter_id }] };
  for (const t of minus) ast = { op: '-', args: [ast, { m: t.meter_id }] };
  return ast;
}

/** Bills that are due and unpaid on `today` (YYYY-MM-DD): issued or sent with a due date before today. */
export function isLate(b: { state: BillState; due_date: string | null }, today: string): boolean {
  return (b.state === 'issued' || b.state === 'sent') && !!b.due_date && b.due_date < today;
}
