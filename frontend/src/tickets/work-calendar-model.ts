/**
 * SLACAL (2.9.1): the pure logic of the working-hours calendar card (Settings > the module > general). The stored document is
 * `tickets.settings.calendar` (services/tickets/work_calendar.py): {enabled, weekdays, start, end, holidays, departments}. OFF by default,
 * which is exactly the old wall-clock behaviour. Weekdays are ISO-style Monday = 0 ... Sunday = 6 (as the server stores them); the card
 * lists them Sunday first. No DOM, no Lit: tests/unit-tickets-work-calendar.spec.ts reads this file directly. The server validates the same
 * rules again (422), so the card's checks are for a quick, local message only.
 */

export interface DeptCalendarOverride { enabled?: boolean; weekdays?: number[]; start?: string; end?: string }

export interface WorkCalendar {
  enabled: boolean;
  weekdays: number[];
  start: string;
  end: string;
  holidays: string[];
  /** per-department overrides: kept as stored and sent back untouched (the card does not edit them) */
  departments: Record<string, DeptCalendarOverride>;
}

export const HOLIDAYS_MAX = 400;
/** the order the card lists the days in: Sunday first (the week of the default installation) */
export const WEEK_ORDER: readonly number[] = [6, 0, 1, 2, 3, 4, 5];
export const DEFAULT_WEEKDAYS: readonly number[] = [0, 1, 2, 3, 6];
export const DEFAULT_CALENDAR: WorkCalendar = { enabled: false, weekdays: [...DEFAULT_WEEKDAYS], start: '08:00', end: '17:00', holidays: [], departments: {} };

export type CalendarProblem = 'weekdays' | 'time' | 'order' | 'holidays_many';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A real calendar date `YYYY-MM-DD` (not 2026-02-30). */
export function isIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function fresh(): WorkCalendar {
  return { ...DEFAULT_CALENDAR, weekdays: [...DEFAULT_WEEKDAYS], holidays: [], departments: {} };
}

/** The calendar from the settings document; a missing or bad value reads as its default (the card never throws on an older server). */
export function calendarOf(raw: unknown): WorkCalendar {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fresh();
  const r = raw as Record<string, unknown>;
  const okDays = Array.isArray(r.weekdays) && r.weekdays.length > 0 && r.weekdays.every((x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 6);
  const days = okDays ? [...new Set(r.weekdays as number[])].sort((a, b) => a - b) : [...DEFAULT_WEEKDAYS];
  const time = (v: unknown, d: string) => (typeof v === 'string' && HHMM.test(v) ? v : d);
  let start = time(r.start, DEFAULT_CALENDAR.start);
  let end = time(r.end, DEFAULT_CALENDAR.end);
  if (start >= end) [start, end] = [DEFAULT_CALENDAR.start, DEFAULT_CALENDAR.end];
  const holidays = Array.isArray(r.holidays) ? [...new Set((r.holidays as unknown[]).filter((x): x is string => typeof x === 'string' && isIsoDate(x)))].sort() : [];
  const deps = r.departments && typeof r.departments === 'object' && !Array.isArray(r.departments) ? (r.departments as Record<string, DeptCalendarOverride>) : {};
  return { enabled: r.enabled === true, weekdays: days, start, end, holidays, departments: { ...deps } };
}

/** The first problem of a draft, or null. A switched-off calendar is not checked (it is stored as typed but never used). */
export function calendarProblem(c: WorkCalendar): CalendarProblem | null {
  if (!c.enabled) return null;
  if (c.weekdays.length === 0) return 'weekdays';
  if (!HHMM.test(c.start) || !HHMM.test(c.end)) return 'time';
  if (c.start >= c.end) return 'order'; // an empty window or one across midnight (like the vendor send hours)
  if (c.holidays.length > HOLIDAYS_MAX) return 'holidays_many';
  return null;
}

/** Toggle a weekday in a list (kept sorted, no repeat). */
export function toggleDay(days: readonly number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
}

/**
 * The holidays typed one per line (or separated by commas / spaces): `2026-10-21`, `21.10.2026` or `21/10/2026`. Returns the clean sorted
 * unique ISO list and the entries that are not a real date (shown to the administrator, nothing is dropped silently).
 */
export function parseHolidays(text: string): { dates: string[]; bad: string[] } {
  const dates = new Set<string>();
  const bad: string[] = [];
  for (const part of text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean)) {
    const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(part);
    const iso = dmy ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}` : part;
    if (isIsoDate(iso)) dates.add(iso);
    else bad.push(part);
  }
  return { dates: [...dates].sort(), bad };
}

export function holidaysText(dates: readonly string[]): string {
  return dates.join('\n');
}

/** The body of PUT /tickets/settings for a draft: the whole document (a save replaces it; department overrides go back unchanged). */
export function calendarPatch(c: WorkCalendar): WorkCalendar {
  return { enabled: c.enabled, weekdays: [...c.weekdays].sort((a, b) => a - b), start: c.start, end: c.end, holidays: [...c.holidays].sort(), departments: c.departments };
}

export function sameCalendar(a: WorkCalendar, b: WorkCalendar): boolean {
  return JSON.stringify(calendarPatch(a)) === JSON.stringify(calendarPatch(b));
}
