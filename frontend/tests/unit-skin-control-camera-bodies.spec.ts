import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoRooms } from '../src/fixtures/demo';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import type { GeomObject } from '../src/map/geometry';
import { buildScene, type SceneDescription, type SceneInput, type SceneZone } from '../src/map/scene-builder';
import { CONTROL_RECIPE, CONTROL_STATES, controlDescription, controlSceneInput, withoutCameraBodies } from '../src/map/skin-control';
import { withoutCameraBodies as bakeHelper } from '../src/map/still-bake';

// STILLCAM-SKIN (the follow-up of STILLCAM): the control image of an AI floor skin is drawn once, in one editor's browser,
// and the skin made from it is meant for every reader of the floor - also a reader whose camera scope hides a camera. An
// object bound to a camera anchor stands at that camera's position (the store copies the anchor's pose onto the body), so a
// control image that draws it shows the hidden camera's place. controlSceneInput leaves every camera-bound body out;
// entity-bound and free objects stay. Pure functions (no browser).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'src');
const BACKEND = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'services', 'skins', 'store.py');

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
const control = (i: SceneInput, s: (typeof CONTROL_STATES)[number]) => controlDescription(buildScene(controlSceneInput(i, s)), s);

test.describe('STILLCAM-SKIN: a camera-bound body never reaches a skin control image', () => {
  test('the plain scene draws the camera-bound body (the leak the control input closes)', () => {
    expect(ids(buildScene({ ...withBodies([0.81, 0.77]), level: null })).has('o-vault')).toBe(true);
  });

  for (const state of CONTROL_STATES) {
    test(`the ${state} control image has no part of the camera-bound body; the entity-bound and free objects stay`, () => {
      const seen = ids(control(withBodies([0.81, 0.77]), state));
      expect(seen.has('o-vault')).toBe(false);
      expect(seen.has('o-lock')).toBe(true);
      expect(seen.has('o-free')).toBe(true);
      expect(controlSceneInput(withBodies([0.81, 0.77]), state).doc.objects.some((o) => o.anchor_ref?.resource_type === 'camera')).toBe(false);
    });

    test(`the ${state} control description does not depend on where the hidden camera is`, () => {
      const a = control(withBodies([0.81, 0.77], 30), state);
      const b = control(withBodies([0.12, 0.15], 200), state);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  }

  test('one helper for the stills and the control image; the input document is untouched', () => {
    expect(bakeHelper).toBe(withoutCameraBodies);
    const src = withBodies([0.81, 0.77]);
    controlSceneInput(src, 'all_on');
    expect(src.doc.objects.some((o) => o.id === 'o-vault')).toBe(true);
  });

  test('the floor map captures through controlSceneInput and uploads with the recipe the backend requires', () => {
    expect(CONTROL_RECIPE).toBe('control-2');
    const screen = fs.readFileSync(path.join(SRC, 'screens', 'explore-floor-map.ts'), 'utf8');
    expect(screen).toMatch(/controlDescription\(buildScene\(controlSceneInput\(base, state\)\), state\)/);
    const api = fs.readFileSync(path.join(SRC, 'api', 'skins.ts'), 'utf8');
    expect(api).toMatch(/form\.set\('recipe', CONTROL_RECIPE\)/);
    const py = fs.readFileSync(BACKEND, 'utf8');
    expect(py).toMatch(/CONTROL_RECIPE = "control-2"/);
    expect(py).toMatch(/SAFE_CONTROL_RANK = 2\b/);
  });
});
