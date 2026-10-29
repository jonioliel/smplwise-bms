/**
 * Release 2.29.0 - the building cross-section (floors screen) and the synoptic map (a Home tab): the pure model.
 *
 * Everything here is plain data and functions (no DOM), so the specs can run it in Node. Three rules (owner decisions 2026-10-29,
 * mock-up v3):
 *  - a value with no real source is `null` and is drawn as "unknown" ("-"), never as a number made up for the screen;
 *  - every behaviour is an option of the installation (`ui.xs`, backend services/xs_options.py) and the defaults here are the owner's;
 *  - fire detection does not exist in the product: the fire column is hidden until an integration reports, and the alarm UI is behind
 *    an off-by-default option and a demo source (`mockFire`) that only the tests and the labelled demo use.
 */
import type { Floor } from '../api/types';
import type { DeviceArea, DeviceTree } from '../api/devices';
import type { PeopleResponse } from '../api/presence';

/* ---------------------------------------------------------------- options (ui.xs) */

export const XS_DESKTOP_PLACE = ['left', 'right', 'off'] as const; // A: in the empty area (default), B: at the other side, C: off
export const XS_PHONE_PLACE = ['side', 'card', 'sheet'] as const; // A: a tile beside each card (default), B: a compact card, C: a button
export const XS_MANY = ['steps', 'scroll', 'near'] as const; // A: cards shrink in steps (default), B: the list scrolls, C: selected + neighbours
export const XS_LINKS = ['fold', 'full', 'hide'] as const; // A: folds to one row when space is short (default), B: always full, C: no drawing
export const XS_CLICK = ['select', 'open'] as const; // A: first selects, second opens (default), B: opens at once
export const XS_COLUMNS_ALL = ['light', 'temp', 'presence', 'cameras', 'doors', 'alerts'] as const; // the fire column is not listed: it follows the connection
export const XS_ACK = ['hold', 'confirm', 'tap'] as const; // A: long press 1.2 s (default), B: press then confirm, C: one press
export const XS_ACK_WHO = ['separate', 'viewers', 'admin'] as const; // A: anyone who sees the board, B: a new separate permission (default), C: administrators
export const XS_ALARM_BAR = ['everywhere', 'home'] as const; // A: a red bar on every screen (default), B: only Home and the synoptic map
export const XS_FIRE_COLUMN = ['hidden', 'dashed'] as const; // B: hidden until connected (default), A: a dashed "not connected" column
export const XS_SYN_COLUMNS = ['all', 'few'] as const; // A: seven columns (default), B: temperature, light, alerts, fire

export type XsColumn = (typeof XS_COLUMNS_ALL)[number];

export interface XsOptions {
  desktop_place: (typeof XS_DESKTOP_PLACE)[number];
  phone_place: (typeof XS_PHONE_PLACE)[number];
  many: (typeof XS_MANY)[number];
  links: (typeof XS_LINKS)[number];
  click: (typeof XS_CLICK)[number];
  shafts: boolean; // stairs and lifts drawn on the section
  animate: boolean; // false = fade only
  temp_threshold: number; // degrees from the target before a floor reads hot / cold
  syn_tab: boolean; // the synoptic tab on Home
  syn_columns: (typeof XS_SYN_COLUMNS)[number];
  syn_events: boolean; // the event strip beside the board on wide screens
  fire_column: (typeof XS_FIRE_COLUMN)[number];
  fire_ui: boolean; // MASTER SWITCH of the alarm UI (off: no bar, no acknowledge, nothing about fire anywhere)
  ack: (typeof XS_ACK)[number];
  ack_who: (typeof XS_ACK_WHO)[number];
  alarm_bar: (typeof XS_ALARM_BAR)[number];
  wall: boolean; // the wall screen URL (#/kiosk/synoptic) is served
}

export const XS_DEFAULT: Readonly<XsOptions> = {
  desktop_place: 'left',
  phone_place: 'side',
  many: 'steps',
  links: 'fold',
  click: 'select',
  shafts: true,
  animate: true,
  temp_threshold: 2,
  syn_tab: true,
  syn_columns: 'all',
  syn_events: true,
  fire_column: 'hidden',
  fire_ui: false,
  ack: 'hold',
  ack_who: 'separate',
  alarm_bar: 'everywhere',
  wall: true,
};

export const XS_THRESHOLDS = [1, 2, 3, 4] as const;
/** Hold time of the acknowledge press (owner decision 9). */
export const ACK_HOLD_MS = 1200;
/** Above this many floors the phone tile would be under 20 px high, so the compact card takes over (mock-up v3). */
export const PHONE_TILE_MAX_FLOORS = 12;

/** The option set in its canonical form: every key present, an unknown value reads as the default (the server refuses it with 422). */
export function normalizeXs(raw: unknown): XsOptions {
  const out: XsOptions = { ...XS_DEFAULT };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, set: readonly T[], d: T): T => (typeof v === 'string' && (set as readonly string[]).includes(v) ? (v as T) : d);
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  out.desktop_place = pick(r.desktop_place, XS_DESKTOP_PLACE, XS_DEFAULT.desktop_place);
  out.phone_place = pick(r.phone_place, XS_PHONE_PLACE, XS_DEFAULT.phone_place);
  out.many = pick(r.many, XS_MANY, XS_DEFAULT.many);
  out.links = pick(r.links, XS_LINKS, XS_DEFAULT.links);
  out.click = pick(r.click, XS_CLICK, XS_DEFAULT.click);
  out.shafts = bool(r.shafts, XS_DEFAULT.shafts);
  out.animate = bool(r.animate, XS_DEFAULT.animate);
  out.temp_threshold = typeof r.temp_threshold === 'number' && (XS_THRESHOLDS as readonly number[]).includes(r.temp_threshold) ? r.temp_threshold : XS_DEFAULT.temp_threshold;
  out.syn_tab = bool(r.syn_tab, XS_DEFAULT.syn_tab);
  out.syn_columns = pick(r.syn_columns, XS_SYN_COLUMNS, XS_DEFAULT.syn_columns);
  out.syn_events = bool(r.syn_events, XS_DEFAULT.syn_events);
  out.fire_column = pick(r.fire_column, XS_FIRE_COLUMN, XS_DEFAULT.fire_column);
  out.fire_ui = bool(r.fire_ui, XS_DEFAULT.fire_ui);
  out.ack = pick(r.ack, XS_ACK, XS_DEFAULT.ack);
  out.ack_who = pick(r.ack_who, XS_ACK_WHO, XS_DEFAULT.ack_who);
  out.alarm_bar = pick(r.alarm_bar, XS_ALARM_BAR, XS_DEFAULT.alarm_bar);
  out.wall = bool(r.wall, XS_DEFAULT.wall);
  return out;
}

let current: XsOptions = { ...XS_DEFAULT };
const listeners = new Set<() => void>();
export const xsOptions = (): Readonly<XsOptions> => current;
/** The installation's value (`ui.xs`) after the settings load or a save; every open screen follows. */
export function setXsOptions(raw: unknown): void {
  current = normalizeXs(raw);
  for (const l of listeners) l();
}
export function onXsOptions(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The demo (no backend) and the specs may override single options from the route (`?xs_phone_place=card`): never used with a backend. */
export function xsFromParams(base: Readonly<XsOptions>, params: URLSearchParams): XsOptions {
  const o: Record<string, unknown> = { ...base };
  params.forEach((v, k) => {
    if (!k.startsWith('xs_')) return;
    const key = k.slice(3);
    if (!(key in XS_DEFAULT)) return;
    const d = (XS_DEFAULT as unknown as Record<string, unknown>)[key];
    o[key] = typeof d === 'boolean' ? v === '1' || v === 'true' : typeof d === 'number' ? Number(v) : v;
  });
  return normalizeXs(o);
}

/* ---------------------------------------------------------------- floor signals */

/** What the section and the synoptic board draw for one floor. `null` = no source (drawn as unknown), never zero. */
export interface FloorSignal {
  id: string;
  name: string;
  level: number;
  cams: number; // the floor's cameras (catalogue)
  shared: number;
  items: number;
  plan: boolean;
  temp: number | null;
  target: number | null;
  lit: number | null;
  lights: number | null;
  people: number | null; // null unless the presence module is on and the caller may read it
  doorsOpen: number | null;
  alerts: number | null;
  /** No data at all reaches this floor (the platform is disconnected, or no area is linked to it): drawn as "no data". */
  nodata: boolean;
}

const nz = (n: number | null | undefined): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null);
const mean = (xs: number[]): number | null => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const norm = (s: string) => s.replace(/[‎‏\s]+/g, ' ').trim().toLowerCase();

/** The device-tree areas that belong to a catalogue floor: the areas the map links to it, else the platform floor of the same name. */
export function areasOfFloor(floor: Pick<Floor, 'id' | 'name'>, tree: DeviceTree | null): { areas: DeviceArea[]; climateTargets: number[] } {
  if (!tree) return { areas: [], climateTargets: [] };
  const linked = tree.floors.flatMap((f) => f.areas).filter((a) => a.map?.floor_id === floor.id);
  const byName = linked.length ? null : tree.floors.find((f) => norm(f.name) === norm(floor.name));
  const areas = linked.length ? linked : byName?.areas ?? [];
  const ids = new Set(areas.map((a) => a.area_id));
  const targets: number[] = [];
  for (const f of tree.floors) for (const c of f.climate) if (c.available && nz(c.target_temperature) !== null && areas.some((a) => a.name === c.area_name && ids.has(a.area_id))) targets.push(c.target_temperature as number);
  return { areas, climateTargets: targets };
}

/** One floor's signals from the catalogue floor, the device tree and the presence answer. */
export function signalOf(floor: Floor, tree: DeviceTree | null, people: PeopleResponse | null): FloorSignal {
  const { areas, climateTargets } = areasOfFloor(floor, tree);
  const connected = !!tree && tree.sync?.connected !== false;
  const lights = areas.reduce((n, a) => n + (a.counts?.lights ?? 0), 0);
  const lit = areas.reduce((n, a) => n + (a.counts?.lights_on ?? 0), 0);
  const temps = areas.map((a) => nz(a.temperature)).filter((t): t is number => t !== null);
  const opens = areas.map((a) => a.open_count).filter((v): v is number => typeof v === 'number');
  const known = connected && areas.length > 0;
  const pf = people && people.enabled ? people.floors.find((p) => p.floor_id === floor.id) : null;
  return {
    id: floor.id,
    name: floor.name,
    level: floor.level,
    cams: floor.camera_count,
    shared: floor.shared_camera_count ?? 0,
    items: floor.anchor_count,
    plan: floor.has_plan,
    temp: known ? mean(temps) : null,
    target: known ? mean(climateTargets) : null,
    lit: known && lights > 0 ? lit : null,
    lights: known && lights > 0 ? lights : null,
    people: people && people.enabled ? (pf ? pf.count : 0) : null,
    doorsOpen: known && opens.length ? opens.reduce((a, b) => a + b, 0) : null,
    alerts: null, // no per-floor alert source exists yet (see the 2.29.0 report)
    nodata: !known,
  };
}

export function signalsOf(floors: Floor[], tree: DeviceTree | null, people: PeopleResponse | null): FloorSignal[] {
  return [...floors].sort((a, b) => b.level - a.level || b.sort_order - a.sort_order).map((f) => signalOf(f, tree, people));
}

/** hot / cold / null: only with both a reading and a target (no target = no verdict, not a guess). */
export function tempState(f: Pick<FloorSignal, 'temp' | 'target' | 'nodata'>, threshold: number): 'hot' | 'cold' | null {
  if (f.nodata || f.temp === null || f.target === null) return null;
  const d = f.temp - f.target;
  return d >= threshold ? 'hot' : d <= -threshold ? 'cold' : null;
}

/** The building totals of the head chips; a floor with no value is left out of the average, never counted as zero. */
export function totalsOf(fl: FloorSignal[], threshold: number) {
  const ts = fl.filter((f) => f.temp !== null);
  const lt = fl.filter((f) => f.lit !== null && f.lights !== null);
  const pp = fl.filter((f) => f.people !== null);
  return {
    avg: mean(ts.map((f) => f.temp as number)),
    lit: lt.reduce((n, f) => n + (f.lit as number), 0),
    lights: lt.reduce((n, f) => n + (f.lights as number), 0),
    litKnown: lt.length > 0,
    hot: fl.filter((f) => tempState(f, threshold) === 'hot').length,
    cold: fl.filter((f) => tempState(f, threshold) === 'cold').length,
    nodata: fl.filter((f) => f.nodata).length,
    people: pp.length ? pp.reduce((n, f) => n + (f.people as number), 0) : null,
    doorsOpen: fl.some((f) => f.doorsOpen !== null) ? fl.reduce((n, f) => n + (f.doorsOpen ?? 0), 0) : null,
  };
}

/* ---------------------------------------------------------------- layout decisions */

export type PhonePlace = (typeof XS_PHONE_PLACE)[number];
/** The phone arrangement: option A (tiles) turns into the compact card above 12 floors. */
export function phonePlaceFor(opt: PhonePlace, floors: number): PhonePlace | 'none' {
  if (!floors) return 'none';
  return opt === 'side' && floors > PHONE_TILE_MAX_FLOORS ? 'card' : opt;
}

/** The size step of the frozen list's cards for n floors (no scrolling, option A): 0 = full, 3 = the smallest; two columns from 17 floors. */
export function listStep(n: number, narrow = false): { step: 0 | 1 | 2 | 3; cols: 1 | 2 } {
  if (narrow && n > 12) return { step: 3, cols: 2 }; // a phone is short: one column of 13+ cards would scroll
  if (n <= 6) return { step: 0, cols: 1 };
  if (n <= 9) return { step: 1, cols: 1 };
  if (n <= 12) return { step: 2, cols: 1 };
  if (n <= 16) return { step: 3, cols: 1 };
  return { step: 3, cols: 2 };
}

/** Option C of "many floors": the selected floor and its neighbours only (the section shows all of them). */
export function nearFloors<T extends { id: string }>(fl: T[], selId: string | null, span = 1): T[] {
  const i = Math.max(0, fl.findIndex((f) => f.id === selId));
  return fl.slice(Math.max(0, i - span), i + span + 1);
}

/** "Links between floors" folds to one row when the stack does not fit (option A, owner decision 4). */
export function linksFold(opt: (typeof XS_LINKS)[number], floors: number, height: number): boolean {
  if (opt === 'hide') return true;
  if (opt === 'full') return false;
  return floors > 4 || height < 760;
}

/* ---------------------------------------------------------------- the synoptic columns */

export type SynColumn = XsColumn | 'fire';
/** The columns the board draws, in order. Presence follows the module; the fire column follows the connection and its option. */
export function synColumns(o: Pick<XsOptions, 'syn_columns' | 'fire_column' | 'fire_ui'>, presenceOn: boolean, fireConnected: boolean): SynColumn[] {
  const base: XsColumn[] = o.syn_columns === 'few' ? ['temp', 'light', 'alerts'] : ['light', 'temp', 'presence', 'cameras', 'doors', 'alerts'];
  const cols: SynColumn[] = base.filter((c) => (c === 'presence' ? presenceOn : true));
  if (o.fire_ui && (fireConnected || o.fire_column === 'dashed')) cols.push('fire');
  return cols;
}

/* ---------------------------------------------------------------- fire (no integration exists: demo only) */

export type FireState = 'ok' | 'alarm' | 'fault';
export interface FireFloor { state: FireState; zone?: string; device?: string; time?: string; zones?: number }
export interface FireReport { connected: boolean; demo: boolean; floors: Record<string, FireFloor> }

/** The real source. No fire-detection integration exists, so this is always "not connected" (an honest empty report). */
export function realFire(): FireReport {
  return { connected: false, demo: false, floors: {} };
}

/** DEMO data for the labelled demo and the specs only: one floor in alarm / fault, the others quiet. Never drawn without the demo label. */
export function mockFire(mode: string | null | undefined, fl: Pick<FloorSignal, 'id' | 'level'>[]): FireReport | null {
  if (!mode || !['ok', 'alarm', 'fault'].includes(mode) || !fl.length) return null;
  const floors: Record<string, FireFloor> = {};
  fl.forEach((f, i) => (floors[f.id] = { state: 'ok', zones: 2 + (i % 4) }));
  const pick = (want: number) => (fl.find((f) => f.level === want) ?? fl[Math.min(1, fl.length - 1)]).id;
  if (mode === 'alarm') floors[pick(2)] = { state: 'alarm', zone: 'DEMO 2-03', device: 'DEMO detector 2-03-07', time: '14:32:08', zones: 4 };
  if (mode === 'fault') floors[pick(1)] = { state: 'fault', zone: 'DEMO 1-02', device: 'DEMO detector 1-02-04', time: '11:05', zones: 3 };
  return { connected: true, demo: true, floors };
}

export function alarmFloors(r: FireReport | null): string[] {
  return r ? Object.keys(r.floors).filter((id) => r.floors[id].state === 'alarm') : [];
}

/** May this user acknowledge an alarm? `can` is the permission check of the session. */
export function mayAcknowledge(who: (typeof XS_ACK_WHO)[number], can: (p: string) => boolean): boolean {
  if (who === 'viewers') return true;
  if (who === 'admin') return can('system.configure');
  return can('fire.acknowledge');
}
export const FIRE_PERMISSION = 'fire.acknowledge';
