import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoRooms } from '../src/fixtures/demo';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import type { GeomObject } from '../src/map/geometry';
import { buildScene, type SceneDescription, type SceneInput, type SceneZone } from '../src/map/scene-builder';
import { STILL_RECIPE_Q2, bakeSceneInput, recipeRank, stillDescription, withoutCameraBodies } from '../src/map/still-bake';
import { LIGHTMAP_RECIPE, bakeLightmap } from '../src/map/lightmap-bake';

// STILLCAM (a leftover of the Studio 6 security review): the stills and the lightmap are drawn once, in one editor's browser,
// and served to every reader of the floor - also to a reader whose camera scope hides a camera. An object bound to a camera
// anchor stands at that camera's position (the store copies the anchor's pose onto the body), so a still that draws it shows
// the hidden camera's place, which the normal plan read withholds (plan_anchor_scope.redact). The bake input leaves every
// camera-bound body out, whoever bakes; entity-bound and free objects stay.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'src');
const BACKEND = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'services', 'plan_bakes.py');

const input = demoSceneInput('f0')!;
const zones: SceneZone[] = demoRooms('f0').map((r, i) => ({ id: `z${i}`, name: `room ${i}`, polygon: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], level_id: 'L0' }));

const body = (id: string, position: [number, number], ref: GeomObject['anchor_ref'], rotation_deg = 0): GeomObject => ({
  id, item_id: 'cabinet.basic', level_id: 'L0', position, rotation_deg, size: { w_m: 0.8, d_m: 0.6, h_m: 1.2 }, z_m: 0, params: {}, label: null,
  anchor_ref: ref, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {},
});
const withBodies = (vaultAt: [number, number], vaultYaw = 0): SceneInput => ({
  ...input, zones,
  doc: { ...input.doc, objects: [...input.doc.objects,
    body('o-vault', vaultAt, { resource_type: 'camera', resource_id: 'cam-vault' }, vaultYaw),
    body('o-lock', [0.42, 0.33], { resource_type: 'ha_entity', resource_id: 'lock.front' }),
    body('o-free', [0.2, 0.7], null)] },
});
const ids = (d: SceneDescription): Set<string> => new Set(d.parts.map((p) => p.userData.id));

test.describe('STILLCAM: a camera-bound body never reaches a still or the lightmap', () => {
  test('the plain scene draws the camera-bound body (the leak the bake input closes)', () => {
    // the live / control scene does draw it: the bake must not use that input as it is
    expect(ids(buildScene({ ...withBodies([0.81, 0.77]), level: null })).has('o-vault')).toBe(true);
  });

  test('withoutCameraBodies drops only camera-bound objects and keeps the document otherwise', () => {
    const doc = withBodies([0.81, 0.77]).doc;
    const out = withoutCameraBodies(doc);
    expect(out.objects.map((o) => o.id)).toEqual(doc.objects.filter((o) => o.id !== 'o-vault').map((o) => o.id));
    expect({ ...out, objects: [] }).toEqual({ ...doc, objects: [] });
    expect(doc.objects.some((o) => o.id === 'o-vault')).toBe(true); // the input is untouched
    // nothing bound to a camera: the same document object back (no copy)
    const clean = { ...doc, objects: doc.objects.filter((o) => o.id !== 'o-vault') };
    expect(withoutCameraBodies(clean)).toBe(clean);
  });

  for (const variant of ['off', 'on'] as const) {
    test(`the ${variant} still has no part of the camera-bound body; the entity-bound and free objects stay`, () => {
      const d = stillDescription(buildScene(bakeSceneInput(withBodies([0.81, 0.77]), variant)), 'L0', variant);
      const seen = ids(d);
      expect(seen.has('o-vault')).toBe(false);
      expect(seen.has('o-lock')).toBe(true);
      expect(seen.has('o-free')).toBe(true);
    });
  }

  test('the still and lightmap input do not depend on where the hidden camera is', () => {
    const a = buildScene(bakeSceneInput(withBodies([0.81, 0.77], 30), 'on'));
    const b = buildScene(bakeSceneInput(withBodies([0.12, 0.15], 200), 'on'));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const off1 = buildScene(bakeSceneInput(withBodies([0.81, 0.77]), 'off'));
    const off2 = buildScene(bakeSceneInput(withBodies([0.3, 0.6]), 'off'));
    expect(JSON.stringify(off1)).toBe(JSON.stringify(off2));
  });

  test('the lightmap bakes the same bytes wherever the camera-bound body stands', async () => {
    const opts = { samples: 8, maxSide: 64 };
    const a = await bakeLightmap(buildScene(bakeSceneInput(withBodies([0.81, 0.77]), 'on')), 'L0', opts);
    const b = await bakeLightmap(buildScene(bakeSceneInput(withBodies([0.25, 0.4]), 'on')), 'L0', opts);
    expect(Buffer.from(a.rgba).equals(Buffer.from(b.rgba))).toBe(true);
  });

  test('the floor map bakes through bakeSceneInput (never the raw control input)', () => {
    const src = fs.readFileSync(path.join(SRC, 'screens', 'floor-stills.ts'), 'utf8');
    expect(src).toMatch(/buildScene\(bakeSceneInput\(base, v\)\)/);
    expect(src).not.toMatch(/buildScene\(controlSceneInput\(/);
  });

  test('the recipes are bumped, and the backend withholds the older ones from a scoped reader', () => {
    expect(recipeRank(STILL_RECIPE_Q2)).toEqual([2, 2]);
    expect(LIGHTMAP_RECIPE).toBe('lightmap-2');
    const py = fs.readFileSync(BACKEND, 'utf8');
    expect(py).toMatch(/SAFE_STILL_RANK = \(2, 2\)/);
    expect(py).toMatch(/SAFE_LIGHTMAP_RANK = 2\b/);
  });
});
