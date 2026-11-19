import { test } from '@playwright/test';
import { matchFloors, type MatchContext, type MatchFloor, type MatchLinks } from '../src/xsection/xs-model';
import type { DeviceArea, DeviceCounts, DeviceFloor, DeviceTree } from '../src/api/devices';
import { expectRecorded } from './cx-record';

// CR-FE-COMPLEXITY-2450: characterisation of matchFloors (xsection/xs-model.ts) before its split. Sets of our floors x platform trees x
// mapping rows / building counts; the answers (areas by id: the area objects are the tree's own) must equal the record taken from the
// unsplit function (tests/fixtures/cx/match-floors.json). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-match-floors-2450.spec.ts --workers=1

const ZERO: DeviceCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };
const area = (id: string, floor: string | null, map?: string): DeviceArea => ({ area_id: id, name: id, icon: null, floor_id: floor, counts: ZERO, has_camera: false, ...(map ? { map: { floor_id: map } as DeviceArea['map'] } : {}) });
const haFloor = (id: string, name: string, level: number | null, areas: DeviceArea[]): DeviceFloor => ({ floor_id: id, name, level, icon: null, areas, counts: ZERO, climate: [] });
const tree = (floors: DeviceFloor[]): DeviceTree => ({ floors, unassigned: { area_id: 'unassigned', name: 'x', counts: ZERO }, building: ZERO, building_climate: [], scoped: false, sync: { connected: true } as DeviceTree['sync'] });
const cat = (id: string, name: string, level: number): MatchFloor => ({ id, name, level });
const links = (floors: [string, string][] = [], areas: [string, string | null][] = []): MatchLinks => ({ floors: floors.map(([ha_floor_id, floor_id]) => ({ ha_floor_id, floor_id })), areas: areas.map(([area_id, floor_id]) => ({ area_id, floor_id })) });

const TREES: Array<[string, DeviceTree | null]> = [
  ['null', null],
  ['owner', tree([
    haFloor('ground_floor', 'Ground floor', 0, [area('lobby', 'ground_floor'), area('kitchen', 'ground_floor', 'c1'), area('salon', 'ground_floor')]),
    haFloor('parking_1', 'Parking A', -1, [area('parking_a', 'parking_1'), area('storage', 'parking_1')]),
    haFloor('parking_2', 'Parking B', -2, [area('parking_b', 'parking_2', 'c2'), area('lobby', 'parking_2')]),
    haFloor('none', 'ללא קומה', null, [area('roof', null), area('yard', null, 'c0')]),
  ])],
  ['twins', tree([haFloor('a0', 'A · קרקע', 0, [area('a1', 'a0')]), haFloor('b0', 'B · קרקע', 0, [area('b1', 'b0')]), haFloor('top', 'גג', null, [area('t1', 'top')])])],
  ['names', tree([
    haFloor('h1', 'קומה_ראשונה', null, [area('n1', 'h1')]), haFloor('h2', ' Second-Floor ', 7, [area('n2', 'h2')]), haFloor('h3', 'קומה ‏שלישית', null, [area('n3', 'h3'), area('n4', 'h3')]),
    haFloor('h4', 'כפול', null, [area('n5', 'h4')]), haFloor('h5', 'כפול', null, [area('n6', 'h5')]),
  ])],
  ['map-votes', tree([
    haFloor('v1', 'X', 5, [area('m1', 'v1', 'c0'), area('m2', 'v1', 'c0'), area('m3', 'v1', 'k')]), haFloor('v2', 'Y', 6, [area('m4', 'v2', 'c0'), area('m5', 'v2', 'c1')]),
    haFloor('v3', 'Z', 6, [area('m6', 'v3', 'c1')]),
  ])],
  ['empty', tree([])],
];
const FLOORSETS: Array<[string, MatchFloor[]]> = [
  ['owner', [cat('c0', 'קרקע', 0), cat('c1', 'קומה -1', -1), cat('c2', 'קומה -2', -2)]],
  ['same-level', [cat('c0', 'קרקע', 0), cat('g', 'גלריה', 0), cat('c1', 'Parking A', -1)]],
  ['by-name', [cat('c0', 'קומה ראשונה', 1), cat('c1', 'second floor', 2), cat('c2', 'קומה שלישית', 3), cat('k', 'כפול', 4), cat('e', '', 9), cat('ab', 'A · קרקע', 0)]],
  ['votes', [cat('c0', 'אחת', 10), cat('c1', 'שתיים', 11), cat('k', 'שלוש', 12)]],
  ['none', []],
];
const CTXS: Array<[string, MatchContext]> = [
  ['default', {}],
  ['multi', { singleBuilding: false }],
  ['rows', { links: links([['ground_floor', 'c1'], ['parking_2', 'c2'], ['gone', 'c0'], ['h2', 'c0'], ['v1', 'zz']], [['lobby', 'c0'], ['salon', null], ['storage', 'c2'], ['ghost', 'c1'], ['m5', 'c0'], ['n1', 'k']]) }],
  ['rows-multi', { singleBuilding: false, links: links([['a0', 'c0'], ['h3', 'c2']], [['b1', 'c0'], ['n2', null]]) }],
  ['null-links', { links: null }],
];

const view = (m: ReturnType<typeof matchFloors>) =>
  [...m.entries()].map(([fid, x]) => ({
    fid, haFloors: x.haFloors, how: x.how, suggestion: x.suggestion, ambiguous: x.ambiguous, missing: x.missing,
    areas: x.areas.map((a) => [a.area.area_id, a.haFloorId, a.source]), excluded: x.excluded.map((e) => [e.area.area_id, e.to]),
  }));

test('matchFloors: every answer equals the record of the unsplit function', () => {
  const out = TREES.flatMap(([t, tr]) => FLOORSETS.flatMap(([f, floors]) => CTXS.map(([c, ctx]) => ({ t, f, c, match: view(matchFloors(floors, tr, ctx)) }))));
  expectRecorded('match-floors', out);
});
