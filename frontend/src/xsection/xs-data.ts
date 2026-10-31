/**
 * Release 2.29.0 - where the section and the synoptic board get their per-floor numbers.
 *
 * With a backend: the catalogue floors (sites?tree=true), the platform's device tree (devices/tree: lights, room temperatures, open doors and
 * windows per area, climate targets) and, only for a caller who holds presence.view, the people count per floor when the presence module is
 * on. A floor with no linked area, or a disconnected platform, gets `nodata` - the screens say "no data" and never a made-up number.
 * Without a backend (the static demo / design review): synthetic, deterministic numbers, always shown with the demo label.
 */
import { getDevicesTree, type DeviceArea, type DeviceCounts, type DeviceFloor, type DeviceTree } from '../api/devices';
import { getPresencePeople, type PeopleResponse } from '../api/presence';
import { canAnywhere, isApi } from '../api/session';
import type { Building, Floor } from '../api/types';
import type { FloorLink } from '../map/connector-targets';
import type { SectionLink } from './sw-xsection';
import { signalsOf, type FloorSignal, type MatchContext } from './xs-model';
import { getHomeLinks, type HomeLinks } from '../api/catalog';

/** `links`: SYNOPTIC-HA-2310, the home-system mapping rows (platform floor / area -> our floor); null = not read (no rows, automatic only). */
export interface XsData { tree: DeviceTree | null; people: PeopleResponse | null; presenceOn: boolean; demo: boolean; links: HomeLinks | null }

/** Reads what the signals need; a failing read leaves its part null (the screens show "no data"), it never throws. */
export async function loadXsData(): Promise<XsData> {
  if (!isApi()) return { tree: null, people: null, presenceOn: true, demo: true, links: null };
  const [tree, people, links] = await Promise.all([
    canAnywhere('devices.read') ? getDevicesTree().catch(() => null) : Promise.resolve(null),
    canAnywhere('presence.view') ? getPresencePeople().catch(() => null) : Promise.resolve(null),
    getHomeLinks().catch(() => null),
  ]);
  return { tree, people, presenceOn: !!people?.enabled, demo: false, links };
}

/** The matching context of a building: the mapping rows and whether its site has one building (a level / name match may apply alone). */
export function matchContext(data: XsData | null, site: { buildings?: unknown[] } | null | undefined): MatchContext {
  return { links: data?.links ?? null, singleBuilding: (site?.buildings?.length ?? 1) <= 1 };
}

/**
 * SYNOPTIC-HA-2310, demo only (`?xsdata=ha` / `?xsdata=none`): a synthetic platform tree for the floors, run through the REAL matching.
 * `ha`: most floors match by level (other names, as on the owner's system), the second by name, the lowest has no platform floor (the
 * "not linked" hint). `none`: the platform floors exist with other names AND other levels - nothing matches, every floor has no data.
 */
export function demoTree(floors: Floor[], mode: 'ha' | 'none'): DeviceTree {
  const zero: DeviceCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };
  const sorted = [...floors].sort((a, b) => b.level - a.level || b.sort_order - a.sort_order);
  const hf: DeviceFloor[] = sorted.flatMap((f, i) => {
    if (mode === 'ha' && i === sorted.length - 1 && sorted.length > 1) return [];
    const id = `demo_ha_${i}`;
    const areas: DeviceArea[] = Array.from({ length: 2 + (i % 3) }, (_, k) => ({
      area_id: `${id}_a${k}`, name: `Room ${i + 1}.${k + 1}`, icon: null, floor_id: id, has_camera: false,
      counts: { ...zero, entities: 6, lights: 2 + ((i + k) % 4), lights_on: (i * 2 + k) % 3 }, climate: [], temperature: 21.5 + ((i * 3 + k) % 7) / 2, open_count: (i + k) % 4 === 0 ? 1 : 0,
    }));
    const byName = mode === 'ha' && i === 1;
    return [{ floor_id: id, name: byName ? f.name : `Level ${f.level}`, level: mode === 'none' ? 100 + i : byName ? null : f.level, icon: null, areas, counts: zero, climate: [] }];
  });
  return { floors: hf, unassigned: { area_id: 'unassigned', name: '', counts: zero }, building: zero, building_climate: [], scoped: false, sync: { connected: true } as DeviceTree['sync'] };
}

/** Deterministic demo numbers per floor (index-based, so a screenshot is repeatable). Demo only - labelled on every screen that uses it. */
export function demoSignals(floors: Floor[], mode: string | null = null): FloorSignal[] {
  if (mode === 'ha' || mode === 'none') return signalsOf(floors, demoTree(floors, mode), null);
  const base = signalsOf(floors, null, null);
  return base.map((s, i) => {
    const lights = 6 + ((i * 5) % 9);
    const lit = (i * 3 + 2) % (lights + 1);
    const hot = i === 1;
    return { ...s, nodata: i === floors.length - 1 && floors.length > 2, temp: i === floors.length - 1 && floors.length > 2 ? null : hot ? 27.6 : 22.4 + ((i * 7) % 10) / 10, target: 24, lit: i === floors.length - 1 && floors.length > 2 ? null : lit, lights: i === floors.length - 1 && floors.length > 2 ? null : lights, people: (i * 4 + 1) % 13, doorsOpen: i % 3 === 0 ? 1 : 0, alerts: null };
  });
}

/** A synthetic building of n floors for the demo (`?xsdemo=16`): the screens at 16 or 24 floors without a backend. */
export function demoBuilding(n: number, base: Building, longNames = false): Building {
  // break-ui (`?xsnames=long`): realistic long names - a mixed-use tower's floors as an operator really types them
  const LONG = ['קומת קרקע - לובי כניסה ראשי, דלפק קבלה ומסחר', 'קומה ‎-1 · חניון דיירים ומחסנים (כניסה מרחוב הנביאים)', 'Mezzanine / גלריה טכנית - חדרי חשמל ותקשורת'];
  const floors: Floor[] = Array.from({ length: n }, (_, i) => {
    const lv = n - 3 - i; // two levels below ground
    const short = lv === 0 ? 'קומת קרקע' : lv > 0 ? `קומה ${lv}` : `חניון ‎${lv}`;
    return {
      id: `xsd${i}`, building_id: base.id, name: longNames && i % 2 === 0 ? LONG[(i / 2) % LONG.length] : short, level: lv, sort_order: i, ha_area_id: null, has_plan: i % 5 !== 4, published_version_id: null,
      plan_width_px: null, plan_height_px: null, draft_version_id: null, anchor_count: 3 + (i % 7), camera_count: 1 + (i % 4), updated_at: '',
    } satisfies Floor;
  });
  return { ...base, floors };
}

/** The stairs / lifts of the published structures as shafts of the section: one shaft per kind; a floor whose twin is not published is marked pending. */
export function sectionLinksOf(links: FloorLink[]): SectionLink[] {
  const by = new Map<'stairs' | 'lift', SectionLink>();
  for (const l of links) {
    const kind: 'stairs' | 'lift' = /מעלית/.test(l.kindLabel) ? 'lift' : 'stairs';
    const s = by.get(kind) ?? { kind, label: l.kindLabel, floors: [], pending: [] };
    for (const id of [l.a.floorId, l.b?.floorId]) if (id && !s.floors.includes(id)) s.floors.push(id);
    if (!l.b && !s.pending!.includes(l.a.floorId)) s.pending!.push(l.a.floorId);
    by.set(kind, s);
  }
  return [...by.values()];
}
