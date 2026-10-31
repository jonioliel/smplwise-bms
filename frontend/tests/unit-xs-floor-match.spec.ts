import { test, expect } from '@playwright/test';
import { matchFloors, signalsOf, areasOfFloor, type MatchFloor, type MatchLinks } from '../src/xsection/xs-model';
import type { DeviceArea, DeviceCounts, DeviceFloor, DeviceTree } from '../src/api/devices';
import type { Floor } from '../src/api/types';

// SYNOPTIC-HA-2310: which home-system floor and areas one of our floors stands for. The owner's case: our floors "קרקע", "קומה -1",
// "קומה -2" against home-system floors with other names - the synoptic map showed "no data" everywhere although every home-system floor
// had areas. The layers of PROPOSAL-MULTI-BUILDING-HOME: 3 map placement > 2 per-area row > 1 platform-floor row > automatic (level only
// with ONE platform floor at that level on a one-building site; exact name) > suggestion (confirmed by the user, never applied) > none.

const ZERO: DeviceCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };

const area = (id: string, floor: string | null, extra: Partial<DeviceArea> = {}): DeviceArea => ({ area_id: id, name: id, icon: null, floor_id: floor, counts: { ...ZERO, lights: 2, lights_on: 1 }, has_camera: false, temperature: 22, open_count: 0, ...extra });
const haFloor = (id: string, name: string, level: number | null, areas: DeviceArea[]): DeviceFloor => ({ floor_id: id, name, level, icon: null, areas, counts: ZERO, climate: [] });
const tree = (floors: DeviceFloor[]): DeviceTree => ({ floors, unassigned: { area_id: 'unassigned', name: 'x', counts: ZERO }, building: ZERO, building_climate: [], scoped: false, sync: { connected: true } as DeviceTree['sync'] });
const cat = (id: string, name: string, level: number): MatchFloor => ({ id, name, level });
const ids = (m: ReturnType<typeof matchFloors>, f: string) => m.get(f)!.areas.map((a) => a.area.area_id).sort();
const links = (floors: [string, string][] = [], areas: [string, string | null][] = []): MatchLinks => ({ floors: floors.map(([ha_floor_id, floor_id]) => ({ ha_floor_id, floor_id })), areas: areas.map(([area_id, floor_id]) => ({ area_id, floor_id })) });
const full = (f: MatchFloor, i = 0): Floor => ({ ...f, building_id: 'b', sort_order: i, ha_area_id: null, has_plan: true, published_version_id: null, plan_width_px: null, plan_height_px: null, draft_version_id: null, anchor_count: 0, camera_count: 0, updated_at: '' });

const OWNER = tree([
  haFloor('ground_floor', 'Ground floor', 0, [area('lobby', 'ground_floor'), area('kitchen', 'ground_floor'), area('salon', 'ground_floor')]),
  haFloor('parking_1', 'Parking A', -1, [area('parking_a', 'parking_1'), area('storage', 'parking_1')]),
  haFloor('parking_2', 'Parking B', -2, [area('parking_b', 'parking_2')]),
  haFloor('none', 'ללא קומה', null, [area('roof', null)]),
]);
const OWNER_FLOORS = [cat('c0', 'קרקע', 0), cat('c1', 'קומה -1', -1), cat('c2', 'קומה -2', -2)];

test('level match on a one-building site when the names differ, and ALL areas of the home-system floor count', () => {
  const m = matchFloors(OWNER_FLOORS, OWNER);
  expect(m.get('c0')).toMatchObject({ haFloors: [{ id: 'ground_floor', name: 'Ground floor' }], how: 'level', ambiguous: false, suggestion: null });
  expect(ids(m, 'c0')).toEqual(['kitchen', 'lobby', 'salon']);
  expect(ids(m, 'c1')).toEqual(['parking_a', 'storage']);
  expect(ids(m, 'c2')).toEqual(['parking_b']);
  expect(m.get('c0')!.areas.every((a) => a.source === 'level')).toBe(true);
});

test('the owner case: the synoptic signals carry data on every floor (was "no data" everywhere)', () => {
  const sigs = signalsOf(OWNER_FLOORS.map(full), OWNER, null);
  expect(sigs.map((s) => s.nodata)).toEqual([false, false, false]);
  expect(sigs[0]).toMatchObject({ id: 'c0', lit: 3, lights: 6, temp: 22 });
  expect(sigs[0].match?.how).toBe('level');
});

test('several buildings on the site: the same level is only a SUGGESTION, never applied', () => {
  const m = matchFloors(OWNER_FLOORS, OWNER, { singleBuilding: false });
  expect(m.get('c0')).toMatchObject({ haFloors: [], how: null, suggestion: { haFloorId: 'ground_floor', why: 'level' } });
  expect(ids(m, 'c0')).toEqual([]);
  expect(signalsOf(OWNER_FLOORS.map(full), OWNER, null, { singleBuilding: false }).every((s) => s.nodata)).toBe(true);
});

test('two home-system floors at one level (one per building): no guess, flagged ambiguous, no suggestion', () => {
  const t = tree([haFloor('a0', 'A · קרקע', 0, [area('a1', 'a0')]), haFloor('b0', 'B · קרקע', 0, [area('b1', 'b0')])]);
  const m = matchFloors([cat('c0', 'קומת קרקע', 0)], t);
  expect(m.get('c0')).toMatchObject({ haFloors: [], how: null, ambiguous: true, suggestion: null });
});

test('two of our floors at one level: no guess for either', () => {
  const m = matchFloors([cat('c0', 'קרקע', 0), cat('g', 'גלריה', 0)], OWNER);
  expect(m.get('c0')!.how).toBeNull();
  expect(m.get('g')!.how).toBeNull();
  expect(m.get('c0')!.ambiguous).toBe(true);
});

test('the platform-floor row beats the automatic rules, and a floor it names is no longer free for another floor', () => {
  const m = matchFloors(OWNER_FLOORS, OWNER, { links: links([['parking_1', 'c0']]) });
  expect(m.get('c0')).toMatchObject({ haFloors: [{ id: 'parking_1', name: 'Parking A' }], how: 'link' });
  expect(ids(m, 'c0')).toEqual(['parking_a', 'storage']);
  expect(m.get('c1')!.haFloors).toEqual([]); // its level twin is taken by the row
});

test('several home-system floors may point at one of our floors (one row each)', () => {
  const m = matchFloors(OWNER_FLOORS, OWNER, { links: links([['parking_1', 'c1'], ['parking_2', 'c1']]) });
  expect(m.get('c1')!.haFloors.map((h) => h.id).sort()).toEqual(['parking_1', 'parking_2']);
  expect(ids(m, 'c1')).toEqual(['parking_a', 'parking_b', 'storage']);
  expect(ids(m, 'c2')).toEqual([]);
});

test('a row of a home-system floor on ANOTHER building keeps it out of this building', () => {
  const m = matchFloors(OWNER_FLOORS, OWNER, { links: links([['ground_floor', 'other-building-floor']]) });
  expect(m.get('c0')!.haFloors).toEqual([]);
  expect(ids(m, 'c0')).toEqual([]);
});

test('a row pointing at a home-system floor that disappeared: reported missing, the automatic rule takes over', () => {
  const m = matchFloors(OWNER_FLOORS, OWNER, { links: links([['gone', 'c0']]) });
  expect(m.get('c0')).toMatchObject({ how: 'level', missing: ['gone'] });
});

test('per-area rows: include moves the area here; null takes it off ("unassigned"); the floor it left lists it as excluded', () => {
  const m = matchFloors(OWNER_FLOORS, OWNER, { links: links([], [['storage', 'c0'], ['roof', 'c0'], ['kitchen', null]]) });
  expect(ids(m, 'c0')).toEqual(['lobby', 'roof', 'salon', 'storage']);
  expect(m.get('c0')!.areas.find((a) => a.area.area_id === 'storage')!.source).toBe('manual');
  expect(m.get('c0')!.excluded.map((x) => [x.area.area_id, x.to])).toEqual([['kitchen', null]]);
  expect(ids(m, 'c1')).toEqual(['parking_a']);
  expect(m.get('c1')!.excluded.map((x) => [x.area.area_id, x.to])).toEqual([['storage', 'c0']]);
});

test('map placement wins over the per-area row and the floor row', () => {
  const t = tree([haFloor('ground_floor', 'Ground', 0, [area('lobby', 'ground_floor', { map: { floor_id: 'c1', zone_id: 'z' } }), area('hall', 'ground_floor')])]);
  const m = matchFloors([cat('c0', 'קרקע', 0), cat('c1', 'קומה 1', 1)], t, { links: links([['ground_floor', 'c0']], [['lobby', 'c0']]) });
  expect(m.get('c1')!.areas.map((a) => [a.area.area_id, a.source])).toEqual([['lobby', 'map']]);
  expect(ids(m, 'c0')).toEqual(['hall']);
});

test('map placement makes a suggestion for the floor, never a silent match', () => {
  const t = tree([haFloor('x', 'X', 7, [area('x1', 'x', { map: { floor_id: 'c1', zone_id: 'z' } }), area('x2', 'x')])]);
  const m = matchFloors([cat('c1', 'קומה 1', 1)], t);
  expect(m.get('c1')).toMatchObject({ haFloors: [], how: null, suggestion: { haFloorId: 'x', why: 'map' } });
  expect(ids(m, 'c1')).toEqual(['x1']); // only the placed area itself (layer 3)
});

test('name: exact normalized equality only (marks, spaces, dashes folded); never a substring', () => {
  const t = tree([haFloor('p', 'קומה ‎-1', null, [area('p1', 'p')]), haFloor('q', 'קומה 2 צפון', null, [area('q1', 'q')])]);
  const m = matchFloors([cat('c1', 'קומה-1', 5), cat('c2', 'קומה 2', 6)], t);
  expect(m.get('c1')).toMatchObject({ haFloors: [{ id: 'p' }], how: 'name' });
  expect(m.get('c2')!.how).toBeNull();
  // on a site of several buildings the same name is offered, not applied
  expect(matchFloors([cat('c1', 'קומה-1', 5)], t, { singleBuilding: false }).get('c1')).toMatchObject({ how: null, suggestion: { haFloorId: 'p', why: 'name' } });
});

test('no match: nothing at that level or name - empty, not ambiguous, no data', () => {
  const m = matchFloors([cat('c9', 'קומה 9', 9)], OWNER);
  expect(m.get('c9')).toMatchObject({ haFloors: [], how: null, ambiguous: false, suggestion: null, areas: [] });
  expect(signalsOf([full(cat('c9', 'קומה 9', 9))], OWNER, null)[0].nodata).toBe(true);
});

test('no tree (no permission / platform off): no match; a lone floor still resolves through areasOfFloor', () => {
  expect(matchFloors(OWNER_FLOORS, null).size).toBe(0);
  expect(areasOfFloor(cat('c0', 'קרקע', 0), OWNER).areas.map((a) => a.area_id).sort()).toEqual(['kitchen', 'lobby', 'salon']);
});
