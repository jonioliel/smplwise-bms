/**
 * MULTIBUILDING-HOME-2330: the static demo's multi-building site (`?mb=1` in demo mode only - the existing `?hs_state=` / `?xsdemo=`
 * pattern): four buildings and "משותף" on one home system, the home-system floors named by the installation convention
 * ("א · קומה 1"), every floor mapped through layer-1 rows (SYNOPTIC-HA-2310), one platform floor left unmapped ("לא משויך").
 * `?mb=alarm` adds a triggered alarm in building ג. All numbers are made up and deterministic.
 */
import type { DeviceArea, DeviceCounts, DeviceFloor, DeviceTree } from '../api/devices';
import type { Building, Floor } from '../api/types';
import type { MatchLinks } from '../xsection/xs-model';
import { sumCounts } from '../api/home-site';

const ZERO: DeviceCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };

interface DemoBuildingSpec { id: string; code: string; name: string; shared?: boolean; floors: { level: number; name: string; areas: string[] }[] }

const ROOMS = ['לובי', 'מסדרון', 'משרדים', 'חדר ישיבות', 'מטבחון', 'ארכיון', 'חדר שרתים', 'מרחבים'];
const tower = (n: number): DemoBuildingSpec['floors'] => Array.from({ length: n }, (_, i) => ({ level: i, name: i === 0 ? 'קרקע' : `קומה ${i}`, areas: i === 0 ? ['לובי', 'מסדרון'] : [ROOMS[(i * 3) % ROOMS.length], ROOMS[(i * 3 + 2) % ROOMS.length]] }));

export const DEMO_SITE_SPEC: DemoBuildingSpec[] = [
  { id: 'bA', code: 'א', name: 'בניין א', floors: tower(8) },
  { id: 'bB', code: 'ב', name: 'בניין ב', floors: tower(6) },
  { id: 'bC', code: 'ג', name: 'בניין ג', floors: tower(5) },
  { id: 'bD', code: 'ד', name: 'בניין ד', floors: tower(3) },
  { id: 'bS', code: 'מ', name: 'משותף', shared: true, floors: [{ level: 0, name: 'גינה ושער', areas: ['גינה', 'שער רכב'] }, { level: -1, name: 'חניון -1', areas: ['חניון -1'] }, { level: -2, name: 'חניון -2', areas: ['חניון -2', 'חדר חשמל ראשי'] }] },
];

export interface DemoSite { tree: DeviceTree; buildings: (Building & { floors: Floor[] })[]; links: MatchLinks; siteName: string }

/** A small deterministic spread (no Math.random: the evidence screenshots must not move). */
function n(seed: number, mod: number): number {
  return ((seed * 7919 + 13) % 104729) % mod;
}

export function demoSite(mode: string, base: DeviceTree): DemoSite {
  const floors: DeviceFloor[] = [];
  const buildings: DemoSite['buildings'] = [];
  const links: MatchLinks = { floors: [], areas: [] };
  let seed = 1;
  const area = (fid: string, b: DemoBuildingSpec, name: string, alarm: string | null): DeviceArea => {
    seed += 1;
    const lights = 2 + n(seed, 7);
    const covers = n(seed + 3, 4);
    const climate = 1 + n(seed + 5, 2);
    const c: DeviceCounts = { ...ZERO, entities: lights + covers + climate + 3, lights, lights_on: n(seed + 1, lights + 1), switches: 1 + n(seed + 2, 3), switches_on: n(seed + 4, 2), covers, covers_open: n(seed + 6, covers + 1), climate, climate_active: n(seed + 7, climate + 1), locks: n(seed + 8, 2), locks_locked: 0, sensors: 2, cameras: n(seed + 9, 2), alarm };
    c.locks_locked = c.locks;
    const label = `${name} · ${b.code}`;
    return { area_id: `${fid}_${seed}`, name: label, icon: null, floor_id: fid, has_camera: c.cameras > 0, can_bulk: true, counts: c, temperature: 22 + n(seed, 5), open_count: 0, climate: [{ entity_id: `climate.${fid}_${seed}`, name: `מזגן ${label}`, area_name: label, hvac_mode: c.climate_active ? 'cool' : 'off', hvac_action: c.climate_active ? 'cooling' : 'off', current_temperature: 24, target_temperature: c.climate_active ? 23 : null, unit: '°C', available: true }] };
  };
  for (const [bi, b] of DEMO_SITE_SPEC.entries()) {
    const ours: Floor[] = [];
    for (const [fi, f] of b.floors.entries()) {
      const fid = `${b.id}_f${fi}`;
      const hid = `ha_${b.id}_${fi}`;
      const alarm = mode === 'alarm' && b.id === 'bC' && fi === 3 ? 'triggered' : null;
      const areas = f.areas.map((r, i) => area(hid, b, r, i === 0 ? alarm : null));
      floors.push({ floor_id: hid, name: `${b.code} · ${f.name}`, level: f.level, icon: null, areas, counts: sumCounts(areas.map((a) => a.counts)), climate: areas.flatMap((a) => a.climate ?? []), can_bulk: true });
      ours.push({ id: fid, building_id: b.id, name: f.name, level: f.level, sort_order: fi, ha_area_id: null, has_plan: false, published_version_id: null, plan_width_px: null, plan_height_px: null, draft_version_id: null, anchor_count: 0, camera_count: 0, updated_at: '' });
      links.floors.push({ ha_floor_id: hid, floor_id: fid });
    }
    buildings.push({ id: b.id, site_id: 'site1', name: b.name, sort_order: bi, updated_at: '', is_shared: !!b.shared, floors: ours });
  }
  // a platform floor nobody mapped yet: "לא משויך"
  const loose = area('ha_new', { id: 'x', code: 'ה', name: '', floors: [] }, 'קומה 1', null);
  floors.push({ floor_id: 'ha_new', name: 'ה · קומה 1', level: 1, icon: null, areas: [loose], counts: loose.counts, climate: [], can_bulk: true });
  const building = sumCounts(floors.map((f) => f.counts));
  building.alarm = mode === 'alarm' ? 'triggered' : 'armed_away';
  const tree: DeviceTree = { ...base, floors, building, building_climate: floors.flatMap((f) => f.climate), unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: { ...ZERO } }, can_bulk: true, scoped: false };
  return { tree, buildings, links, siteName: 'מתחם הגפן' };
}
