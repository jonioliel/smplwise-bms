import { test, expect } from '@playwright/test';
import { CAMERA_SUGGEST_DEFAULTS, bearingDeg, distanceToPolygon, facingShare, sanitizeSettings, suggestCameras, type SuggestCamera, type SuggestZone } from '../src/map/camera-suggest';

// Nearest cameras for a zone (CAMSUGGEST138-295 / r138): distance to the zone, an optional field-of-view check, the same floor
// only, at most three, never an excluded id. Runs in node: no page, no backend.
const SQ = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const ZONE: SuggestZone = { id: 'z', floorId: 'f1', polygon: SQ(0.4, 0.4, 0.6, 0.6) };
const cam = (id: string, x: number, y: number, over: Partial<SuggestCamera> = {}): SuggestCamera => ({ id, floorId: 'f1', position: { x, y }, rotationDeg: 0, fovDeg: null, ...over });

test('distance to a polygon is 0 inside and the edge distance outside; aspect scales y', () => {
  expect(distanceToPolygon({ x: 0.5, y: 0.5 }, ZONE.polygon)).toBe(0);
  expect(distanceToPolygon({ x: 0.3, y: 0.5 }, ZONE.polygon)).toBeCloseTo(0.1, 9);
  expect(distanceToPolygon({ x: 0.3, y: 0.3 }, ZONE.polygon)).toBeCloseTo(Math.hypot(0.1, 0.1), 9);
  // a 2:1 plan: 0.1 of the height is 0.05 of the width
  expect(distanceToPolygon({ x: 0.5, y: 0.3 }, ZONE.polygon, 2)).toBeCloseTo(0.05, 9);
  expect(distanceToPolygon({ x: 0.5, y: 0.3 }, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(Infinity);
});

test('bearings are 0 = up, clockwise', () => {
  const o = { x: 0.5, y: 0.5 };
  expect(bearingDeg(o, { x: 0.5, y: 0.2 })).toBeCloseTo(0, 6);
  expect(bearingDeg(o, { x: 0.8, y: 0.5 })).toBeCloseTo(90, 6);
  expect(bearingDeg(o, { x: 0.5, y: 0.8 })).toBeCloseTo(180, 6);
  expect(bearingDeg(o, { x: 0.2, y: 0.5 })).toBeCloseTo(270, 6);
});

test('facing share: a camera looking at the zone sees all of it, looking away sees none', () => {
  const west = { x: 0.1, y: 0.5 };
  expect(facingShare(west, 90, 120, ZONE.polygon)).toBe(1); // faces east, the zone is east
  expect(facingShare(west, 270, 90, ZONE.polygon)).toBe(0); // faces west
  const part = facingShare(west, 90, 10, ZONE.polygon);
  expect(part).toBeGreaterThan(0);
  expect(part).toBeLessThan(1);
  expect(facingShare(west, 90, 360, ZONE.polygon)).toBe(1);
});

test('ranked by distance, at most three, never beyond the max distance', () => {
  const cams = [cam('far', 0.95, 0.5), cam('c3', 0.25, 0.5), cam('c1', 0.5, 0.5), cam('c2', 0.35, 0.5), cam('c4', 0.2, 0.5)];
  const s = suggestCameras(ZONE, cams);
  expect(s.map((x) => x.id)).toEqual(['c1', 'c2', 'c3']);
  expect(s[0].inside).toBe(true);
  expect(s[1].distance).toBeCloseTo(0.05, 9);
  expect(suggestCameras(ZONE, cams, { maxDistance: 0.1 }).map((x) => x.id)).toEqual(['c1', 'c2']);
  expect(suggestCameras(ZONE, cams, { maxSuggestions: 1 }).map((x) => x.id)).toEqual(['c1']);
  expect(suggestCameras(ZONE, cams, { maxSuggestions: 9 }).length, 'the cap of three holds').toBeLessThanOrEqual(3);
});

test('only the same floor counts, and the same level when both name one', () => {
  const cams = [cam('other-floor', 0.5, 0.5, { floorId: 'f2' }), cam('same', 0.3, 0.5), cam('up', 0.45, 0.5, { levelId: 'L2' }), cam('down', 0.46, 0.5, { levelId: 'L1' })];
  expect(suggestCameras({ ...ZONE, levelId: 'L1' }, cams).map((x) => x.id)).toEqual(['down', 'same']);
  expect(suggestCameras(ZONE, cams).map((x) => x.id)).toContain('up'); // the zone names no level: any level
});

test('a known field of view that faces away ranks a nearer camera behind a farther one that faces the zone', () => {
  const away = cam('away', 0.35, 0.5, { rotationDeg: 270, fovDeg: 90 }); // 0.05 away, looking west
  const facing = cam('facing', 0.2, 0.5, { rotationDeg: 90, fovDeg: 90 }); // 0.2 away, looking at it
  const blind = cam('blind', 0.3, 0.5); // 0.1 away, no field of view known: distance alone
  const s = suggestCameras(ZONE, [away, facing, blind], { fovWeight: 0.5 });
  expect(s.map((x) => x.id)).toEqual(['blind', 'facing', 'away']);
  expect(s.find((x) => x.id === 'blind')!.facing).toBeNull();
  expect(s.find((x) => x.id === 'facing')!.facing).toBe(1);
  expect(s.find((x) => x.id === 'away')!.facing).toBe(0);
  // weight 0 = distance only
  expect(suggestCameras(ZONE, [away, facing, blind], { fovWeight: 0 }).map((x) => x.id)).toEqual(['away', 'blind', 'facing']);
  // weight 1 = a camera that misses the zone entirely is not offered
  expect(suggestCameras(ZONE, [away, facing, blind], { fovWeight: 1 }).map((x) => x.id)).toEqual(['blind', 'facing']);
});

test('exclude, empty and degenerate input', () => {
  expect(suggestCameras(ZONE, [cam('a', 0.5, 0.5), cam('b', 0.45, 0.5)], {}, { exclude: ['a'] }).map((x) => x.id)).toEqual(['b']);
  expect(suggestCameras(ZONE, [])).toEqual([]);
  expect(suggestCameras({ ...ZONE, polygon: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, [cam('a', 0.5, 0.5)])).toEqual([]);
  // a tie on score falls back to the id so the order is stable
  expect(suggestCameras(ZONE, [cam('b', 0.5, 0.5), cam('a', 0.55, 0.55)]).map((x) => x.id)).toEqual(['a', 'b']);
});

test('settings are sanitised to the defaults when out of range', () => {
  expect(sanitizeSettings(null)).toEqual(CAMERA_SUGGEST_DEFAULTS);
  expect(sanitizeSettings({ maxDistance: 0, fovWeight: 2, maxSuggestions: 7 })).toEqual(CAMERA_SUGGEST_DEFAULTS);
  expect(sanitizeSettings({ maxDistance: 0.2, fovWeight: 1, maxSuggestions: 2 })).toEqual({ maxDistance: 0.2, fovWeight: 1, maxSuggestions: 2 });
});
