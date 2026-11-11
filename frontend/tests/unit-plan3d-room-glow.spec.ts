import { test, expect } from '@playwright/test';
import { GLOW_INSET_M, PRESENCE_PLATE_BASE, PRESENCE_RING_BASE, centroidOf, glowLook, inside, insetPolygon, planGlow, poolStrength, poolsFor, signedArea, washSegments, type GlowLamp } from '../src/map/room-glow';
import { PRESENCE_RING_OPACITY, PRESENCE_TINT_OPACITY, type ScenePart } from '../src/map/scene-builder';
import { STUDIO, backdropColors, softboxLevels } from '../src/map/scene-real';
import { lightRecipe } from '../src/map/sun';

// PLAN3D-REALISM-2432: the room glow's plan (pools, inset outline, wall wash strengths, presence weights), the studio
// backdrop's stops and the environment softboxes. Node only: pure functions, no three renderer, no DOM.

const square = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const tint = (zone: string, tag: 'lit' | 'presence' | 'presence-ring', opacity: number, polygon: [number, number][], level = 'L0'): ScenePart =>
  ({ id: `room:${zone}#${tag}`, kind: 'tint', shape: 'prism', position: [0, 0.01, 0], size: [0, 0.01, 0], rotation: [0, 0, 0], color: tag === 'lit' ? 'map-lit' : 'map-presence', opacity, group: null, level_id: level, polygon, userData: { id: zone, kind: 'zone' } }) as ScenePart;
const lamp = (id: string, x: number, z: number, on = true, extra: Partial<GlowLamp> = {}): GlowLamp => ({ id, level_id: 'L0', position: [x, 2.5, z], kind: 'ceiling', color_k: 3000, lumens: 1000, on, ...extra });

test('the presence bases match the builder constants', () => {
  expect(PRESENCE_RING_BASE).toBe(PRESENCE_RING_OPACITY);
  expect(PRESENCE_PLATE_BASE).toBe(PRESENCE_TINT_OPACITY);
});

test('insetPolygon: inward by d, counter-clockwise, either input winding; [] where it folds', () => {
  const sq = square(0, 0, 4, 3);
  const a = insetPolygon(sq, 0.5);
  expect(signedArea(a)).toBeCloseTo(3 * 2, 6);
  expect(a).toEqual([[0.5, 0.5], [3.5, 0.5], [3.5, 2.5], [0.5, 2.5]]);
  const b = insetPolygon([...sq].reverse(), 0.5);
  expect(signedArea(b)).toBeGreaterThan(0);
  expect(new Set(b.map((q) => q.join(',')))).toEqual(new Set(a.map((q) => q.join(','))));
  // a closed ring (first = last) is the same polygon
  expect(insetPolygon([...sq, sq[0]], 0.5)).toEqual(a);
  // a 0.8 m corridor cannot take a 0.5 m inset
  expect(insetPolygon(square(0, 0, 5, 0.8), 0.5)).toEqual([]);
  expect(insetPolygon([[0, 0], [1, 0]], 0.1)).toEqual([]);
  // an L-shaped room keeps six corners, inside the original
  const L: [number, number][] = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]];
  const li = insetPolygon(L, 0.2);
  expect(li.length).toBe(6);
  for (const [x, z] of li) expect(inside(x, z, L)).toBe(true);
});

test('pools: a broad fill at the centroid plus one per lamp that is on inside the room', () => {
  const poly = square(0, 0, 6, 4);
  expect(centroidOf(poly)).toEqual([3, 2]);
  const lamps = [lamp('b', 4.5, 2), lamp('a', 1.5, 2), lamp('off', 3, 3, false), lamp('out', 9, 2)];
  const pools = poolsFor(poly, lamps);
  expect(pools.length).toBe(3);
  expect(pools[0]).toMatchObject({ x: 3, z: 2, w: 0.45 });
  expect(pools.slice(1).map((p) => p.x)).toEqual([1.5, 4.5]); // by lamp id, deterministic
  // no lamp on inside: the fill alone, stronger
  expect(poolsFor(poly, [lamp('off', 3, 3, false)])).toEqual([{ x: 3, z: 2, r: expect.any(Number), w: 0.9 }]);
  // the strength falls off with the distance from the pool
  const s0 = poolStrength(1.5, 2, pools);
  const s1 = poolStrength(0.2, 0.2, pools);
  expect(s0).toBeGreaterThan(s1);
  expect(s0).toBeLessThanOrEqual(1.4);
});

test('planGlow: lit and presence weights per zone from the state tints, zones sorted, the inset outline', () => {
  const big = square(0, 0, 6, 4);
  const small = square(6, 0, 9, 4);
  const parts = [
    tint('z2', 'presence', PRESENCE_TINT_OPACITY * 0.5, small),
    tint('z2', 'presence-ring', PRESENCE_RING_OPACITY * 0.5, insetPolygon(small, 0.3)),
    tint('z1', 'lit', 0.45, big),
    tint('z1', 'presence-ring', PRESENCE_RING_OPACITY, insetPolygon(big, 0.3)),
  ];
  const plan = planGlow(parts, [{ id: 'L0', elevation_m: 0, ceiling_height_m: 2.8 }], [lamp('l1', 2, 2, true, { color_k: 2700 }), lamp('l2', 7, 2, false)]);
  expect(plan.map((r) => r.zone)).toEqual(['z1', 'z2']);
  expect(plan[0]).toMatchObject({ lit: 1, presence: 1, color_k: 2700, y: 0 });
  expect(plan[1]).toMatchObject({ lit: 0, presence: 0.5, color_k: 2900 });
  expect(plan[0].polygon).toEqual(insetPolygon(big, GLOW_INSET_M));
  expect(plan[0].wash).toBeCloseTo(Math.min(1.5, 2.8 * 0.6 - 0.12), 4);
  expect(plan[0].band.length).toBe(4);
  // a ring-only room (no plate, not lit) has no outline to draw: skipped
  expect(planGlow([tint('z3', 'presence-ring', 0.5, insetPolygon(big, 0.3))], [], [])).toEqual([]);
  // equal input, equal plan
  expect(JSON.stringify(planGlow(parts, [{ id: 'L0', elevation_m: 0 }], []))).toBe(JSON.stringify(planGlow([...parts].reverse(), [{ id: 'L0', elevation_m: 0 }], [])));
});

test('washSegments: ~0.4 m segments around the outline, the strength 0.3..1 and highest near a pool', () => {
  const room = { polygon: square(0, 0, 4, 2), pools: [{ x: 0.5, z: 1, r: 1.5, w: 1 }] };
  const segs = washSegments(room);
  expect(segs.length).toBe(10 + 5 + 10 + 5);
  for (const s of segs) for (const v of [s.sa, s.sb]) expect(v).toBeGreaterThanOrEqual(0.3), expect(v).toBeLessThanOrEqual(1);
  const near = segs.filter((s) => s.a[0] === 0).sort((a, b) => Math.abs(a.a[1] - 1) - Math.abs(b.a[1] - 1))[0]; // the left wall, by the pool
  const far = segs.find((s) => s.a[0] === 4)!;
  expect(near.sa).toBeGreaterThan(far.sa);
});

test('glowLook: stronger at night, the dark style a little stronger', () => {
  const day = glowLook('light', 0);
  const night = glowLook('light', 1);
  for (const k of Object.keys(day) as (keyof typeof day)[]) expect(night[k]).toBeGreaterThan(day[k]);
  expect(glowLook('dark', 1).floor).toBeGreaterThan(night.floor);
  expect(glowLook('light', 7)).toEqual(night); // clamped
});

test('the studio backdrop: dark stops easing from day to night; the sky backdrop unchanged by default', () => {
  const day = lightRecipe(45);
  const night = lightRecipe(-20);
  const rgb = (s: string) => s.match(/\d+/g)!.map(Number);
  const lum = (s: string) => rgb(s).reduce((a, b) => a + b, 0);
  const d = backdropColors(day, 'light', 'studio');
  const n = backdropColors(night, 'light', 'studio');
  expect(rgb(d[0])).toEqual([0x1b, 0x25, 0x36]);
  expect(lum(n[0])).toBeLessThan(lum(d[0]));
  for (const s of [...d, ...n]) expect(lum(s)).toBeLessThan(3 * 110); // dark
  expect(backdropColors(day, 'light')).toEqual(backdropColors(day, 'light', 'sky'));
  expect(STUDIO.discScale).toBeLessThan(1); // the studio plinth is smaller than the sky's ground disc
});

test('the environment softboxes: bright overhead by day, a warm low panel at night, the dark style dimmer', () => {
  const day = softboxLevels({ day: 1, night: 0 }, 'light');
  const night = softboxLevels({ day: 0, night: 1 }, 'light');
  expect(day[0][0]).toBeGreaterThan(1);
  expect(night[0][0]).toBeLessThan(0.1);
  expect(night[2][0]).toBeGreaterThan(night[2][2]); // warm: red over blue
  expect(night[2][0]).toBeGreaterThan(night[0][0]);
  expect(softboxLevels({ day: 1, night: 0 }, 'dark')[0][0]).toBeLessThan(day[0][0]);
});
