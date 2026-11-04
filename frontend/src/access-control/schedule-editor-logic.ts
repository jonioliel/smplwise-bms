/**
 * The schedule library editor's pure logic (WISKEY-SCHED-WRITE-2390): the draft model and its edits, the same validation the
 * integration applies (`access/schedules.normalize` of rc.10, mirrored by the server in services/wiskey_schedule_writes.py), the week
 * grid conversion, the device-slot defaults and the deploy / job wording helpers. No DOM, no network - the unit spec checks all of it.
 */
import type { LibrarySchedule } from '../api/access-schedules';
import type { Period, WeekdayName } from '../api/access-stations';
import type { Bindings, Capability, DeployResult, Draft, HolidayDraft, Readiness, Week } from '../api/schedule-writes';
import type { WeekDays } from '../components/sw-week-grid';

/** The schedules administrator: `access.schedules.manage` or `system.configure` at the installation (the server's own gate). */
export function libraryManage(canInstallation: (p: string) => boolean): boolean {
  return canInstallation('access.schedules.manage') || canInstallation('system.configure');
}

/** The integration's order (Monday first) - the data. */
export const DAYS: readonly WeekdayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** The Hebrew week on screen: Sunday first. */
export const DAYS_UI: readonly WeekdayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WORKDAYS: readonly WeekdayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
export const MAX_PERIODS = 8;
export const MAX_HOLIDAYS = 64;
export const NAME_MAX = 32;

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const END = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const emptyWeek = (): Week => Object.fromEntries(DAYS.map((d) => [d, []])) as unknown as Week;
export const emptyDraft = (name = ''): Draft => ({ name, weekly: emptyWeek(), holidays: [] });

/** A library schedule as an editable draft (every day present, copies only). */
export function draftOf(s: LibrarySchedule): Draft {
  const weekly = emptyWeek();
  for (const d of DAYS) weekly[d] = (s.weekly?.[d] ?? []).map((p) => ({ start: p.start, end: p.end }));
  return {
    name: s.name ?? '',
    weekly,
    holidays: (s.holidays ?? []).map((h) => ({ name: h.name ?? '', start: h.start ?? '', end: h.end ?? '', periods: (h.periods ?? []).map((p) => ({ start: p.start, end: p.end })) })),
  };
}

export const cloneDraft = (d: Draft): Draft => JSON.parse(JSON.stringify(d)) as Draft;
export const sameDraft = (a: Draft, b: Draft): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** The draft as the server and the integration take it: name trimmed is NOT applied (the integration trims itself); periods and
 * holidays in their stored order so two equivalent drafts compare equal. */
export function canonical(d: Draft): Draft {
  const sortP = (ps: Period[]) => [...ps].sort((a, b) => a.start.localeCompare(b.start));
  return {
    name: d.name,
    weekly: Object.fromEntries(DAYS.map((day) => [day, sortP(d.weekly[day] ?? [])])) as unknown as Week,
    holidays: [...d.holidays].map((h) => ({ ...h, periods: sortP(h.periods) })).sort((a, b) => a.start.localeCompare(b.start)),
  };
}

export const minute = (t: string): number => (t === '24:00' ? 1440 : Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)));

/** One fault the integration would refuse: its own code and where (`name`, `weekly.Monday.0`, `holidays.1.start`...). */
export interface DraftFault {
  code: string;
  where: string;
}

function periodFaults(ps: Period[], where: string): DraftFault[] {
  if (ps.length > MAX_PERIODS) return [{ code: 'schedule_period_limit', where }];
  const out: DraftFault[] = [];
  ps.forEach((p, i) => {
    if (!TIME.test(p.start) || !END.test(p.end)) out.push({ code: 'schedule_invalid_time', where: `${where}.${i}` });
    else if (minute(p.start) >= minute(p.end)) out.push({ code: 'schedule_invalid_time', where: `${where}.${i}` });
  });
  if (out.length) return out;
  const sorted = [...ps].sort((a, b) => minute(a.start) - minute(b.start));
  for (let i = 1; i < sorted.length; i++) if (minute(sorted[i - 1].end) > minute(sorted[i].start)) return [{ code: 'schedule_overlap', where }];
  return [];
}

function dateOk(v: string): boolean {
  if (!DATE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && y <= 2037 && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function nameFault(name: string): boolean {
  // eslint-disable-next-line no-control-regex
  return name.length > NAME_MAX || !name.trim() || /[\u0000-\u001f]/.test(name);
}

/** Every fault of the draft, in screen order (empty = the integration's own rules accept it). */
export function faults(d: Draft): DraftFault[] {
  const out: DraftFault[] = [];
  if (nameFault(d.name)) out.push({ code: 'invalid_text', where: 'name' });
  for (const day of DAYS) out.push(...periodFaults(d.weekly[day] ?? [], `weekly.${day}`));
  if (d.holidays.length > MAX_HOLIDAYS) out.push({ code: 'schedule_holiday_limit', where: 'holidays' });
  d.holidays.forEach((h, i) => {
    const w = `holidays.${i}`;
    if (nameFault(h.name)) out.push({ code: 'invalid_text', where: `${w}.name` });
    if (!dateOk(h.start)) out.push({ code: 'schedule_invalid_date', where: `${w}.start` });
    if (!dateOk(h.end)) out.push({ code: 'schedule_invalid_date', where: `${w}.end` });
    if (dateOk(h.start) && dateOk(h.end) && h.start > h.end) out.push({ code: 'schedule_invalid_date', where: w });
    out.push(...periodFaults(h.periods, `${w}.periods`));
  });
  const ok = d.holidays.filter((h) => dateOk(h.start) && dateOk(h.end)).sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < ok.length; i++) if (ok[i - 1].end >= ok[i].start) {
    out.push({ code: 'schedule_holiday_overlap', where: 'holidays' });
    break;
  }
  return out;
}

/** Whether a fault concerns `where` or something inside it. */
export const faultAt = (all: DraftFault[], where: string): DraftFault | undefined => all.find((f) => f.where === where || f.where.startsWith(`${where}.`));

// ---------------------------------------------------------------- edits (pure: each returns a new draft)

export function setPeriods(d: Draft, day: WeekdayName, periods: Period[]): Draft {
  return { ...d, weekly: { ...d.weekly, [day]: periods } };
}

/** A new window after the day's last one (an hour, clipped to the day), or 08:00-17:00 on an empty day. */
export function nextPeriod(ps: Period[]): Period | null {
  if (ps.length >= MAX_PERIODS) return null;
  if (!ps.length) return { start: '08:00', end: '17:00' };
  const last = Math.max(...ps.map((p) => minute(p.end)));
  if (last >= 1439) return null;
  const end = Math.min(1440, last + 60);
  const fmt = (m: number) => (m === 1440 ? '24:00' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return { start: fmt(last), end: fmt(end) };
}

export function addPeriod(d: Draft, day: WeekdayName): Draft {
  const p = nextPeriod(d.weekly[day] ?? []);
  return p ? setPeriods(d, day, [...(d.weekly[day] ?? []), p]) : d;
}

export function removePeriod(d: Draft, day: WeekdayName, i: number): Draft {
  return setPeriods(d, day, (d.weekly[day] ?? []).filter((_, k) => k !== i));
}

export function editPeriod(d: Draft, day: WeekdayName, i: number, key: 'start' | 'end', value: string): Draft {
  return setPeriods(d, day, (d.weekly[day] ?? []).map((p, k) => (k === i ? { ...p, [key]: value } : p)));
}

/** The day's windows copied onto `to` (each a copy), e.g. Sunday onto the other workdays. */
export function copyDay(d: Draft, from: WeekdayName, to: readonly WeekdayName[]): Draft {
  const weekly = { ...d.weekly };
  for (const day of to) if (day !== from) weekly[day] = (d.weekly[from] ?? []).map((p) => ({ ...p }));
  return { ...d, weekly };
}

export function addHoliday(d: Draft, today: string): Draft {
  const h: HolidayDraft = { name: '', start: today, end: today, periods: [] };
  return { ...d, holidays: [...d.holidays, h] };
}

export function editHoliday(d: Draft, i: number, patch: Partial<HolidayDraft>): Draft {
  return { ...d, holidays: d.holidays.map((h, k) => (k === i ? { ...h, ...patch } : h)) };
}

export function removeHoliday(d: Draft, i: number): Draft {
  return { ...d, holidays: d.holidays.filter((_, k) => k !== i) };
}

// ---------------------------------------------------------------- the week grid (sw-week-grid: 0 = Monday ... 6 = Sunday, hours)

export function gridOf(week: Week): WeekDays {
  return DAYS.map((day) => (week[day] ?? []).filter((p) => TIME.test(p.start) && END.test(p.end)).map((p) => ({ begin: `${p.start}:00`, end: `${p.end}:00` })));
}

/** The grid painted by the operator, back to windows. Painting works in whole hours: a day the stroke did not change keeps its exact
 * minutes; a changed day takes the painted hours. */
export function weekFromGrid(days: WeekDays, before: Week): Week {
  const prev = gridOf(before);
  const out = emptyWeek();
  DAYS.forEach((day, i) => {
    const painted = (days[i] ?? []).map((r) => ({ start: r.begin.slice(0, 5), end: r.end.slice(0, 5) === '24:00' ? '24:00' : r.end.slice(0, 5) }));
    const same = JSON.stringify(hourCells(days[i] ?? [])) === JSON.stringify(hourCells(prev[i] ?? []));
    out[day] = same ? (before[day] ?? []).map((p) => ({ ...p })) : painted;
  });
  return out;
}

function hourCells(ranges: { begin: string; end: string }[]): boolean[] {
  const row = Array.from({ length: 24 }, () => false);
  for (const r of ranges) {
    const a = Math.floor(minute(r.begin.slice(0, 5)) / 60);
    const b = Math.min(24, Math.ceil(minute(r.end.slice(0, 5)) / 60));
    for (let h = a; h < b; h++) row[h] = true;
  }
  return row;
}

/** Total open minutes in the week (the editor's summary line). */
export function weekMinutes(week: Week): number {
  return DAYS.reduce((n, day) => n + (week[day] ?? []).reduce((m, p) => (TIME.test(p.start) && END.test(p.end) ? m + Math.max(0, minute(p.end) - minute(p.start)) : m), 0), 0);
}

// ---------------------------------------------------------------- device slots

/** A kind's id range as the station advertised it (readiness), or null. */
export function rangeOf(r: Readiness | null, kind: string): [number, number] | null {
  const cap: Capability | null | undefined = r?.checks.find((c) => c.kind === kind)?.capabilities;
  const ids = cap?.ids;
  return Array.isArray(ids) && ids.length === 2 ? [ids[0], ids[1]] : null;
}

/** The slots a proposal starts from: the schedule's earlier proposal on this station (the same slots), else the top of each advertised
 * range (the integration never allocates from absence - the operator decides; these are only a starting point). */
export function defaultBindings(holidays: number, r: Readiness | null, previous?: Bindings | null): Bindings {
  if (previous && previous.holidays.length === holidays && (holidays === 0) === (previous.holiday_group === null)) return { ...previous, holidays: [...previous.holidays] };
  const top = (kind: string, fallback: number) => rangeOf(r, kind)?.[1] ?? fallback;
  const hTop = top('holiday', 64);
  return {
    template: top('template', 1),
    weekly: top('weekly', 1),
    holiday_group: holidays ? top('holiday_group', 1) : null,
    holidays: Array.from({ length: holidays }, (_, i) => Math.max(1, hTop - i)),
  };
}

/** Faults of the chosen slots against the integration's rules and the advertised ranges: `where` -> code. */
export function bindingFaults(b: Bindings, r: Readiness | null): Record<string, string> {
  const out: Record<string, string> = {};
  const check = (where: string, kind: string, v: number | null) => {
    if (v === null || !Number.isInteger(v) || v < 1 || v > 65535) out[where] = 'schedule_binding_invalid';
    else {
      const range = rangeOf(r, kind);
      if (range && (v < range[0] || v > range[1])) out[where] = 'schedule_binding_out_of_range';
    }
  };
  check('template', 'template', b.template);
  check('weekly', 'weekly', b.weekly);
  if (b.holidays.length) check('holiday_group', 'holiday_group', b.holiday_group);
  b.holidays.forEach((v, i) => check(`holidays.${i}`, 'holiday', v));
  if (new Set(b.holidays).size !== b.holidays.length) out.holidays = 'schedule_binding_invalid';
  return out;
}

// ---------------------------------------------------------------- wording helpers

export type Tone = 'live' | 'stale' | 'error' | 'offline' | 'unknown' | 'neutral';

export function jobTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'verified':
    case 'ready':
      return 'live';
    case 'blocked':
    case 'interrupted':
      return 'stale';
    case 'failed':
      return 'error';
    case 'cancelled':
      return 'offline';
    case 'pending':
    case 'queued':
    case 'checking':
      return 'neutral';
    default:
      return 'unknown';
  }
}

export const isActive = (status: string | null | undefined): boolean => status === 'pending' || status === 'queued' || status === 'checking';

/** The deploy batch's lines: one per station, its result. */
export function deployTone(r: DeployResult): Tone {
  return r.status === 'queued' ? 'neutral' : r.status === 'refused' ? 'error' : r.status === 'not_sent' ? 'offline' : 'unknown';
}

/** The local date `YYYY-MM-DD` and time `HH:MM` of `ms` in the browser's zone (the check's default instant). */
export function localNow(ms: number): { date: string; time: string } {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}

/** The integration's portable document of a list of drafts (what `export` returns and `import` takes). */
export function transferDocument(drafts: Draft[]): string {
  return JSON.stringify({ format: 'hikvision_intercom.schedule_drafts', version: 1, schedules: drafts.map(canonical) }, null, 2);
}
