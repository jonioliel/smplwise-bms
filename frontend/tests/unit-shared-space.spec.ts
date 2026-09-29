import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScene } from '../src/map/scene-builder';
import { buildPrimitives, type GeometryDoc, type GeomLevel, type GeomObject, type GeomOpening, type GeomWall } from '../src/map/geometry';
import { claimForRoom, guardShared, roomAt, sharedChip, sharedHint, withoutMirrors, zonesWithChips, type SharedSpaceEntry } from '../src/map/shared-space';
import { rebaseOnServer } from '../src/map/studio-controller';
import { anchorOnLevel } from '../src/map/studio-ops';
import { routeFor } from '../src/api/search';

// Shared space (CR-009, owner 2026-09-29): the double-height sports hall belongs to floor -1 (the court) and floor 0 (the
// tribunes' top). Floor 0's document arrives with the hall attached (ids "<home>:<id>", marked `shared`, the court level
// at the home datum): it draws whole on every level filter, carries the chip, is claimed for its home floor when edited
// here, merges on a 409 like the stairs' connectors, and in 3D opens floor 0's plate and rises through both floors.
// Runs in node: no page, no backend.
const HOME = 'fh';
const HALL = [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.4 }, { x: 0.1, y: 0.4 }];
const MARK = { zone_id: 'zhall', home_floor_id: HOME };

function sample(): GeometryDoc {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const doc = JSON.parse(fs.readFileSync(path.resolve(here, '..', '..', 'contracts', 'fixtures', 'plan_geometry', 'sample-v2.json'), 'utf8')) as GeometryDoc;
  doc.objects = [];
  doc.connectors = [];
  doc.circuits = [];
  doc.groups = [];
  return doc;
}

const W = (id: string, polyline: [number, number][], extra: Partial<GeomWall> = {}): GeomWall => ({ id, level_id: 'L0', polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, ...extra });
const O = (id: string, position: [number, number], extra: Partial<GeomObject> = {}): GeomObject => ({ id, item_id: 'chair.basic', level_id: 'L0', position, rotation_deg: 0, size: { w_m: 0.5, d_m: 0.5, h_m: 0.9 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, ...extra });

/** Floor 0 as the server attaches the hall of floor -1 to it. */
function mirrorDoc(): GeometryDoc {
  const doc = sample();
  const court: GeomLevel = { id: `${HOME}:L0`, name: 'מגרש · קומה -1', elevation_m: -3, ceiling_height_m: 2.8, is_default: false, shared: MARK };
  const entry: SharedSpaceEntry = { zone_id: 'zhall', zone_name: 'אולם ספורט', home_floor_id: HOME, home_floor_name: 'קומה -1', home_floor_level: -1, role: 'mirror', polygon: HALL, placement: { mode: 'same_frame' },
    home_revision: 7, datum_m: -3, level_id: `${HOME}:L0`, volume_height_m: 5.8, wall_ids: [`${HOME}:hw1`], label: 'רצפה בקומה -1' };
  doc.levels = [...doc.levels, court];
  doc.walls = [...doc.walls, W(`${HOME}:hw1`, [[0.1, 0.4], [0.4, 0.4]], { level_id: `${HOME}:L0`, shared: MARK }), W(`${HOME}:ext#1`, [[0.1, 0.1], [0.4, 0.1]], { level_id: `${HOME}:L0`, locked: true, shared: { ...MARK, readonly: true } })];
  doc.objects = [O(`${HOME}:trib`, [0.25, 0.2], { level_id: `${HOME}:L0`, item_id: 'tribune.stepped', size: { w_m: 6, d_m: 2, h_m: 1.5 }, shared: MARK })];
  doc.shared_spaces = [entry];
  return doc;
}

test.describe('shared space (CR-009)', () => {
  test('the chip names the floor of the room\'s surface, bidi-safe, on both maps', () => {
    expect(sharedChip({ label: 'רצפה בקומה -1' })).toBe('רצפה בקומה ‎-1');
    expect(sharedChip(null)).toBeNull();
    const zones = zonesWithChips([{ id: 'z', label_pos: 'top', shared: { role: 'home' as const, zone_id: 'z', home_floor_id: HOME, home_floor_name: 'קומה -1', home_floor_level: -1, label: 'רצפה בקומה -1' } }, { id: 'y' }]);
    expect(zones.map((z) => [z.labelPos, z.chip])).toEqual([['top', 'רצפה בקומה ‎-1'], [undefined, null]]);
  });

  test('the hall draws whole whatever level filter is on, and its anchors show on every filter', () => {
    const doc = mirrorDoc();
    const prims = buildPrimitives(doc, 1000, 1000, 'L0');
    expect(prims.some((p) => p.kind === 'wall' && p.id === `${HOME}:hw1`)).toBe(true);
    expect(prims.some((p) => p.kind === 'object' && p.id === `${HOME}:trib`)).toBe(true);
    expect(anchorOnLevel(doc, `${HOME}:L0`, 'L0')).toBe(true);
    expect(anchorOnLevel(doc, 'L1', 'L0')).toBe(false); // the floor's own other level still filters
    expect(withoutMirrors(doc).walls.some((w) => w.shared)).toBe(false);
    expect(roomAt(doc, [0.2, 0.2])?.zone_id).toBe('zhall');
    expect(roomAt(doc, [0.8, 0.8])).toBeNull();
  });

  test('editing on the other floor: read-only pieces never change, a new item inside the hall is claimed for its home floor', () => {
    const prev = mirrorDoc();
    // a drag of the read-only piece of the exterior wall, and a chair dropped inside the hall and one outside it
    const next: GeometryDoc = {
      ...prev,
      walls: prev.walls.map((w) => (w.id === `${HOME}:ext#1` ? { ...w, polyline: [[0.1, 0.15], [0.4, 0.15]] as [number, number][] } : w)),
      objects: [...prev.objects, O('c-in', [0.3, 0.3]), O('c-out', [0.8, 0.8])],
    };
    const { doc, claimed } = guardShared(prev, next);
    expect(doc.walls.find((w) => w.id === `${HOME}:ext#1`)!.polyline).toEqual([[0.1, 0.1], [0.4, 0.1]]);
    const inside = doc.objects.find((o) => o.id === `${HOME}:c-in`)!;
    expect(inside.shared).toEqual(MARK);
    expect(inside.level_id).toBe(`${HOME}:L0`);
    expect(doc.objects.find((o) => o.id === 'c-out')!.shared).toBeUndefined();
    expect([...claimed]).toEqual([['c-in', `${HOME}:c-in`]]);
    // a door on a hall wall is the hall's; one on the read-only piece is dropped
    const door = (id: string, wall: string): GeomOpening => ({ id, wall_id: wall, t: 0.5, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'right', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual' });
    const withDoors = guardShared(prev, { ...prev, openings: [...prev.openings, door('d1', `${HOME}:hw1`), door('d2', `${HOME}:ext#1`)] }).doc;
    expect(withDoors.openings.find((o) => o.id === `${HOME}:d1`)?.shared).toEqual(MARK);
    expect(withDoors.openings.some((o) => o.id === 'd2' || o.id === `${HOME}:d2`)).toBe(false);
    // a document without shared rooms passes untouched
    const plain = sample();
    const again = { ...plain, objects: [O('x', [0.3, 0.3])] };
    expect(guardShared(plain, again).doc).toBe(again);
    expect(claimForRoom(prev, { id: 'n', level_id: 'L0' }, [0.2, 0.2])).toEqual({ id: `${HOME}:n`, level_id: `${HOME}:L0`, shared: MARK });
  });

  test('a 409 from the home floor merges like the stairs: its hall change and this floor\'s own edit both survive', () => {
    const base = mirrorDoc();
    const local: GeometryDoc = { ...base, labels: [...base.labels, { id: 'mine', text: 'כניסה', position: [0.8, 0.2], level_id: 'L0', size: 14 }] };
    const server: GeometryDoc = { ...base, objects: base.objects.map((o) => ({ ...o, position: [0.3, 0.25] as [number, number] })), shared_spaces: base.shared_spaces!.map((e) => ({ ...e, home_revision: 8 })) };
    const merged = rebaseOnServer(base, local, server)!;
    expect(merged.labels.some((l) => l.id === 'mine')).toBe(true);
    expect(merged.objects[0].position).toEqual([0.3, 0.25]);
    expect(merged.shared_spaces![0].home_revision).toBe(8);
    // the same tribune moved on both sides: a real conflict
    const both: GeometryDoc = { ...base, objects: base.objects.map((o) => ({ ...o, rotation_deg: 30 })) };
    expect(rebaseOnServer(base, both, server)).toBeNull();
  });

  test('3D: no plate of the upper floor over the hall, the court at the home datum, the hall\'s walls through both floors', () => {
    const doc = mirrorDoc();
    const W0 = doc.dimensions.width_px;
    const H0 = doc.dimensions.height_px;
    const desc = buildScene({ doc, width: W0, height: H0, anchors: [], entityStates: {}, circuitStates: {} });
    const scale = desc.scale_m_per_px;
    const centre: [number, number] = [0.25 * W0 * scale, 0.25 * H0 * scale];
    const plates = desc.parts.filter((p) => p.kind === 'floor' && p.level_id === 'L0');
    expect(plates.length).toBeGreaterThan(1);
    const covers = plates.some((p) => Math.abs(p.position[0] - centre[0]) <= p.size[0] / 2 && Math.abs(p.position[2] - centre[1]) <= p.size[2] / 2);
    expect(covers, 'the upper floor is open over the hall').toBe(false);
    const court = desc.parts.filter((p) => p.kind === 'floor' && p.level_id === `${HOME}:L0`);
    expect(court.length).toBeGreaterThan(0);
    expect(court[0].position[1]).toBeCloseTo(-3 - 0.025, 3);
    const wall = desc.parts.find((p) => p.kind === 'wall' && p.userData.id === `${HOME}:hw1`)!;
    expect(wall.size[1]).toBeCloseTo(5.8, 3);
    const piece = desc.parts.find((p) => p.kind === 'wall' && p.userData.id === `${HOME}:ext#1`)!;
    expect(piece.size[1]).toBeCloseTo(2.8, 3); // a piece of the rest of the home floor keeps its own height
  });

  test('the editor\'s hint names the other floor; search opens a shared room on the floor the person is on', () => {
    const doc = mirrorDoc();
    expect(sharedHint(doc, doc.objects[0])).toBe('חלל משותף · השינוי יופיע גם בקומה ‎-1');
    expect(sharedHint(doc, doc.walls.find((w) => w.id === `${HOME}:ext#1`)!)).toContain('ערוך אותו שם');
    const r = { kind: 'zone' as const, id: 'zhall', title: 'אולם', subtitle: '', route: '/explore/floors/fh?zone=zhall', floor_id: 'fh', floor_ids: ['fh', 'f0'] };
    expect(routeFor(r, '/explore/floors/f0')).toBe('/explore/floors/f0?zone=zhall');
    expect(routeFor(r, '/explore/floors/f9')).toBe('/explore/floors/fh?zone=zhall');
    expect(routeFor({ ...r, floor_ids: undefined }, '/explore/floors/f0')).toBe('/explore/floors/fh?zone=zhall');
  });
});
