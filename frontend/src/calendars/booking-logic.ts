/**
 * CALENDARS-UI-2310 slice A: the pure logic of the calendar views, the rooms timeline and the booking drawer (no DOM beyond the address
 * helpers, no network): unit-tested in Node (tests/unit-calendars-ui-2310.spec.ts).
 */
import type { Equipment, OnBehalfKind, Occurrence, RoomDay } from '../api/calendars';
import { DAY_LONG, addDays, ddmm, sameDay, startOfDay } from './model';

export const EQUIPMENT_LABEL: Record<Equipment, string> = { screen: 'מסך', projector: 'מקרן', video_call: 'שיחת וידאו', whiteboard: 'לוח', kitchen: 'מטבחון', accessible: 'נגיש' };
/** Lanes of one room's track: overlapping entries (a maintenance window over a displaced booking) get their own band. */
export function trackLanes(entries: Pick<Occurrence, 'start' | 'end'>[]): number[] {
  const lanes: number[] = [];
  const ends: number[] = [];
  entries.forEach((o) => {
    const s = new Date(o.start).getTime();
    let l = ends.findIndex((e) => e <= s);
    if (l < 0) {
      l = ends.length;
      ends.push(0);
    }
    ends[l] = new Date(o.end).getTime();
    lanes.push(l);
  });
  return lanes;
}

/** "מצא חדר פנוי": the first room (in order) free for `minutes` from the next quarter hour on, inside its open hours, by the day's entries. */
export function firstFree(rooms: Pick<RoomDay, 'calendar_id' | 'open' | 'entries'>[], day: Date, now: Date, minutes: number, until = 23): { room: string; start: Date; end: Date } | null {
  const base = sameDay(day, now) ? Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15 : 8 * 60;
  for (let m = base; m + minutes <= until * 60; m += 15) {
    const s = new Date(startOfDay(day).getTime() + m * 60000);
    const e = new Date(s.getTime() + minutes * 60000);
    for (const r of rooms) {
      const open = r.open.some((w) => {
        const [fh, fm] = w.from.split(':').map(Number);
        const [th, tm] = w.to.split(':').map(Number);
        return m >= fh * 60 + fm && m + minutes <= th * 60 + tm;
      });
      if (!open) continue;
      const busy = r.entries.some((o) => ['confirmed', 'pending'].includes(o.state) && new Date(o.start) < e && new Date(o.end) > s);
      if (!busy) return { room: r.calendar_id, start: s, end: e };
    }
  }
  return null;
}

export const BEHALF_LABEL: Record<OnBehalfKind, string> = { self: 'אני', team: 'צוות', class: 'חוג', customer: 'לקוח', department: 'מחלקה', vendor: 'ספק' };
export type Repeat = 'none' | 'daily' | 'weekly';

/** The recurrence rule of the drawer's three choices (contract section 4: RFC 5545 RRULE, COUNT-bounded here). */
export function rruleOf(repeat: Repeat, count: number): string | undefined {
  if (repeat === 'none' || count < 2) return undefined;
  return `FREQ=${repeat === 'daily' ? 'DAILY' : 'WEEKLY'};COUNT=${Math.min(Math.max(count, 2), 104)}`;
}
/** "כל שלישי עד 29.12 · 9 מועדים" */
export function repeatSummary(repeat: Repeat, count: number, start: Date): string {
  if (repeat === 'none' || count < 2) return 'פעם אחת';
  const n = Math.min(Math.max(count, 2), 104);
  const last = addDays(start, repeat === 'daily' ? n - 1 : (n - 1) * 7);
  return `${repeat === 'daily' ? 'כל יום' : `כל ${DAY_LONG[start.getDay()]}`} עד ${ddmm(last)} · ${n} מועדים`;
}
/** A local date ("YYYY-MM-DD") and a local time ("HH:MM") as an instant. */
export function localInstant(date: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  return m && t ? new Date(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]) : null;
}

/** View state lives in the address (?view=&date=), written with replaceState so no route change (and no reload) follows; the demo's own
 * parameters (data / role / mode) stay. */
export function readHashParam(name: string): string | null {
  return new URLSearchParams(window.location.hash.split('?')[1] ?? '').get(name);
}
export function writeHashParams(values: Record<string, string>): void {
  const [path, query = ''] = window.location.hash.split('?');
  const p = new URLSearchParams(query);
  for (const [k, v] of Object.entries(values)) p.set(k, v);
  history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}${path}?${p.toString()}`);
}
export function parseDateParam(v: string | null, now: Date): Date {
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : startOfDay(now);
}

