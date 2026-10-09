import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrimitives, type GeometryDoc, type GeomWall, type GlazingPrim, type Primitive, type WallPrim } from '../src/map/geometry';
import {
  AUTO_MAX_M, AUTO_MIN_M, GLAZING_DEFAULTS, MAX_PANELS, applyAutoDivide, autoDivide, glassBand, glassVerticals, glazingOf, panelBounds, panelCount, panelStateId, patchGlazing,
  patchOperable, toGlassPatch, toSolidPatch, toggleOperable, usesGlazing, wallLengthM, withDocVersion,
} from '../src/map/glass-wall';
import { addWall, patchWall, removeItem } from '../src/map/studio-ops';
import { kindPatch } from '../src/screens/plan-studio-panel';
import { buildScene, type SceneInput } from '../src/map/scene-builder';
import { roomStates } from '../src/map/room-state';
import { blockingSegments } from '../src/map/coverage';
import { PLAN_GLASS_STRINGS, glassT } from '../src/i18n/plan-glass';

// Window walls (document 2.1): the map's glazing primitives equal the backend renderer's (the shared golden
// contracts/fixtures/plan_geometry/sample-v2-glass.primitives.json, written by the backend), the panel layout maths along
// the path length, the editor's pure edits (draw, convert and back, glazing, operable panels, bulk layout, the version
// stamp), the 3D parts and the state layer. Runs in node: no page, no backend.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const sample = () => JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2-glass.json'), 'utf8')) as GeometryDoc;
const golden = JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2-glass.primitives.json'), 'utf8')) as { all: Primitive[] };

function close(a: unknown, b: unknown, where = ''): void {
  if (typeof a === 'number' && typeof b === 'number') {
    expect(Math.abs(a - b), `${where}: ${a} vs ${b}`).toBeLessThanOrEqual(0.011);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    expect(a.length, `${where} length`).toBe(b.length);
    a.forEach((x, i) => close(x, b[i], `${where}[${i}]`));
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    expect(Object.keys(a).sort(), `${where} keys`).toEqual(Object.keys(b).sort());
    for (const k of Object.keys(a)) close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${where}.${k}`);
    return;
  }
  expect(a, where).toEqual(b);
}

test('the glazing primitives equal the backend renderer (shared golden)', () => {
  const prims = buildPrimitives(sample(), 1000, 800);
  close(prims, golden.all, 'all');
  const glazing = prims.filter((p): p is GlazingPrim => p.kind === 'glazing');
  expect(glazing.map((g) => g.id)).toEqual(['g-bend', 'g-box', 'g-corner', 'g-facade']);
  const byId = new Map(glazing.map((g) => [g.id, g]));
  expect(byId.get('g-bend')!.mullions.length).toBe(byId.get('g-bend')!.panels.length - 1); // a gentle bend gets no post
  expect(byId.get('g-corner')!.panels.length).toBe(5); // the stored count
  expect(byId.get('g-corner')!.mullions.length).toBe(5); // 4 inner edges + the corner post
  expect(byId.get('g-box')!.mullions.length).toBeGreaterThan(byId.get('g-box')!.panels.length - 1); // corner posts, the closing corner too
  const facade = byId.get('g-facade')!;
  expect(facade.panels.filter((p) => p.operation).map((p) => [p.index, p.operation, p.anchor])).toEqual([[1, 'casement_left', 'ha_entity:binary_sensor.facade_2'], [5, 'tilt', null]]);
  // the walls: glass parts are flagged, the solid wall's primitive has no flag key at all
  const walls = prims.filter((p): p is WallPrim => p.kind === 'wall');
  expect(walls.filter((p) => p.id === 'g-facade').length).toBe(2); // the door cuts it
  expect(walls.filter((p) => p.id === 'w-solid').every((p) => !('glass' in p))).toBe(true);
});

test('panel layout maths along the path length (mirror of plan_glass)', () => {
  expect(panelCount(8, { panel_width_m: 1, panel_count: null })).toBe(8);
  expect(panelCount(8.7, { panel_width_m: 1.2, panel_count: null })).toBe(7);
  expect(panelCount(9, { panel_width_m: 1.2, panel_count: null })).toBe(8); // 7.5 half-up
  expect(panelCount(0.3, { panel_width_m: 1.2, panel_count: null })).toBe(1);
  expect(panelCount(8, { panel_width_m: 1, panel_count: 3 })).toBe(3);
  expect(panelCount(1e6, { panel_width_m: 0.2, panel_count: null })).toBe(MAX_PANELS);
  expect(panelBounds(6, 3)).toEqual([0, 2, 4, 6]);
  expect(autoDivide(12, 0.9, 1.5)).toBe(10);
  expect(autoDivide(12, 0.9, 1.5, 1.5)).toBe(8);
  expect(autoDivide(12, 1.4, 1.5)).toBe(8);
  expect(autoDivide(0.5)).toBeNull();
  expect(autoDivide(2.05, 1.1, 1.2)).toBeNull();
  expect(autoDivide(5, 2, 1)).toBeNull();
  for (const len of [0.95, 3.3, 7.77, 19.1, 64]) {
    const n = autoDivide(len, AUTO_MIN_M, AUTO_MAX_M)!;
    expect(len / n).toBeGreaterThanOrEqual(AUTO_MIN_M - 1e-9);
    expect(len / n).toBeLessThanOrEqual(AUTO_MAX_M + 1e-9);
  }
  expect(glassVerticals({ ...GLAZING_DEFAULTS, sill_m: 0.4, glazed_height_m: null }, 3)).toEqual({ sill: 0.4, top: 3 });
  expect(glassVerticals({ ...GLAZING_DEFAULTS, sill_m: 0.4, glazed_height_m: 2 }, 3)).toEqual({ sill: 0.4, top: 2.4 });
  expect(glassVerticals({ ...GLAZING_DEFAULTS, sill_m: 5, glazed_height_m: null }, 3).sill).toBeLessThan(3);
  const b = glassBand(10);
  expect(b.band).toBeGreaterThan(0);
  expect(b.band + 2 * b.line).toBeCloseTo(10, 6);
});

test('the editor: draw a window wall, convert and back, glazing and operable edits, the version stamp', () => {
  const doc = sample();
  const plain: GeometryDoc = { ...doc, schema_version: '2.0', walls: doc.walls.filter((w) => w.kind !== 'glass'), openings: [] };
  expect(usesGlazing(plain)).toBe(false);
  // drawn like any wall with the kind choice 'glass': the defaults, the document goes to 2.1
  const drawn = addWall(plain, [[0.2, 0.2], [0.6, 0.2]], { thickness_m: 0.12, kind: 'glass' });
  const w = drawn.doc.walls.find((x) => x.id === drawn.id)!;
  expect(w.kind).toBe('glass');
  expect(w.glazing).toEqual(GLAZING_DEFAULTS);
  expect(drawn.doc.schema_version).toBe('2.1');
  // one-click conversion of a solid wall: glazing defaults, a frame no deeper than 0.12 m; back again: no glazing key
  const solid = plain.walls[0];
  const toGlass = patchWall(plain, solid.id, kindPatch(solid, 'glass'));
  const g = toGlass.walls.find((x) => x.id === solid.id)!;
  expect(g.kind).toBe('glass');
  expect(g.thickness_m).toBe(0.12);
  expect(toGlass.schema_version).toBe('2.1');
  const back = patchWall(toGlass, solid.id, kindPatch(g, 'exterior'));
  const s = back.walls.find((x) => x.id === solid.id)!;
  expect(s.kind).toBe('exterior');
  expect('glazing' in s).toBe(false);
  expect(back.schema_version).toBe('2.0');
  expect(kindPatch(solid, 'interior')).toEqual({ kind: 'interior' });
  expect(kindPatch(g, 'glass')).toEqual({});
  expect(toSolidPatch('low')).toEqual({ kind: 'low', glazing: undefined });
  // a thin wall keeps its thickness
  expect(toGlassPatch({ ...solid, thickness_m: 0.08 }).thickness_m).toBe(0.08);
  // glazing edits: a layout change drops the operable panels that no longer exist
  const len = wallLengthM(g, 1000, 800, 0.01);
  const withOps = { ...g, glazing: toggleOperable(toggleOperable(glazingOf(g), 1), 7) };
  expect(withOps.glazing.operable.map((o) => o.panel)).toEqual([1, 7]);
  expect(toggleOperable(withOps.glazing, 1).operable.map((o) => o.panel)).toEqual([7]);
  expect(patchGlazing(withOps, { panel_count: 4 }, len).operable.map((o) => o.panel)).toEqual([1]);
  const bound = patchOperable(withOps.glazing, 7, { operation: 'tilt', anchor_ref: { resource_type: 'ha_entity', resource_id: 'binary_sensor.x' } });
  expect(bound.operable.find((o) => o.panel === 7)).toEqual({ panel: 7, operation: 'tilt', anchor_ref: { resource_type: 'ha_entity', resource_id: 'binary_sensor.x' } });
  // bulk layout: equal panels within min / max; null when nothing fits
  const auto = applyAutoDivide(withOps, len, 0.9, 1.5)!;
  expect(auto.panel_count).toBe(autoDivide(len, 0.9, 1.5));
  expect(len / auto.panel_count!).toBeGreaterThanOrEqual(0.9);
  expect(applyAutoDivide(withOps, 0.5, 0.9, 1.5)).toBeNull();
  // removing the last window wall drops the document back to 2.0; a document without a version is left as it is
  expect(removeItem(drawn.doc, drawn.id).schema_version).toBe('2.0');
  const unversioned = { ...plain } as Partial<GeometryDoc>;
  delete unversioned.schema_version;
  expect('schema_version' in withDocVersion(unversioned as GeometryDoc)).toBe(false);
});

const sceneInput = (doc: GeometryDoc, extra: Partial<SceneInput> = {}): SceneInput => ({ doc, width: 1000, height: 800, anchors: [], entityStates: {}, circuitStates: {}, ...extra });

test('3D: glass panes in the glass material, a sill and a head in the structure, mullions, the right heights', () => {
  const doc = sample();
  const desc = buildScene(sceneInput(doc));
  const facade = desc.parts.filter((p) => p.userData?.id === 'g-facade');
  const panes = facade.filter((p) => p.color === 'map-glass');
  expect(panes.length).toBe(2); // one per wall part (the door splits the facade)
  for (const p of panes) {
    expect(p.kind).toBe('window');
    expect(p.opacity).toBe(0.35);
    expect(p.group).toBeNull();
    // the sill is 0.4 m and the glazing reaches the head of the 3.2 m level
    expect(p.position[1] - p.size[1] / 2).toBeCloseTo(0.4, 4);
    expect(p.position[1] + p.size[1] / 2).toBeCloseTo(3.2, 4);
  }
  expect(facade.filter((p) => p.id.endsWith(':sill')).every((p) => p.color === 'map-structure' && Math.abs(p.size[1] - 0.4) < 1e-4)).toBe(true);
  expect(facade.filter((p) => p.id.startsWith('glazing:g-facade#m')).length).toBe((buildPrimitives(doc, 1000, 800).find((p) => p.kind === 'glazing' && p.id === 'g-facade') as GlazingPrim).mullions.length);
  // no solid full-height box for a glass wall; the solid wall keeps its box
  expect(facade.some((p) => p.kind === 'wall' && p.color === 'map-structure' && p.id.startsWith('wall:g-facade#0') && !p.id.includes(':'))).toBe(false);
  expect(desc.parts.some((p) => p.id === 'wall:w-solid#0')).toBe(true);
  // the corner wall: glazed 2.4 m from the floor, a head above it up to the level's 3.2 m
  const corner = desc.parts.filter((p) => p.userData?.id === 'g-corner');
  const heads = corner.filter((p) => p.id.endsWith(':head'));
  expect(heads.length).toBe(2);
  expect(heads[0].size[1]).toBeCloseTo(0.8, 4);
  expect(corner.filter((p) => p.color === 'map-glass').every((p) => Math.abs(p.position[1] + p.size[1] / 2 - 2.4) < 1e-4)).toBe(true);
  // deterministic
  expect(JSON.stringify(buildScene(sceneInput(sample())))).toBe(JSON.stringify(desc));
});

test('an operable panel bound to an open sensor is an open opening of the state layer, in 2D and 3D', () => {
  const doc = sample();
  const prims = buildPrimitives(doc, 1000, 800);
  const facade = prims.find((p): p is GlazingPrim => p.kind === 'glazing' && p.id === 'g-facade')!;
  const q = facade.panels[1];
  const layer = roomStates({
    rooms: [], lamps: [], size: [1000, 800], now: 0, fade: 'off',
    entities: [{ id: 'binary_sensor.facade_2', domain: 'binary_sensor', device_class: 'window', state: 'on', last_changed: null, x: 0.2, y: 0.1, level_id: 'L0', layer_id: 'sensors', attributes: {} }] as never,
    openings: [{ id: panelStateId('g-facade', 1), kind: 'window', x: (q.a[0] + q.b[0]) / 2 / 1000, y: (q.a[1] + q.b[1]) / 2 / 800, level_id: 'L0', entity_id: 'binary_sensor.facade_2' }],
  });
  expect(layer.openOpenings).toEqual(['g-facade~p1']);
  const desc = buildScene(sceneInput(doc, { roomStates: layer }));
  expect(desc.parts.filter((p) => p.id.startsWith('open:g-facade~p1#')).length).toBe(4); // jambs, head, sill
});

test('a glass wall is still a wall: it blocks camera rays and stays a wall for every consumer', () => {
  const doc = sample();
  const segs = blockingSegments(doc, 1000, 800, 'L0', {});
  const facade = buildPrimitives(doc, 1000, 800).filter((p): p is WallPrim => p.kind === 'wall' && p.id === 'g-facade');
  expect(segs.some((s) => s.a[0] === facade[0].points[0][0] && s.a[1] === facade[0].points[0][1])).toBe(true);
  const g = doc.walls.find((w) => w.id === 'g-facade') as GeomWall;
  expect(g.kind).toBe('glass');
});

test('i18n: every window wall string exists in Hebrew and English', () => {
  expect(Object.keys(PLAN_GLASS_STRINGS.en).sort()).toEqual(Object.keys(PLAN_GLASS_STRINGS.he).sort());
  expect(glassT('kind', 'he')).toBe('קיר זכוכית'); // WALLP: renamed from 'קיר חלונות' (owner request 2026-10-08)
  expect(glassT('kind', 'en')).toBe('Glass wall');
  for (const v of [...Object.values(PLAN_GLASS_STRINGS.he), ...Object.values(PLAN_GLASS_STRINGS.en)]) expect(v).not.toMatch(/home assistant|\bHA\b/i);
});
