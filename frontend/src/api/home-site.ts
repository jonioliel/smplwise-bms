/**
 * MULTIBUILDING-HOME-2330 (owner approval 31.10, round 10 "ריבוי בניינים", every recommendation): the home screen's SITE level for an
 * installation with several buildings. Pure logic only - nothing here draws or fetches.
 *
 * The home-system tree (DeviceTree: platform floors -> areas) is resolved onto OUR catalogue (site -> buildings -> floors) through the
 * mapping of SYNOPTIC-HA-2310 (xs-model matchFloors: map placement > per-area row > platform-floor row; on a multi-building site the
 * automatic level / name rules only SUGGEST, they never assign). An area that resolves to no building is "לא משויך".
 *
 *  - siteModel(): null = the one-building home (nothing changes, no selector is drawn): fewer than two buildings the caller sees, or no
 *    area resolves to any building (the mapping was never made). Else the buildings in catalogue order with the shared building last.
 *  - scopeTree(): today's home tree narrowed to one building (its areas only; a platform floor split between buildings keeps only this
 *    building's areas and loses its floor-wide bulk menu, since the floor action would reach the other building).
 *  - bulkTargets(): the existing safe bulk path per building - one request per platform floor that is wholly this building's, one per
 *    area on a split floor.
 *  - entryLevel(): where the home opens (installation default + per-user override; a fixed / last building that no longer exists = site).
 *  - offSelection(): the "כבה הכל באתר" dialog's initial checks (shared unchecked unless the installation says include).
 */
import type { ClimateSummary, DeviceArea, DeviceCounts, DeviceFloor, DeviceTree } from './devices';
import type { Building, Floor } from './types';
import { matchFloors, type MatchLinks } from '../xsection/xs-model';

export const SITE_LEVEL = 'site';

const ZERO: DeviceCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };

/** The counts of several scopes added up; the alarm is the most urgent state (triggered wins, else the first one present). */
export function sumCounts(list: DeviceCounts[]): DeviceCounts {
  const out: DeviceCounts = { ...ZERO };
  for (const c of list) {
    for (const k of Object.keys(ZERO) as (keyof DeviceCounts)[]) if (k !== 'alarm') (out[k] as number) += (c[k] as number) ?? 0;
    if (c.alarm === 'triggered' || (c.alarm && !out.alarm)) out.alarm = c.alarm;
  }
  return out;
}

/** One of OUR floors of a building, with the home-system areas resolved onto it. */
export interface SiteFloor {
  id: string;
  name: string;
  level: number;
  areas: DeviceArea[];
  counts: DeviceCounts;
}

export interface SiteBuilding {
  id: string;
  name: string;
  shared: boolean;
  /** Our floors, top level first (the cross-section's order). */
  floors: SiteFloor[];
  counts: DeviceCounts;
  areaIds: Set<string>;
  /** Areas whose alarm is triggered (the card's alert rows and the tree's red badge). */
  alerts: { area: DeviceArea; floor: string }[];
}

export interface SiteModel {
  siteName: string;
  buildings: SiteBuilding[];
  /** Areas that resolve to no building (the tree's "לא משויך" line). */
  unassigned: DeviceArea[];
}

/** Catalogue buildings (as the caller sees them) -> the site model, or null for the one-building home. */
export function siteModel(buildings: (Building & { floors?: Floor[] })[], tree: DeviceTree | null, links: MatchLinks | null, siteName = ''): SiteModel | null {
  if (!tree || buildings.length < 2) return null;
  const claimed = new Set<string>();
  const out: SiteBuilding[] = [];
  const ordered = [...buildings.filter((b) => !b.is_shared), ...buildings.filter((b) => b.is_shared)];
  for (const b of ordered) {
    const floors = [...(b.floors ?? [])].sort((x, y) => y.level - x.level || x.sort_order - y.sort_order);
    const match = matchFloors(floors, tree, { links, singleBuilding: false });
    const sf: SiteFloor[] = floors.map((f) => {
      const areas = (match.get(f.id)?.areas ?? []).map((m) => m.area).filter((a) => !claimed.has(a.area_id));
      for (const a of areas) claimed.add(a.area_id);
      return { id: f.id, name: f.name, level: f.level, areas, counts: sumCounts(areas.map((a) => a.counts)) };
    });
    const areaIds = new Set(sf.flatMap((f) => f.areas.map((a) => a.area_id)));
    const alerts = sf.flatMap((f) => f.areas.filter((a) => a.counts.alarm === 'triggered').map((area) => ({ area, floor: f.name })));
    out.push({ id: b.id, name: b.name, shared: !!b.is_shared, floors: sf, counts: sumCounts(sf.map((f) => f.counts)), areaIds, alerts });
  }
  if (!claimed.size) return null;
  const unassigned: DeviceArea[] = [];
  const seen = new Set<string>();
  for (const f of tree.floors)
    for (const a of f.areas) {
      if (claimed.has(a.area_id) || seen.has(a.area_id)) continue;
      seen.add(a.area_id);
      unassigned.push(a);
    }
  return { siteName, buildings: out, unassigned };
}

/** The buildings this viewer is shown: the shared one hidden by his own "הסתר משותף". */
export function shownBuildings(m: SiteModel, hideShared: boolean): SiteBuilding[] {
  return hideShared ? m.buildings.filter((b) => !b.shared) : m.buildings;
}

/** The tree narrowed to one building: its areas only, the platform floors that keep at least one area, the counts added up again. A
 * floor split between buildings keeps only this building's areas and no floor-wide bulk menu; the building-wide bulk (= the whole
 * installation on the server) is off - the home's "כבה הכל" acts per building through bulkTargets(). */
export function scopeTree(tree: DeviceTree, b: SiteBuilding): DeviceTree {
  const ourName = new Map<string, { name: string; level: number }>();
  for (const f of b.floors) for (const a of f.areas) ourName.set(a.area_id, { name: f.name, level: f.level });
  const floors: DeviceFloor[] = [];
  for (const f of tree.floors) {
    const areas = f.areas.filter((a) => b.areaIds.has(a.area_id));
    if (!areas.length) continue;
    const whole = areas.length === f.areas.length;
    // the floor reads as OUR floor when every kept area resolves to the same one of our floors ("קומה 1", not "א · קומה 1")
    const ours = new Set(areas.map((a) => ourName.get(a.area_id)?.name));
    const one = ours.size === 1 ? ourName.get(areas[0].area_id) : undefined;
    const names = new Set(areas.map((a) => a.name));
    floors.push({
      ...f,
      name: one?.name ?? f.name,
      level: one?.level ?? f.level,
      areas,
      counts: whole ? f.counts : sumCounts(areas.map((a) => a.counts)),
      climate: whole ? f.climate : f.climate.filter((c) => c.area_name !== null && names.has(c.area_name)),
      can_bulk: whole ? f.can_bulk : false,
    });
  }
  const names = new Set(floors.flatMap((f) => f.areas.map((a) => a.name)));
  const climate: ClimateSummary[] = tree.building_climate.filter((c) => c.area_name !== null && names.has(c.area_name));
  return {
    ...tree,
    floors,
    unassigned: { ...tree.unassigned, counts: { ...ZERO } },
    building: sumCounts(floors.map((f) => f.counts)),
    building_climate: climate,
    can_bulk: false,
  };
}

/** One bulk request of a building's "כבה הכל": the existing safe path (preview -> confirmed run) on a floor or an area. */
export interface BulkTarget {
  scope: 'floor' | 'area';
  id: string;
  name: string;
  building: string;
}

/** The requests that turn a building off: a platform floor wholly in the building -> one floor request (when the caller may act on
 * the floor); a floor split between buildings, or one the caller may not act on as a whole -> one request per area he may act on. */
export function bulkTargets(tree: DeviceTree, b: SiteBuilding): BulkTarget[] {
  const out: BulkTarget[] = [];
  for (const f of tree.floors) {
    const mine = f.areas.filter((a) => b.areaIds.has(a.area_id));
    if (!mine.length) continue;
    if (f.floor_id !== 'none' && mine.length === f.areas.length && f.can_bulk) out.push({ scope: 'floor', id: f.floor_id, name: f.name, building: b.id });
    else for (const a of mine) if (a.can_bulk) out.push({ scope: 'area', id: a.area_id, name: a.name, building: b.id });
  }
  return out;
}

export type SiteEntry = 'site' | 'last' | 'fixed';
export const SITE_ENTRIES: readonly SiteEntry[] = ['site', 'last', 'fixed'];

/** Where the home opens: the user's own choice over the installation's (whole site | the last building he was in | a fixed building);
 * a building that is not (or no longer) shown falls back to the whole site. */
export function entryLevel(o: { site: SiteEntry; siteBuilding: string; personal?: { site_entry?: SiteEntry; site_entry_building?: string } | null; last: string | null; buildings: string[] }): string {
  const mode = o.personal?.site_entry ?? o.site;
  const want = mode === 'fixed' ? o.personal?.site_entry_building || o.siteBuilding : mode === 'last' ? o.last : null;
  return want && o.buildings.includes(want) ? want : SITE_LEVEL;
}

/** The "כבה הכל באתר" dialog's first checks: every building, the shared one only when the installation says include. */
export function offSelection(buildings: Pick<SiteBuilding, 'id' | 'shared'>[], includeShared: boolean): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const b of buildings) out[b.id] = !b.shared || includeShared;
  return out;
}

/** What "כבה הכל" would reach in a scope according to the tree's counts (the dialog's hint; the server's preview is what is sent). */
export function activeOff(c: DeviceCounts): number {
  return c.lights_on + c.switches_on + c.covers_open + c.climate_active + c.heating_active + c.media_on;
}

/** The card's per-floor lit bars: top floor first, the share of lights on (0..1), red when an area of the floor is in alarm. */
export function floorBars(b: SiteBuilding): { id: string; name: string; on: number; total: number; ratio: number; alert: boolean }[] {
  return b.floors.map((f) => ({ id: f.id, name: f.name, on: f.counts.lights_on, total: f.counts.lights, ratio: f.counts.lights ? f.counts.lights_on / f.counts.lights : 0, alert: f.areas.some((a) => a.counts.alarm === 'triggered') }));
}

/** The mini cross-section: the floors of every building aligned by level (the rows from the highest level down to the lowest). */
export function sectionLevels(buildings: SiteBuilding[]): number[] {
  const levels = new Set<number>();
  for (const b of buildings) for (const f of b.floors) levels.add(f.level);
  return [...levels].sort((a, b) => b - a);
}

/** The scope tag of the widgets and counters that follow the level: "אתר" at the site level, else the building's name. */
export function scopeTag(m: SiteModel | null, level: string): string {
  if (!m) return '';
  if (level === SITE_LEVEL) return 'אתר';
  return m.buildings.find((b) => b.id === level)?.name ?? 'אתר';
}
