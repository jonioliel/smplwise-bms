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
  /** SYNOPTIC-HA-2310: which platform floor the catalogue floor stands for and how that was decided (null when there is no tree). */
  match?: FloorMatchInfo | null;
}

const nz = (n: number | null | undefined): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null);
const mean = (xs: number[]): number | null => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
/** Name comparison: direction marks dropped, spaces / underscores / dashes / maqaf folded, case ignored. */
const norm = (s: string) => s.replace(/[‎‏‪-‮⁦-⁩]/g, '').replace(/[\s_\-־]+/g, ' ').trim().toLowerCase();

/* ---------------------------------------------------------------- floor <-> platform matching (SYNOPTIC-HA-2310) */

/**
 * The layers of docs/changes/PROPOSAL-MULTI-BUILDING-HOME.md (branch pilot/MULTI-BUILDING-HOME-PLAN), strongest first, per AREA:
 *   3. map placement - the area is linked to a room of one of our floor plans (spatial_zones.ha_area_id): that floor, whatever else says;
 *   2. the per-area override row (`home_area_links`): our floor, or none ("לא משויך");
 *   1. the platform floor's row (`home_floor_links`, one row per platform floor) - then the automatic rules for a platform floor no row
 *      names: the same LEVEL only when exactly one platform floor has that level, exactly one of the building's floors has it AND the site
 *      has one building; the same NAME only on exact normalized equality, unique on both sides (never a substring).
 * Everything else that points somewhere is a SUGGESTION the user confirms (a level shared by several platform floors or several buildings,
 * the platform floor most of a floor's map-placed areas sit on) - never applied silently. Unresolved = no data, and the hint says why.
 * ALL areas of a platform floor count, not only the areas placed on a map: the same floors -> areas projection the home screen draws.
 */
export type FloorHow = 'link' | 'level' | 'name';
/** Why an area counts on a floor: `map` = placed on this floor's plan, `manual` = the per-area override, else how its platform floor matched. */
export type AreaSource = 'map' | 'manual' | FloorHow;

export interface MatchedArea { area: DeviceArea; haFloorId: string | null; source: AreaSource }
export interface FloorSuggestion { haFloorId: string; haFloorName: string; why: 'level' | 'name' | 'map' }
export interface FloorMatchInfo {
  /** The platform floors this floor stands for (rows, else the automatic rule) and how. */
  haFloors: { id: string; name: string }[];
  how: FloorHow | null;
  /** A platform floor the user may confirm (not applied). */
  suggestion: FloorSuggestion | null;
  /** The level found several candidates (or the site has several buildings) and made no guess. */
  ambiguous: boolean;
  areas: MatchedArea[];
  /** Areas the platform floor brings that are taken off this floor by hand (to another floor or to none). */
  excluded: { area: DeviceArea; to: string | null }[];
  /** Platform ids in this floor's rows that the platform no longer lists (the editor shows them; the numbers ignore them). */
  missing: string[];
}

/** The mapping rows (api/catalog.ts HomeLinks): keyed by the platform id -> our floor id; an area row with `floor_id: null` = none. */
export interface MatchLinks {
  floors: { ha_floor_id: string; floor_id: string }[];
  areas: { area_id: string; floor_id: string | null }[];
}
export interface MatchContext {
  links?: MatchLinks | null;
  /** The site has one building (a level match may then apply on its own). Default true. */
  singleBuilding?: boolean;
}

export type MatchFloor = Pick<Floor, 'id' | 'name' | 'level'>;

/** Every area of the tree once, with its platform floor id (null = the "no floor" bucket): the same floors -> areas the home screen draws. */
export function treeAreas(tree: DeviceTree): { area: DeviceArea; haFloorId: string | null }[] {
  const out: { area: DeviceArea; haFloorId: string | null }[] = [];
  const seen = new Set<string>();
  for (const f of tree.floors)
    for (const a of f.areas) {
      if (seen.has(a.area_id)) continue;
      seen.add(a.area_id);
      out.push({ area: a, haFloorId: f.floor_id === 'none' ? null : f.floor_id });
    }
  return out;
}

/** The real platform floors of the tree (the "no floor" bucket is not a floor). */
export const treeFloors = (tree: DeviceTree) => tree.floors.filter((f) => f.floor_id !== 'none');

/** Matches the floors of ONE building (`floors`) against the platform tree and the installation's mapping rows. */
export function matchFloors(floors: MatchFloor[], tree: DeviceTree | null, ctx: MatchContext = {}): Map<string, FloorMatchInfo> {
  const out = new Map<string, FloorMatchInfo>();
  if (!tree) return out;
  const single = ctx.singleBuilding !== false;
  const floorRows = new Map((ctx.links?.floors ?? []).map((r) => [r.ha_floor_id, r.floor_id]));
  const areaRows = new Map((ctx.links?.areas ?? []).map((r) => [r.area_id, r.floor_id]));
  const haFloors = treeFloors(tree);
  const haById = new Map(haFloors.map((f) => [f.floor_id, f]));
  const areas = treeAreas(tree);
  const areaIds = new Set(areas.map((x) => x.area.area_id));
  const ids = new Set(floors.map((f) => f.id));
  // platform floor -> our floor and how (rows first; then the automatic rules for platform floors no row names)
  const owner = new Map<string, { floor: string; how: FloorHow }>();
  for (const [hid, fid] of floorRows) if (ids.has(fid) && haById.has(hid)) owner.set(hid, { floor: fid, how: 'link' });
  const linkedFloors = new Set([...floorRows.entries()].filter(([hid]) => haById.has(hid)).map(([, fid]) => fid));
  const open = (f: MatchFloor) => !linkedFloors.has(f.id) && ![...owner.values()].some((o) => o.floor === f.id);
  const free = (hid: string) => !floorRows.has(hid) && !owner.has(hid);
  const ambiguous = new Set<string>();
  const suggestions = new Map<string, FloorSuggestion>();
  for (const f of floors) {
    if (!open(f)) continue;
    const sameLevel = haFloors.filter((h) => h.level !== null && h.level === f.level);
    const twins = floors.filter((g) => g.level === f.level);
    if (sameLevel.length === 1 && twins.length === 1 && single && free(sameLevel[0].floor_id)) owner.set(sameLevel[0].floor_id, { floor: f.id, how: 'level' });
    else if (sameLevel.length) {
      ambiguous.add(f.id);
      const cand = sameLevel.filter((h) => free(h.floor_id));
      // one free candidate on a multi-building site: offered, not applied; several: the user picks
      if (cand.length === 1 && twins.length === 1) suggestions.set(f.id, { haFloorId: cand[0].floor_id, haFloorName: cand[0].name, why: 'level' });
    }
  }
  for (const f of floors) {
    if (!open(f)) continue;
    const key = norm(f.name);
    if (!key) continue;
    const cands = haFloors.filter((h) => norm(h.name) === key);
    const twins = floors.filter((g) => norm(g.name) === key);
    if (cands.length === 1 && twins.length === 1 && free(cands[0].floor_id)) {
      // every building's floors are matched on their own: on a site of several buildings a name could be claimed twice - offered only
      if (single) {
        owner.set(cands[0].floor_id, { floor: f.id, how: 'name' });
        ambiguous.delete(f.id);
        suggestions.delete(f.id);
      } else if (!suggestions.has(f.id)) suggestions.set(f.id, { haFloorId: cands[0].floor_id, haFloorName: cands[0].name, why: 'name' });
    }
  }
  // a suggestion from the map: the platform floor most of the floor's placed areas sit on (only when nothing matched and it is free)
  for (const f of floors) {
    if (!open(f) || suggestions.has(f.id)) continue;
    const votes = new Map<string, number>();
    for (const x of areas) if (x.area.map?.floor_id === f.id && x.haFloorId) votes.set(x.haFloorId, (votes.get(x.haFloorId) ?? 0) + 1);
    const best = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    if (best[0] && (!best[1] || best[1][1] < best[0][1]) && free(best[0][0])) suggestions.set(f.id, { haFloorId: best[0][0], haFloorName: haById.get(best[0][0])!.name, why: 'map' });
  }
  // the areas, one owner each: map placement > the per-area row > the platform floor's owner
  const byFloor = new Map<string, MatchedArea[]>(floors.map((f) => [f.id, []]));
  const excluded = new Map<string, { area: DeviceArea; to: string | null }[]>(floors.map((f) => [f.id, []]));
  for (const x of areas) {
    const aid = x.area.area_id;
    const viaFloor = x.haFloorId ? owner.get(x.haFloorId) : undefined;
    let to: string | null;
    let source: AreaSource;
    if (x.area.map?.floor_id) {
      to = x.area.map.floor_id;
      source = 'map';
    } else if (areaRows.has(aid)) {
      to = areaRows.get(aid) ?? null;
      source = 'manual';
    } else if (viaFloor) {
      to = viaFloor.floor;
      source = viaFloor.how;
    } else continue;
    if (viaFloor && viaFloor.floor !== to && source !== 'map') excluded.get(viaFloor.floor)?.push({ area: x.area, to });
    if (to && ids.has(to)) byFloor.get(to)!.push({ area: x.area, haFloorId: x.haFloorId, source });
  }
  for (const f of floors) {
    const mine = [...owner.entries()].filter(([, o]) => o.floor === f.id);
    const missing = [...floorRows.entries()].filter(([hid, fid]) => fid === f.id && !haById.has(hid)).map(([hid]) => hid);
    missing.push(...[...areaRows.entries()].filter(([aid, fid]) => fid === f.id && !areaIds.has(aid)).map(([aid]) => aid));
    out.set(f.id, {
      haFloors: mine.map(([hid]) => ({ id: hid, name: haById.get(hid)!.name })),
      how: mine[0]?.[1].how ?? null,
      suggestion: mine.length ? null : suggestions.get(f.id) ?? null,
      ambiguous: !mine.length && ambiguous.has(f.id),
      areas: byFloor.get(f.id)!,
      excluded: excluded.get(f.id)!,
      missing,
    });
  }
  return out;
}

/** The device-tree areas of a floor; pass the building's floors so the other floors compete (a lone floor matches alone). */
export function areasOfFloor(floor: MatchFloor, tree: DeviceTree | null, building: MatchFloor[] = [floor], ctx: MatchContext = {}): { areas: DeviceArea[]; climateTargets: number[] } {
  const all = building.some((f) => f.id === floor.id) ? building : [...building, floor];
  const m = matchFloors(all, tree, ctx).get(floor.id);
  const areas = m?.areas.map((x) => x.area) ?? [];
  return { areas, climateTargets: tree ? climateTargetsOf(areas, tree) : [] };
}

/** The available climate targets of the areas: the area's own units, and the platform floor's list matched by area name (older trees). */
function climateTargetsOf(areas: DeviceArea[], tree: DeviceTree): number[] {
  const names = new Set(areas.map((a) => a.name));
  const seen = new Set<string>();
  const targets: number[] = [];
  const take = (c: { entity_id: string; available: boolean; target_temperature: number | null }) => {
    if (seen.has(c.entity_id) || !c.available || nz(c.target_temperature) === null) return;
    seen.add(c.entity_id);
    targets.push(c.target_temperature as number);
  };
  for (const a of areas) for (const c of a.climate ?? []) take(c);
  for (const f of tree.floors) for (const c of f.climate) if (c.area_name && names.has(c.area_name)) take(c);
  return targets;
}

/** One floor's signals from the catalogue floor, its match (building-wide, from signalsOf), the device tree and the presence answer. */
export function signalOf(floor: Floor, tree: DeviceTree | null, people: PeopleResponse | null, match?: FloorMatchInfo | null): FloorSignal {
  const m = match === undefined ? matchFloors([floor], tree).get(floor.id) ?? null : match;
  const areas = m?.areas.map((x) => x.area) ?? [];
  const climateTargets = tree ? climateTargetsOf(areas, tree) : [];
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
    match: m,
  };
}

export function signalsOf(floors: Floor[], tree: DeviceTree | null, people: PeopleResponse | null, ctx: MatchContext = {}): FloorSignal[] {
  const matches = matchFloors(floors, tree, ctx);
  return [...floors].sort((a, b) => b.level - a.level || b.sort_order - a.sort_order).map((f) => signalOf(f, tree, people, matches.get(f.id) ?? null));
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
