import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrimitives, pointOnWall, type DoorPrim, type GeometryDoc } from '../src/map/geometry';
import type { DoorProposal } from '../src/api/geometry';
import { GHOST_DOOR_ID, GHOST_JAMB_M, GHOST_WALL_ID, acceptGhost, defaultGhost, flipHinge, flipSwing, ghostDoc, ghostFromProposal, ghostHandles, ghostWidthTo, onGhost } from '../src/map/door-tool';

// The "סמן דלת" tool (T087): the pure steps from the server's door proposal to the ghost the editor shows, its handles
// and adjustments, and the accepted door - an ordinary opening added as one new document (one undo step). Runs in node.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sample = () => JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry', 'sample-v2.json'), 'utf8')) as GeometryDoc;
const W = 1000;
const H = 800; // sample-v2: 1000 x 800 px, 0.01 m / px, wall "wb" from (0.1, 0.5) to (0.6, 0.5) - 5 m along +x
const DEFAULTS = { thickness_m: 0.2, kind: 'interior' as const };

const proposal = (over: Partial<DoorProposal> = {}): DoorProposal => ({
  found: 'arc', note: 'נמצאה קשת', wall_id: 'wb', t: 0.3, new_wall: null, width_px: 85, hinge: 'start', swing: 'left', confidence: 0.8, warning: null, elapsed_ms: 40, version_id: 'v', level_id: 'L0', ...over,
});

test.describe('the mark-door tool (unit)', () => {
  test('a proposal on a drawn wall: metres from its pixels at the document scale, the default width when none was measured', () => {
    const doc = sample();
    const g = ghostFromProposal(doc, proposal(), W, H, DEFAULTS);
    expect(g).toMatchObject({ wallId: 'wb', newWall: null, t: 0.3, width_m: 0.85, hinge: 'start', swing: 'left', found: 'arc', note: 'נמצאה קשת' });
    expect(ghostFromProposal(doc, proposal({ width_px: null, found: 'default', note: 'ברירת מחדל - בדוק' }), W, H, DEFAULTS).width_m).toBe(0.9);
    // a door near the wall's end is pulled inside it (the validator's opening_outside_wall)
    expect(ghostFromProposal(doc, proposal({ t: 0.01 }), W, H, DEFAULTS).t).toBeCloseTo(0.085, 3);
  });

  test('the ghost draws as a door on its wall; handles sit at the latch, beside the hinge and on the swing side', () => {
    const doc = sample();
    const g = ghostFromProposal(doc, proposal(), W, H, DEFAULTS);
    const gd = ghostDoc(doc, g, DEFAULTS)!;
    expect(gd.walls.map((w) => w.id)).toEqual(['wb']);
    expect(gd.openings.map((o) => o.id)).toEqual([GHOST_DOOR_ID]);
    const door = buildPrimitives(gd, W, H).find((p): p is DoorPrim => p.kind === 'door')!;
    expect(door.leaves.length).toBe(1);
    const hs = ghostHandles(doc, g, W, H);
    expect(hs.map((h) => h.id)).toEqual(['width', 'hinge', 'swing']);
    const c = pointOnWall(doc.walls.find((w) => w.id === 'wb')!, 0.3, W, H);
    const width = hs.find((h) => h.id === 'width')!.at;
    expect(width[0] * W).toBeCloseTo(c[0] * W + 42.5, 0); // the latch end: hinged at the start, the latch is towards +x
    expect(hs.find((h) => h.id === 'swing')!.at[1]).toBeLessThan(c[1]); // opens to the wall's left: up the page
    const hinge = hs.find((h) => h.id === 'hinge')!.at;
    expect(hinge[0] * W).toBeLessThan(c[0] * W - 42.5); // on the wall, past the hinge end (the start side)
    expect(hinge[1]).toBeCloseTo(c[1], 5);
  });

  test('flips and the width drag', () => {
    const doc = sample();
    const g = ghostFromProposal(doc, proposal(), W, H, DEFAULTS);
    expect(flipHinge(g).hinge).toBe('end');
    expect(flipSwing(g).swing).toBe('right');
    const d = ghostFromProposal(doc, proposal({ swing: 'double', found: 'double', width_px: 160 }), W, H, DEFAULTS);
    expect(flipSwing(d)).toMatchObject({ swing: 'double', hinge: 'end' }); // a double door's side
    expect(ghostHandles(doc, d, W, H).map((h) => h.id)).toEqual(['width', 'swing']); // no hinge to flip
    const c = pointOnWall(doc.walls.find((w) => w.id === 'wb')!, 0.3, W, H);
    expect(ghostWidthTo(doc, g, [c[0] + 0.05, c[1] + 0.01], W, H).width_m).toBe(1); // 50 px from the centre -> 1 m
    expect(ghostWidthTo(doc, g, [c[0] + 0.001, c[1]], W, H).width_m).toBe(0.4); // the smallest door
    expect(ghostWidthTo(doc, g, [c[0] + 0.9, c[1]], W, H).width_m).toBe(3); // the widest
  });

  test('accepting adds an ordinary opening as one new document', () => {
    const doc = sample();
    const g = flipSwing(ghostFromProposal(doc, proposal(), W, H, DEFAULTS));
    const r = acceptGhost(doc, g, W, H, DEFAULTS)!;
    expect(r.doc.openings.length).toBe(doc.openings.length + 1);
    expect(r.doc.walls.length).toBe(doc.walls.length);
    const o = r.doc.openings.find((x) => x.id === r.openingId)!;
    expect(o).toMatchObject({ wall_id: 'wb', kind: 'door', t: 0.3, width_m: 0.85, swing: 'right', hinge: 'start', source: 'manual', height_m: 2.1, sill_m: 0 });
    expect(doc.openings.find((x) => x.id === r.openingId)).toBeUndefined(); // the input is untouched
  });

  test('a proposal without a drawn wall brings its wall piece, and accepting adds both', () => {
    const doc = sample();
    const p = proposal({ wall_id: null, t: 0.5, new_wall: { polyline: [[0.2, 0.3], [0.31, 0.3]], thickness_px: 15 }, warning: 'אין קיר', width_px: 85 });
    const g = ghostFromProposal(doc, p, W, H, DEFAULTS);
    expect(g.newWall!.thickness_m).toBe(0.15);
    const len = (g.newWall!.polyline[1][0] - g.newWall!.polyline[0][0]) * W * 0.01;
    expect(len).toBeCloseTo(0.85 + 2 * GHOST_JAMB_M, 3);
    const gd = ghostDoc(doc, g, DEFAULTS)!;
    expect(gd.walls[0].id).toBe(GHOST_WALL_ID);
    // a wider door grows its piece
    const wide = ghostWidthTo(doc, g, [0.255 + 0.07, 0.3], W, H);
    expect(wide.width_m).toBe(1.4);
    expect((wide.newWall!.polyline[1][0] - wide.newWall!.polyline[0][0]) * W * 0.01).toBeCloseTo(1.4 + 2 * GHOST_JAMB_M, 3);
    const r = acceptGhost(doc, g, W, H, DEFAULTS, 'L1')!;
    expect(r.doc.walls.length).toBe(doc.walls.length + 1);
    const w = r.doc.walls.find((x) => x.id === r.wallId)!;
    expect(w).toMatchObject({ thickness_m: 0.15, kind: 'interior', source: 'manual', level_id: 'L1' });
    expect(r.doc.openings.find((x) => x.id === r.openingId)).toMatchObject({ wall_id: r.wallId, t: 0.5, width_m: 0.85 });
  });

  test('the demo default and the hit test of the ghost', () => {
    const doc = sample();
    const wall = doc.walls.find((w) => w.id === 'wb')!;
    const below = defaultGhost(doc, wall, 0.5, [0.35, 0.55], W, H);
    expect(below).toMatchObject({ found: 'default', width_m: 0.9, swing: 'right', hinge: 'start', t: 0.5 });
    expect(defaultGhost(doc, wall, 0.5, [0.35, 0.45], W, H).swing).toBe('left');
    expect(onGhost(doc, below, [0.35, 0.52], W, H)).toBe(true);
    expect(onGhost(doc, below, [0.45, 0.5], W, H)).toBe(false);
  });
});
