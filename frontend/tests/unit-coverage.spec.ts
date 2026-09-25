import { test, expect } from '@playwright/test';
import type { GeometryDoc, GeomOpening, GeomWall, Pt } from '../src/map/geometry';
import { blockingSegments, clipCoverage, coveragePolygon, CoverageCache, hasWallsOnLevel, isOpenState, raySegment } from '../src/map/coverage';

// Plan Studio phase 4 (T087, ruling R-P4-2): camera coverage stops at the walls of the camera's level - a passage lets a
// ray through, a closed door and a window stop it, an open door (its entity in an open state) lets it through. Node only.
const W = 1000;
const H = 800;

const wall = (id: string, polyline: Pt[], level = 'L0'): GeomWall => ({ id, level_id: level, polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} });
const opening = (id: string, wall_id: string, kind: GeomOpening['kind'], anchor: string | null = null): GeomOpening => ({ id, wall_id, t: 0.5, kind, width_m: 0.9, height_m: 2.1, sill_m: kind === 'window' ? 0.9 : 0, swing: kind === 'door' ? 'left' : 'none', hinge: 'start', anchor_ref: anchor ? { resource_type: 'ha_entity', resource_id: anchor } : null, confidence: 1, source: 'manual', external_ids: {} });

/** A closed room 0.2..0.8 x 0.3..0.7 around the plan centre; the camera sits at (0.5, 0.5). 1 m = 100 px. */
function doc(openings: GeomOpening[] = [], extraWalls: GeomWall[] = []): GeometryDoc {
  return {
    schema_version: '2.0', plan_version_id: 'v', floor_id: 'f', source: { sha256: '', file_name: 'p.png', mime: 'image/png', page: 1 },
    dimensions: { width_px: W, height_px: H, scale_m_per_px: 0.01, calibration: { status: 'measured', method: 'two_point', pairs: [], residual_pct: 0, reason: null } },
    transform: { rotation: 0, crop: null },
    levels: [{ id: 'L0', name: 'ראשי', elevation_m: 0, ceiling_height_m: 3, is_default: true }, { id: 'L1', name: 'תחתון', elevation_m: -1.2, ceiling_height_m: 6, is_default: false }],
    walls: [wall('n', [[0.2, 0.3], [0.8, 0.3]]), wall('e', [[0.8, 0.3], [0.8, 0.7]]), wall('s', [[0.8, 0.7], [0.2, 0.7]]), wall('w', [[0.2, 0.7], [0.2, 0.3]]), ...extraWalls],
    openings, rooms: [], objects: [], circuits: [], connectors: [], labels: [], groups: [], uncertain_regions: [], uncertainty: { overall: 0, notes: [] },
    meta: { generator: 'test', tokens_version: 'map-1', detector_version: null },
  };
}

const origin: Pt = [W / 2, H / 2];
/** The point the ray at `bearing` reaches in a full-circle clip (360 rays: index = bearing + 180). */
const at = (pts: Pt[], bearing: number): Pt => pts[((bearing + 180) % 360 + 360) % 360];

test('ray against segment: hit distance, misses behind, beside and parallel', () => {
  expect(raySegment([0, 0], [1, 0], [5, -1], [5, 1])).toBeCloseTo(5, 9);
  expect(raySegment([0, 0], [1, 0], [-5, -1], [-5, 1])).toBeNull(); // behind the origin
  expect(raySegment([0, 0], [1, 0], [5, 1], [5, 3])).toBeNull(); // beside the ray
  expect(raySegment([0, 0], [1, 0], [5, 0], [9, 0])).toBeNull(); // parallel
  expect(raySegment([0, 0], [0, -1], [-1, -4], [1, -4])).toBeCloseTo(4, 9); // up (plan y down): bearing 0
});

test('walls in the four directions stop the rays; the corners of the room are the farthest points', () => {
  const segs = blockingSegments(doc(), W, H, 'L0', {});
  expect(segs.length).toBe(4);
  const pts = clipCoverage(origin, 0, 360, 400, segs);
  expect(pts.length).toBe(360); // one per degree, no origin in a full circle, the closing ray not repeated
  expect(at(pts, 0)).toEqual([500, 240]); // north wall at y = 0.3 * 800
  expect(at(pts, 90)).toEqual([800, 400]); // east wall at x = 0.8 * 1000
  expect(at(pts, 180)).toEqual([500, 560]);
  expect(at(pts, 270)).toEqual([200, 400]);
  const far = Math.max(...pts.map((p) => Math.hypot(p[0] - origin[0], p[1] - origin[1])));
  expect(far).toBeLessThanOrEqual(Math.hypot(300, 160) + 1);
  // a narrow field: the origin comes first and the fan has fov + 1 points after it
  const fan = clipCoverage(origin, 90, 60, 400, segs);
  expect(fan[0]).toEqual([500, 400]);
  expect(fan.length).toBe(62);
  expect(fan.every((p) => p[0] <= 800.01)).toBe(true);
});

test('without walls the arc is the plain radius', () => {
  const pts = clipCoverage(origin, 0, 90, 140, []);
  expect(pts[0]).toEqual([500, 400]);
  for (const p of pts.slice(1)) expect(Math.hypot(p[0] - 500, p[1] - 400)).toBeCloseTo(140, 1);
});

test('a passage lets the ray through, a closed door and a window stop it, an open door lets it through', () => {
  const north = (o: GeomOpening | null, states: Record<string, string | null> = {}) => at(clipCoverage(origin, 0, 360, 400, blockingSegments(doc(o ? [o] : []), W, H, 'L0', states)), 0);
  expect(north(null)).toEqual([500, 240]);
  expect(north(opening('p', 'n', 'passage'))).toEqual([500, 0]); // through the gap to the radius (y = 400 - 400)
  expect(north(opening('d', 'n', 'door'))).toEqual([500, 240]); // a door without an entity is closed
  expect(north(opening('d', 'n', 'door', 'lock.front'), { 'lock.front': 'locked' })).toEqual([500, 240]);
  // ruling R-P4-T2-1: a lock state says nothing about the leaf - an unlocked door is still closed for a ray
  expect(north(opening('d', 'n', 'door', 'lock.front'), { 'lock.front': 'unlocked' })).toEqual([500, 240]);
  expect(north(opening('d', 'n', 'door', 'cover.front'), { 'cover.front': 'open' })).toEqual([500, 0]);
  expect(north(opening('d', 'n', 'door', 'binary_sensor.front'), { 'binary_sensor.front': 'on' })).toEqual([500, 0]);
  expect(north(opening('g', 'n', 'window'))).toEqual([500, 240]);
  expect(isOpenState('open') && isOpenState('on') && isOpenState('opening')).toBe(true);
  expect(isOpenState('closed') || isOpenState('locked') || isOpenState('unlocked') || isOpenState('off') || isOpenState(null) || isOpenState(undefined)).toBe(false);
});

test('only the walls of the camera level block; the normalized polygon is rounded and deterministic', () => {
  const d = doc([], [wall('lower', [[0.45, 0.35], [0.55, 0.35]], 'L1')]); // a wall on the lower level, right in front of the camera
  expect(hasWallsOnLevel(d, 'L0') && hasWallsOnLevel(d, 'L1') && !hasWallsOnLevel(d, 'L2')).toBe(true);
  const m = { x: 0.5, y: 0.5, rotation: 0, fov: 90, radiusPx: 400, level: 'L0' };
  const a = coveragePolygon(m, d, W, H, {});
  expect(a[0]).toEqual([0.5, 0.5]);
  expect(a[46]).toEqual([0.5, 0.3]); // the middle ray (bearing 0) stops at the north wall, not at the lower level's wall
  expect(coveragePolygon({ ...m, level: 'L1' }, d, W, H, {})[46]).toEqual([0.5, 0.35]);
  expect(JSON.stringify(coveragePolygon(m, d, W, H, {}))).toBe(JSON.stringify(a));
  expect(a.every((p) => String(p[0]).length <= 7 && String(p[1]).length <= 7)).toBe(true); // 5 decimals at most
});

test('a camera on a wall or inside its thickness keeps its coverage on the side it faces and does not leak behind it', () => {
  const segs = blockingSegments(doc([opening('d', 'n', 'door')]), W, H, 'L0', {});
  expect(segs.every((g) => g.w === 20)).toBe(true); // 0.2 m at 100 px/m: the wall parts and the door gap carry the thickness
  for (const y of [238, 240, 242]) {
    const fan = clipCoverage([500, y], 180, 90, 400, segs); // on the north wall (centre y = 240, faces 230..250), facing south
    expect(fan[46]).toEqual([500, 560]); // the middle ray reaches the south wall
    expect(clipCoverage([500, y], 180, 360, 400, segs)[0]).toEqual([500, y]); // facing south, index 0 is bearing 0: the ray behind stops in the wall
  }
  // a corner camera inside both the north and the west wall, facing into the room
  const corner = clipCoverage([198, 238], 135, 90, 600, segs);
  expect(corner[46]).toEqual([520, 560]);
  expect(Math.min(...corner.slice(1).map((p) => Math.hypot(p[0] - 198, p[1] - 238)))).toBeGreaterThan(300);
  // a camera away from the walls is unchanged: rays still stop at the wall centre line
  expect(at(clipCoverage(origin, 0, 360, 400, segs), 180)).toEqual([500, 560]);
});

test('the coverage cache follows the document identity and the door states, and shares the blocking segments', () => {
  const cache = new CoverageCache();
  const m = { x: 0.5, y: 0.5, rotation: 0, fov: 90, radiusPx: 400, level: 'L0' };
  const d1 = doc([opening('d', 'n', 'door', 'binary_sensor.front')]);
  const p1 = cache.polygon('c', m, d1, W, H, {});
  expect(p1[46]).toEqual([0.5, 0.3]);
  expect(cache.polygon('c', m, d1, W, H, {})).toBe(p1); // same inputs: the cached array
  expect(cache.segments(d1, W, H, 'L0', {})).toBe(cache.segments(d1, W, H, 'L0', { 'other.entity': 'on' })); // shared across cameras and unrelated states
  expect(cache.polygon('c', m, d1, W, H, { 'binary_sensor.front': 'on' })[46]).toEqual([0.5, 0]); // the door opened
  const d2 = doc([], [wall('mid', [[0.3, 0.4], [0.7, 0.4]])]); // a new document object (an edit): recomputed, not the old cone
  expect(cache.polygon('c', m, d2, W, H, {})[46]).toEqual([0.5, 0.4]);
  expect(cache.polygon('c', { ...m, rotation: 90 }, d2, W, H, {})[46]).toEqual([0.8, 0.5]);
  expect(JSON.stringify(cache.polygon('c', m, d1, W, H, {}))).toBe(JSON.stringify(coveragePolygon(m, d1, W, H, {})));
});
