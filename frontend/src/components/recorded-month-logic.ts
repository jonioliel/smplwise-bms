/**
 * RECORDED-DAYS-MONTH-2407: the pure part of the playback screen's month view (the legacy add-on's monthly calendar of days
 * with recordings). Dates are plain local calendar strings (YYYY-MM-DD / YYYY-MM) of the installation's zone - the server
 * already answered in that zone, so nothing here converts time.
 */

export const WEEKDAYS_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] as const;
export const WEEKDAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;
export const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'] as const;

export type DayState = 'recorded' | 'empty' | 'future' | 'unknown';

export interface MonthCell {
  /** YYYY-MM-DD */
  date: string;
  day: number;
  /** 0 = Sunday (the Israeli week starts on Sunday) */
  weekday: number;
  state: DayState;
  today: boolean;
  selected: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The month `delta` months away (YYYY-MM). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + delta;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}

/** Weekday (0 = Sunday) of a calendar date, independent of the browser's zone. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_HE[m - 1]} ${y}`;
}

/** Day cells of a month with the leading blanks of the first week (Sunday first); `null` = a blank before day 1.
 * `recorded` = the server's days; `loaded` false = the answer has not arrived (past days are `unknown`, not `empty`). */
export function monthGrid(month: string, opts: { recorded: readonly string[]; today: string; selected?: string; loaded: boolean }): (MonthCell | null)[] {
  const n = daysInMonth(month);
  const first = weekdayOf(`${month}-01`);
  const rec = new Set(opts.recorded);
  const out: (MonthCell | null)[] = Array.from({ length: first }, () => null);
  for (let d = 1; d <= n; d++) {
    const date = `${month}-${pad(d)}`;
    const state: DayState = date > opts.today ? 'future' : !opts.loaded ? 'unknown' : rec.has(date) ? 'recorded' : 'empty';
    out.push({ date, day: d, weekday: (first + d - 1) % 7, state, today: date === opts.today, selected: date === opts.selected });
  }
  return out;
}

/** Rows the grid takes (4-6): the popover reserves exactly this height so months never jump or scroll. */
export function gridRows(month: string): number {
  return Math.ceil((weekdayOf(`${month}-01`) + daysInMonth(month)) / 7);
}

/** Whether `month` may be shown: never after the month holding today. */
export function canGoNext(month: string, today: string): boolean {
  return month < monthOf(today);
}

/** The accessible name of a day button (Hebrew, read by screen readers). */
export function dayLabel(cell: MonthCell): string {
  const [y, m] = cell.date.split('-').map(Number);
  const base = `יום ${WEEKDAY_NAMES_HE[cell.weekday]}, ${cell.day} ב${MONTHS_HE[m - 1]} ${y}`;
  const what = { recorded: 'יש הקלטות', empty: 'אין הקלטות', future: 'עתידי', unknown: 'בבדיקה' }[cell.state];
  return `${base} · ${what}${cell.today ? ' · היום' : ''}`;
}

/** The line under the grid: how many days have recordings, and an honest word when the answer is partial. */
export function summaryText(count: number, coverage: 'complete' | 'partial' | null): string {
  const days = count === 0 ? 'אין ימים עם הקלטות בחודש זה' : count === 1 ? 'יום אחד עם הקלטות' : `${count} ימים עם הקלטות`;
  return coverage === 'partial' ? `${days} · ייתכן שחסרים ימים (החיפוש הוגבל)` : days;
}
