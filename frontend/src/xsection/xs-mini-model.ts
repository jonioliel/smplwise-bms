/**
 * XS-MINI-WIDGET-2351 (owner follow-up): the home widget "חתך בניין" - a compact building cross-section in the home widgets row. Pure model
 * only (no DOM, no fetch), so the unit specs run it in Node; the drawing is xs-mini-widget.ts.
 *
 * It reuses the cross-section's own model (xs-model.ts) end to end, so the widget can never say something the floors screen does not:
 *  - the floors and their numbers are `signalsOf()` of ONE catalogue building against the home-system tree and the mapping rows (the same
 *    matching, the same `nodata`, the same lights count option `syn_switches`);
 *  - a metric the building has no source for is not drawn (`xsMetrics()` / `emptyColumns()` under the installation's `syn_hide_empty`);
 *  - hot / cold is `tempState()` with the installation's threshold; the fire marker exists only while the fire UI option is on (demo only);
 *  - the lights chip opens the floor lights popup only where `floorLightsTarget()` finds one (the popup of 2.33.1).
 * The alert marker is the home site's own semantics (api/home-site.ts floorBars): an area of the floor whose alarm is triggered.
 *
 * Which building: the one-building home shows the catalogue's first building that has floors (a non-shared one first); with the
 * multi-building view on, the building the home shows (its level) - at the site level, the first building shown.
 */
import type { Building, Floor } from '../api/types';
import type { DeviceTree } from '../api/devices';
import { emptyColumns, floorLightsTarget, litPercent, signalsOf, tempState, xsMetrics, type FloorSignal, type MatchContext, type XsOptions } from './xs-model';

/** The site level of the multi-building home (api/home-site.ts SITE_LEVEL; repeated so this module stays free of the home's imports). */
export const MINI_SITE_LEVEL = 'site';

/** Floors drawn per widget size; a taller building keeps its top floors and says "+N". */
export const MINI_CAP: Readonly<Record<'s' | 'm' | 'l', number>> = { s: 6, m: 9, l: 14 };

/** The lights tint of a floor: 0 = none on (or no lights), 1 = up to a third, 2 = up to two thirds, 3 = more. */
export type MiniTint = 0 | 1 | 2 | 3;

export interface MiniFloor {
  id: string;
  name: string;
  /** The short level mark of the slab: "3", "ק" (ground), "-1". */
  mark: string;
  level: number;
  nodata: boolean;
  lit: number | null;
  lights: number | null;
  tint: MiniTint;
  temp: 'hot' | 'cold' | null;
  doorsOpen: number | null;
  /** An area of the floor is in a triggered alarm. */
  alarm: boolean;
  /** The demo fire alarm (only with the fire UI option on). */
  fire: boolean;
  /** The lights chip opens the floor lights popup (a target exists; the caller still checks the permission). */
  lightsTarget: boolean;
}

export interface MiniModel {
  buildingId: string;
  buildingName: string;
  /** The floors drawn, top level first. */
  floors: MiniFloor[];
  /** Floors left out under the cap. */
  more: number;
  /** The building has floors below ground and floors above (a ground line is drawn between them). */
  hasBelow: boolean;
  /** What the widget draws, after the hide-empty rule: the lights tint / chip, the hot-cold mark, the open-doors mark. */
  show: { light: boolean; temp: boolean; doors: boolean };
  totals: { lit: number; lights: number; litKnown: boolean; alarms: number; doorsOpen: number };
  /** All the signals of the building (every floor, not only the drawn ones), for the host's lights popup. */
  signals: FloorSignal[];
}

/** The building the widget speaks for, or null when no building has floors. */
export function miniBuilding<B extends Pick<Building, 'id' | 'is_shared'> & { floors?: unknown[] }>(buildings: readonly B[], level: string | null = null): B | null {
  const withFloors = buildings.filter((b) => (b.floors?.length ?? 0) > 0);
  if (level && level !== MINI_SITE_LEVEL) {
    const b = withFloors.find((x) => x.id === level);
    if (b) return b;
  }
  return withFloors.find((b) => !b.is_shared) ?? withFloors[0] ?? null;
}

export function tintOf(f: Pick<FloorSignal, 'lit' | 'lights'>): MiniTint {
  const p = litPercent(f);
  if (!f.lit || p <= 0) return 0;
  return p <= 33 ? 1 : p <= 66 ? 2 : 3;
}

/** The short mark of a level: the ground is "ק", a basement keeps its minus sign (an LRM keeps it on the left of the digit in RTL). */
export function levelMark(level: number): string {
  return level === 0 ? 'ק' : level > 0 ? String(level) : `‎${level}`;
}

export interface MiniInput {
  building: Pick<Building, 'id' | 'name'> & { floors?: Floor[] };
  tree: DeviceTree | null;
  ctx?: MatchContext;
  opts: Pick<XsOptions, 'syn_hide_empty' | 'temp_threshold' | 'syn_switches' | 'fire_ui'>;
  size: 's' | 'm' | 'l';
  /** The fire report's floors (demo only); ignored unless the fire UI option is on. */
  fire?: Record<string, { state: string }> | null;
  /** Precomputed signals (the static demo): skip the matching. */
  signals?: FloorSignal[];
}

/** The widget's model: the building's floors through the cross-section's own signals, capped for the size. */
export function miniModel(i: MiniInput): MiniModel {
  const floors = i.building.floors ?? [];
  const sigs = i.signals ?? signalsOf(floors, i.tree, null, i.ctx ?? {}, { switches: i.opts.syn_switches });
  const m = xsMetrics(sigs, i.opts);
  const empty = i.opts.syn_hide_empty === false ? [] : emptyColumns(sigs);
  const show = { light: m.light, temp: m.temp, doors: !empty.includes('doors') };
  const fire = i.opts.fire_ui ? i.fire ?? null : null;
  const all: MiniFloor[] = sigs.map((f) => ({
    id: f.id,
    name: f.name,
    mark: levelMark(f.level),
    level: f.level,
    nodata: f.nodata,
    lit: f.lit,
    lights: f.lights,
    tint: f.nodata ? 0 : tintOf(f),
    temp: tempState(f, i.opts.temp_threshold),
    doorsOpen: f.doorsOpen,
    alarm: (f.match?.areas ?? []).some((x) => x.area.counts?.alarm === 'triggered'),
    fire: fire?.[f.id]?.state === 'alarm',
    lightsTarget: floorLightsTarget(f) !== null,
  }));
  const cap = MINI_CAP[i.size];
  const shown = all.length > cap ? all.slice(0, cap - 1) : all;
  const lt = all.filter((f) => f.lit !== null && f.lights !== null);
  return {
    buildingId: i.building.id,
    buildingName: i.building.name,
    floors: shown,
    more: all.length - shown.length,
    hasBelow: shown.some((f) => f.level < 0) && shown.some((f) => f.level >= 0),
    show,
    totals: {
      lit: lt.reduce((n, f) => n + (f.lit as number), 0),
      lights: lt.reduce((n, f) => n + (f.lights as number), 0),
      litKnown: lt.length > 0,
      alarms: all.filter((f) => f.alarm || f.fire).length,
      doorsOpen: all.reduce((n, f) => n + (f.doorsOpen ?? 0), 0),
    },
    signals: sigs,
  };
}

/** The accessible name of a floor's slab: the name, then only what the widget draws (never a number it does not show). */
export function miniFloorLabel(f: MiniFloor, show: MiniModel['show']): string {
  const parts = [f.name];
  if (f.nodata) parts.push('אין מידע מהקומה');
  else {
    if (show.light && f.lit !== null && f.lights !== null) parts.push(`${f.lit} מתוך ${f.lights} אורות דולקים`);
    if (show.temp && f.temp) parts.push(f.temp === 'hot' ? 'חם' : 'קר');
    if (show.doors && f.doorsOpen) parts.push(f.doorsOpen === 1 ? 'דלת פתוחה' : `${f.doorsOpen} דלתות פתוחות`);
  }
  if (f.alarm) parts.push('אזעקה');
  if (f.fire) parts.push('אזעקת אש (נתוני דמה)');
  return parts.join(', ');
}
