/**
 * The home screen's own settings (owner notes 2026-09-30, and the home redesign of the same day; backend:
 * services/home_screen.py + services/home_config.py, `home.*` product settings): an editable page title, the
 * installation's floor order, the direction of the layout (a: control centre - the default, b: side panel, c: compact
 * row), the side of b's column, and the widget configuration (api/home-config.ts). Values come from the platform's mirrored
 * entity list; nothing here reaches the network.
 *
 * Two owners of the direction and the widgets: the installation (an administrator: הגדרות › מסך ראשי, or the screen's edit
 * mode) and - only for a user who holds `screen.personalize` - the user themselves (החשבון שלי › המסך שלי, /me/prefs
 * `home.personal`). The server applies the personal override to the tree it sends; the screen just draws what it is given.
 */
import { get, patch } from './client';
import { getMyPrefs, putMyPrefs } from './me-prefs';
import { invalidateSettings, productSettings } from './prefs';
import { isApi } from './session';
import {
  configBody, configOf, DIRECTION_DEFAULT, DIRECTIONS, PHONE_LAYOUTS, SIDES, SIZES, WIDGET_IDS, sameConfig, defaultConfig,
  type Direction, type HomeCandidates, type HomeConfig, type PhoneLayout, type Side, type Size, type WidgetId,
} from './home-config';

export * from './home-config';

export const HOME_TITLE_DEFAULT = 'חשמל והתקנים';
export const HOME_TITLE_MAX = 60;

/** The settings, as edit mode edits them (and as the screen reads them). */
export interface HomeSettings {
  title: string;
  floorOrder: string[];
  direction: Direction;
  side: Side;
  config: HomeConfig;
}

export const HOME_DEFAULT: HomeSettings = { title: '', floorOrder: [], direction: DIRECTION_DEFAULT, side: 'end', config: defaultConfig() };

export function parseFloorOrder(v: unknown): string[] {
  let data: unknown = v;
  if (typeof v === 'string') {
    try {
      data = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  const out: string[] = [];
  for (const x of data) if (typeof x === 'string' && x && !out.includes(x)) out.push(x);
  return out;
}

export function homeSettingsOf(s: Record<string, unknown> | null | undefined): HomeSettings {
  const dir = s?.['home.direction'];
  const side = s?.['home.side'];
  return {
    title: typeof s?.['home.title'] === 'string' ? (s['home.title'] as string).trim() : '',
    floorOrder: parseFloorOrder(s?.['home.floor_order']),
    direction: DIRECTIONS.includes(dir as Direction) ? (dir as Direction) : DIRECTION_DEFAULT,
    side: SIDES.includes(side as Side) ? (side as Side) : 'end',
    config: configOf(s?.['home.widgets']),
  };
}

/** The installation's home settings (the shared settings cache); never throws - the defaults on any failure. */
export async function loadHomeSettings(force = false): Promise<HomeSettings> {
  if (!isApi()) return HOME_DEFAULT;
  try {
    return homeSettingsOf((await productSettings(force)) as unknown as Record<string, unknown>);
  } catch {
    return HOME_DEFAULT;
  }
}

/** The PATCH /settings body for what differs between two states (only the changed keys; the widget configuration whole). */
export function homePatch(from: HomeSettings, to: HomeSettings): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (to.title.trim() !== from.title) body['home.title'] = to.title.trim();
  if (JSON.stringify(to.floorOrder) !== JSON.stringify(from.floorOrder)) body['home.floor_order'] = JSON.stringify(to.floorOrder);
  if (to.direction !== from.direction) body['home.direction'] = to.direction;
  if (to.side !== from.side) body['home.side'] = to.side;
  if (!sameConfig(to.config, from.config)) body['home.widgets'] = configBody(to.config);
  return body;
}

/** Saves the changed keys (system.configure; audited by the server) and refreshes the shared settings cache. */
export async function saveHomeSettings(from: HomeSettings, to: HomeSettings): Promise<HomeSettings> {
  const body = homePatch(from, to);
  if (!Object.keys(body).length) return to;
  const r = await patch<{ settings: Record<string, unknown> }>('settings', body);
  invalidateSettings();
  return homeSettingsOf(r.settings);
}

/** "אפס לברירת מחדל": the widget configuration back to "never saved" (the built-in default with the catalogue's suggestions). */
export async function resetHomeWidgets(): Promise<HomeSettings> {
  const r = await patch<{ settings: Record<string, unknown> }>('settings', { 'home.widgets': {} });
  invalidateSettings();
  return homeSettingsOf(r.settings);
}

export const getHomeCandidates = () => get<HomeCandidates>('devices/home-candidates');

/** The floors in the installation's order: the listed ones first, in the listed order, then every other floor in its own
 * (level) order. Mirrors home_screen.order_floors on the server (the tree already arrives ordered; edit mode previews). */
export function orderFloors<T extends { floor_id: string }>(floors: T[], order: string[]): T[] {
  if (!order.length) return floors;
  const rank = new Map(order.map((id, i) => [id, i]));
  const tail = order.length;
  return floors
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (rank.get(a.f.floor_id) ?? tail) - (rank.get(b.f.floor_id) ?? tail) || a.i - b.i)
    .map((x) => x.f);
}

/** Moves one id to a place inside the full ordered list of ids (edit mode's up / down buttons and drop target). */
export function moveId(ids: string[], id: string, to: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  const dest = Math.max(0, Math.min(ids.length - 1, to));
  if (dest === from) return ids;
  const out = [...ids];
  out.splice(from, 1);
  out.splice(dest, 0, id);
  return out;
}

// ------------------------------------------------------------------------------------------------ the personal override

/** `home.personal` of /me/prefs (services/home_config.py normalise_personal): null = follow the installation. */
export interface HomePersonal {
  direction: Direction | null;
  /** The phone presentation of the widgets (null = the installation's). */
  phone_layout: PhoneLayout | null;
  order: WidgetId[] | null;
  widgets: Partial<Record<WidgetId, { on?: boolean; size?: Size }>>;
}

export const PERSONAL_EMPTY: HomePersonal = { direction: null, phone_layout: null, order: null, widgets: {} };

/** Fired on `window` after the personal home screen changed: an open home screen refetches (screens/devices-building.ts). */
export const HOME_PERSONAL_EVENT = 'sw-home-personal';

export function personalOf(raw: unknown): HomePersonal {
  if (!raw || typeof raw !== 'object') return { ...PERSONAL_EMPTY, widgets: {} };
  const o = raw as Record<string, unknown>;
  const widgets: HomePersonal['widgets'] = {};
  const w = o.widgets && typeof o.widgets === 'object' ? (o.widgets as Record<string, unknown>) : {};
  for (const id of WIDGET_IDS) {
    const e = w[id];
    if (!e || typeof e !== 'object') continue;
    const x = e as Record<string, unknown>;
    const entry: { on?: boolean; size?: Size } = {};
    if (typeof x.on === 'boolean') entry.on = x.on;
    if (SIZES.includes(x.size as Size)) entry.size = x.size as Size;
    if (Object.keys(entry).length) widgets[id] = entry;
  }
  const order = Array.isArray(o.order) ? (o.order.filter((x) => WIDGET_IDS.includes(x as WidgetId)) as WidgetId[]) : null;
  return { direction: DIRECTIONS.includes(o.direction as Direction) ? (o.direction as Direction) : null, phone_layout: PHONE_LAYOUTS.includes(o.phone_layout as PhoneLayout) ? (o.phone_layout as PhoneLayout) : null, order: order && order.length ? [...order, ...WIDGET_IDS.filter((i) => !order.includes(i))] : null, widgets };
}

export function personalIsEmpty(p: HomePersonal): boolean {
  return !p.direction && !p.phone_layout && !p.order && !Object.keys(p.widgets).length;
}

export function personalBody(p: HomePersonal): Record<string, unknown> | null {
  return personalIsEmpty(p) ? null : { direction: p.direction, phone_layout: p.phone_layout, order: p.order, widgets: p.widgets };
}

/** This user's stored personal choices (empty when none, or when the server hides them because the permission is missing). */
export async function loadPersonal(): Promise<HomePersonal> {
  if (!isApi()) return personalOf(null);
  try {
    const r = await getMyPrefs();
    return personalOf(r.prefs['home.personal']);
  } catch {
    return personalOf(null);
  }
}

/** Saves (or clears, with an empty value) the user's personal choices; the server refuses it without the permission. */
export async function savePersonal(p: HomePersonal): Promise<HomePersonal> {
  const r = await putMyPrefs({ 'home.personal': personalBody(p) });
  return personalOf(r.prefs['home.personal']);
}

