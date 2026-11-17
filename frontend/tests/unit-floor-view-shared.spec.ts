import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fallbackLevelId, hoverLabelsOf, isTypingTarget, libraryLookups, readPlanImage, sceneZonesOf, stateLampsOf, stateRoomsOf, writePlanImage, defaultViewIs3d } from '../src/map/floor-view-shared';
import { stateEntitiesOf } from '../src/map/state-facts';
import type { CatalogLibrary } from '../src/api/plan-catalog';
import type { GeometryDoc } from '../src/map/geometry';

// CR-MAP-SHARED-2440 (code review 06:DUP-9): the pieces the live floor map, the historical map and the plan editor wrote
// two or three times each are one definition in map/floor-view-shared.ts. Each test pins the shared piece to the text it
// replaced, so the three screens keep exactly the behaviour they had.

const src = (name: string) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'screens', name), 'utf8');

test('a key belongs to a field: input, textarea, select and editable nodes only', () => {
  const g = globalThis as unknown as { HTMLElement?: unknown };
  const before = g.HTMLElement;
  class FakeElement {
    constructor(public tagName: string, public isContentEditable = false) {}
  }
  g.HTMLElement = FakeElement;
  try {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) expect(isTypingTarget(new FakeElement(tag) as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget(new FakeElement('DIV', true) as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget(new FakeElement('DIV') as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget(new FakeElement('BUTTON') as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(false); // not an element (a window, a document)
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
  } finally {
    g.HTMLElement = before;
  }
});

test('the plan picture switch: one key per screen and floor, shown by default, storage failures are swallowed', () => {
  const g = globalThis as unknown as { localStorage?: unknown };
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const store = new Map<string, string>();
  const set = (value: unknown) => Object.defineProperty(globalThis, 'localStorage', { value, configurable: true, writable: true });
  set({ getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  try {
    expect(readPlanImage('floor', 'f1')).toBe(true); // never switched
    writePlanImage('floor', 'f1', false);
    writePlanImage('history', 'f1', true);
    writePlanImage('editor', 'f 2', false);
    // the keys the three screens used before
    expect([...store.entries()].sort()).toEqual([['sw.editor.background.f 2', '0'], ['sw.floor.background.f1', '0'], ['sw.history.background.f1', '1']]);
    expect(readPlanImage('floor', 'f1')).toBe(false);
    expect(readPlanImage('history', 'f1')).toBe(true);
    expect(readPlanImage('editor', 'f1')).toBe(true); // another screen's switch is not this one's
    expect(readPlanImage('editor', 'f 2')).toBe(false);
    set({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(readPlanImage('floor', 'f1')).toBe(true);
    expect(() => writePlanImage('floor', 'f1', false)).not.toThrow();
  } finally {
    if (before) Object.defineProperty(globalThis, 'localStorage', before);
    else delete g.localStorage;
  }
});

test('the library lookups: the 2D, 3D and material lookups and the Hebrew names of one library', () => {
  const lib = { catalog_version: '1', revision: 'r', categories: [], items: [
    { id: 'lamp', names: { he: 'מנורה' }, shape: 'circle', icon: 'bulb', color_token: 'light', role: 'light', material_id: 'm1', light: null },
    { id: 'sofa', names: { he: 'ספה' }, shape: 'rect', icon: 'sofa', color_token: 'wood', role: 'furniture', material_id: null, light: null, walkable: false },
  ] } as unknown as CatalogLibrary;
  const l = libraryLookups(lib);
  expect(l.catalogLookup('lamp')).toEqual({ shape: 'circle', icon: 'bulb', color_token: 'light' });
  expect(l.catalog3d('sofa')).toEqual({ shape: 'rect', color_token: 'wood', role: 'furniture', mesh: null, walkable: false });
  expect(l.materials3d('lamp')).toEqual({ role: 'light', material_id: 'm1', light: null });
  expect([...l.itemNames]).toEqual([['lamp', 'מנורה'], ['sofa', 'ספה']]);
  expect(l.catalogLookup('nothing')).toBeUndefined();
});

test('the zones as the scene and as rooms, the lamps, the level fallback, the hover labels and the default view', () => {
  const zones = [
    { id: 'z1', name: 'סלון', polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], level_id: 'L1', kind: 'room', color: '#fff' },
    { id: 'z2', name: 'מטבח', polygon: [{ x: 0, y: 0 }], kind: 'room' },
  ];
  const scene = sceneZonesOf(zones);
  expect(scene).toEqual([{ id: 'z1', name: 'סלון', polygon: zones[0].polygon, level_id: 'L1' }, { id: 'z2', name: 'מטבח', polygon: zones[1].polygon, level_id: null }]);
  // the scene description is hashed from JSON: the key order is part of the contract
  expect(JSON.stringify(scene[0])).toBe('{"id":"z1","name":"סלון","polygon":[{"x":0,"y":0},{"x":1,"y":0},{"x":1,"y":1}],"level_id":"L1"}');
  expect(scene[0].polygon).toBe(zones[0].polygon); // not copied
  expect(JSON.stringify(stateRoomsOf(zones)[1])).toBe('{"id":"z2","polygon":[{"x":0,"y":0}],"level_id":null}');

  const facts = { openings: [], lamps: [
    { x: 0.1, y: 0.2, level_id: 'L0', circuit: 'c1', entity: null },
    { x: 0.3, y: 0.4, level_id: 'L0', circuit: null, entity: 'light.a' },
    { x: 0.5, y: 0.6, level_id: 'L1', circuit: 'c2', entity: 'light.b' },
    { x: 0.7, y: 0.8, level_id: 'L1', circuit: null, entity: null },
  ] };
  expect(stateLampsOf(facts, { c1: 'on', c2: 'off' }, { 'light.a': null, 'light.b': 'on' })).toEqual([
    { x: 0.1, y: 0.2, level_id: 'L0', on: true },
    { x: 0.3, y: 0.4, level_id: 'L0', on: false },
    { x: 0.5, y: 0.6, level_id: 'L1', on: true },
    { x: 0.7, y: 0.8, level_id: 'L1', on: false },
  ]);
  expect(stateLampsOf(null, {}, {})).toEqual([]);

  const doc = { levels: [{ id: 'G', is_default: false }, { id: 'U', is_default: true }] } as unknown as GeometryDoc;
  expect(fallbackLevelId(doc, { levels: [{ id: 'B', is_default: true }] })).toBe('U'); // the document wins
  expect(fallbackLevelId(null, { levels: [{ id: 'A' }, { id: 'B', is_default: true }] })).toBe('B');
  expect(fallbackLevelId(null, { levels: [{ id: 'A' }] })).toBe('L0');
  expect(fallbackLevelId(null, null)).toBe('L0');

  const labels = hoverLabelsOf([{ id: 'a1', n: 'מצלמה' }], (a) => a.n, [{ id: 'o1', label: 'שולחן', item_id: 'table' }, { id: 'o2', label: '', item_id: 'lamp' }, { id: 'o3', label: null, item_id: 'unknown' }], new Map([['lamp', 'מנורה']]), [{ id: 'z1', name: 'סלון' }]);
  expect(labels).toEqual({ a1: 'מצלמה', o1: 'שולחן', o2: 'מנורה', o3: 'unknown', z1: 'סלון' });
  // a zone and an anchor sharing an id: the zone's name wins, as the loops did
  expect(hoverLabelsOf([{ id: 'x' }], () => 'anchor', [], new Map(), [{ id: 'x', name: 'zone' }])).toEqual({ x: 'zone' });

  expect(defaultViewIs3d({ 'map.default_view': '3d' })).toBe(true);
  expect(defaultViewIs3d({ 'map.default_view': '2d' })).toBe(false);
  expect(defaultViewIs3d({})).toBe(false);
});

test('the live map builds its room-state entities with stateEntitiesOf: identical to the loop it replaced', () => {
  // the loop of explore-floor-map.ts deriveRoomStates before CR-MAP-SHARED-2440, kept here as the reference
  const anchors = [
    { resource_type: 'camera' as const, resource_id: 'cam1', position: { x: 0.1, y: 0.1 }, level_id: null, layer_id: 'cameras' },
    { resource_type: 'ha_entity' as const, resource_id: 'light.kitchen', position: { x: 0.2, y: 0.3 }, level_id: 'L1', layer_id: 'lights', entity: { domain: 'light', device_class: null, last_changed: '2026-11-16T08:00:00Z', attributes: { brightness: 3 } } },
    { resource_type: 'ha_entity' as const, resource_id: 'binary_sensor.door', position: { x: 0.4, y: 0.5 }, layer_id: 'doors', entity: null },
    { resource_type: 'ha_entity' as const, resource_id: 'climate.room', position: { x: 0.6, y: 0.7 }, level_id: undefined, layer_id: 'sensors', entity: { device_class: 'x' } },
  ];
  const states: Record<string, string | null> = { 'light.kitchen': 'on', 'climate.room': null };
  const before: unknown[] = [];
  for (const a of anchors) {
    if (a.resource_type !== 'ha_entity') continue;
    const e = a.entity as { domain?: string; device_class?: string | null; last_changed?: string; attributes?: Record<string, unknown> } | null | undefined;
    before.push({ id: a.resource_id, domain: e?.domain ?? a.resource_id.split('.')[0] ?? '', device_class: e?.device_class ?? null, state: states[a.resource_id] ?? null, last_changed: e?.last_changed ?? null, attributes: e?.attributes ?? null, x: a.position.x, y: a.position.y, level_id: a.level_id ?? null, layer_id: a.layer_id });
  }
  const now = stateEntitiesOf(anchors, states);
  expect(now).toEqual(before);
  expect(JSON.stringify(now)).toBe(JSON.stringify(before)); // the same key order too
});

test('the three screens read the shared module and keep no private copy', () => {
  const floor = src('explore-floor-map.ts');
  const history = src('investigate-history-map.ts');
  const editor = src('explore-plan-editor.ts');
  for (const s of [floor, history, editor]) {
    expect(s).toContain("from '../map/floor-view-shared'");
    expect(s).not.toMatch(/tagName === 'TEXTAREA'/);
    expect(s).not.toMatch(/localStorage\.(get|set)Item\(`sw\.(floor|history|editor)\.background\./);
  }
  for (const s of [floor, history]) {
    expect(s).not.toContain("import('../map/sw-plan-3d')");
    expect(s).not.toMatch(/lookup3dOf\(lib\)/);
    expect(s).not.toMatch(/is_default\)\?\.id \?\? 'L0'/);
    expect(s).not.toMatch(/level_id: z\.level_id \?\? null/);
  }
});
