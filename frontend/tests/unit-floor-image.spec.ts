import { test, expect } from '@playwright/test';
import { affineFromCorners, applyAffine, cornerResidual, isDefaultCorners, moveCorner, shiftCorners, affineAttr, type Corners } from '../src/map/floor-image';

// K88: the alignment maths of an own floor image (pure, node-only). The plan rectangle (0,0)-(w,h) is sent to the stored
// corners by a least-squares affine map: exact for a scaled / rotated / sheared placement, a reported residual otherwise.

const W = 1200, H = 800;
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

test('the plan corners give the identity', () => {
  const t = affineFromCorners([[0, 0], [1, 0], [1, 1], [0, 1]], W, H);
  expect(near(t.a, 1) && near(t.b, 0) && near(t.c, 0) && near(t.d, 1) && near(t.e, 0) && near(t.f, 0)).toBe(true);
  expect(affineAttr(t)).toBe('matrix(1 0 0 1 0 0)');
  expect(isDefaultCorners([[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(true);
  expect(isDefaultCorners(null)).toBe(true);
});

test('a scaled and shifted picture maps its corners exactly', () => {
  const c: Corners = [[0.1, 0.2], [0.7, 0.2], [0.7, 0.8], [0.1, 0.8]];
  const t = affineFromCorners(c, W, H);
  const tl = applyAffine(t, { x: 0, y: 0 });
  const br = applyAffine(t, { x: W, y: H });
  expect(near(tl.x, 0.1 * W) && near(tl.y, 0.2 * H)).toBe(true);
  expect(near(br.x, 0.7 * W) && near(br.y, 0.8 * H)).toBe(true);
  expect(cornerResidual(c, W, H)).toBeLessThan(1e-9);
  expect(isDefaultCorners(c)).toBe(false);
});

test('a rotated picture (90 degrees) is still exact', () => {
  // top-left of the picture at the plan's top-right corner, going down: a quarter turn
  const c: Corners = [[1, 0], [1, 1], [0, 1], [0, 0]];
  const t = affineFromCorners(c, W, H);
  const tr = applyAffine(t, { x: W, y: 0 });
  expect(near(tr.x, W) && near(tr.y, H)).toBe(true);
  expect(cornerResidual(c, W, H)).toBeLessThan(1e-9);
});

test('a perspective quad reports a residual and keeps a usable map', () => {
  const c: Corners = [[0.1, 0.1], [0.9, 0.15], [0.8, 0.9], [0.2, 0.85]];
  const r = cornerResidual(c, W, H);
  expect(r).toBeGreaterThan(0.002);
  expect(r).toBeLessThan(0.1);
  const t = affineFromCorners(c, W, H);
  expect(Math.abs(t.a * t.d - t.b * t.c)).toBeGreaterThan(0.1);
});

test('degenerate corners fall back to the identity', () => {
  const t = affineFromCorners([[0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]], W, H);
  expect(t.a).toBe(1);
  expect(t.e).toBe(0);
  expect(affineFromCorners([[0, 0], [1, 0], [1, 1]] as unknown as Corners, W, H).d).toBe(1);
});

test('moving and shifting corners stays inside the allowed range', () => {
  const c: Corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const moved = moveCorner(c, 2, { x: 5, y: -5 });
  expect(moved[2]).toEqual([2, -1]);
  expect(moved[0]).toEqual([0, 0]);
  const shifted = shiftCorners(c, 0.25, -0.5);
  expect(shifted[0]).toEqual([0.25, -0.5]);
  expect(shifted[2]).toEqual([1.25, 0.5]);
  expect(c[0]).toEqual([0, 0]); // the inputs are never mutated
});
