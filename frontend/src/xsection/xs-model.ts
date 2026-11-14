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
import {
  PHONE_TILE_MAX_FLOORS, SYN_COLUMN_ORDER, XS_COLUMNS_ALL, type SynColumn, type XS_ACK_WHO, type XS_LINKS, type XS_PHONE_PLACE, type XS_SYN_PHONE_LIGHT, type XS_SYN_PHONE_SUMMARY,
  type XS_SYN_PHONE_VIEW, type XS_SYN_SWITCHES, type XsColumn, type XsOptions,
} from './xs-options';

/* ---------------------------------------------------------------- options (ui.xs): xsection/xs-options.ts (CR-SHELL-LAZY-2436), re-exported unchanged */

export * from './xs-options';

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
/** SWITCH-LIGHT-DIMMER-2331: what the lights column counts. `typed` (default): the server's lights (light.* and the switches an administrator
 * typed as a light); `all`: every other switch.* entity too (the tree's switch_entities - never an input_boolean helper). */
export interface LightCountOptions {
  switches?: (typeof XS_SYN_SWITCHES)[number];
}

/** One area's lights and lights on as the lights column counts them. */
export function areaLights(a: Pick<DeviceArea, 'counts'>, opts: LightCountOptions = {}): { lights: number; lit: number } {
  const c = a.counts;
  const all = opts.switches === 'all';
  return {
    lights: (c?.lights ?? 0) + (all ? (c?.switch_entities ?? 0) : 0),
    lit: (c?.lights_on ?? 0) + (all ? (c?.switch_entities_on ?? 0) : 0),
  };
}

export function signalOf(floor: Floor, tree: DeviceTree | null, people: PeopleResponse | null, match?: FloorMatchInfo | null, opts: LightCountOptions = {}): FloorSignal {
  const m = match === undefined ? matchFloors([floor], tree).get(floor.id) ?? null : match;
  const areas = m?.areas.map((x) => x.area) ?? [];
  const climateTargets = tree ? climateTargetsOf(areas, tree) : [];
  const connected = !!tree && tree.sync?.connected !== false;
  const lights = areas.reduce((n, a) => n + areaLights(a, opts).lights, 0);
  const lit = areas.reduce((n, a) => n + areaLights(a, opts).lit, 0);
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

export function signalsOf(floors: Floor[], tree: DeviceTree | null, people: PeopleResponse | null, ctx: MatchContext = {}, opts: LightCountOptions = {}): FloorSignal[] {
  const matches = matchFloors(floors, tree, ctx);
  return [...floors].sort((a, b) => b.level - a.level || b.sort_order - a.sort_order).map((f) => signalOf(f, tree, people, matches.get(f.id) ?? null, opts));
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

type SynOpts = Pick<XsOptions, 'syn_columns' | 'fire_column' | 'fire_ui'> & Partial<Pick<XsOptions, 'syn_custom' | 'syn_hide_empty'>>;

/**
 * SYN-COLUMNS-2321: the metrics that have NO source on any floor of the building - drawn, they would be a column of "-" only.
 * The rule is "the source does not exist", never "the value is 0": a floor that reports 0 lights on, 0 people or 0 open doors keeps its column.
 *  - light / temp / doors: no floor WITH DATA has a value (lights counted, a reading or a target, an open-sensor count). When no floor has
 *    data at all (the platform is disconnected, nothing is linked) nothing is hidden: that is an outage, said as "no data", not a missing source;
 *  - presence: no floor has a count (the module answers for every floor when it is on); alerts: no floor has an alert source (none exists yet);
 *  - cameras: the building has no camera at all, own or shared (a catalogue of zero cameras is not a source of camera numbers).
 * The fire column is never hidden here: it has its own option (hidden until connected, or the dashed "not connected").
 */
export function emptyColumns(fl: readonly FloorSignal[]): XsColumn[] {
  if (!fl.length) return [];
  const live = fl.filter((f) => !f.nodata);
  const none = (set: readonly FloorSignal[], pred: (f: FloorSignal) => boolean) => set.length > 0 && set.every(pred);
  const out = new Set<XsColumn>();
  if (none(live, (f) => f.lights === null || f.lit === null)) out.add('light');
  if (none(live, (f) => f.temp === null && f.target === null)) out.add('temp');
  if (none(fl, (f) => f.people === null)) out.add('presence');
  if (none(fl, (f) => !f.cams && !f.shared)) out.add('cameras');
  if (none(live, (f) => f.doorsOpen === null)) out.add('doors');
  if (none(fl, (f) => f.alerts === null)) out.add('alerts');
  return XS_COLUMNS_ALL.filter((c) => out.has(c));
}

/** The columns the options ask for, before the data has a say: the preset (all / few) or the custom ticks, always in the board order. */
function chosenColumns(o: SynOpts): SynColumn[] {
  if (o.syn_columns === 'few') return ['temp', 'light', 'alerts', 'fire'];
  if (o.syn_columns === 'custom') return SYN_COLUMN_ORDER.filter((c) => (o.syn_custom ?? SYN_COLUMN_ORDER).includes(c));
  return [...SYN_COLUMN_ORDER];
}

/**
 * The columns the board draws, in order, and the ones left out because the building has no source for them (`hiddenEmpty`, for the quiet
 * note under the board). Presence follows the module; the fire column follows the alarm UI, the connection and its option. Pass the floors
 * (`fl`) for the hide-empty rule; without them (or with syn_hide_empty off) every chosen column is drawn.
 */
export function synBoardColumns(o: SynOpts, presenceOn: boolean, fireConnected: boolean, fl?: readonly FloorSignal[]): { cols: SynColumn[]; hiddenEmpty: XsColumn[] } {
  const chosen = chosenColumns(o).filter((c) => (c === 'presence' ? presenceOn : c === 'fire' ? o.fire_ui && (fireConnected || o.fire_column === 'dashed') : true));
  const empty = fl && o.syn_hide_empty !== false ? emptyColumns(fl) : [];
  const hiddenEmpty = chosen.filter((c): c is XsColumn => c !== 'fire' && empty.includes(c));
  return { cols: chosen.filter((c) => c === 'fire' || !empty.includes(c)), hiddenEmpty };
}

/** The columns the board draws, in order (see synBoardColumns). */
export function synColumns(o: SynOpts, presenceOn: boolean, fireConnected: boolean, fl?: readonly FloorSignal[]): SynColumn[] {
  return synBoardColumns(o, presenceOn, fireConnected, fl).cols;
}

/** The phone keeps at most three signal columns (and fire): lighting, temperature and alerts first, then what is left of doors, presence, cameras. */
export function phoneColumns(cols: readonly SynColumn[]): SynColumn[] {
  const rank: SynColumn[] = ['light', 'temp', 'alerts', 'doors', 'presence', 'cameras'];
  const keep = new Set<SynColumn>(rank.filter((c) => cols.includes(c)).slice(0, 3));
  if (cols.includes('fire')) keep.add('fire');
  return cols.filter((c) => keep.has(c));
}

/* ---------------------------------------------------------------- the phone board (SYNOPTIC-MOBILE-2342) */

/** Below this width the phone board never draws a column of "-" (the hide-empty option off), whatever the option says (mock-up round 12). */
export const PHONE_DASHED_MIN_WIDTH = 360;
/** At most this many columns on the phone board, the dashed ones included. */
export const PHONE_MAX_COLUMNS = 5;
/** The fixed width (px) of each column of the phone table: the number column never shrinks under its content, so nothing spills into the next. */
export const PHONE_COL_PX: Readonly<Record<SynColumn, number>> = { light: 56, temp: 38, presence: 34, cameras: 42, doors: 34, alerts: 32, fire: 36 };
/** Above this many floors the phone rows drop to the 44 px touch minimum (table, section) and the cards turn into one row each. */
export const PHONE_DENSE_FLOORS = 6;

/**
 * SYNOPTIC-MOBILE-2342: the phone board's columns. The columns WITH a source come first (at most three, lighting / temperature / alerts /
 * doors / presence / cameras by rank, shown in the board order), then - only when the hide-empty option let them through and the screen is at
 * least 360 px - the chosen columns that have no source, drawn dashed ("-"), up to five in all. Fire follows its own option, as on the desktop.
 * The old phone rule (phoneColumns) took the first three by rank even when they had no source, and dropped cameras and doors that had data.
 */
export function phoneBoardColumns(cols: readonly SynColumn[], fl: readonly FloorSignal[], width: number): { cols: SynColumn[]; dashed: SynColumn[] } {
  const empty = new Set<SynColumn>(emptyColumns(fl));
  const rank: SynColumn[] = ['light', 'temp', 'alerts', 'doors', 'presence', 'cameras'];
  const live = new Set(rank.filter((c) => cols.includes(c) && !empty.has(c)).slice(0, 3));
  const dashed = width >= PHONE_DASHED_MIN_WIDTH ? cols.filter((c) => c !== 'fire' && empty.has(c)).slice(0, Math.max(0, PHONE_MAX_COLUMNS - live.size)) : [];
  return { cols: [...cols.filter((c) => live.has(c) || c === 'fire'), ...dashed], dashed };
}

/** The grid template of the phone table: the name takes what is left (and may shrink to nothing but its ellipsis), every number column is fixed. */
export function phoneGridTemplate(cols: readonly SynColumn[]): string {
  return ['minmax(0, 1fr)', ...cols.map((c) => `${PHONE_COL_PX[c]}px`)].join(' ');
}

/** The share of a floor's lights that are on, 0-100 (the small bar under "2/10", the warm fill of the section slab); 0 with no lights. */
export function litPercent(f: Pick<FloorSignal, 'lit' | 'lights'>): number {
  return f.lights && f.lit !== null ? Math.max(0, Math.min(100, Math.round((f.lit / f.lights) * 100))) : 0;
}

/** SYNOPTIC-PHONE-SETTINGS-2360: the lights gauge of one floor under the setting `syn_phone_light` - what the table cell and the card tile draw. */
export interface PhoneLightGauge {
  kind: 'bar' | 'segments' | 'none';
  /** bar: the filled share, 0-100 (litPercent). */
  percent: number;
  /** segments: how many of `total` are lit. */
  on: number;
  /** segments: one per light, at most eight (the wide board's strip), never zero while the gauge is drawn. */
  total: number;
}
/** The segment count of the strip never passes the wide board's eight (`devices-synoptic.ts cell`). */
export const PHONE_MAX_SEGMENTS = 8;
export function phoneLightGauge(mode: (typeof XS_SYN_PHONE_LIGHT)[number], f: Pick<FloorSignal, 'lit' | 'lights'>): PhoneLightGauge {
  const percent = litPercent(f);
  if (mode === 'number') return { kind: 'none', percent, on: 0, total: 0 };
  if (mode === 'bar') return { kind: 'bar', percent, on: 0, total: 0 };
  const lights = f.lights ?? 0;
  const lit = f.lit ?? 0;
  const total = Math.max(1, Math.min(PHONE_MAX_SEGMENTS, lights));
  // rounded to a segment, but a floor with any light on shows at least one segment and a floor with a light off never shows a full strip
  const on = lights ? Math.max(lit > 0 ? 1 : 0, Math.min(lit < lights ? total - 1 : total, Math.round((lit / lights) * total))) : 0;
  return { kind: 'segments', percent, on, total };
}

/** SYNOPTIC-PHONE-SETTINGS-2360: which phone layouts a phone setting applies to (the cross-section colours its slabs itself; it has no gauge to restyle). */
export function phoneLightApplies(view: (typeof XS_SYN_PHONE_VIEW)[number]): boolean {
  return view !== 'section';
}

/**
 * SYNOPTIC-PHONE-SETTINGS-2360: the summary under `syn_phone_summary` - the info button (and its sheet), the line under the board, or neither. All
 * three layouts. With "off" the head keeps a small settings button (`settings`, 44 px hit area) for whoever may open the map settings
 * (`canOpenSettings`: system.configure), so the phone never loses the route to "הגדרות המפה"; nobody else sees a button.
 */
export function phoneSummaryParts(mode: (typeof XS_SYN_PHONE_SUMMARY)[number], canOpenSettings = false): { button: boolean; line: boolean; settings: boolean } {
  return { button: mode === 'button', line: mode === 'line', settings: mode === 'off' && canOpenSettings };
}

/**
 * SYNOPTIC-MOBILE-2342 (the owner's "11/17 דולקות" against rows that seemed to add up to 4/17): the head chip is totalsOf() of the very rows
 * the board draws, so the two cannot disagree; lights that sit on no floor are NOT in the chip. They are counted here, for the board's info
 * sheet ("ללא קומה"): the areas of the home system's "no floor" bucket that nothing moves onto a floor (no map placement, no per-area row to a
 * floor, not taken by one of `sigs`), and the devices that have no area at all (tree.unassigned). null when there are none.
 */
export function unassignedLights(tree: DeviceTree | null, sigs: readonly FloorSignal[], ctx: MatchContext = {}, opts: LightCountOptions = {}): { lit: number; lights: number } | null {
  if (!tree) return null;
  const taken = new Set(sigs.flatMap((s) => (s.match?.areas ?? []).map((x) => x.area.area_id)));
  const rows = new Map((ctx.links?.areas ?? []).map((r) => [r.area_id, r.floor_id]));
  let lit = 0;
  let lights = 0;
  const add = (a: Pick<DeviceArea, 'counts'>) => {
    const l = areaLights(a, opts);
    lit += l.lit;
    lights += l.lights;
  };
  for (const x of treeAreas(tree)) {
    const id = x.area.area_id;
    if (x.haFloorId !== null || taken.has(id) || x.area.map?.floor_id || (rows.has(id) && rows.get(id) !== null)) continue;
    add(x.area);
  }
  if (tree.unassigned) add(tree.unassigned);
  return lights ? { lit, lights } : null;
}

/** SYN-COLUMNS-2321, the cross-section (rows, tiles, compact card): which of its two metrics it draws - the same hide-empty rule as the board. */
export function xsMetrics(fl: readonly FloorSignal[], o: Partial<Pick<XsOptions, 'syn_hide_empty'>>): { temp: boolean; light: boolean } {
  const empty = o.syn_hide_empty === false ? [] : emptyColumns(fl);
  return { temp: !empty.includes('temp'), light: !empty.includes('light') };
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

/* ---------------------------------------------------------------- the floor lights popup (SWITCH-LIGHT-DIMMER-2331) */

/** Where the floor lights popup reads and acts: one of our floors stands for a set of home-system areas (its match). All on one home-system
 * floor -> that floor's scope (a floor-scoped caller may act there); spread over several -> the building, narrowed to the areas. A floor
 * with no match (no data) has no popup: null. The areas list is the filter of the rows and of every bulk action (`only`). */
export interface FloorLightsTarget {
  scope: 'floor' | 'building';
  scopeId: string;
  areaIds: string[];
}

export function floorLightsTarget(f: Pick<FloorSignal, 'match' | 'nodata' | 'lights'>): FloorLightsTarget | null {
  const areas = f.match?.areas ?? [];
  if (f.nodata || !areas.length || f.lights === null) return null;
  const floors = [...new Set(areas.map((x) => x.haFloorId ?? 'none'))];
  const areaIds = [...new Set(areas.map((x) => x.area.area_id))];
  return floors.length === 1 ? { scope: 'floor', scopeId: floors[0], areaIds } : { scope: 'building', scopeId: '', areaIds };
}
