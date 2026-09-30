/**
 * What the home screen shows next to an area's name and in a floor's header (release 0.1.149, owner 2026-09-30: the big
 * installation's home screen was crowded). The installation's choice is two settings (הגדרות › חשמל והתקנים ›
 * devices.area_row / devices.floor_row, services/area_row.py); a holder of screen.personalize may lay a choice of their own
 * over them (/me/prefs `devices.area_row`). Everything here is pure (no DOM, no fetch except the two small loaders) so the
 * rules are unit-tested: which indicator an area has, what it says, what is hidden because it is zero, and what collapses
 * into "+N".
 */
import type { IconName } from '../components/sw-icon';
import { canAnywhere, isApi } from './session';
import { getMyPrefs, putMyPrefs } from './me-prefs';
import { ALARM_HE, HVAC_HE, type ClimateSummary, type DeviceArea, type DeviceCounts } from './devices';

export const AREA_ITEMS = ['climate', 'temperature', 'lights', 'switches', 'covers', 'media', 'openings', 'locks', 'alarm'] as const;
export type AreaItem = (typeof AREA_ITEMS)[number];
export const FLOOR_ITEMS = ['lights', 'switches', 'covers', 'climate', 'media', 'locks', 'sensors', 'cameras'] as const;
export type FloorItem = (typeof FLOOR_ITEMS)[number];
export const CLIMATE_DISPLAYS = ['icon', 'temp', 'mode'] as const;
export type ClimateDisplay = (typeof CLIMATE_DISPLAYS)[number];

export const AREA_ITEM_LABEL: Record<AreaItem, string> = {
  climate: 'מזגן',
  temperature: 'טמפרטורה בחדר',
  lights: 'תאורה דולקת',
  switches: 'מתגים פעילים',
  covers: 'תריסים פתוחים',
  media: 'מדיה מנגנת',
  openings: 'דלתות וחלונות פתוחים',
  locks: 'מנעולים לא נעולים',
  alarm: 'אזעקה',
};
export const FLOOR_ITEM_LABEL: Record<FloorItem, string> = {
  lights: 'תאורה',
  switches: 'מתגים',
  covers: 'תריסים',
  climate: 'מזגנים',
  media: 'מדיה',
  locks: 'מנעולים',
  sensors: 'חיישנים',
  cameras: 'מצלמות',
};
export const CLIMATE_DISPLAY_LABEL: Record<ClimateDisplay, string> = { icon: 'סמל בלבד', temp: 'סמל וטמפרטורה', mode: 'סמל ומצב' };

export interface AreaRow {
  /** In this order; an item that is not listed is not shown on the row (the opened area has everything). */
  items: AreaItem[];
  climate: ClimateDisplay;
  /** A counter whose value is zero is hidden unless this is on. */
  show_empty: boolean;
}
export interface FloorRow {
  items: FloorItem[];
}

/** Short by default: the A/C indicator with the room temperature, what is lit, what is playing (services/area_row.py). */
export const AREA_ROW_DEFAULT: AreaRow = { items: ['climate', 'lights', 'switches', 'media'], climate: 'temp', show_empty: false };
export const FLOOR_ROW_DEFAULT: FloorRow = { items: ['lights', 'switches', 'covers', 'climate', 'media', 'locks', 'sensors'] };

function listOf<T extends string>(raw: unknown, allowed: readonly T[], fallback: T[]): T[] {
  if (!Array.isArray(raw)) return [...fallback];
  const out: T[] = [];
  for (const x of raw) if (allowed.includes(x as T) && !out.includes(x as T)) out.push(x as T);
  return out;
}

/** The stored `devices.area_row` (an object) as the screen uses it; anything unknown reads as the default. */
export function areaRowOf(raw: unknown): AreaRow {
  if (!raw || typeof raw !== 'object') return { ...AREA_ROW_DEFAULT, items: [...AREA_ROW_DEFAULT.items] };
  const o = raw as Record<string, unknown>;
  return {
    items: listOf(o.items, AREA_ITEMS, AREA_ROW_DEFAULT.items),
    climate: CLIMATE_DISPLAYS.includes(o.climate as ClimateDisplay) ? (o.climate as ClimateDisplay) : AREA_ROW_DEFAULT.climate,
    show_empty: typeof o.show_empty === 'boolean' ? o.show_empty : AREA_ROW_DEFAULT.show_empty,
  };
}

export function floorRowOf(raw: unknown): FloorRow {
  if (!raw || typeof raw !== 'object') return { items: [...FLOOR_ROW_DEFAULT.items] };
  return { items: listOf((raw as Record<string, unknown>).items, FLOOR_ITEMS, FLOOR_ROW_DEFAULT.items) };
}

// ------------------------------------------------------------------------------------------------ the personal override

/** `devices.area_row` of /me/prefs: every key optional (missing = follow the installation). */
export interface AreaRowPersonal {
  items?: AreaItem[];
  climate?: ClimateDisplay;
  show_empty?: boolean;
  floor_items?: FloorItem[];
}

export function personalRowOf(raw: unknown): AreaRowPersonal {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const out: AreaRowPersonal = {};
  if (Array.isArray(o.items)) out.items = listOf(o.items, AREA_ITEMS, []);
  if (CLIMATE_DISPLAYS.includes(o.climate as ClimateDisplay)) out.climate = o.climate as ClimateDisplay;
  if (typeof o.show_empty === 'boolean') out.show_empty = o.show_empty;
  if (Array.isArray(o.floor_items)) out.floor_items = listOf(o.floor_items, FLOOR_ITEMS, []);
  return out;
}

/** The installation's rows with the user's own choices laid over them, key by key. */
export function effectiveRows(area: AreaRow, floor: FloorRow, personal: AreaRowPersonal | null): { area: AreaRow; floor: FloorRow } {
  if (!personal) return { area, floor };
  return {
    area: { items: personal.items ?? area.items, climate: personal.climate ?? area.climate, show_empty: personal.show_empty ?? area.show_empty },
    floor: { items: personal.floor_items ?? floor.items },
  };
}

/** The user's choices as a body for /me/prefs: only what differs from the installation's (so a later change of the
 * installation's default still reaches them); null when nothing differs. */
export function personalDiff(area: AreaRow, floor: FloorRow, baseArea: AreaRow, baseFloor: FloorRow): AreaRowPersonal | null {
  const out: AreaRowPersonal = {};
  if (JSON.stringify(area.items) !== JSON.stringify(baseArea.items)) out.items = area.items;
  if (area.climate !== baseArea.climate) out.climate = area.climate;
  if (area.show_empty !== baseArea.show_empty) out.show_empty = area.show_empty;
  if (JSON.stringify(floor.items) !== JSON.stringify(baseFloor.items)) out.floor_items = floor.items;
  return Object.keys(out).length ? out : null;
}

/** This user's stored choices ({} for none, and when the server hides them because the permission is missing). */
export async function loadPersonalRow(): Promise<AreaRowPersonal> {
  if (!isApi() || !canAnywhere('screen.personalize')) return {};
  try {
    return personalRowOf((await getMyPrefs()).prefs['devices.area_row']);
  } catch {
    return {};
  }
}

export async function savePersonalRow(p: AreaRowPersonal | null): Promise<AreaRowPersonal> {
  const r = await putMyPrefs({ 'devices.area_row': p as Record<string, unknown> | null });
  return personalRowOf(r.prefs['devices.area_row']);
}

/** Moves one item to a place in the list of all items (enabled first, in their order, then the rest). */
export function moveItem<T extends string>(items: T[], id: T, delta: -1 | 1): T[] {
  const i = items.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= items.length) return items;
  const out = [...items];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// ------------------------------------------------------------------------------------------------ what one row says

export interface Indicator {
  id: AreaItem;
  icon: IconName;
  /** Short text next to the icon ('' = the icon alone). */
  text: string;
  /** The words: the tooltip and the accessible name. */
  title: string;
  /** Something is on / open / needs a look: drawn stronger. */
  warm: boolean;
  /** An indicator that exists but is idle (an A/C that is off): drawn dimmed. */
  dim: boolean;
}

/** `24°` / `24.5°`: one decimal only when there is one. */
export function degrees(n: number): string {
  return `${Math.round(n * 10) / 10}°`;
}

type Dominant = 'cool' | 'heat' | 'fan';

function dominantOf(on: ClimateSummary[]): Dominant {
  const score: Record<Dominant, number> = { cool: 0, heat: 0, fan: 0 };
  for (const c of on) {
    const m = c.hvac_mode ?? '';
    if (m === 'heat' || (m === 'heat_cool' && c.hvac_action === 'heating') || (m === 'auto' && c.hvac_action === 'heating')) score.heat++;
    else if (m === 'fan_only') score.fan++;
    else score.cool++;
  }
  return (['cool', 'heat', 'fan'] as Dominant[]).reduce((a, b) => (score[b] > score[a] ? b : a));
}

const DOMINANT_ICON: Record<Dominant, IconName> = { cool: 'snow', heat: 'flame', fan: 'fan' };

/** The single air-conditioning indicator of an area (null when it has none): an icon by the dominant working mode, dimmed
 * when every unit is off; the optional text is the temperature (hidden when unknown - never a dash) or the mode word; with
 * several units working, their number in brackets. Tapping the row opens the area, where each unit has its own card. */
export function climateIndicator(a: DeviceArea, display: ClimateDisplay): Indicator | null {
  const list = a.climate ?? [];
  if (!list.length) {
    // only fans / humidifiers (counted, but not climate.* entities): a fan icon, on when any is on
    const c = a.counts;
    if (!c.climate) return null;
    const active = c.climate_active;
    return { id: 'climate', icon: 'fan', text: active > 1 ? String(active) : '', title: `מיזוג ואקלים: ${active} מתוך ${c.climate} פועלים`, warm: active > 0, dim: active === 0 };
  }
  const usable = list.filter((c) => c.available);
  const on = usable.filter((c) => c.hvac_mode && c.hvac_mode !== 'off');
  const dom = dominantOf(on);
  const dim = on.length === 0;
  const temps = (on.length ? on : usable).map((c) => c.current_temperature).filter((t): t is number => typeof t === 'number');
  const temp = temps.length ? degrees(temps.reduce((s, t) => s + t, 0) / temps.length) : '';
  const modeWord = on.length ? (HVAC_HE[on.find((c) => dominantOf([c]) === dom)?.hvac_mode ?? ''] ?? '') : '';
  const main = display === 'temp' ? temp : display === 'mode' ? modeWord : '';
  const many = on.length > 1 ? `(${on.length})` : '';
  const text = [main, many].filter(Boolean).join(' ');
  const parts = [list.length > 1 ? `מזגנים: ${on.length} מתוך ${list.length} פועלים` : on.length ? 'מזגן פועל' : usable.length ? 'מזגן כבוי' : 'מזגן לא זמין', modeWord, temp].filter(Boolean);
  return { id: 'climate', icon: DOMINANT_ICON[dom], text, title: parts.join(' · '), warm: !dim, dim };
}

/** The counters of an area as the row draws them, in the row's own order. A counter is hidden when the area has no such device
 * at all, and - unless `show_empty` - when its value is zero (nothing to report). The temperature is hidden when unknown. */
export function areaIndicators(a: DeviceArea, row: AreaRow): Indicator[] {
  const c = a.counts;
  const out: Indicator[] = [];
  const count = (id: AreaItem, icon: IconName, on: number, total: number, title: string) => {
    if (total <= 0 || (on <= 0 && !row.show_empty)) return;
    out.push({ id, icon, text: String(on), title: `${title}: ${on} מתוך ${total}`, warm: on > 0, dim: false });
  };
  for (const id of row.items) {
    if (id === 'climate') {
      const i = climateIndicator(a, row.climate);
      if (i) out.push(i);
    } else if (id === 'temperature') {
      if (typeof a.temperature === 'number') out.push({ id, icon: 'thermometer', text: degrees(a.temperature), title: 'טמפרטורה בחדר', warm: false, dim: false });
    } else if (id === 'lights') count(id, 'light', c.lights_on, c.lights, 'תאורה דולקת');
    else if (id === 'switches') count(id, 'bolt', c.switches_on, c.switches, 'מתגים פעילים');
    else if (id === 'covers') count(id, 'layers', c.covers_open, c.covers, 'תריסים פתוחים');
    else if (id === 'media') count(id, 'play', c.media_on, c.media, 'מדיה מנגנת');
    else if (id === 'openings') {
      const n = a.open_count ?? 0;
      if (n > 0 || (row.show_empty && c.sensors > 0)) out.push({ id, icon: 'door', text: String(n), title: `דלתות וחלונות פתוחים: ${n}`, warm: n > 0, dim: false });
    } else if (id === 'locks') {
      const unlocked = c.locks - c.locks_locked;
      if (c.locks > 0 && (unlocked > 0 || row.show_empty)) out.push({ id, icon: unlocked > 0 ? 'unlock' : 'lock', text: `${c.locks_locked}/${c.locks}`, title: `מנעולים נעולים: ${c.locks_locked} מתוך ${c.locks}`, warm: unlocked > 0, dim: false });
    } else if (id === 'alarm') {
      if (c.alarm) out.push({ id, icon: 'shield', text: ALARM_HE[c.alarm] ?? c.alarm, title: 'אזעקה', warm: c.alarm !== 'disarmed', dim: false });
    }
  }
  return out;
}

/** The phone shows at most this many indicators in one line, a wider screen a few more; the rest collapse into "+N". */
export const ROW_MAX_PHONE = 3;
export const ROW_MAX_WIDE = 6;

export function splitRow<T>(list: T[], max: number): { shown: T[]; hidden: T[] } {
  return list.length <= max ? { shown: list, hidden: [] } : { shown: list.slice(0, max), hidden: list.slice(max) };
}

/** A floor's header chips, in the floor row's order; the counts of a kind the floor has none of are not chips. */
export function floorKinds(counts: DeviceCounts, items: FloorItem[], showSensors: boolean): FloorItem[] {
  const has: Record<FloorItem, number> = { lights: counts.lights, switches: counts.switches, covers: counts.covers, climate: counts.climate, media: counts.media, locks: counts.locks, sensors: counts.sensors, cameras: counts.cameras };
  return items.filter((k) => has[k] > 0 && (showSensors || k !== 'sensors'));
}
