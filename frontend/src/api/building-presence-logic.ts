/**
 * BUILDING-PRESENCE-2271: the pure rules of the building-presence chip and the settings card (no DOM, unit-tested).
 * Green is reserved for status: only an occupied building is `ok`; empty and unknown are neutral.
 */
import { BP } from '../i18n/building-presence';
import { EMPTY_RANGE, HOLD_RANGE, type BuildingPresenceSettings, type BuildingSnapshot, type PresenceCandidate } from './building-presence';

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

export interface SettingsProblem { field: 'hold_seconds' | 'empty_minutes'; }

/** Whole numbers inside the server's ranges, or the first field that is not. */
export function settingsProblem(s: BuildingPresenceSettings): SettingsProblem | null {
  const ok = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
  if (!ok(s.hold_seconds, HOLD_RANGE.min, HOLD_RANGE.max)) return { field: 'hold_seconds' };
  if (!ok(s.empty_minutes, EMPTY_RANGE.min, EMPTY_RANGE.max)) return { field: 'empty_minutes' };
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

/** Candidates grouped by room (area name) for the settings list, rooms alphabetical, the unplaced last. */
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
