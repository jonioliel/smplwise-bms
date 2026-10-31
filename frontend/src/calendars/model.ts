/**
 * CALENDARS-UI-2310: the pure logic of the calendars screens - dates in the installation's zone, the month grid, the week columns, the rooms
 * timeline geometry, the paging that keeps every control screen free of a page scroll (owner rule 2026-10-24), labels of the module's words.
 * No DOM, no network: unit-tested in Node (tests/unit-calendars-ui.spec.ts).
 */
import type { CalColor, CalRole, CalType, Calendar, EntryState, Occurrence, OverlapMode } from '../api/calendars';

export const TYPE_LABEL: Record<CalType, string> = { room: 'חדר', team: 'צוות', maintenance: 'אחזקה', event: 'אירועים' };
export const TYPE_GROUP: Record<CalType, string> = { room: 'חדרים', team: 'צוותים', maintenance: 'אחזקה', event: 'אירועים' };
export const ROLE_LABEL: Record<CalRole, string> = { view: 'צפייה', book: 'יצירת אירועים שלי', edit: 'עריכת הכול', manage: 'ניהול ואישור' };
export const ROLE_HINT: Record<CalRole, string> = {
  view: 'רואה את היומן לפי הנראות', book: 'יוצר, משנה ומבטל הזמנות שלו', edit: 'משנה ומבטל כל הזמנה, גם מחוץ למגבלות הזמן', manage: 'מאשר ודוחה בקשות, קובע כללים וחברים',
};
export const STATE_LABEL: Record<EntryState, string> = {
  pending: 'ממתין לאישור', confirmed: 'מאושר', rejected: 'נדחה', withdrawn: 'בוטל על ידי המבקש', expired: 'פג', cancelled: 'בוטל', displaced: 'נדחק', done: 'הסתיים',
};
export const OVERLAP_LABEL: Record<OverlapMode, string> = {
  first_holds: 'הראשון שאושר מחזיק, התחזוקה מחכה להחלטה', override_notify: 'התחזוקה גוברת ומודיעים למארגנים', block: 'אי אפשר להציב תחזוקה מעל הזמנה', ask: 'לשאול בכל חלון',
};
export const OVERLAP_SHORT: Record<OverlapMode, string> = { first_holds: 'הראשון מחזיק', override_notify: 'התחזוקה גוברת', block: 'אי אפשר להציב', ask: 'לשאול בכל חלון' };
export const APPROVAL_LABEL: Record<Calendar['approval_mode'], string> = { none: 'ללא אישור', always: 'כל בקשה באישור', outside_hours: 'באישור מחוץ לשעות', on_behalf: 'באישור כשמזמינים בשם אחרים' };
export const PROVIDER_LABEL: Record<string, string> = { ical: 'iCal', google: 'Google', microsoft: 'Microsoft' };
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
export const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
export const DAY_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

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

/** "היום · 17:00–21:00", "ג׳ 03.11 · 16:00–17:30" */
export function whenText(start: string, end: string, now: Date): string {
  const s = new Date(start);
  const day = sameDay(s, now) ? 'היום' : sameDay(s, addDays(now, 1)) ? 'מחר' : `${DAY_SHORT[s.getDay()]} ${ddmm(s)}`;
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
export function span(o: Pick<Occurrence, 'start' | 'end'>, day: Date, from: number, to: number): { start: number; width: number } | null {
  const a = startOfDay(day).getTime();
  const s = Math.max((new Date(o.start).getTime() - a) / 60000, from * 60);
  const e = Math.min((new Date(o.end).getTime() - a) / 60000, to * 60);
  if (e <= s) return null;
  const total = (to - from) * 60;
  return { start: ((s - from * 60) / total) * 100, width: ((e - s) / total) * 100 };
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
      const s = new Date(startOfDay(day).getTime() + m * 60000);
      const e = new Date(s.getTime() + duration * 60000);
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
export type SlotLook = 'free' | 'contest' | 'busy' | 'blocked';
export function slotLook(s: Slot, display: 'count' | 'free' | 'blocked'): SlotLook {
  if (!s.free) return 'busy';
  if (!s.pending || display === 'free') return 'free';
  return display === 'blocked' ? 'blocked' : 'contest';
}

/** The first start a room is free for `duration` minutes today (or on the day), or null. */
export function nextFree(entries: Occurrence[], day: Date, open: { from: string; to: string }[], duration: number, now: Date): Date | null {
  return slotGrid(entries, day, open, duration, 15, now).find((s) => s.free)?.start ?? null;
}
