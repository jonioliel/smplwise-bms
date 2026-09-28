import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GeometryDoc } from '../src/map/geometry';
import { ISO_THUMB, buildScene, type SceneDescription } from '../src/map/scene-builder';
import { CUTAWAY_HEIGHT_M, ISO_DIR, ISO_RIGHT, ISO_UP, PERSP_DIR, azimuthDeg, cutBox, cutawayIds, isoFrame, levelExtent, quantiseAzimuth, sceneExtent, withinFootprint } from '../src/map/scene-frame';
import { demoSceneInput } from '../src/fixtures/demo-3d';

// CR-006 slice 1a: the camera framing and the cutaway are pure maths over the description (design rule 4) - the same
// description and camera state give the same frame and the same cut list. Node only: no three, no DOM.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const sample = (): SceneDescription => buildScene({ doc: JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.json'), 'utf8')) as GeometryDoc, width: 1000, height: 800, anchors: [], entityStates: {}, circuitStates: {} });
const demo = (): SceneDescription => buildScene(demoSceneInput('f0')!);
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test('the isometric camera is the building page isometric: 45 deg azimuth, 35.26 deg elevation, a flat square spans sqrt 3 : 1', () => {
  expect(Math.hypot(...ISO_DIR)).toBeCloseTo(1, 12);
  expect(ISO_DIR[0]).toBeCloseTo(ISO_DIR[2], 12); // the +x +z corner: azimuth 45 deg
  expect((Math.asin(ISO_DIR[1]) * 180) / Math.PI).toBeCloseTo(35.264, 2); // atan(1 / sqrt 2)
  expect(dot(ISO_RIGHT, ISO_DIR)).toBeCloseTo(0, 12);
  expect(dot(ISO_UP, ISO_DIR)).toBeCloseTo(0, 12);
  expect(dot(ISO_RIGHT, ISO_UP)).toBeCloseTo(0, 12);
  expect(ISO_UP[1]).toBeGreaterThan(0);
  // a unit square on the floor projects (u - v) * half wide and (u + v) * rise high on the building page: the same
  // sqrt 3 : 1 ratio between the screen width and height of the square here
  const square = isoFrame({ x0: 0, x1: 10, z0: 0, z1: 10, y0: 0, y1: 0 }, Math.sqrt(3), 1); // at this aspect neither side is widened
  expect(square.halfW / square.halfH).toBeCloseTo(ISO_THUMB.half / ISO_THUMB.rise, 6);
  expect(square.halfW).toBeCloseTo(20 / (2 * Math.SQRT2), 9); // (W + D) / sqrt 2 across
  expect(ISO_THUMB.half / ISO_THUMB.rise).toBeCloseTo(Math.sqrt(3), 12);
  // the perspective preset keeps the 31 deg of phase 4
  expect((Math.asin(PERSP_DIR[1]) * 180) / Math.PI).toBeCloseTo(31.0, 0);
});

test('isoFrame fits the extent to the aspect (never crops) and looks at its centre', () => {
  const e = { x0: 0, x1: 10, z0: 0, z1: 8, y0: 0, y1: 3 };
  const wide = isoFrame(e, 2);
  const narrow = isoFrame(e, 0.5);
  expect(wide.target).toEqual([5, 1.5, 4]);
  expect(wide.halfW / wide.halfH).toBeCloseTo(2, 9);
  expect(narrow.halfW / narrow.halfH).toBeCloseTo(0.5, 9);
  // the eight corners all fall inside the frustum of either aspect
  for (const f of [wide, narrow]) for (const x of [0, 10]) for (const y of [0, 3]) for (const z of [0, 8]) {
    const v = [x - f.target[0], y - f.target[1], z - f.target[2]];
    expect(Math.abs(dot(v, ISO_RIGHT))).toBeLessThanOrEqual(f.halfW + 1e-9);
    expect(Math.abs(dot(v, ISO_UP))).toBeLessThanOrEqual(f.halfH + 1e-9);
  }
  expect(wide.dist).toBeGreaterThan(Math.hypot(10, 3, 8)); // the camera stands outside the extent
  expect(isoFrame(e, 2)).toEqual(wide); // the same extent and aspect: the same frame
});

test('the extent of a description comes from its floor plates, the level extent from the level plate', () => {
  const d = sample();
  const e = sceneExtent(d);
  expect([e.x0, e.z0, e.x1, e.z1]).toEqual([0, 0, 10, 8]); // the default level's plate is the whole plan
  expect(e.y0).toBe(-1.2); // L1 sits at -1.2 m
  expect(e.y1).toBeGreaterThanOrEqual(3);
  const l1 = levelExtent(d, 'L1');
  expect(l1.x1 - l1.x0).toBeLessThan(10); // a secondary level covers what sits on it
  expect(l1.y0).toBe(-1.2);
  const noPlates: SceneDescription = { ...d, parts: d.parts.filter((p) => p.kind !== 'floor') };
  expect(sceneExtent(noPlates)).toMatchObject({ x0: 0, z0: 0, x1: 10, z1: 8 }); // the structure layer off: the plan size
});

test('azimuths quantise to the cutaway step and fold to [0, 360)', () => {
  expect(azimuthDeg(5, 5, 0, 0)).toBeCloseTo(45, 9);
  expect(azimuthDeg(-1, 0, 0, 0)).toBeCloseTo(180, 9);
  expect(azimuthDeg(0, -1, 0, 0)).toBeCloseTo(270, 9);
  expect(quantiseAzimuth(44)).toBe(45); // the presets' 45 deg sits mid-bin: noise on either side keeps the same cut
  expect(quantiseAzimuth(46)).toBe(45);
  expect(quantiseAzimuth(45.00001)).toBe(45);
  expect(quantiseAzimuth(44.99999)).toBe(45);
  expect(quantiseAzimuth(359.9)).toBe(355);
  expect(quantiseAzimuth(-4)).toBe(355);
  expect(quantiseAzimuth(0)).toBe(5);
});

test('the cutaway of the demo floor: the near walls facing the camera, their openings with them, the same list every time', () => {
  const d = demo();
  const at45 = cutawayIds(d, 45);
  expect(at45.length).toBeGreaterThan(0);
  expect(at45).toEqual([...at45].sort());
  expect(cutawayIds(d, 45)).toEqual(at45); // deterministic
  expect(cutawayIds({ ...d, parts: [...d.parts].reverse() }, 45)).toEqual(at45); // whatever the part order
  const e = sceneExtent(d);
  const cx = (e.x0 + e.x1) / 2;
  const cz = (e.z0 + e.z1) / 2;
  const byId = new Map(d.parts.map((p) => [p.id, p]));
  for (const id of at45) {
    const p = byId.get(id)!;
    if (p.kind === 'wall') {
      // every cut wall lies on the camera's side: its offset from the centre points toward +x +z
      expect((p.position[0] - cx) + (p.position[2] - cz)).toBeGreaterThan(0);
      // and faces it: the box lies along (cos t, -sin t), so a wall along x (yaw 0) has normals +-z, along z (yaw +-90) +-x
      const t = (p.rotation[1] * Math.PI) / 180;
      const facing = Math.abs(Math.sin(t) * Math.SQRT1_2 + Math.cos(t) * Math.SQRT1_2);
      expect(facing).toBeGreaterThanOrEqual(Math.cos((65 * Math.PI) / 180) - 1e-9);
    } else {
      expect(['lintel', 'sill', 'head', 'window', 'door']).toContain(p.kind); // an opening part follows its wall
      expect(at45.some((w) => byId.get(w)!.kind === 'wall' && withinFootprint(byId.get(w)!, p.position[0], p.position[2], 1))).toBe(true);
    }
  }
  // no cut wall lies in the far half, and the opposite azimuth cuts the opposite side
  const at225 = cutawayIds(d, 225);
  expect(at225.filter((id) => at45.includes(id))).toEqual([]);
  expect(at225.length).toBeGreaterThan(0);
  // walls through the centre are never cut: a description with one wall at the centre yields nothing
  const centre: SceneDescription = { ...d, parts: d.parts.filter((p) => p.kind === 'floor').concat([{ ...byId.get(at45.find((id) => byId.get(id)!.kind === 'wall')!)!, id: 'wall:c', position: [cx, 1.5, cz] }]) };
  expect(cutawayIds(centre, 45)).toEqual([]);
});

test('cutBox keeps the part below the cut height above its level floor, hides one that starts above it', () => {
  const wall = demo().parts.find((p) => p.kind === 'wall')!;
  const cut = cutBox(wall, 0)!;
  expect(cut.h).toBeCloseTo(CUTAWAY_HEIGHT_M, 9);
  expect(cut.y).toBeCloseTo(CUTAWAY_HEIGHT_M / 2, 9);
  const raised = { ...wall, position: [wall.position[0], 5 + wall.size[1] / 2, wall.position[2]] as [number, number, number] };
  expect(cutBox(raised, 0)).toBeNull(); // a lintel-like box above the cut: hidden
  const onUpper = cutBox(raised, 5)!; // the same box on a level at 5 m: cut like the wall, from that floor
  expect(onUpper.h).toBeCloseTo(CUTAWAY_HEIGHT_M, 9);
  expect(onUpper.y).toBeCloseTo(5 + CUTAWAY_HEIGHT_M / 2, 9);
  const low = { ...wall, size: [wall.size[0], 0.3, wall.size[2]] as [number, number, number], position: [0, 0.15, 0] as [number, number, number] };
  expect(cutBox(low, 0)).toEqual({ y: 0.15, h: 0.3 }); // already under the cut: untouched
});
