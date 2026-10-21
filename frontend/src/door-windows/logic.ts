/**
 * CR-039 / DOORWIN-295: the pure logic of the door-windows screen and the emergency controls - no DOM, no fetch, so the unit specs
 * test it directly. The server decides everything; this module only shapes: the editor draft and its client-side checks (a mirror of
 * the server's - the server's answer wins), the state words and tones, the time formatting in the door's own zone, the grouping of
 * occurrences, and the emergency sheet's step machine (hold -> prepare -> confirm -> send -> result, auto-close).
 */
import type { CalendarPolicy, DoorResult, DoorRow, Incident, Occurrence, OccState, Rule, RuleBody, RuleKind } from '../api/door-windows';

export type Tone = 'ok' | 'acc' | 'warn' | 'err' | 'off';

// ---------------------------------------------------------------- time (always the door's own IANA zone; never a fixed offset)

const formatters = new Map<string, Intl.DateTimeFormat>();

function parts(iso: string, zone: string): Record<string, string> {
  const key = zone || 'Asia/Jerusalem';
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: key, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
    formatters.set(key, f);
  }
  const out: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(iso))) out[p.type] = p.value;
  return out;
}

/** "HH:MM" of an instant in a zone. */
export function hm(iso: string, zone: string): string {
  const p = parts(iso, zone);
  return `${p.hour}:${p.minute}`;
}

/** "YYYY-MM-DD" (the local date) of an instant in a zone. */
export function localDay(iso: string, zone: string): string {
  const p = parts(iso, zone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 0 = Sunday .. 6 = Saturday of a local date string. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function minutes(v: string): number {
  return v === '24:00' ? 24 * 60 : Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
}

// ---------------------------------------------------------------- state words and tones

export const OCC_TONE: Record<OccState, Tone> = {
  prepared: 'off', planned: 'off', armed: 'acc', starting: 'acc', active: 'ok', not_started: 'warn', ending: 'acc',
  relock_unconfirmed: 'err', closed_confirmed: 'off', cancelled: 'off', superseded: 'err', elapsed: 'off',
};

export const RESULT_TONE: Record<DoorResult, Tone> = { pending: 'off', sent: 'acc', acknowledged: 'ok', refused: 'err', unknown: 'warn', skipped: 'off' };

export const RULE_TONE: Record<Rule['state'], Tone> = { draft: 'off', enabled: 'ok', paused: 'warn', retired: 'off' };

/** The open (not final) occurrence states - the ones a person may still act on. */
export const LIVE_STATES: readonly OccState[] = ['starting', 'active', 'not_started', 'ending'];

export function alarms(occ: Occurrence[]): Occurrence[] {
  return occ.filter((o) => o.state === 'relock_unconfirmed').sort((a, b) => (a.end_at < b.end_at ? -1 : 1));
}

/** May the person end this occurrence now (the guard override)? The server decides again. */
export function canEndNow(o: Occurrence, door: DoorRow | undefined): boolean {
  return !!door?.cancel && LIVE_STATES.includes(o.state) && o.state !== 'ending';
}

/** The occurrences of the coming days grouped by door (doors in label order, occurrences by start). Final states of the past drop out. */
export function byDoor(occ: Occurrence[], doors: DoorRow[], nowIso: string): { door: DoorRow | { key: string; label: string }; items: Occurrence[] }[] {
  const keep = occ.filter((o) => o.state !== 'cancelled' && (o.end_at >= nowIso || o.state === 'relock_unconfirmed' || LIVE_STATES.includes(o.state)));
  const groups = new Map<string, Occurrence[]>();
  for (const o of keep) groups.set(o.door, [...(groups.get(o.door) ?? []), o]);
  const known = new Map(doors.map((d) => [d.key, d]));
  return [...groups.entries()]
    .map(([key, items]) => ({ door: known.get(key) ?? { key, label: items[0]?.label ?? key }, items: items.sort((a, b) => (a.start_at < b.start_at ? -1 : 1)) }))
    .sort((a, b) => a.door.label.localeCompare(b.door.label, 'he'));
}

// ---------------------------------------------------------------- rule summaries

/** Periods grouped into "days: hours" lines, e.g. [[0,1,2,3,4], '08:00-11:00']. Weekdays only; one-off dates separately. */
export function periodLines(rule: Pick<Rule, 'kind' | 'periods'>): { days: number[]; date: string | null; hours: string }[] {
  if (rule.kind === 'once') {
    const byDate = new Map<string, string[]>();
    for (const p of rule.periods) byDate.set(p.on_date ?? '', [...(byDate.get(p.on_date ?? '') ?? []), `${p.start}–${p.end}`]);
    return [...byDate.entries()].sort().map(([date, hours]) => ({ days: [], date, hours: hours.sort().join(', ') }));
  }
  const byHours = new Map<string, number[]>();
  for (const p of rule.periods) {
    const k = `${p.start}–${p.end}`;
    byHours.set(k, [...(byHours.get(k) ?? []), p.weekday ?? 0]);
  }
  return [...byHours.entries()].map(([hours, days]) => ({ days: [...new Set(days)].sort(), date: null, hours })).sort((a, b) => (a.hours < b.hours ? -1 : 1));
}

/** Contiguous day runs as label pairs: [0,1,2,3,4] -> [[0,4]], [0,2,4] -> [[0,0],[2,2],[4,4]]. */
export function dayRuns(days: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const d of [...days].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && d === last[1] + 1) last[1] = d;
    else out.push([d, d]);
  }
  return out;
}

// ---------------------------------------------------------------- the editor draft

export interface Range {
  start: string;
  end: string;
}

export interface Draft {
  id: string | null;
  revision: number | null;
  name: string;
  kind: RuleKind;
  calendar: CalendarPolicy;
  notes: string;
  doors: Set<string>;
  /** weekly: the chosen days share the ranges (the common case); a rule saved with different hours per day keeps them per day. */
  days: Set<number>;
  ranges: Range[];
  perDay: Map<number, Range[]> | null;
  date: string;
}

export function emptyDraft(today: string): Draft {
  return { id: null, revision: null, name: '', kind: 'weekly', calendar: 'skip_holidays', notes: '', doors: new Set(), days: new Set([0, 1, 2, 3, 4]),
           ranges: [{ start: '08:00', end: '11:00' }], perDay: null, date: today };
}

/** A saved rule back into the editor. Same hours on every chosen day -> the simple form; otherwise per-day ranges are kept as they are. */
export function draftOf(rule: Rule, today: string): Draft {
  const d = emptyDraft(today);
  d.id = rule.id;
  d.revision = rule.revision;
  d.name = rule.name;
  d.kind = rule.kind;
  d.calendar = rule.calendar_policy;
  d.notes = rule.notes;
  d.doors = new Set(rule.doors.map((x) => x.key));
  if (rule.kind === 'once') {
    d.date = rule.periods[0]?.on_date ?? today;
    d.ranges = rule.periods.map((p) => ({ start: p.start, end: p.end }));
    return d;
  }
  const per = new Map<number, Range[]>();
  for (const p of rule.periods) per.set(p.weekday ?? 0, [...(per.get(p.weekday ?? 0) ?? []), { start: p.start, end: p.end }]);
  const sig = (rs: Range[]) => rs.map((r) => `${r.start}-${r.end}`).sort().join('|');
  const sigs = new Set([...per.values()].map(sig));
  d.days = new Set(per.keys());
  if (sigs.size <= 1) {
    d.ranges = [...per.values()][0]?.map((r) => ({ ...r })) ?? [];
    d.perDay = null;
  } else {
    d.perDay = per;
    d.ranges = [];
  }
  return d;
}

/** The first problem of a draft as an i18n key (+ vars), or null. A mirror of the server's checks; the server's answer wins. */
export function draftProblem(d: Draft, maxHours: number): { key: string; vars?: Record<string, number> } | null {
  if (!d.name.trim()) return { key: 'errName' };
  if (!d.doors.size) return { key: 'errDoors' };
  if (d.kind === 'weekly' && !d.perDay && !d.days.size) return { key: 'errDays' };
  if (d.kind === 'once' && !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return { key: 'errDate' };
  const ranges = d.perDay ? [...d.perDay.values()].flat() : d.ranges;
  if (!ranges.length) return { key: 'errPeriods' };
  for (const r of ranges) {
    if (!HM_RE.test(r.start) || !(HM_RE.test(r.end) || r.end === '24:00') || minutes(r.end) <= minutes(r.start)) return { key: 'errOrder' };
    if (minutes(r.end) - minutes(r.start) > maxHours * 60) return { key: 'errLong', vars: { h: maxHours } };
  }
  return null;
}

/** The request body of a draft (doors as keys "station:relay"; the station id may itself contain ":" - the relay is after the last one). */
export function bodyOf(d: Draft, enable: boolean): RuleBody {
  const doors = [...d.doors].map((k) => {
    const i = k.lastIndexOf(':');
    return { station_id: k.slice(0, i), relay: Number(k.slice(i + 1)) };
  });
  let periods: RuleBody['periods'];
  if (d.kind === 'once') periods = d.ranges.map((r) => ({ on_date: d.date, start: r.start, end: r.end }));
  else if (d.perDay) periods = [...d.perDay.entries()].sort((a, b) => a[0] - b[0]).flatMap(([wd, rs]) => rs.map((r) => ({ weekday: wd, start: r.start, end: r.end })));
  else periods = [...d.days].sort((a, b) => a - b).flatMap((wd) => d.ranges.map((r) => ({ weekday: wd, start: r.start, end: r.end })));
  return { name: d.name.trim(), kind: d.kind, calendar_policy: d.calendar, notes: d.notes.trim(), doors, periods, ...(d.revision !== null ? { revision: d.revision } : {}), enable };
}

// ---------------------------------------------------------------- emergency

export const AUTO_CLOSE_MS = 20_000;

/** 0..1 of a press-and-hold (the ring). */
export function holdProgress(startedMs: number | null, nowMs: number, holdMs: number): number {
  if (startedMs === null) return 0;
  return Math.max(0, Math.min(1, (nowMs - startedMs) / Math.max(1, holdMs)));
}

export type SheetStep = 'choose' | 'confirm' | 'sending' | 'result' | 'error';

/** The sheet's next step. Only these moves exist: a hold completes -> confirm (after the server's prepare); confirm -> sending ->
 * result | error; anything -> choose on cancel / auto-close. There is no path from `choose` straight to `sending`. */
export function nextStep(step: SheetStep, event: 'held' | 'confirm' | 'sent' | 'failed' | 'cancel' | 'timeout'): SheetStep {
  if (event === 'cancel' || event === 'timeout') return step === 'sending' ? 'sending' : 'choose';
  if (step === 'choose' && event === 'held') return 'confirm';
  if (step === 'confirm' && event === 'confirm') return 'sending';
  if (step === 'sending' && event === 'sent') return 'result';
  if ((step === 'sending' || step === 'confirm' || step === 'choose') && event === 'failed') return 'error';
  return step;
}

/** The incident's per-door lines of one phase, the failures first (the headline is "N of M confirmed", never "success"). */
export function incidentLines(inc: Incident, phase: 'apply' | 'release' = 'apply'): NonNullable<Incident['doors']> {
  const rank: Record<DoorResult, number> = { refused: 0, unknown: 1, pending: 2, sent: 3, skipped: 4, acknowledged: 5 };
  return (inc.doors ?? []).filter((d) => d.phase === phase).sort((a, b) => rank[a.state] - rank[b.state] || a.label.localeCompare(b.label, 'he'));
}

export function incidentLive(inc: Incident | null | undefined): boolean {
  return !!inc && (inc.state === 'applying' || inc.state === 'in_effect' || inc.state === 'in_effect_partial' || inc.state === 'releasing');
}
