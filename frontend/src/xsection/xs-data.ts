/**
 * Release 2.29.0 - where the section and the synoptic board get their per-floor numbers.
 *
 * With a backend: the catalogue floors (sites?tree=true), the platform's device tree (devices/tree: lights, room temperatures, open doors and
 * windows per area, climate targets) and, only for a caller who holds presence.view, the people count per floor when the presence module is
 * on. A floor with no linked area, or a disconnected platform, gets `nodata` - the screens say "no data" and never a made-up number.
 * Without a backend (the static demo / design review): synthetic, deterministic numbers, always shown with the demo label.
 */
import { getDevicesTree, type DeviceTree } from '../api/devices';
import { getPresencePeople, type PeopleResponse } from '../api/presence';
import { canAnywhere, isApi } from '../api/session';
import type { Building, Floor } from '../api/types';
import type { FloorLink } from '../map/connector-targets';
import type { SectionLink } from './sw-xsection';
import { signalsOf, type FloorSignal } from './xs-model';

export interface XsData { tree: DeviceTree | null; people: PeopleResponse | null; presenceOn: boolean; demo: boolean }

/** Reads what the signals need; a failing read leaves its part null (the screens show "no data"), it never throws. */
export async function loadXsData(): Promise<XsData> {
  if (!isApi()) return { tree: null, people: null, presenceOn: true, demo: true };
  const [tree, people] = await Promise.all([
    canAnywhere('devices.read') ? getDevicesTree().catch(() => null) : Promise.resolve(null),
    canAnywhere('presence.view') ? getPresencePeople().catch(() => null) : Promise.resolve(null),
  ]);
  return { tree, people, presenceOn: !!people?.enabled, demo: false };
}

/** Deterministic demo numbers per floor (index-based, so a screenshot is repeatable). Demo only - labelled on every screen that uses it. */
export function demoSignals(floors: Floor[]): FloorSignal[] {
  const base = signalsOf(floors, null, null);
  return base.map((s, i) => {
    const lights = 6 + ((i * 5) % 9);
    const lit = (i * 3 + 2) % (lights + 1);
    const hot = i === 1;
    return { ...s, nodata: i === floors.length - 1 && floors.length > 2, temp: i === floors.length - 1 && floors.length > 2 ? null : hot ? 27.6 : 22.4 + ((i * 7) % 10) / 10, target: 24, lit: i === floors.length - 1 && floors.length > 2 ? null : lit, lights: i === floors.length - 1 && floors.length > 2 ? null : lights, people: (i * 4 + 1) % 13, doorsOpen: i % 3 === 0 ? 1 : 0, alerts: null };
  });
}

/** A synthetic building of n floors for the demo (`?xsdemo=16`): the screens at 16 or 24 floors without a backend. */
export function demoBuilding(n: number, base: Building): Building {
  const floors: Floor[] = Array.from({ length: n }, (_, i) => {
    const lv = n - 3 - i; // two levels below ground
    return {
      id: `xsd${i}`, building_id: base.id, name: lv === 0 ? 'קומת קרקע' : lv > 0 ? `קומה ${lv}` : `חניון ‎${lv}`, level: lv, sort_order: i, ha_area_id: null, has_plan: i % 5 !== 4, published_version_id: null,
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
