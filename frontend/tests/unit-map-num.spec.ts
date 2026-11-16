import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clamp, deg, isNum, r4, r4round, r4z, rad, round5 } from '../src/map/num';
import { r4 as sceneR4 } from '../src/map/scene-builder';
import { r4 as walkR4 } from '../src/map/walk-world';

// CR-MAP-NUM-PRESS-2440 (code review 08:F20): the number helpers of the map modules are one definition each in map/num.ts.
// The scene description is hashed (AO volume cache, stills, determinism specs), so each helper is pinned BIT FOR BIT to the
// private copy it replaced (kept below as the reference), over the awkward values: halves, the largest double below a
// half, negative zero, tiny and huge numbers, NaN and the infinities.

const before = {
  rad: (d: number): number => (d * Math.PI) / 180,
  deg: (r: number): number => (r * 180) / Math.PI,
  isNum: (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v),
  clamp: (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v)),
  round5: (v: number): number => Math.round(v * 1e5) / 1e5,
  r4scene: (v: number): number => Math.floor(v * 1e4 + 0.5) / 1e4, // scene-builder.ts, scene-real-builder.ts
  r4walkWorld: (v: number): number => Math.floor(v * 1e4 + 0.5) / 1e4 + 0, // walk-world.ts
  r4walkController: (v: number): number => Math.round(v * 1e4) / 1e4 + 0, // walk-controller.ts
};

function samples(): number[] {
  const out = [0, -0, 1, -1, 0.5, -0.5, 0.00005, -0.00005, 0.000049999999999999996, 0.49999999999999994, -0.49999999999999994, 0.49999999999999994 / 1e4, -0.00002, -0.2 / 1e4, 1e-12, -1e-12,
    1.00005, 2.675, 2.67495, 1234.56785, -1234.56785, 0.1 + 0.2, 1 / 3, -1 / 3, Math.PI, -Math.PI, Math.E, 90, 180, 270, 360, -45, 1e15, -1e15, 2 ** 52, 2 ** 53, Number.MAX_SAFE_INTEGER, Number.MIN_VALUE, -Number.MIN_VALUE,
    Number.EPSILON, NaN, Infinity, -Infinity];
  // a deterministic spread (no Math.random: the spec must test the same numbers every run)
  let s = 0x2440;
  for (let i = 0; i < 4000; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const u = s / 0x100000000;
    out.push((u - 0.5) * 200, (u - 0.5) * 2, Math.round((u - 0.5) * 2e5) / 1e5 + 0.000005, (Math.round(u * 1e5) + 0.5) / 1e5, -(Math.round(u * 1e5) + 0.5) / 1e5);
  }
  return out;
}

/** Same bits: Object.is tells -0 from 0 and takes NaN as equal to NaN. */
const same = (a: number, b: number): boolean => Object.is(a, b);

test('every helper answers bit for bit what the private copy it replaced answered', () => {
  const bad: string[] = [];
  for (const v of samples()) {
    if (!same(rad(v), before.rad(v))) bad.push(`rad(${v})`);
    if (!same(deg(v), before.deg(v))) bad.push(`deg(${v})`);
    if (!same(round5(v), before.round5(v))) bad.push(`round5(${v})`);
    if (!same(r4(v), before.r4scene(v))) bad.push(`r4(${v})`);
    if (!same(r4z(v), before.r4walkWorld(v))) bad.push(`r4z(${v})`);
    if (!same(r4round(v), before.r4walkController(v))) bad.push(`r4round(${v})`);
    if (!same(clamp(v, -1, 1), before.clamp(v, -1, 1))) bad.push(`clamp(${v})`);
    if (isNum(v) !== before.isNum(v)) bad.push(`isNum(${v})`);
  }
  expect(bad).toEqual([]);
  for (const v of ['1', null, undefined, {}, [], true, 1n]) expect(isNum(v)).toBe(false);
  expect(clamp(5, 3, 1)).toBe(1); // lo above hi answers hi, as before
});

test('the three 0.1 mm rules are different functions and each module keeps its own', () => {
  // the sign of a zero: flooring a small negative gives a plain 0; Math.round gives -0, which is why that rule ends with + 0
  expect(Object.is(r4(-0.00002), 0)).toBe(true);
  expect(Object.is(r4z(-0.00002), 0)).toBe(true);
  expect(Object.is(Math.round(-0.2) / 1e4, -0)).toBe(true);
  expect(Object.is(r4round(-0.00002), 0)).toBe(true);
  // the largest double below a half: floor(x + 0.5) rounds it up to 1, Math.round answers 0 - so r4 and r4round differ
  const edge = 0.49999999999999994;
  expect(Math.floor(edge + 0.5)).toBe(1);
  expect(Math.round(edge)).toBe(0);
  // what the modules export is the rule they had
  expect(sceneR4).toBe(r4);
  expect(walkR4).toBe(r4z);
  for (const v of samples()) {
    expect(same(sceneR4(v), before.r4scene(v))).toBe(true);
    expect(same(walkR4(v), before.r4walkWorld(v))).toBe(true);
  }
});

test('the map files of the row import the helpers and keep no private copy', () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'map');
  const own = /^(export )?const (rad|deg|isNum|clamp|round5|r4) = \(/m;
  for (const f of ['scene-builder.ts', 'scene-real-builder.ts', 'scene-three.ts', 'still-bake.ts', 'walk-world.ts', 'walk-controller.ts', 'studio-ops.ts', 'curve-ops.ts']) {
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    expect(s, f).toContain("from './num'");
    expect(own.test(s), f).toBe(false);
  }
  // the walk controller's rule is Math.round, not the scene's floor: the alias must say so
  expect(fs.readFileSync(path.join(dir, 'walk-controller.ts'), 'utf8')).toContain('r4round as r4');
});
