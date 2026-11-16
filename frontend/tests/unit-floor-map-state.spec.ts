import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogLookup, GeometryDoc } from '../src/map/geometry';
import { FLOOR_LAYER_IDS, LATE_FLOOR_LAYERS, LoadGeneration, RefMemo, restoredLayers, stateFactsMemo } from '../src/screens/floor-map-state';

// CR-FLOORMAP-STATE-2440 (code review 06:RACE-1, MAP-1, DA-1, TIMER-1, PERF-6 for the live floor map). The rules are pure
// (screens/floor-map-state.ts) and tested here in node; the last tests guard how explore-floor-map.ts uses them.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCREEN = fs.readFileSync(path.join(HERE, '..', 'src', 'screens', 'explore-floor-map.ts'), 'utf8');
const sample = () => JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry', 'sample-v2.json'), 'utf8')) as GeometryDoc;

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** The shape of the screen's load(): one generation per call, asked after the await and in the catch. */
function screenModel() {
  const loads = new LoadGeneration();
  const screen = { bundle: null as string | null, error: '', writes: [] as string[] };
  const load = async (answer: Promise<string>) => {
    const stale = loads.begin();
    screen.error = '';
    try {
      const b = await answer;
      if (stale()) return;
      screen.bundle = b;
      screen.writes.push(b);
    } catch (err) {
      if (stale()) return;
      screen.error = String(err);
      screen.bundle = null;
    }
  };
  return { screen, load };
}

test('06:RACE-1 - two deferred loadMap answers resolved in reverse order: the later load wins, the older answer writes nothing', async () => {
  const { screen, load } = screenModel();
  const a = deferred<string>();
  const b = deferred<string>();
  const first = load(a.promise); // floor A
  const second = load(b.promise); // the address changed to floor B before A answered
  b.resolve('floor-B');
  await second;
  expect(screen.bundle).toBe('floor-B');
  a.resolve('floor-A'); // the slow answer for A lands under B
  await first;
  expect(screen.bundle).toBe('floor-B');
  expect(screen.writes).toEqual(['floor-B']);
});

test('06:RACE-1 - an old failure cannot blank a newer floor; the latest failure is still shown', async () => {
  const { screen, load } = screenModel();
  const a = deferred<string>();
  const b = deferred<string>();
  const first = load(a.promise);
  const second = load(b.promise);
  b.resolve('floor-B');
  await second;
  a.reject(new Error('timeout'));
  await first;
  expect(screen).toMatchObject({ bundle: 'floor-B', error: '' });
  const c = deferred<string>();
  const third = load(c.promise);
  c.reject(new Error('gone'));
  await third;
  expect(screen).toMatchObject({ bundle: null, error: 'Error: gone' });
});

test('06:RACE-1 - a generation is stale only once a newer one began; answers in order are all current when they land', () => {
  const loads = new LoadGeneration();
  const one = loads.begin();
  expect(one()).toBe(false);
  const two = loads.begin();
  expect(one()).toBe(true);
  expect(two()).toBe(false);
  const other = new LoadGeneration().begin(); // another element has its own count
  expect(other()).toBe(false);
  expect(two()).toBe(false);
});

test('06:MAP-1 b - two floors: a floor with nothing stored gets every layer, never the set of the floor shown before', () => {
  const store: Record<string, string> = { 'sw.floor.layers.A': JSON.stringify(['cameras', 'zones', '-structure', '-states']) };
  const a = restoredLayers(store['sw.floor.layers.A'] ?? null);
  expect([...a].sort()).toEqual(['cameras', 'connectors', 'objects', 'photo', 'zones']); // late layers on unless switched off
  const b = restoredLayers(store['sw.floor.layers.B'] ?? null); // floor B was never visited
  expect([...b]).toEqual([...FLOOR_LAYER_IDS]);
  expect(b).not.toBe(a);
  // the same for a damaged value, a value that is not a list, an empty string and blocked storage (null)
  for (const raw of ['{broken', '{"cameras":true}', '"cameras"', '', null, undefined]) expect([...restoredLayers(raw)], String(raw)).toEqual([...FLOOR_LAYER_IDS]);
});

test('06:MAP-1 b - the stored-list rule is unchanged: unknown ids are dropped, an explicit "-id" keeps a late layer off', () => {
  expect([...restoredLayers(JSON.stringify([]))].sort()).toEqual([...LATE_FLOOR_LAYERS].sort()); // a list from before the late layers existed
  expect([...restoredLayers(JSON.stringify(['cameras', 'nonsense', 7, null, '-objects', '-photo']))].sort()).toEqual(['cameras', 'connectors', 'states', 'structure']);
  const all = restoredLayers(JSON.stringify([...FLOOR_LAYER_IDS]));
  expect([...all].sort()).toEqual([...FLOOR_LAYER_IDS].sort());
  expect(LATE_FLOOR_LAYERS.every((l) => (FLOOR_LAYER_IDS as readonly string[]).includes(l))).toBe(true);
});

test('06:MAP-1 c - the library resolving after the structure: the state facts are built again and the lamp appears', () => {
  // no circuits: an object is a lamp only by its library item's colour
  const doc: GeometryDoc = { ...sample(), circuits: [] };
  const before = stateFactsMemo(null, doc, 1000, 800, null); // the structure arrived first: no library yet
  expect(before.lamps).toEqual([]);
  expect(stateFactsMemo(before, doc, 1000, 800, null)).toBe(before); // nothing changed: the same object
  const library: CatalogLookup = (id) => (id === 'light.ceiling' ? { shape: 'cylinder', icon: 'box', color_token: 'light' } : undefined);
  const after = stateFactsMemo(before, doc, 1000, 800, library); // the old key (document + size) answered `before` here
  expect(after).not.toBe(before);
  expect(after.lamps.map((l) => l.entity)).toEqual(['light.store']);
  expect(after.catalog).toBe(library);
  expect(stateFactsMemo(after, doc, 1000, 800, library)).toBe(after);
  // the document and the plan size still count
  expect(stateFactsMemo(after, { ...doc }, 1000, 800, library)).not.toBe(after);
  expect(stateFactsMemo(after, doc, 1200, 800, library)).not.toBe(after);
  expect(after.openings.length).toBe(before.openings.length); // openings do not depend on the library
});

test('06:PERF-6 - RefMemo computes once per set of references and again when one of them is replaced', () => {
  const memo = new RefMemo<{ n: number }>();
  let made = 0;
  const make = () => ({ n: ++made });
  const bundle = { id: 'b1' };
  const layers = new Set(['cameras']);
  const first = memo.get([bundle, layers, null, 'ready', true], make);
  expect(memo.get([bundle, layers, null, 'ready', true], make)).toBe(first);
  expect(made).toBe(1);
  expect(memo.get([{ ...bundle }, layers, null, 'ready', true], make)).not.toBe(first); // a push replaced the bundle
  expect(memo.get([bundle, layers, null, 'stale', true], make).n).toBe(3); // a primitive changed
  expect(memo.get([bundle, layers, null, 'stale'], make).n).toBe(4); // another number of references
  const nan = new RefMemo<number>();
  expect(nan.get([NaN], () => 1)).toBe(1);
  expect(nan.get([NaN], () => 2)).toBe(1); // Object.is: NaN is the same as NaN
  const undef = new RefMemo<undefined | number>();
  let calls = 0;
  undef.get([1], () => void calls++);
  undef.get([1], () => void calls++);
  expect(calls).toBe(1); // a kept `undefined` is a kept value
});

/** The text of one method of the screen, from its header to the closing brace at the method's indent. */
function method(header: string): string {
  const at = SCREEN.indexOf(header);
  expect(at, header).toBeGreaterThan(-1);
  const end = SCREEN.indexOf('\n  }\n', at);
  return SCREEN.slice(at, end);
}

test('the screen: load() asks its generation after every await and in the catch; the defaults are guarded by it', () => {
  const load = method('  private async load() {');
  expect(load).toContain('const stale = this.loads.begin();');
  const lines = load.split('\n');
  const awaits = lines.map((l, i) => ({ l, i })).filter((x) => /\bawait\b/.test(x.l) && !x.l.trim().startsWith('//'));
  expect(awaits.length).toBe(5); // the tree (twice), the settings of the entry floor, the map, the camera list
  for (const a of awaits) expect(lines[a.i + 1].trim(), a.l.trim()).toBe('if (stale()) return;');
  expect(load).toMatch(/\} catch \(err\) \{\n\s+if \(stale\(\)\) return;/);
  expect(load).not.toContain('if (this.bundle === b)'); // every push replaces the bundle object: identity is no guard
  expect(load).toContain("if (!stale()) this.levelFilter = initialLevel(s['plan.levels'], b);");
  expect(load).toMatch(/if \(!stale\(\)\) this\.default3d = /);
});

test('the screen: another floor resets what named an item of the floor before; the notice follows the selection; timers are cleared', () => {
  const updated = method('  protected updated(changed: Map<string, unknown>) {');
  expect(updated).toMatch(/changed\.get\('floorId'\) !== undefined\) \{\n\s+this\.resetFloorState\(\);\n\s+void this\.load\(\);/);
  const reset = method('  private resetFloorState() {');
  for (const s of ['this.selectedId = null;', 'this.anchor = null;', 'this.selectedZoneId = null;', 'this.focusedObjectId = null;', 'this.action = null;', 'this.renaming = null;', "this.notice = '';", 'if (!this.picksParam && this.picked.length) this.picked = [];']) expect(reset).toContain(s);
  expect(reset).not.toContain('this.multi'); // the picking mode stays on
  expect(method('  protected willUpdate(changed: Map<string, unknown>) {')).toContain("if (changed.has('selectedId') && this.notice) this.notice = '';");
  // the notice line is in the camera card and in the entity card
  expect(SCREEN.match(/\$\{this\.notice \? html`<div class="note" data-notice role="status">\$\{this\.notice\}<\/div>` : nothing\}/g)?.length).toBe(2);
  // 06:TIMER-1: one jump timer, restarted by the next jump and cleared on disconnect
  expect(SCREEN.match(/window\.setTimeout\(\(\) => \(this\.focusZoom = true\), 900\)/)).toBeNull();
  expect(method('  private async jumpTo(a: Anchor) {')).toMatch(/window\.clearTimeout\(this\.focusZoomTimer\);\n\s+this\.focusZoomTimer = window\.setTimeout\(/);
  expect(method('  disconnectedCallback() {')).toContain('window.clearTimeout(this.focusZoomTimer);');
});

test('the screen: the layer set and the state facts come from the pure module; the hot getters are memoised by reference', () => {
  expect(method('  private restoreLayers() {')).toContain('restoredLayers(raw)');
  expect(method('  private stateFactsFor(b: MapBundle)')).toContain('stateFactsMemo(this.stateFacts, doc, b.width, b.height, this.catalogLookup)');
  expect(method('  private get roomStateLayer(): RoomStateLayer | null {')).toContain('m.catalog === this.catalogLookup');
  const refs: Record<string, string> = {
    buildingFloors: 'this.tree, this.floorId',
    floors: 'this.tree',
    markers: 'this.bundle, this.layers, this.levelFilter, this.screenState, this.syncConnected',
    anchorPositions: 'this.bundle',
    circuitStateMap: 'this.bundle',
    entityStateMap: 'this.bundle',
    entityStates3d: 'this.bundle, this.states3dStale',
    circuitStates3d: 'this.bundle, this.states3dStale',
  };
  for (const [name, r] of Object.entries(refs)) expect(SCREEN, name).toContain(`return this.memo('${name}', [${r}], () => this.compute${name[0].toUpperCase()}${name.slice(1)}());`);
  // every layer id of the pure module has its row in the layers panel
  for (const id of FLOOR_LAYER_IDS) expect(SCREEN, id).toMatch(new RegExp(`\\{ id: '${id}', icon: `));
});
