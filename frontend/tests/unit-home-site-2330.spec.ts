import { test, expect } from '@playwright/test';
import { activeOff, bulkTargets, entryLevel, floorBars, offSelection, scopeTag, scopeTree, sectionLevels, shownBuildings, siteModel, SITE_LEVEL } from '../src/api/home-site';
import { demoSite, DEMO_SITE_SPEC } from '../src/screens/home-site-demo';
import type { DeviceCounts, DeviceTree } from '../src/api/devices';
import type { Building, Floor } from '../src/api/types';

// MULTIBUILDING-HOME-2330: the home screen's site level - grouping by building, scoping, the entry rule, the all-off selection and
// the shared building's default.
//   npx playwright test -c playwright.unit.config.ts tests/unit-home-site-2330.spec.ts

const ZERO: DeviceCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };
const BASE: DeviceTree = { floors: [], unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: ZERO }, building: ZERO, building_climate: [], scoped: false, sync: { connected: true, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 0, entities: 0, started_at: null, ha_version: null } };
const fl = (id: string, building: string, name: string, level: number): Floor => ({ id, building_id: building, name, level, sort_order: 0, ha_area_id: null, has_plan: false, published_version_id: null, plan_width_px: null, plan_height_px: null, draft_version_id: null, anchor_count: 0, camera_count: 0, updated_at: '' });
const bld = (id: string, floors: Floor[], shared = false): Building & { floors: Floor[] } => ({ id, site_id: 's', name: id, sort_order: 0, updated_at: '', is_shared: shared, floors });

const demo = () => demoSite('', BASE);

test('the demo site groups every mapped area under its building, the shared one last, the unmapped floor apart', () => {
  const d = demo();
  const m = siteModel(d.buildings, d.tree, d.links, d.siteName)!;
  expect(m.buildings.map((b) => b.name)).toEqual(['בניין א', 'בניין ב', 'בניין ג', 'בניין ד', 'משותף']);
  expect(m.buildings.at(-1)!.shared).toBe(true);
  for (const [i, spec] of DEMO_SITE_SPEC.entries()) expect(m.buildings[i].floors.length).toBe(spec.floors.length);
  // each building's areas carry its code (the convention) and nothing leaks between buildings
  for (const b of m.buildings) {
    const code = DEMO_SITE_SPEC.find((s) => s.id === b.id)!.code;
    for (const f of b.floors) for (const a of f.areas) expect(a.name.endsWith(`· ${code}`)).toBe(true);
  }
  expect(m.unassigned.map((a) => a.name)).toEqual(['קומה 1 · ה']);
  // our floors, top first
  expect(m.buildings[0].floors.map((f) => f.name)).toEqual(['קומה 7', 'קומה 6', 'קומה 5', 'קומה 4', 'קומה 3', 'קומה 2', 'קומה 1', 'קרקע']);
  // the site counts add up to the tree minus the unmapped area
  const lights = m.buildings.reduce((s, b) => s + b.counts.lights, 0);
  expect(lights + m.unassigned.reduce((s, a) => s + a.counts.lights, 0)).toBe(d.tree.building.lights);
});

test('one building, or no mapping at all, is the unchanged home (no site model)', () => {
  const d = demo();
  expect(siteModel(d.buildings.slice(0, 1), d.tree, d.links)).toBeNull();
  expect(siteModel(d.buildings, d.tree, { floors: [], areas: [] })).toBeNull(); // a multi-building site never guesses by name / level
  expect(siteModel(d.buildings, null, d.links)).toBeNull();
});

test('a user who sees one building only gets no site level', () => {
  const d = demo();
  const only = d.buildings.filter((b) => b.id === 'bB');
  expect(siteModel(only, d.tree, d.links)).toBeNull();
});

test('map placement wins over the floor row; an area row takes an area off', () => {
  const tree: DeviceTree = { ...BASE, floors: [{ floor_id: 'h1', name: 'א · 1', level: 1, icon: null, climate: [], counts: ZERO, can_bulk: true, areas: [
    { area_id: 'x', name: 'x', icon: null, floor_id: 'h1', has_camera: false, can_bulk: true, counts: { ...ZERO, lights: 1 } },
    { area_id: 'y', name: 'y', icon: null, floor_id: 'h1', has_camera: false, counts: { ...ZERO, lights: 2 }, map: { floor_id: 'b1', zone_id: 'z' } },
    { area_id: 'z', name: 'z', icon: null, floor_id: 'h1', has_camera: false, counts: { ...ZERO, lights: 4 } },
  ] }] };
  const buildings = [bld('A', [fl('a1', 'A', 'קומה 1', 1)]), bld('B', [fl('b1', 'B', 'קומה 1', 1)])];
  const m = siteModel(buildings, tree, { floors: [{ ha_floor_id: 'h1', floor_id: 'a1' }], areas: [{ area_id: 'z', floor_id: null }] })!;
  expect([...m.buildings[0].areaIds]).toEqual(['x']);
  expect([...m.buildings[1].areaIds]).toEqual(['y']);
  expect(m.unassigned.map((a) => a.area_id)).toEqual(['z']);
  // the split platform floor: scoped to A it keeps x only, loses the floor-wide bulk, and turns off through its area
  const a = scopeTree(tree, m.buildings[0]);
  expect(a.floors[0].areas.map((x) => x.area_id)).toEqual(['x']);
  expect(a.floors[0].can_bulk).toBe(false);
  expect(a.floors[0].name).toBe('קומה 1'); // our floor's name, not the platform's
  expect(a.building.lights).toBe(1);
  expect(a.can_bulk).toBe(false); // the installation-wide bulk is never offered inside a building
  expect(bulkTargets(tree, m.buildings[0])).toEqual([{ scope: 'area', id: 'x', name: 'x', building: 'A' }]);
});

test('scoping the demo to one building keeps only its floors and adds its counts', () => {
  const d = demo();
  const m = siteModel(d.buildings, d.tree, d.links)!;
  const b = m.buildings[3];
  const t = scopeTree(d.tree, b);
  expect(t.floors.length).toBe(3);
  expect(t.floors.map((f) => f.name)).toEqual(['קרקע', 'קומה 1', 'קומה 2']);
  expect(t.building.lights_on).toBe(b.counts.lights_on);
  expect(t.building_climate.every((c) => b.floors.some((f) => f.areas.some((a) => a.name === c.area_name)))).toBe(true);
  // whole platform floors: one floor request each
  expect(bulkTargets(d.tree, b).map((x) => x.scope)).toEqual(['floor', 'floor', 'floor']);
});

test('the entry rule: installation default, the user override, a vanished building falls back to the site', () => {
  const ids = ['A', 'B', 'S'];
  expect(entryLevel({ site: 'site', siteBuilding: '', last: 'B', buildings: ids })).toBe(SITE_LEVEL);
  expect(entryLevel({ site: 'last', siteBuilding: '', last: 'B', buildings: ids })).toBe('B');
  expect(entryLevel({ site: 'last', siteBuilding: '', last: null, buildings: ids })).toBe(SITE_LEVEL);
  expect(entryLevel({ site: 'fixed', siteBuilding: 'A', last: 'B', buildings: ids })).toBe('A');
  expect(entryLevel({ site: 'fixed', siteBuilding: 'gone', last: 'B', buildings: ids })).toBe(SITE_LEVEL);
  expect(entryLevel({ site: 'site', siteBuilding: '', personal: { site_entry: 'last' }, last: 'S', buildings: ids })).toBe('S');
  expect(entryLevel({ site: 'last', siteBuilding: '', personal: { site_entry: 'site' }, last: 'B', buildings: ids })).toBe(SITE_LEVEL);
  expect(entryLevel({ site: 'fixed', siteBuilding: 'A', personal: { site_entry: 'fixed', site_entry_building: 'B' }, last: null, buildings: ids })).toBe('B');
  // a user who hides the shared building never enters it
  expect(entryLevel({ site: 'last', siteBuilding: '', last: 'S', buildings: ['A', 'B'] })).toBe(SITE_LEVEL);
});

test('all-off selection: every building checked, the shared one only when the installation includes it', () => {
  const bs = [{ id: 'A', shared: false }, { id: 'B', shared: false }, { id: 'S', shared: true }];
  expect(offSelection(bs, false)).toEqual({ A: true, B: true, S: false });
  expect(offSelection(bs, true)).toEqual({ A: true, B: true, S: true });
});

test('hide shared, the scope tag, the bars and the cross-section levels', () => {
  const d = demo();
  const m = siteModel(d.buildings, d.tree, d.links)!;
  expect(shownBuildings(m, true).some((b) => b.shared)).toBe(false);
  expect(shownBuildings(m, false).length).toBe(5);
  expect(scopeTag(null, SITE_LEVEL)).toBe('');
  expect(scopeTag(m, SITE_LEVEL)).toBe('אתר');
  expect(scopeTag(m, 'bA')).toBe('בניין א');
  const bars = floorBars(m.buildings[0]);
  expect(bars.length).toBe(8);
  expect(bars.every((x) => x.ratio >= 0 && x.ratio <= 1)).toBe(true);
  expect(sectionLevels(m.buildings)).toEqual([7, 6, 5, 4, 3, 2, 1, 0, -1, -2]);
  expect(activeOff({ ...ZERO, lights_on: 2, covers_open: 1, media_on: 1 })).toBe(4);
});

test('an alarm in building ג is an alert of that building only', () => {
  const d = demoSite('alarm', BASE);
  const m = siteModel(d.buildings, d.tree, d.links)!;
  expect(m.buildings.map((b) => b.alerts.length)).toEqual([0, 0, 1, 0, 0]);
  expect(m.buildings[2].counts.alarm).toBe('triggered');
  expect(floorBars(m.buildings[2]).filter((x) => x.alert).map((x) => x.name)).toEqual(['קומה 3']);
});
