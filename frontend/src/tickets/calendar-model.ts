/**
 * TKCAL: the pure logic of the weekly calendar of the request list - the week (Sunday first), day keys in an IANA zone (never a fixed
 * offset: the two Israeli clock changes make some days 23 or 25 hours), the events a list item carries (the visit time `eta_at` and the
 * SLA targets of `sla`), their per-day segments and the colour tone. No DOM, no Lit: tests/unit-tickets-calendar.spec.ts reads this file.
 *
 * Only what the server already returns is used: `eta_at` (the handler's scheduled time, a point) and `sla.{ack,stuck,resolve}_due_at`
 * (points). The list carries no visit END (the quote work window `work_from..work_to` lives on the request's detail, not on the list), so
 * today every event is a point; an event with an `endMs` is split over the days it touches (the model is ready for a window the day a list
 * item carries one).
 */
import type { TicketItem } from '../api/tickets';

export const DEFAULT_TZ = 'Asia/Jerusalem';
const HOUR = 3_600_000;
export const SLA_NEAR_MS = 24 * HOUR;

// ---------------------------------------------------------------- zoned time

const fmts = new Map<string, Intl.DateTimeFormat>();
function fmtFor(tz: string): Intl.DateTimeFormat {
  let f = fmts.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmts.set(tz, f);
  }
  return f;
}

export interface Parts { y: number; m: number; d: number; h: number; min: number; s: number }

/** The wall-clock parts of an instant in `tz`. */
export function partsOf(ms: number, tz: string = DEFAULT_TZ): Parts {
  const o: Record<string, number> = {};
  for (const p of fmtFor(tz).formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, h: o.hour === 24 ? 0 : o.hour, min: o.minute, s: o.second };
}

const p2 = (n: number) => String(n).padStart(2, '0');
export const keyOf = (y: number, m: number, d: number) => `${y}-${p2(m)}-${p2(d)}`;

/** `yyyy-mm-dd` of an instant in `tz`; '' for an invalid one. */
export function dayKeyOf(ms: number, tz: string = DEFAULT_TZ): string {
  if (!Number.isFinite(ms)) return '';
  const p = partsOf(ms, tz);
  return keyOf(p.y, p.m, p.d);
}

export function isDayKey(k: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
  const [y, m, d] = ymd(k);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

function ymd(key: string): [number, number, number] {
  return [+key.slice(0, 4), +key.slice(5, 7), +key.slice(8, 10)];
}

/** Calendar arithmetic on day keys (no clock involved, so no DST): `addDays('2026-03-27', 1)` is '2026-03-28'. */
export function addDays(key: string, n: number): string {
  const [y, m, d] = ymd(key);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return keyOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(key: string): number {
  const [y, m, d] = ymd(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The Sunday that opens the week of `key`. */
export function weekStart(key: string): string {
  return addDays(key, -weekdayOf(key));
}

export function weekKeys(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function offsetAt(ms: number, tz: string): number {
  const p = partsOf(ms, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000;
}

/** The instant of a wall-clock time in `tz` (a time inside a spring-forward gap resolves to just after the gap). */
export function zonedMs(key: string, h: number, min: number, tz: string = DEFAULT_TZ): number {
  const [y, m, d] = ymd(key);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const o1 = offsetAt(guess, tz);
  let t = guess - o1;
  const o2 = offsetAt(t, tz);
  if (o2 !== o1) t = guess - o2;
  return t;
}

/** The instant a local day starts, and the instant the next one does (the day is `[start, end)`). */
export function dayBounds(key: string, tz: string = DEFAULT_TZ): { start: number; end: number } {
  return { start: zonedMs(key, 0, 0, tz), end: zonedMs(addDays(key, 1), 0, 0, tz) };
}

/** 23, 24 or 25: the real length of a local day. */
export function dayHours(key: string, tz: string = DEFAULT_TZ): number {
  const b = dayBounds(key, tz);
  return (b.end - b.start) / HOUR;
}

/** "09:05" in `tz`. */
export function timeText(ms: number, tz: string = DEFAULT_TZ): string {
  const p = partsOf(ms, tz);
  return `${p2(p.h)}:${p2(p.min)}`;
}

export function todayKey(now: Date = new Date(), tz: string = DEFAULT_TZ): string {
  return dayKeyOf(now.getTime(), tz);
}

/** The week (Sunday key) a step of `n` weeks away. */
export function stepWeek(start: string, n: number): string {
  return addDays(start, 7 * n);
}

// ---------------------------------------------------------------- events

export type CalKind = 'visit' | 'ack' | 'stuck' | 'resolve';
export const CAL_KINDS: readonly CalKind[] = ['visit', 'ack', 'stuck', 'resolve'];
export type CalTone = 'info' | 'quiet' | 'warn' | 'bad';

/** The part of a list item the calendar reads. */
export type CalItem = Pick<TicketItem, 'id' | 'number' | 'title' | 'status' | 'eta_at' | 'sla'>;

export interface CalEvent<T extends CalItem = CalItem> {
  id: string;
  kind: CalKind;
  ticket: T;
  startMs: number;
  /** a window's end; null for a point */
  endMs: number | null;
}

const FINAL = ['closed', 'cancelled'];
const DONE = ['done', 'closed', 'cancelled'];

const ms = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : NaN);

/** The events of one item: its visit time while the request is not final, its SLA targets while it is not done. */
export function eventsOfItem<T extends CalItem>(t: T): CalEvent<T>[] {
  const out: CalEvent<T>[] = [];
  const eta = ms(t.eta_at);
  if (!FINAL.includes(t.status) && Number.isFinite(eta)) out.push({ id: `${t.id}:visit`, kind: 'visit', ticket: t, startMs: eta, endMs: null });
  if (t.sla && !DONE.includes(t.status)) {
    for (const [kind, iso] of [['ack', t.sla.ack_due_at], ['stuck', t.sla.stuck_due_at], ['resolve', t.sla.resolve_due_at]] as const) {
      const at = ms(iso);
      if (Number.isFinite(at)) out.push({ id: `${t.id}:${kind}`, kind, ticket: t, startMs: at, endMs: null });
    }
  }
  return out;
}

export function eventsOf<T extends CalItem>(items: readonly T[]): CalEvent<T>[] {
  return items.flatMap((t) => eventsOfItem(t)).sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
}

/** Open requests of the list that have no time at all (shown as one quiet count, never as events). */
export function unscheduledCount(items: readonly CalItem[]): number {
  return items.filter((t) => !FINAL.includes(t.status) && eventsOfItem(t).length === 0).length;
}

export interface DaySegment<T extends CalItem = CalItem> {
  day: string;
  event: CalEvent<T>;
  fromMs: number;
  toMs: number;
  startsHere: boolean;
  endsHere: boolean;
}

/** An event cut by local days: one segment for a point, one per touched day for a window. */
export function segmentsOf<T extends CalItem>(ev: CalEvent<T>, tz: string = DEFAULT_TZ): DaySegment<T>[] {
  const end = ev.endMs !== null && ev.endMs > ev.startMs ? ev.endMs : ev.startMs;
  const first = dayKeyOf(ev.startMs, tz);
  // a window that ends exactly at midnight does not touch the next day
  const last = end > ev.startMs ? dayKeyOf(end - 1, tz) : first;
  const out: DaySegment<T>[] = [];
  for (let k = first; k <= last && out.length < 400; k = addDays(k, 1)) {
    const b = dayBounds(k, tz);
    out.push({ day: k, event: ev, fromMs: Math.max(ev.startMs, b.start), toMs: Math.min(end, b.end), startsHere: k === first, endsHere: k === last });
  }
  return out;
}

/** The segments that fall on the given days, per day, in time order. */
export function groupByDay<T extends CalItem>(events: readonly CalEvent<T>[], keys: readonly string[], tz: string = DEFAULT_TZ): Record<string, DaySegment<T>[]> {
  const out: Record<string, DaySegment<T>[]> = Object.fromEntries(keys.map((k) => [k, []]));
  for (const ev of events) for (const s of segmentsOf(ev, tz)) out[s.day]?.push(s);
  for (const k of keys) out[k].sort((a, b) => a.fromMs - b.fromMs || a.event.id.localeCompare(b.event.id));
  return out;
}

/** How many distinct events fall in the week (the toolbar's quiet count). */
export function weekCount(by: Record<string, DaySegment[]>): number {
  return new Set(Object.values(by).flatMap((l) => l.map((s) => s.event.id))).size;
}

/** The colour: only the existing states - a visit is the info tone, a target is quiet while far, warn under 24 h, bad once crossed. */
export function toneOf(ev: CalEvent, now: Date = new Date()): CalTone {
  if (ev.kind === 'visit') return 'info';
  const left = ev.startMs - now.getTime();
  if (left < 0) return 'bad';
  return left < SLA_NEAR_MS ? 'warn' : 'quiet';
}

/** The week that holds the first event on or after `from`; null when there is none (nothing is guessed). */
export function nearestEventWeek(events: readonly CalEvent[], from: string, tz: string = DEFAULT_TZ): string | null {
  const start = zonedMs(from, 0, 0, tz);
  const next = events.find((e) => e.startMs >= start);
  return next ? weekStart(dayKeyOf(next.startMs, tz)) : null;
}

/** Whether a day key lies in the week that starts at `start`. */
export function inWeek(key: string, start: string): boolean {
  return key >= start && key <= addDays(start, 6);
}

export function dayNum(key: string): number {
  return +key.slice(8, 10);
}
export function monthNum(key: string): number {
  return +key.slice(5, 7);
}
