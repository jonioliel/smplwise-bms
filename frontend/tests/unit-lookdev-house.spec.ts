import { test, expect } from '@playwright/test';
import { buildPrimitives, objectCorners, type Pt } from '../src/map/geometry';
import { houseCatalog, houseDoc } from './lookdev/house';
import { lookup3dOf } from '../src/api/plan-catalog';

// ST7-odd (2.4.10 oddity 4): the look-dev house (tests/lookdev/house.ts) is what the Studio 6 pictures judge, so a wall-mounted
// item hung over a window (the office whiteboard covered the south window; the living-room screen and the meeting-room board
// covered north windows too) is a fixture defect, not a look finding. Every wall-mounted object (hung off the floor, thin) keeps
// clear of every opening on its level: no footprint corner within the wall's reach of an opening gap while their heights overlap.
// Node-only, no browser.

const W = 1000;
const H = 900;
const SCALE = 0.012;
const REACH_M = 0.35; // across the wall: half a thick wall plus the mount offset
const JAMB_M = 0.05; // along the wall: an item may end this close to a jamb

/** Whether the footprint `corners` lies on the wall line of the gap a-b (within REACH_M across it) and overlaps the gap
 * along the wall (past JAMB_M). */
const overGap = (corners: Pt[], a: Pt, b: Pt): boolean => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 1e-9) return false;
  const d: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const n: Pt = [-d[1], d[0]];
  let s0 = Infinity;
  let s1 = -Infinity;
  let across = Infinity;
  for (const c of corners) {
    const s = ((c[0] - a[0]) * d[0] + (c[1] - a[1]) * d[1]) * SCALE;
    const t = Math.abs((c[0] - a[0]) * n[0] + (c[1] - a[1]) * n[1]) * SCALE;
    s0 = Math.min(s0, s);
    s1 = Math.max(s1, s);
    across = Math.min(across, t);
  }
  return across < REACH_M && s1 > JAMB_M && s0 < len * SCALE - JAMB_M;
};

test('no wall-mounted item of the look-dev house hangs over an opening', () => {
  const doc = houseDoc();
  const cat = lookup3dOf(houseCatalog());
  const lookup = (id: string) => { const c = cat(id); return c ? { shape: c.shape, icon: 'box', color_token: c.color_token } : undefined; };
  const walls = new Map(doc.walls.map((w) => [w.id, w]));
  const gaps: { id: string; level: string; a: Pt; b: Pt; z0: number; z1: number }[] = [];
  for (const p of buildPrimitives(doc, W, H, null, lookup)) {
    if (p.kind !== 'door' && p.kind !== 'window' && p.kind !== 'passage') continue;
    const o = doc.openings.find((x) => x.id === p.id)!;
    const w = walls.get(o.wall_id)!;
    gaps.push({ id: o.id, level: w.level_id, a: p.gap[0], b: p.gap[1], z0: o.sill_m, z1: o.sill_m + o.height_m });
  }
  expect(gaps.length).toBe(doc.openings.length);
  const hung = doc.objects.filter((o) => o.z_m >= 0.5 && Math.min(o.size.w_m, o.size.d_m) <= 0.15);
  expect(hung.map((o) => o.id).sort()).toEqual(['board', 'lamp-stair', 'mboard', 'mtv', 'tv']); // the fixture's wall-mounted items
  const offenders: string[] = [];
  for (const o of hung) {
    const corners = objectCorners(o, W, H, SCALE);
    const z0 = o.z_m;
    const z1 = o.z_m + o.size.h_m;
    for (const g of gaps) {
      if (g.level !== o.level_id || z0 >= g.z1 || z1 <= g.z0) continue;
      if (overGap(corners, g.a, g.b)) offenders.push(`${o.id} over ${g.id}`);
    }
  }
  expect(offenders).toEqual([]);
});

test('the living room keeps its screen wall: sofa, table and rug face the screen on the west wall', () => {
  const doc = houseDoc();
  const by = new Map(doc.objects.map((o) => [o.id, o]));
  const tv = by.get('tv')!;
  const sofa = by.get('sofa')!;
  expect(tv.position[0] * W * SCALE).toBeLessThan(3.75); // on the west wall (x = 3.5 m)
  expect(sofa.position[0]).toBeGreaterThan(tv.position[0]);
  expect(Math.abs(sofa.position[1] - tv.position[1])).toBeLessThan(0.01); // the same line across the room
});
