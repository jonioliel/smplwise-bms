/**
 * BUILDING-PRESENCE-2271: the pure rules of the building-presence chip and the settings card (no DOM, unit-tested).
 * Green is reserved for status: only an occupied building is `ok`; empty and unknown are neutral.
 */
import { BP } from '../i18n/building-presence';
import {
  CARD_CHOICES, EMPTY_RANGE, HOLD_RANGE, RETENTION_RANGE,
  type BuildingPresenceSettings, type BuildingSnapshot, type CardAllEmpty, type CardDetails, type CardEmptyRooms, type CardStyle, type PresenceCandidate,
} from './building-presence';

export interface ChipView { show: boolean; tone: 'ok' | 'neutral'; text: string }

/** Local clock text (HH:MM, 24 h) of an ISO instant in the given zone; '' for anything unparsable. */
export function clockText(iso: string | null | undefined, zone = 'Asia/Jerusalem'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone }).format(d);
}

/** Nothing at all unless the server says sensors are tagged (`configured`); a stale or unknown answer never reads as empty. */
export function chipView(s: BuildingSnapshot | null | undefined, zone = 'Asia/Jerusalem'): ChipView {
  if (!s || !s.configured) return { show: false, tone: 'neutral', text: '' };
  if (s.settings?.home_display === 'card' || s.settings?.home_display === 'off') return { show: false, tone: 'neutral', text: '' };
  if (s.status === 'occupied') {
    const n = s.occupied_rooms ?? 0;
    return { show: true, tone: 'ok', text: n > 0 ? `${BP.occupied} · ${BP.occupiedRooms(n)}` : BP.occupied };
  }
  if (s.status === 'clear') {
    const at = clockText(s.empty_since, zone);
    return { show: true, tone: 'neutral', text: at ? BP.emptySince(at) : BP.empty };
  }
  return { show: true, tone: 'neutral', text: BP.unknown };
}

/** The chip's polling gap: a quiet 30 s while visible. */
export const POLL_MS = 30_000;

export interface SettingsProblem { field: 'hold_seconds' | 'empty_minutes' | 'retention_days'; }

/** Whole numbers inside the server's ranges, or the first field that is not. */
export function settingsProblem(s: Pick<BuildingPresenceSettings, 'hold_seconds' | 'empty_minutes'> & Partial<BuildingPresenceSettings>): SettingsProblem | null {
  const ok = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
  if (!ok(s.hold_seconds, HOLD_RANGE.min, HOLD_RANGE.max)) return { field: 'hold_seconds' };
  if (!ok(s.empty_minutes, EMPTY_RANGE.min, EMPTY_RANGE.max)) return { field: 'empty_minutes' };
  if (s.retention_days !== undefined && !ok(s.retention_days, RETENTION_RANGE.min, RETENTION_RANGE.max)) return { field: 'retention_days' };
  return null;
}

/** The ids of the tagged candidates after one toggle (sorted; a toggle for an unknown id changes nothing). */
export function toggledTags(list: readonly PresenceCandidate[], entityId: string, on: boolean): string[] {
  const ids = new Set(list.filter((c) => c.tagged).map((c) => c.entity_id));
  if (list.some((c) => c.entity_id === entityId)) {
    if (on) ids.add(entityId);
    else ids.delete(entityId);
  }
  return [...ids].sort();
}

export type SensorFilter = 'all' | 'tagged' | 'untagged';

/** The settings table's rows for a filter: tagged first (by room, then name), the rest after. */
export function filterSensors(list: readonly PresenceCandidate[], f: SensorFilter): PresenceCandidate[] {
  const keep = list.filter((c) => (f === 'tagged' ? c.tagged : f === 'untagged' ? !c.tagged : true));
  const room = (c: PresenceCandidate) => c.area_name ?? '\uffff';
  return [...keep].sort((a, b) => Number(b.tagged) - Number(a.tagged) || room(a).localeCompare(room(b), 'he') || a.name.localeCompare(b.name, 'he'));
}

/** One page of a list (1-based, clamped); `pages` is at least 1. The table pages instead of scrolling (no scrolling in control screens). */
export function pageSlice<T>(items: readonly T[], page: number, size: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / Math.max(1, size)));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: items.slice((p - 1) * size, p * size), page: p, pages };
}

export interface CardRoom { name: string; text: string; tone: 'ok' | 'neutral' | 'unknown' }
export interface CardView { show: boolean; tone: 'ok' | 'neutral'; big: string; sub: string; rooms: CardRoom[] }

/** The overview card (display = card): the state word, one quiet line and the rooms with a sensor. Nothing unless the server says configured. */
export function cardView(s: BuildingSnapshot | null | undefined, zone = 'Asia/Jerusalem'): CardView {
  const none: CardView = { show: false, tone: 'neutral', big: '', sub: '', rooms: [] };
  if (!s || !s.configured || s.settings?.home_display !== 'card') return none;
  const rooms = (s.rooms ?? []).filter((r) => r.name);
  const placed = rooms.length;
  const rows: CardRoom[] = rooms.map((r) => ({
    name: r.name ?? '',
    tone: r.status === 'occupied' ? 'ok' : r.status === 'clear' ? 'neutral' : 'unknown',
    text: r.status === 'occupied' ? BP.occupied : r.status === 'clear' ? (clockText(r.empty_since, zone) ? BP.emptySince(clockText(r.empty_since, zone)) : BP.empty) : BP.unknown,
  }));
  if (s.status === 'occupied') return { show: true, tone: 'ok', big: BP.occupied, sub: BP.cardSub(s.occupied_rooms ?? 0, placed), rooms: rows };
  if (s.status === 'clear') return { show: true, tone: 'neutral', big: BP.empty, sub: BP.cardAllEmpty(placed), rooms: rows };
  return { show: true, tone: 'neutral', big: BP.unknown, sub: BP.cardNoInfo, rooms: rows };
}

/** PRESENCE-2280: whether the home presence widget exists at all (enabled + configured + display "card"; the caller's permission is checked by the screen).
 * PRESENCE-COMPACT-2310: and the card style is not "off" (no card, the map only). */
export const presenceWidgetAvailable = (s: BuildingSnapshot | null | undefined): boolean => cardView(s).show && cardOptions(s?.settings).style !== 'off';

// ---- PRESENCE-COMPACT-2310: the compact home card (round-9 mockup, owner answers 31.10) ----

export interface CardOptions { style: CardStyle; emptyRooms: CardEmptyRooms; details: CardDetails; allEmpty: CardAllEmpty }

const pick = <T extends string>(list: readonly T[], v: unknown): T => (list.includes(v as T) ? (v as T) : list[0]);

/** The card's four display options from the settings; a missing or unknown value is the default (the first choice). */
export function cardOptions(s: Partial<BuildingPresenceSettings> | null | undefined): CardOptions {
  return {
    style: pick(CARD_CHOICES.card_style, s?.card_style),
    emptyRooms: pick(CARD_CHOICES.card_empty_rooms, s?.card_empty_rooms),
    details: pick(CARD_CHOICES.card_details, s?.card_details),
    allEmpty: pick(CARD_CHOICES.card_all_empty, s?.card_all_empty),
  };
}

export interface CompactRoom { name: string; tone: 'ok' | 'neutral' | 'unknown'; title: string }
export interface CompactFloor { name: string; on: number; of: number }
export interface CompactView {
  show: boolean;
  tone: 'ok' | 'clear' | 'unknown';
  word: string;
  /** "2 מתוך 5 חדרים" / "כל 5 החדרים ריקים" / "החיישנים לא מדווחים". */
  sub: string;
  /** The update time (HH:MM) or ''. */
  at: string;
  opts: CardOptions;
  /** The rooms with a sensor. */
  of: number;
  /** The active rooms, by name. */
  active: CompactRoom[];
  /** Empty (grey) then unknown rooms - only with "show empty rooms" and never beside the "last emptied" line. */
  others: CompactRoom[];
  /** All empty + "last": "<room> · ריק מ־HH:MM" (the room that emptied last); '' otherwise. */
  last: string;
  /** The "floors" style: one bar per floor, the most active first (a building without floors is one bar). */
  floors: CompactFloor[];
  /** Details inline (and the empty rooms are not pills): one quiet line of the empty / unknown names; '' otherwise. */
  rest: string;
  /** The tooltip: the update time, then the empty and the unknown names (capped with +N). */
  tip: string;
}

const TIP_NAMES = 12;
const REST_NAMES = 4;

function names(list: readonly CompactRoom[], cap: number): string {
  const head = list.slice(0, cap).map((r) => r.name).join(', ');
  return list.length > cap ? `${head} ${BP.plus(list.length - cap)}` : head;
}

/** Everything the compact card draws. `show` is false unless the widget exists (see `presenceWidgetAvailable`). */
export function compactView(s: BuildingSnapshot | null | undefined, zone = 'Asia/Jerusalem'): CompactView {
  const opts = cardOptions(s?.settings);
  const base: CompactView = { show: false, tone: 'unknown', word: '', sub: '', at: '', opts, of: 0, active: [], others: [], last: '', floors: [], rest: '', tip: '' };
  if (!s || !presenceWidgetAvailable(s)) return base;
  const rooms = (s.rooms ?? []).filter((r) => r.name);
  const byName = (a: CompactRoom, b: CompactRoom) => a.name.localeCompare(b.name, 'he');
  const toRoom = (r: (typeof rooms)[number]): CompactRoom => {
    const name = r.name ?? '';
    const since = clockText(r.empty_since, zone);
    const text = r.status === 'occupied' ? BP.occupied : r.status === 'clear' ? (since ? BP.emptySince(since) : BP.empty) : BP.unknown;
    return { name, tone: r.status === 'occupied' ? 'ok' : r.status === 'clear' ? 'neutral' : 'unknown', title: `${name} · ${text}` };
  };
  const active = rooms.filter((r) => r.status === 'occupied').map(toRoom).sort(byName);
  const empty = rooms.filter((r) => r.status === 'clear').map(toRoom).sort(byName);
  const unknown = rooms.filter((r) => r.status !== 'occupied' && r.status !== 'clear').map(toRoom).sort(byName);
  const of = rooms.length;
  const at = clockText(s.at, zone);
  const tone: CompactView['tone'] = s.status === 'occupied' ? 'ok' : s.status === 'clear' ? 'clear' : 'unknown';
  const word = tone === 'ok' ? BP.occupied : tone === 'clear' ? BP.empty : BP.unknown;
  const sub = tone === 'ok' ? BP.stripSub(s.occupied_rooms ?? active.length, of) : tone === 'clear' ? BP.cardAllEmpty(of) : BP.cardNoInfo;
  let last = '';
  if (tone === 'clear' && opts.allEmpty === 'last') {
    const timed = rooms.filter((r) => r.status === 'clear' && clockText(r.empty_since, zone));
    timed.sort((a, b) => Date.parse(b.empty_since ?? '') - Date.parse(a.empty_since ?? ''));
    if (timed[0]) last = BP.lastEmpty(timed[0].name ?? '', clockText(timed[0].empty_since, zone));
  }
  const others = opts.emptyRooms === 'show' && !last ? [...empty, ...unknown] : [];
  // floors in the order the rooms come (the server sorts them), the most active first; a stable sort keeps that order on a tie
  const hasFloors = rooms.some((r) => r.floor);
  const floors: CompactFloor[] = [];
  for (const r of rooms) {
    const name = hasFloors ? r.floor || BP.noFloor : BP.wholeBuilding;
    let f = floors.find((x) => x.name === name);
    if (!f) floors.push((f = { name, on: 0, of: 0 }));
    f.of++;
    if (r.status === 'occupied') f.on++;
  }
  floors.sort((a, b) => b.on - a.on);
  const tipLines = [at ? BP.updated(at) : '', empty.length ? `${BP.emptyNames}: ${names(empty, TIP_NAMES)}` : '', unknown.length ? `${BP.unknownNames}: ${names(unknown, TIP_NAMES)}` : ''];
  const rest = opts.details === 'inline' && opts.emptyRooms === 'hide' && tone === 'ok'
    ? [empty.length ? `${BP.emptyNames}: ${names(empty, REST_NAMES)}` : '', unknown.length ? `${BP.unknownNames}: ${names(unknown, REST_NAMES)}` : ''].filter(Boolean).join(' · ')
    : '';
  return { show: true, tone, word, sub, at, opts, of, active, others, last, floors, rest, tip: tipLines.filter(Boolean).join('\n') };
}

/** PRESENCE-COMPACT-2310 (answer 4): the area window's quiet part of the sub-line - "פעיל" / "ריק מ־HH:MM" / "אין מידע". Shown while tracking
 * is on and the room has a tagged sensor; the map's own switch does not hide it (it is not the map). */
export function areaPresence(s: BuildingSnapshot | null | undefined, areaId: string | null | undefined, zone = 'Asia/Jerusalem'): { text: string; tone: 'ok' | 'clear' | 'unknown' } | null {
  if (!s || !s.configured || !areaId) return null;
  const r = (s.rooms ?? []).find((x) => x.area_id === areaId);
  if (!r) return null;
  if (r.status === 'occupied') return { text: BP.occupied, tone: 'ok' };
  if (r.status === 'clear') {
    const at = clockText(r.empty_since, zone);
    return { text: at ? BP.emptySince(at) : BP.empty, tone: 'clear' };
  }
  return { text: BP.unknown, tone: 'unknown' };
}

/**
 * The plan map's chip of one room: "פעיל" / "ריק מ־HH:MM" / "אין מידע" (a room whose sensor does not report). Null when the master switch or
 * the map option is off, when nothing is configured, or when no tagged sensor sits in the room. No legend filter (owner decision): the list is
 * in the settings only.
 */
export function zoneChip(s: BuildingSnapshot | null | undefined, areaId: string | null | undefined, zone = 'Asia/Jerusalem'): string | null {
  if (!s || !s.configured || s.settings?.map_tint === false || !areaId) return null;
  const r = (s.rooms ?? []).find((x) => x.area_id === areaId);
  if (!r) return null;
  if (r.status === 'occupied') return BP.occupied;
  if (r.status === 'clear') return clockText(r.empty_since, zone) ? BP.emptySince(clockText(r.empty_since, zone)) : BP.empty;
  return BP.unknown;
}

/** The occupancy tone of one room for the plan map (same rules as `zoneChip`): drives the chip's look and the green tint of an active room. */
export function zoneTone(s: BuildingSnapshot | null | undefined, areaId: string | null | undefined): 'occupied' | 'clear' | 'unknown' | null {
  if (!s || !s.configured || s.settings?.map_tint === false || !areaId) return null;
  const r = (s.rooms ?? []).find((x) => x.area_id === areaId);
  if (!r) return null;
  return r.status === 'occupied' ? 'occupied' : r.status === 'clear' ? 'clear' : 'unknown';
}

/** Candidates grouped by room (area name), rooms alphabetical, the unplaced last (kept for the unit spec and any list that groups). */
export function groupByRoom(list: readonly PresenceCandidate[]): { room: string; items: PresenceCandidate[] }[] {
  const by = new Map<string, PresenceCandidate[]>();
  for (const c of list) {
    const key = c.area_name || '';
    by.set(key, [...(by.get(key) ?? []), c]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'he')))
    .map(([room, items]) => ({ room: room || BP.noRoom, items }));
}
