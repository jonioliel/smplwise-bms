/**
 * SLACAL (2.9.1): the pure logic of the working-hours calendar card (Settings > the module > general). The stored document is
 * `tickets.settings.calendar` (services/tickets/work_calendar.py):
 *   {enabled, weekdays, start, end, days, holidays, hold_internal, auto_close, link_unopened, departments}.
 * OFF by default, which is exactly the old wall-clock behaviour. Weekdays are ISO-style Monday = 0 ... Sunday = 6 (as the server stores
 * them); the card lists them Sunday first. `days` holds per-weekday windows that replace the daily one (a shorter Friday). A department
 * override carries the same hours fields (`enabled`, `weekdays`, `start`, `end`, `days`). No DOM, no Lit:
 * tests/unit-tickets-work-calendar.spec.ts reads this file directly. The server validates the same rules again (422), so the card's
 * checks are for a quick, local message only.
 */

export interface DayWindow { start: string; end: string }
export type DayWindows = Record<string, DayWindow>;
export interface DeptCalendarOverride { enabled?: boolean; weekdays?: number[]; start?: string; end?: string; days?: DayWindows }
export type AutoCloseMode = 'calendar' | 'working';
export type LinkClockMode = 'wall' | 'working';

/** The hours part of a calendar: what the installation and each own-hours department carry. */
export interface HoursSpec { weekdays: number[]; start: string; end: string; days: DayWindows }

export interface WorkCalendar extends HoursSpec {
  enabled: boolean;
  holidays: string[];
  /** an internal reminder / manager alert that falls outside working time waits for the next opening (default on) */
  hold_internal: boolean;
  /** the `done` -> closed wait: calendar days (default, as before) or working time */
  auto_close: AutoCloseMode;
  /** the "vendor link not opened" threshold: the vendor's wall clock (default) or working time */
  link_unopened: LinkClockMode;
  departments: Record<string, DeptCalendarOverride>;
}

export const HOLIDAYS_MAX = 400;
/** the order the card lists the days in: Sunday first (the week of the default installation) */
export const WEEK_ORDER: readonly number[] = [6, 0, 1, 2, 3, 4, 5];
export const DEFAULT_WEEKDAYS: readonly number[] = [0, 1, 2, 3, 6];
export const AUTO_CLOSE_MODES: readonly AutoCloseMode[] = ['calendar', 'working'];
export const LINK_CLOCK_MODES: readonly LinkClockMode[] = ['wall', 'working'];
export const DEFAULT_CALENDAR: WorkCalendar = {
  enabled: false, weekdays: [...DEFAULT_WEEKDAYS], start: '08:00', end: '17:00', days: {}, holidays: [], hold_internal: true,
  auto_close: 'calendar', link_unopened: 'wall', departments: {},
};

export type CalendarProblem = 'weekdays' | 'time' | 'order' | 'holidays_many' | 'dept';
export type DeptMode = 'inherit' | 'always' | 'own';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_KEY = /^[0-6]$/;

/** A real calendar date `YYYY-MM-DD` (not 2026-02-30). */
export function isIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function fresh(): WorkCalendar {
  return { ...DEFAULT_CALENDAR, weekdays: [...DEFAULT_WEEKDAYS], days: {}, holidays: [], departments: {} };
}

function windowsOf(raw: unknown): DayWindows {
  const out: DayWindows = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, w] of Object.entries(raw as Record<string, unknown>)) {
    const v = w as Partial<DayWindow> | null;
    if (DAY_KEY.test(k) && v && typeof v.start === 'string' && typeof v.end === 'string' && HHMM.test(v.start) && HHMM.test(v.end) && v.start < v.end) out[k] = { start: v.start, end: v.end };
  }
  return out;
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
  return {
    enabled: r.enabled === true, weekdays: days, start, end, days: windowsOf(r.days), holidays,
    hold_internal: r.hold_internal !== false,
    auto_close: r.auto_close === 'working' ? 'working' : 'calendar',
    link_unopened: r.link_unopened === 'working' ? 'working' : 'wall',
    departments: { ...deps },
  };
}

/** The first problem of an hours spec, or null. */
export function specProblem(c: HoursSpec): Exclude<CalendarProblem, 'holidays_many' | 'dept'> | null {
  if (c.weekdays.length === 0) return 'weekdays';
  if (!HHMM.test(c.start) || !HHMM.test(c.end)) return 'time';
  if (c.start >= c.end) return 'order'; // an empty window or one across midnight (like the vendor send hours)
  for (const w of Object.values(c.days)) {
    if (!HHMM.test(w.start) || !HHMM.test(w.end)) return 'time';
    if (w.start >= w.end) return 'order';
  }
  return null;
}

/** The first problem of a draft, or null. A switched-off calendar's own hours are not judged, but a department's own hours always are. */
export function calendarProblem(c: WorkCalendar): CalendarProblem | null {
  if (c.enabled) {
    const p = specProblem(c);
    if (p) return p;
    if (c.holidays.length > HOLIDAYS_MAX) return 'holidays_many';
  }
  for (const id of Object.keys(c.departments)) {
    if (deptMode(c.departments[id]) === 'own' && specProblem(deptSpec(c, id))) return 'dept';
  }
  return null;
}

/** Toggle a weekday in a list (kept sorted, no repeat). */
export function toggleDay(days: readonly number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
}

/** The window of one weekday in a spec: its own entry, else the daily window. */
export function windowOf(spec: HoursSpec, day: number): DayWindow {
  return spec.days[String(day)] ?? { start: spec.start, end: spec.end };
}

/** Set one weekday's window; an entry equal to the daily window is dropped (a plain day carries no entry). */
export function setDayWindow(spec: HoursSpec, day: number, start: string, end: string): HoursSpec {
  const days = { ...spec.days };
  if (start === spec.start && end === spec.end) delete days[String(day)];
  else days[String(day)] = { start, end };
  return { ...spec, days };
}

/** Change the daily window; entries of days that no longer differ from it are dropped. */
export function setDailyWindow(spec: HoursSpec, start: string, end: string): HoursSpec {
  const days: DayWindows = {};
  for (const [k, w] of Object.entries(spec.days)) if (w.start !== start || w.end !== end) days[k] = w;
  return { ...spec, start, end, days };
}

// ---------------------------------------------------------------- departments

export function deptMode(o: DeptCalendarOverride | undefined): DeptMode {
  if (!o) return 'inherit';
  if (o.enabled === false) return 'always';
  return o.enabled === true || o.weekdays || o.start || o.end || o.days ? 'own' : 'inherit';
}

/** The hours a department works by: its own where it sets them, else the installation's (per-weekday windows are not inherited by an own-hours override). */
export function deptSpec(c: WorkCalendar, id: string): HoursSpec {
  const o = c.departments[id];
  if (!o || deptMode(o) !== 'own') return { weekdays: c.weekdays, start: c.start, end: c.end, days: c.days };
  const hasHours = o.weekdays || o.start || o.end || o.days;
  return { weekdays: o.weekdays ?? c.weekdays, start: o.start ?? c.start, end: o.end ?? c.end, days: hasHours ? (o.days ?? {}) : c.days };
}

/** Change a department's mode: inherit drops the override, always = {enabled: false}, own = the current effective hours as its own start. */
export function setDeptMode(c: WorkCalendar, id: string, mode: DeptMode): Record<string, DeptCalendarOverride> {
  const deps = { ...c.departments };
  if (mode === 'inherit') delete deps[id];
  else if (mode === 'always') deps[id] = { enabled: false };
  else {
    const s = deptSpec({ ...c, departments: {} }, id);
    deps[id] = { enabled: true, weekdays: [...s.weekdays], start: s.start, end: s.end, days: { ...s.days } };
  }
  return deps;
}

export function setDeptSpec(c: WorkCalendar, id: string, spec: HoursSpec): Record<string, DeptCalendarOverride> {
  return { ...c.departments, [id]: { enabled: true, weekdays: [...spec.weekdays].sort((a, b) => a - b), start: spec.start, end: spec.end, days: { ...spec.days } } };
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

function sortedDays(d: DayWindows): DayWindows {
  return Object.fromEntries(Object.entries(d).sort(([a], [b]) => a.localeCompare(b)));
}

/** The body of PUT /tickets/settings for a draft: the whole document (a save replaces it). */
export function calendarPatch(c: WorkCalendar): WorkCalendar {
  return {
    enabled: c.enabled, weekdays: [...c.weekdays].sort((a, b) => a - b), start: c.start, end: c.end, days: sortedDays(c.days), holidays: [...c.holidays].sort(),
    hold_internal: c.hold_internal, auto_close: c.auto_close, link_unopened: c.link_unopened, departments: c.departments,
  };
}

export function sameCalendar(a: WorkCalendar, b: WorkCalendar): boolean {
  return JSON.stringify(calendarPatch(a)) === JSON.stringify(calendarPatch(b));
}
