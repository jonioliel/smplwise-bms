/**
 * CR-INV-EVENTS-2440 (review 06:EVT-1, 06:EVT-2) - the two decisions of the event centre that had no home outside the element, so that
 * they can be checked without a browser: what to do with an event the push socket delivered while filters are set, and when a row's
 * pending thumbnail is asked for again. No DOM, no request of its own.
 */
import { instantInZone } from '../api/recordings';
import { addDaysByParts } from '../format/day-key';

/** The list's filters as the screen holds them ('' = not set). */
export interface PushFilters {
  date: string;
  cameraId: string;
  recorderId: string;
  type: string;
  source: string;
  filter: 'all' | 'unacked' | 'acked';
  placeFloor: string;
  placeZone: string;
  q: string;
}

/** What a pushed event carries of what the filters look at. */
interface PushedEvent {
  camera_id: string | null;
  recorder_id?: string | null;
  type: string;
  source: string;
  acked_at?: string | null;
}

/**
 * `drop`: not this list's. `update`: a row the list already shows - its fields are refreshed. `prepend`: a new row that matches
 * every filter the browser can evaluate. `reload`: a new row while a filter only the server can evaluate is set (a place, a
 * text search) - the list is read again, once for a burst of pushes, instead of guessing.
 *
 * 06:EVT-1: the first four tests are the ones the screen always made (the event's day in the installation's zone, the camera, the
 * recorder - the event's own or its camera's - and the type). Before this change a new event was then prepended whatever the
 * source, place, text or "handled" filter said, so a non-matching event appeared in a filtered list.
 */
export function pushedAction(ev: PushedEvent, f: PushFilters, o: { day: string; cameraRecorder: string | null; known: boolean }): 'drop' | 'update' | 'prepend' | 'reload' {
  if (f.date && o.day !== f.date) return 'drop';
  if (f.cameraId && ev.camera_id !== f.cameraId) return 'drop';
  if (f.recorderId && ev.recorder_id !== f.recorderId && o.cameraRecorder !== f.recorderId) return 'drop';
  if (f.type && ev.type !== f.type) return 'drop';
  if (o.known) return 'update';
  if (f.source && ev.source !== f.source) return 'drop';
  if (f.filter === 'acked' && !ev.acked_at) return 'drop';
  if (f.filter === 'unacked' && ev.acked_at) return 'drop';
  if (f.placeFloor || f.placeZone || f.q.trim()) return 'reload';
  return 'prepend';
}

/** 06:EVT-2: a pending thumbnail is asked for at most this many times, however often the table renders. */
export const THUMB_MAX_POLLS = 14;
export const THUMB_FIRST_MS = 3000;
export const THUMB_BUSY_MS = 1500;
const THUMB_PARALLEL = 2;

/** The wait before poll number `attempt + 1` (attempt 0 was the first): 3 s growing by 35 % a time, 15 s at most. */
export function thumbDelay(attempt: number): number {
  return Math.min(15000, 3000 * 1.35 ** attempt);
}

type ThumbState = 'ready' | 'pending' | 'unavailable';

interface ThumbPollerOptions {
  /** One request for the thumbnail's state. */
  poll: (id: string) => Promise<ThumbState>;
  /** Whether the row is still worth asking for (the screen is on the page and still lists it). */
  alive: (id: string) => boolean;
  /** The thumbnail settled. */
  done: (id: string, state: 'ready' | 'unavailable') => void;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (h: unknown) => void;
}

/**
 * 06:EVT-2 - the polls of the pending thumbnails. The element asked for a poll from inside the table's render with "attempt 0", so
 * the cap restarted on every render (the 30 s clock, any push) and a thumbnail that never arrives was polled for ever. Here the
 * count belongs to the event id: `want(id)` may be called as often as the row is drawn; it starts a poll only when none is waiting
 * or in flight for that id, continues the count where it stands, and does nothing once the id used its `THUMB_MAX_POLLS` requests.
 * At most `THUMB_PARALLEL` requests are in flight; a poll that finds both slots taken waits `THUMB_BUSY_MS` and does not count.
 */
export class ThumbPoller {
  private timers = new Map<string, unknown>();
  private asked = new Map<string, number>();
  private flying = new Set<string>();
  private gaveUp = new Set<string>();
  private readonly set: (fn: () => void, ms: number) => unknown;
  private readonly clear_: (h: unknown) => void;

  constructor(private readonly o: ThumbPollerOptions) {
    this.set = o.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this.clear_ = o.clearTimeout ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /** The row with this pending thumbnail is on screen. */
  want(id: string): void {
    if (this.gaveUp.has(id) || this.timers.has(id) || this.flying.has(id)) return;
    const asked = this.asked.get(id) ?? 0;
    this.schedule(id, asked === 0 ? THUMB_FIRST_MS : thumbDelay(asked - 1));
  }

  /** The thumbnail settled another way (a push said so): no more polls for it. */
  cancel(id: string): void {
    const t = this.timers.get(id);
    if (t !== undefined) this.clear_(t);
    this.timers.delete(id);
  }

  /** Forget every id the list no longer shows (their counts with them). */
  prune(listed: ReadonlySet<string>): void {
    for (const id of [...this.timers.keys()]) if (!listed.has(id)) this.cancel(id);
    for (const id of [...this.asked.keys()]) if (!listed.has(id)) this.asked.delete(id);
    for (const id of [...this.gaveUp]) if (!listed.has(id)) this.gaveUp.delete(id);
  }

  /** The screen left the page: every waiting poll is dropped (the counts stay for a screen that comes back). */
  stop(): void {
    for (const t of this.timers.values()) this.clear_(t);
    this.timers.clear();
  }

  /** How many requests this id has used (tests). */
  requests(id: string): number {
    return this.asked.get(id) ?? 0;
  }

  private schedule(id: string, ms: number): void {
    if (this.timers.has(id)) return;
    this.timers.set(id, this.set(() => void this.run(id), ms));
  }

  private async run(id: string): Promise<void> {
    this.timers.delete(id);
    if (!this.o.alive(id)) return;
    if (this.flying.size >= THUMB_PARALLEL) {
      this.schedule(id, THUMB_BUSY_MS);
      return;
    }
    const n = (this.asked.get(id) ?? 0) + 1;
    this.asked.set(id, n);
    this.flying.add(id);
    let st: ThumbState;
    try {
      st = await this.o.poll(id);
    } finally {
      this.flying.delete(id);
    }
    if (st === 'pending') {
      if (n < THUMB_MAX_POLLS) this.schedule(id, thumbDelay(n - 1));
      else this.gaveUp.add(id);
      return;
    }
    this.o.done(id, st);
  }
}

/** CR-EVENTS-TABLE-2443 (06:INFILE-1, lead decision L13): the ONE severity-to-badge mapping of the event centre - critical is an error
 * (red), alert is stale (amber), information is neutral. The review-window drawer painted critical as "offline" (the grey of a
 * device that is down): a bug, now the same red as the list and the event drawer. */
export function sevKind(sev: string): 'error' | 'stale' | 'neutral' {
  return sev === 'critical' ? 'error' : sev === 'alert' ? 'stale' : 'neutral';
}

/** LOWS-FRONTEND-2550 (review SCR-55): the event list's row limit (one read asks for at most this many). A list that reached it says so. */
export const EVENTS_LIMIT = 500;

/** LOWS-FRONTEND-2550 (review SCR-55): the instants of a range of `rangeDays` local days ending on `lastDay` (YYYY-MM-DD) in the
 * installation's zone - from the first day's local midnight to the last day's end. The range used UTC day edges: in Israel the first two
 * or three local hours of the first day were missing and as many hours after the last day's end were in. DST-safe (instantInZone). */
export function eventsRange(lastDay: string, rangeDays: number, zone: string): { from: string; to: string } {
  const days = Math.max(1, Math.floor(rangeDays));
  const from = instantInZone(addDaysByParts(lastDay, -(days - 1)), 0, zone);
  const to = new Date(instantInZone(addDaysByParts(lastDay, 1), 0, zone).getTime() - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}
