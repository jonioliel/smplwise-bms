/**
 * CALENDARS-UI-2310: the pure logic of the calendars screens - dates in the installation's zone, the month grid, the week columns, the rooms
 * timeline geometry, the paging that keeps every control screen free of a page scroll (owner rule 2026-10-24), labels of the module's words.
 * No DOM, no network: unit-tested in Node (tests/unit-calendars-ui.spec.ts).
 */
import type { ApprovedMove, CalColor, CalRole, CalType, Calendar, EntryState, Occurrence, OverlapMode } from '../api/calendars';
import { tr } from '../i18n/msg/calendars';

export const TYPE_LABEL: Record<CalType, string> = { room: tr('חדר'), team: tr('צוות'), maintenance: tr('אחזקה'), event: tr('אירועים') };
export const TYPE_GROUP: Record<CalType, string> = { room: tr('חדרים'), team: tr('צוותים'), maintenance: tr('אחזקה'), event: tr('אירועים') };
export const ROLE_LABEL: Record<CalRole, string> = { view: tr('צפייה'), book: tr('יצירת אירועים שלי'), edit: tr('עריכת הכול'), manage: tr('ניהול ואישור') };
export const ROLE_HINT: Record<CalRole, string> = {
  view: tr('רואה את היומן לפי הנראות'), book: tr('יוצר, משנה ומבטל הזמנות שלו'), edit: tr('משנה ומבטל כל הזמנה, גם מחוץ למגבלות הזמן'), manage: tr('מאשר ודוחה בקשות, קובע כללים וחברים'),
};
export const STATE_LABEL: Record<EntryState, string> = {
  pending: tr('ממתין לאישור'), confirmed: tr('מאושר'), rejected: tr('נדחה'), withdrawn: tr('בוטל על ידי המבקש'), expired: tr('פג'), cancelled: tr('בוטל'), displaced: tr('נדחק'), done: tr('הסתיים'),
};
export const OVERLAP_LABEL: Record<OverlapMode, string> = {
  first_holds: tr('הראשון שאושר מחזיק, התחזוקה מחכה להחלטה'), override_notify: tr('התחזוקה גוברת ומודיעים למארגנים'), block: tr('אי אפשר להציב תחזוקה מעל הזמנה'), ask: tr('לשאול בכל חלון'),
};
export const OVERLAP_SHORT: Record<OverlapMode, string> = { first_holds: tr('הראשון מחזיק'), override_notify: tr('התחזוקה גוברת'), block: tr('אי אפשר להציב'), ask: tr('לשאול בכל חלון') };
export const APPROVAL_LABEL: Record<Calendar['approval_mode'], string> = { none: tr('ללא אישור'), always: tr('כל בקשה באישור'), outside_hours: tr('באישור מחוץ לשעות'), on_behalf: tr('באישור כשמזמינים בשם אחרים') };
/** CAL-GRID-EDIT-2343 (owner answer 3C): what happens when an approved booking in a room that needs approval is moved. */
export const APPROVED_MOVE_LABEL: Record<ApprovedMove, string> = { reapproval: tr('באישור מחדש'), managers: tr('רק מנהל החדר') };
export const PROVIDER_LABEL: Record<string, string> = { ical: 'iCal', ics_in: 'iCal', ics_out: 'iCal', google: 'Google', microsoft: 'Microsoft' };
/** Order of the strictness of the maintenance-overlap modes (stricter protects an existing entry more). */
export const STRICTNESS: Record<OverlapMode, number> = { override_notify: 0, first_holds: 1, ask: 2, block: 3 };

/** The visual kind of an entry: tinted fill, dashed outline, hatch, amber hatch + strike, imported well (contract section 16). */
export type Mark = 'ok' | 'pending' | 'maint' | 'displaced' | 'external' | 'holiday' | 'busy';
export function markOf(o: Pick<Occurrence, 'state' | 'kind' | 'title'>): Mark {
  if (o.kind === 'holiday') return 'holiday';
  if (o.state === 'displaced') return 'displaced';
  if (o.kind === 'maintenance' || o.kind === 'maintenance_task') return 'maint';
  if (o.state === 'pending') return 'pending';
  if (o.kind === 'external') return 'external';
  if (o.title === null) return 'busy';
  return 'ok';
}

export const pad = (n: number) => String(n).padStart(2, '0');
export const DAY_SHORT = [tr('א׳'), tr('ב׳'), tr('ג׳'), tr('ד׳'), tr('ה׳'), tr('ו׳'), tr('ש׳')];
export const DAY_LONG = [tr('ראשון'), tr('שני'), tr('שלישי'), tr('רביעי'), tr('חמישי'), tr('שישי'), tr('שבת')];
export const MONTHS = [tr('ינואר'), tr('פברואר'), tr('מרץ'), tr('אפריל'), tr('מאי'), tr('יוני'), tr('יולי'), tr('אוגוסט'), tr('ספטמבר'), tr('אוקטובר'), tr('נובמבר'), tr('דצמבר')];

/** Local wall-clock helpers: the browser runs in the installation's zone (the shell sets nothing else; the specs pin Asia/Jerusalem). */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const hm = (iso: string | Date) => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const ddmm = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
/** SCR-37: the instant at wall-clock minute `min` of `day` (1440 = the next midnight). Built by the clock, never as midnight + elapsed
 * minutes: the two DST-change days have 23 and 25 hours, and "midnight + 600 min" is 11:00 / 09:00 on them, not 10:00. */
export const atMinute = (day: Date, min: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, min);

/** "היום · 17:00–21:00", "ג׳ 03.11 · 16:00–17:30" */
export function whenText(start: string, end: string, now: Date): string {
  const s = new Date(start);
  const day = sameDay(s, now) ? tr('היום') : sameDay(s, addDays(now, 1)) ? tr('מחר') : `${DAY_SHORT[s.getDay()]} ${ddmm(s)}`;
  return `${day} · ${hm(start)}–${hm(end)}`;
}

/** The 42 days of the month grid (Sunday first), and which belong to the shown month. */
export function monthGrid(anchor: Date): { day: Date; inMonth: boolean }[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const day = addDays(start, i);
    return { day, inMonth: day.getMonth() === anchor.getMonth() };
  });
}
export const weekStart = (d: Date) => startOfDay(addDays(d, -d.getDay()));

/** The occurrences that touch a local day, ordered by start. */
export function onDay(list: Occurrence[], day: Date): Occurrence[] {
  const a = startOfDay(day).getTime();
  const b = addDays(startOfDay(day), 1).getTime();
  return list.filter((o) => new Date(o.start).getTime() < b && new Date(o.end).getTime() > a).sort((x, y) => x.start.localeCompare(y.start));
}

/** Week / day column layout: the visible hour band, and per entry its top / height in percent and its lane among overlapping entries. */
export interface Placed { o: Occurrence; top: number; height: number; lane: number; lanes: number }
export function placeDay(list: Occurrence[], day: Date, fromH: number, toH: number): Placed[] {
  const span = (toH - fromH) * 60;
  const items = onDay(list, day).filter((o) => !o.all_day).map((o) => {
    const s = Math.max(fromH * 60, minutesOf(new Date(o.start)) + (sameDay(new Date(o.start), day) ? 0 : -1440));
    const eRaw = sameDay(new Date(o.end), day) ? minutesOf(new Date(o.end)) : 1440;
    const e = Math.min(toH * 60, Math.max(eRaw, s + 15));
    return { o, s, e };
  }).filter((x) => x.e > fromH * 60 && x.s < toH * 60);
  // greedy lanes per cluster of overlapping entries
  const out: Placed[] = [];
  let cluster: { o: Occurrence; s: number; e: number; lane: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster) out.push({ o: c.o, top: ((c.s - fromH * 60) / span) * 100, height: ((c.e - c.s) / span) * 100, lane: c.lane, lanes });
    cluster = [];
  };
  for (const it of items) {
    if (it.s >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.e > it.s).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    cluster.push({ ...it, lane });
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return out;
}

/** Rooms timeline: the hour window shown (desktop 07-23, the phone a 6-hour window around now) and an entry's start / width in percent. */
export function timelineWindow(phone: boolean, now: Date): { from: number; to: number } {
  if (!phone) return { from: 7, to: 23 };
  const h = Math.min(Math.max(now.getHours() - 1, 0), 18);
  return { from: h, to: h + 6 };
}
/** DST-TIMELINE-2540: the rooms timeline and the resident's time bar are drawn on a wall-clock hour axis (like the week / day grid): an
 * entry's place is its CLOCK time, never midnight + elapsed minutes. On the 23-hour day (spring, 02:00 -> 03:00 in Asia/Jerusalem) and
 * the 25-hour day (autumn, 02:00 -> 01:00) elapsed time put every entry after the change one hour off its hour label. */
export function span(o: Pick<Occurrence, 'start' | 'end'>, day: Date, from: number, to: number): { start: number; width: number } | null {
  const [s0, e0] = wallRange(o, day);
  const s = Math.max(s0, from * 60);
  const e = Math.min(e0, to * 60);
  if (e <= s) return null;
  const total = (to - from) * 60;
  return { start: ((s - from * 60) / total) * 100, width: ((e - s) / total) * 100 };
}

/** DST-TIMELINE-2540: the clock minute of instant `t` on the axis of `day` - minutes since `day`'s midnight BY THE CLOCK (both passes through
 * the repeated autumn hour read the same minute). An instant on an earlier day is < 0, on a later day >= 1440 (elapsed past that edge). */
export function wallMinute(t: Date, day: Date): number {
  const d0 = startOfDay(day);
  if (sameDay(t, d0)) return t.getHours() * 60 + t.getMinutes() + t.getSeconds() / 60 + t.getMilliseconds() / 60000;
  if (t < d0) return (t.getTime() - d0.getTime()) / 60000;
  return 1440 + (t.getTime() - addDays(d0, 1).getTime()) / 60000;
}
/** An entry's [start, end] in clock minutes of `day`. One that runs through the repeated hour can end at an earlier clock minute than it
 * starts (01:40 of the first pass -> 01:10 of the second); it then keeps its real length from its start. */
export function wallRange(o: Pick<Occurrence, 'start' | 'end'>, day: Date): [number, number] {
  const a = new Date(o.start);
  const b = new Date(o.end);
  const s = wallMinute(a, day);
  let e = wallMinute(b, day);
  if (e <= s && b.getTime() > a.getTime()) e = s + (b.getTime() - a.getTime()) / 60000;
  return [s, e];
}

/** DST-TIMELINE-2540: what the clock does in hour `h` (0-23) of `day`: 'missing' = the clock jumps over it (spring: 02:00 -> 03:00),
 * 'repeated' = it is lived twice (autumn: 02:00 -> 01:00), else 'plain'. Read from the zone itself (the browser runs in the installation's
 * zone), so any zone and year works; JS resolves a skipped clock time forward and a repeated one to its first pass. */
export type HourKind = 'plain' | 'missing' | 'repeated';
export function hourKind(day: Date, h: number): HourKind {
  if (h < 0 || h > 23) return 'plain';
  const a = atMinute(day, h * 60);
  if (a.getHours() !== h || !sameDay(a, day)) return 'missing';
  const lived = (atMinute(day, (h + 1) * 60).getTime() - a.getTime()) / 60000;
  return lived > 60 ? 'repeated' : 'plain';
}
/** The hour labels of a wall-clock axis from `from` to `to` (k = 0..to-from): the missing hour has no label (it is skipped), the repeated
 * hour keeps its one place on the axis and is marked (the screens add "×2" and say why). */
export interface AxisHour { k: number; h: number; kind: HourKind }
export function axisHours(day: Date, from: number, to: number): AxisHour[] {
  return Array.from({ length: to - from + 1 }, (_, k) => ({ k, h: (from + k) % 24, kind: from + k < 24 ? hourKind(day, from + k) : 'plain' }));
}
/** The clock hours inside [from, to) that do not exist on `day`, as start / width in percent of the window (drawn hatched, not bookable). */
export function missingBands(day: Date, from: number, to: number): { h: number; start: number; width: number }[] {
  const total = to - from;
  return axisHours(day, from, to).filter((x) => x.k < total && x.kind === 'missing').map((x) => ({ h: x.h, start: (x.k / total) * 100, width: (1 / total) * 100 }));
}
/** The instant at clock minute `min` of `day`, like `atMinute`, except that a minute the clock skips gives the first minute after the jump
 * (02:30 on the spring day -> 03:00, not 03:30): a tap inside the missing hour starts at the change, never an hour later. */
export function wallInstant(day: Date, min: number): Date {
  const t = atMinute(day, min);
  if (min <= 0 || min >= 1440 || wallMinute(t, day) === min) return t;
  let k = 1;
  while (k <= 180 && wallMinute(new Date(t.getTime() - k * 60000), day) > min) k += 1;
  return new Date(t.getTime() - (k - 1) * 60000);
}
/** A clock minute of `day` that exists (not inside the missing spring hour). */
export const minuteExists = (day: Date, min: number) => min <= 0 || min >= 1440 || wallMinute(atMinute(day, min), day) === min;
/** The rooms timeline: a tap at `frac` (0-1) of the track opens a booking at that half hour BY THE CLOCK. */
export function roomsTapStart(day: Date, win: { from: number; to: number }, frac: number): Date {
  const f = Math.min(Math.max(frac, 0), 1);
  return wallInstant(day, Math.floor((win.from * 60 + f * (win.to - win.from) * 60) / 30) * 30);
}
/** The resident's time bar: a tap / drag at `frac` centres the chosen duration there, on the quarter hour, inside the window, by the clock. */
export function barStart(day: Date, win: { from: number; to: number }, frac: number, duration: number): Date {
  const f = Math.min(Math.max(frac, 0), 1);
  const min = Math.round((win.from * 60 + f * (win.to - win.from) * 60 - duration / 2) / 15) * 15;
  return wallInstant(day, Math.max(win.from * 60, Math.min(win.to * 60 - duration, min)));
}

/** Paging instead of a page scroll: how many rows fit in the given height, and the slice of a page (1-based). */
export function rowsThatFit(available: number, rowH: number, min = 1): number {
  return Math.max(min, Math.floor(available / rowH));
}
export function pageOf<T>(list: T[], page: number, per: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(list.length / Math.max(1, per)));
  const p = Math.min(Math.max(1, page), pages);
  return { items: list.slice((p - 1) * per, p * per), page: p, pages };
}

/** Calendars grouped by type for the switcher (rooms, teams, maintenance, events), keeping the server's order inside a group. */
export function grouped(cals: Calendar[]): { type: CalType; cals: Calendar[] }[] {
  return (['room', 'team', 'maintenance', 'event'] as CalType[]).map((type) => ({ type, cals: cals.filter((c) => c.type === type) })).filter((g) => g.cals.length);
}

export const colorVar = (c: CalColor | string | undefined) => `var(--cal-${c ?? 'slate'})`;

/** Slice B: the order of the requests competing for one window (owner answer 11 as the setting `contested_order`). The server ranks them
 * (`queue_position`); without it, first come = request time, by kind = maintenance, then teams, then everyone, then request time; manual =
 * request time (the manager picks). */
export function queueOrder<T extends { requested_at: string; queue_position?: number; kind?: string }>(list: T[], order: 'first_come' | 'manual' | 'by_kind'): T[] {
  const kindRank = (k?: string) => (k === 'maintenance' ? 0 : k === 'team' || k === 'department' ? 1 : 2);
  return [...list].sort((a, b) => {
    if (order !== 'manual' && a.queue_position !== undefined && b.queue_position !== undefined && a.queue_position !== b.queue_position) return a.queue_position - b.queue_position;
    if (order === 'by_kind' && kindRank(a.kind) !== kindRank(b.kind)) return kindRank(a.kind) - kindRank(b.kind);
    return a.requested_at.localeCompare(b.requested_at);
  });
}

/** Free start times of a room on a day (the resident's start grid, owner answer 16A): every `step` minutes inside the open hours that are not
 * held by a confirmed entry for `duration` minutes; pending entries are counted (owner answer 13: "2 מבקשים"). */
export interface Slot { start: Date; free: boolean; pending: number }
export function slotGrid(entries: Occurrence[], day: Date, open: { from: string; to: string }[], duration: number, step: number, now: Date): Slot[] {
  const out: Slot[] = [];
  for (const w of open) {
    const [fh, fm] = w.from.split(':').map(Number);
    const [th, tm] = w.to.split(':').map(Number);
    for (let m = fh * 60 + fm; m + duration <= th * 60 + tm; m += step) {
      // DST-TIMELINE-2540: a start inside the missing spring hour does not exist (02:30 would be built as 03:30, a second "03:30")
      if (!minuteExists(day, m)) continue;
      const s = atMinute(day, m);
      const e = atMinute(day, m + duration);
      if (s < now) continue;
      const hit = entries.filter((o) => new Date(o.start) < e && new Date(o.end) > s);
      out.push({ start: s, free: !hit.some((o) => o.state === 'confirmed'), pending: hit.filter((o) => o.state === 'pending').length });
    }
  }
  return out;
}

// ---------------------------------------------------------------- slice C: the resident phone flow (owner answers 13, 14, 16)

/** Owner answer 14 as a setting: may an organizer (without the edit role) still cancel a confirmed entry? (start | 1h | 24h before it) */
export function cancelClosed(start: string, until: 'start' | '1h' | '24h', now: Date): boolean {
  const lead = until === '24h' ? 1440 : until === '1h' ? 60 : 0;
  return new Date(start).getTime() - lead * 60000 <= now.getTime();
}

/** Owner answer 13 as a setting: how a start time with pending requests reads for the resident. */
type SlotLook = 'free' | 'contest' | 'busy' | 'blocked';
export function slotLook(s: Slot, display: 'count' | 'free' | 'blocked'): SlotLook {
  if (!s.free) return 'busy';
  if (!s.pending || display === 'free') return 'free';
  return display === 'blocked' ? 'blocked' : 'contest';
}

/** The first start a room is free for `duration` minutes today (or on the day), or null. */
export function nextFree(entries: Occurrence[], day: Date, open: { from: string; to: string }[], duration: number, now: Date): Date | null {
  return slotGrid(entries, day, open, duration, 15, now).find((s) => s.free)?.start ?? null;
}
