/**
 * BUILDING-PRESENCE-2271: the pure rules of the building-presence chip and the settings card (no DOM, unit-tested).
 * Green is reserved for status: only an occupied building is `ok`; empty and unknown are neutral.
 */
import { BP } from '../i18n/building-presence';
import { EMPTY_RANGE, HOLD_RANGE, RETENTION_RANGE, type BuildingPresenceSettings, type BuildingSnapshot, type PresenceCandidate } from './building-presence';

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

/** PRESENCE-2280: whether the home presence widget exists at all (enabled + configured + display "card"; the caller's permission is checked by the screen). */
export const presenceWidgetAvailable = (s: BuildingSnapshot | null | undefined): boolean => cardView(s).show;

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
