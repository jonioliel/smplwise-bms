import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrimitives, type CatalogLookup, type GeometryDoc, type ObjectShape } from '../src/map/geometry';
import type { CatalogItem } from '../src/api/plan-catalog';
import { expectRecorded } from './cx-record';

// CR-FE-COMPLEXITY-2450: characterisation of buildPrimitives (map/geometry.ts) before its split. The shared plan fixtures plus one document
// of edge cases (duplicate / zero-length / shared walls, an opening on a missing wall, short connectors, capped tribune rows, objects the
// catalogue does not know) go through every level filter, with and without the catalogue; the answers must equal the record taken from the
// unsplit function (tests/fixtures/cx/build-primitives.json). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-build-primitives-2450.spec.ts --workers=1

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const CATALOG = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json');
const load = (name: string) => JSON.parse(fs.readFileSync(path.join(FIX, `${name}.json`), 'utf8')) as GeometryDoc;
const catalogItems = new Map((JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as { items: CatalogItem[] }).items.map((i) => [i.id, i]));
const lookup: CatalogLookup = (id) => {
  const i = catalogItems.get(id);
  return i ? { shape: i.shape as ObjectShape, icon: i.icon, color_token: i.color_token } : undefined;
};
const SHARED = { zone_id: 'z1', home_floor_id: 'f2' };
const odd: CatalogLookup = (id) => (id === 'chair.basic' ? { shape: 'nope' as ObjectShape, icon: 'nope', color_token: 'nope' } : lookup(id));

function edgeDoc(): GeometryDoc {
  const v2 = load('sample-v2');
  const [w0] = v2.walls;
  const [o0] = v2.openings;
  const [ob] = v2.objects;
  const [c0] = v2.connectors;
  const [l0] = v2.labels;
  return {
    ...v2,
    walls: [
      ...v2.walls,
      { ...w0, id: 'wc', polyline: [[0.05, 0.05], [0.05, 0.95]], thickness_m: 0 }, // duplicate id: the last one wins
      { ...w0, id: 'wz', polyline: [[0.3, 0.3], [0.3, 0.3]] },
      { ...w0, id: 'ws', level_id: 'L1', shared: SHARED, polyline: [[0.2, 0.9], [0.9, 0.9], [0.9, 0.6]] },
      { ...w0, id: 'wg', kind: 'glass', polyline: [[0.1, 0.6], [0.5, 0.6]], thickness_m: 0.15 },
      { ...w0, id: 'wb2', polyline: [[0.1, 0.2], [0.5, 0.2], [0.5, 0.4]], bulges: [0.4, -0.2] },
      { ...w0, id: 'wbg', kind: 'glass', polyline: [[0.6, 0.6], [0.9, 0.6]], bulges: [0.3] },
    ],
    openings: [
      ...v2.openings,
      { ...o0, id: 'om', wall_id: 'missing' },
      { ...o0, id: 'og1', wall_id: 'wg', kind: 'window', t: 0.3, width_m: 0.8 },
      { ...o0, id: 'og2', wall_id: 'wg', kind: 'door', t: 0, width_m: 0.9, swing: 'double', hinge: 'end' },
      { ...o0, id: 'ob1', wall_id: 'wb2', kind: 'door', t: 0.5, width_m: 0.9, swing: 'left', hinge: 'start' },
      { ...o0, id: 'ob2', wall_id: 'wbg', kind: 'window', t: 0.95, width_m: 1.5 },
      { ...o0, id: 'ob3', wall_id: 'wbg', kind: 'passage', t: 0.2, width_m: 0 },
      { ...o0, id: 'oz', wall_id: 'wz', kind: 'door' },
    ],
    labels: [...v2.labels, { ...l0, id: 'l-shared', level_id: 'L0', shared: SHARED }, { ...l0, id: 'l-empty', text: undefined as never, size: 0 }],
    connectors: [
      ...v2.connectors,
      { ...c0, id: 'c-short', polyline: [[0.5, 0.5]] },
      { ...c0, id: 'c-zero', polyline: [[0.5, 0.5], [0.5, 0.5]] },
      { ...c0, id: 'c-tiny', polyline: [[0.5, 0.5], [0.505, 0.5]], kind: '' as never, width_m: 0, level_to: undefined as never },
      { ...c0, id: 'c-bend', polyline: [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4]], kind: 'ramp', level_to: null },
    ],
    circuits: [...v2.circuits, { ...v2.circuits[0], id: 'k0', member_ids: ['o3', 'o1'] }],
    objects: [
      ...v2.objects,
      { ...ob, id: 'x-rows', item_id: 'tribune.stepped', params: { rows: 200 }, rotation_deg: 30, size: { w_m: 4, d_m: 3, h_m: 1 } },
      { ...ob, id: 'x-rows1', item_id: 'tribune.stepped', params: { rows: 1 } },
      { ...ob, id: 'x-rowsf', item_id: 'tribune.stepped', params: { rows: 2.5 } },
      { ...ob, id: 'x-unknown', item_id: 'not.in.catalog', size: undefined as never, rotation_deg: undefined as never, label: 'שלט' },
      { ...ob, id: 'x-anchor', anchor_ref: { resource_type: 'camera', resource_id: 'cam1' } as never, level_id: 'L1' },
      { ...ob, id: 'x-anchor0', anchor_ref: { resource_type: 'camera', resource_id: '' } as never, item_id: undefined as never },
      { ...ob, id: 'x-shared', level_id: 'L1', shared: SHARED },
    ],
  };
}

const DOCS: Array<[string, () => GeometryDoc]> = [
  ['sample-v2', () => load('sample-v2')], ['sample-v22', () => load('sample-v22')], ['sample-v2-glass', () => load('sample-v2-glass')],
  ['sample-curved', () => load('sample-curved')], ['edge', edgeDoc],
];
// every level filter with the catalogue at the fixtures' size; the whole document also without / with an odd catalogue and at another size
const RUNS: Array<[string | null, string, CatalogLookup | undefined, number, number]> = [
  [null, 'catalog', lookup, 1000, 800], ['L0', 'catalog', lookup, 1000, 800], ['L1', 'catalog', lookup, 1000, 800], ['none', 'catalog', lookup, 1000, 800],
  [null, 'none', undefined, 1000, 800], [null, 'odd', odd, 1000, 800], [null, 'catalog', lookup, 1600, 900],
];

test('buildPrimitives: every answer equals the record of the unsplit function', () => {
  const out = DOCS.flatMap(([doc, make]) => RUNS.map(([level, cat, fn, w, h]) => ({ doc, level, cat, w, h, prims: buildPrimitives(make(), w, h, level, fn) })));
  expectRecorded('build-primitives', out);
});
