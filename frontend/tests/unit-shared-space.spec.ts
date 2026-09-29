import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScene, type ScenePart } from '../src/map/scene-builder';
import { buildPrimitives, effectiveScale, type GeometryDoc, type GeomLevel, type GeomObject, type GeomOpening, type GeomWall } from '../src/map/geometry';
import { guardShared, overhangZone, roomAt, sharedChip, sharedDeleted, sharedHint, sharedUpperLevel, sharedVolumes, tribuneEntrances, tribuneLayout, zonesWithChips, type SharedSpaceEntry } from '../src/map/shared-space';
import { rebaseOnServer } from '../src/map/studio-controller';
import { anchorOnLevel } from '../src/map/studio-ops';
import { routeFor } from '../src/api/search';

// Shared space (CR-009, owner 2026-09-29): the double-height sports hall belongs to floor -1 (the court) and floor 0 (the
// tribunes' top), and it is wider at the upper level. Two-outline model: each floor keeps its own outline and walls of
// the hall; the hall's CONTENT (tribunes, markings, objects, circuits) lives on floor -1 and floor 0's document arrives
// with it attached (ids "<home>:<id>", marked `shared`, the court level at the home datum) plus the court's outline
// ("מפלס תחתון"). It draws whole on every level filter, carries the chip, a new piece of content drawn in it is claimed
// for its home floor (walls never are), a deletion is listed explicitly (review M1), a 409 merges like the stairs'
// connectors, and in 3D the lower outline stands from the court up to floor 0, the upper one from there to the ceiling,
// with a slab ring at the step unless a tribune fills it. Runs in node: no page, no backend.
const HOME = 'fh';
/** Floor 0's own outline of the hall (the upper level, wider) and the court's outline brought onto floor 0's plan. */
const UPPER = [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.5 }, { x: 0.1, y: 0.5 }];
const LOWER = [{ x: 0.15, y: 0.15 }, { x: 0.45, y: 0.15 }, { x: 0.45, y: 0.45 }, { x: 0.15, y: 0.45 }];
const MARK = { zone_id: 'zhall', home_floor_id: HOME };

/** The generated horizontal parts inside the room above its floor: 'floor' parts (plates, rings) whose footprint holds a
 * point of the upper outline's interior above `bottom` - there must be none (owner 2026-09-30). */
function slabsInside(parts: ScenePart[], doc: GeometryDoc, bottom: number): string[] {
  const W0 = doc.dimensions.width_px;
  const H0 = doc.dimensions.height_px;
  const { scale } = effectiveScale(doc);
  const probes = [[0.12, 0.3], [0.3, 0.12], [0.3, 0.3], [0.48, 0.48]].map(([x, y]) => [x * W0 * scale, y * H0 * scale]);
  return parts
    .filter((p) => p.kind === 'floor' && p.position[1] > bottom + 0.1)
    .filter((p) => probes.some(([x, z]) => (p.shape === 'box' ? Math.abs(p.position[0] - x) <= p.size[0] / 2 && Math.abs(p.position[2] - z) <= p.size[2] / 2 : true)))
    .map((p) => p.id);
}

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

/** Floor 0 as the server attaches the hall of floor -1 to it: its own walls along the upper outline, the court's
 * content at the home datum, the court's outline as `other_polygon`. */
function mirrorDoc(): GeometryDoc {
  const doc = sample();
  const court: GeomLevel = { id: `${HOME}:L0`, name: 'מגרש · קומה -1', elevation_m: -3, ceiling_height_m: 2.8, is_default: false, shared: MARK };
  const entry: SharedSpaceEntry = { zone_id: 'zhall', zone_name: 'אולם ספורט', home_floor_id: HOME, home_floor_name: 'קומה -1', home_floor_level: -1, role: 'mirror', polygon: UPPER, placement: { mode: 'same_frame' },
    other_polygon: LOWER, other_label: 'מפלס תחתון', other_floor_level: -1, upper_ceiling_m: 2.8, aligned: true,
    home_revision: 7, datum_m: -3, level_id: `${HOME}:L0`, volume_height_m: null, wall_ids: [], label: 'רצפה בקומה -1' };
  doc.levels = [...doc.levels, court];
  doc.walls = [...doc.walls, W('own-n', [[0.1, 0.1], [0.5, 0.1]], { kind: 'exterior' })];
  doc.objects = [O(`${HOME}:trib`, [0.3, 0.3], { level_id: `${HOME}:L0`, item_id: 'tribune.stepped', size: { w_m: 6, d_m: 2, h_m: 1.5 }, shared: MARK })];
  doc.shared_spaces = [entry];
  return doc;
}

/** Floor -1 (the home): its own walls along the court's outline rise to floor 0's level; the upper outline arrives as
 * `other_polygon` 3 m up. */
function homeDoc(): GeometryDoc {
  const doc = sample();
  const entry: SharedSpaceEntry = { zone_id: 'zhall', zone_name: 'אולם ספורט', home_floor_id: HOME, home_floor_name: 'קומה -1', home_floor_level: -1, role: 'home', polygon: LOWER, placement: { mode: 'same_frame' },
    other_polygon: UPPER, other_label: 'מפלס עליון', other_floor_level: 0, upper_ceiling_m: 2.8, aligned: true,
    datum_m: 3, level_id: 'L0', volume_height_m: 3, wall_ids: ['hw1'], label: 'רצפה בקומה -1' };
  doc.walls = [...doc.walls, W('hw1', [[0.15, 0.45], [0.45, 0.45]])];
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

  test('the hall\'s content draws whole whatever level filter is on, and its anchors show on every filter', () => {
    const doc = mirrorDoc();
    const prims = buildPrimitives(doc, 1000, 1000, 'L0');
    expect(prims.some((p) => p.kind === 'object' && p.id === `${HOME}:trib`)).toBe(true);
    expect(prims.some((p) => p.kind === 'wall' && p.id === 'own-n')).toBe(true); // the floor's own outline wall
    expect(anchorOnLevel(doc, `${HOME}:L0`, 'L0')).toBe(true);
    expect(anchorOnLevel(doc, 'L1', 'L0')).toBe(false); // the floor's own other level still filters
    expect(roomAt(doc, [0.2, 0.2])?.zone_id).toBe('zhall');
    expect(roomAt(doc, [0.12, 0.12])?.zone_id).toBe('zhall'); // inside the upper outline, outside the court
    expect(roomAt(doc, [0.8, 0.8])).toBeNull();
  });

  test('editing on the other floor: new content inside the hall is claimed for its home floor, walls and openings never are', () => {
    const prev = mirrorDoc();
    const next: GeometryDoc = {
      ...prev,
      walls: [...prev.walls, W('w-in', [[0.2, 0.2], [0.3, 0.2]])],
      objects: [...prev.objects, O('c-in', [0.3, 0.35]), O('c-out', [0.8, 0.8])],
    };
    const { doc, claimed } = guardShared(prev, next);
    const inside = doc.objects.find((o) => o.id === `${HOME}:c-in`)!;
    expect(inside.shared).toEqual(MARK);
    expect(inside.level_id).toBe(`${HOME}:L0`);
    expect(doc.objects.find((o) => o.id === 'c-out')!.shared).toBeUndefined();
    expect(doc.walls.find((w) => w.id === 'w-in')!.shared).toBeUndefined(); // each floor keeps its own walls
    expect([...claimed]).toEqual([['c-in', `${HOME}:c-in`]]);
    const door = (id: string, wall: string): GeomOpening => ({ id, wall_id: wall, t: 0.5, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'right', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual' });
    const withDoor = guardShared(prev, { ...prev, openings: [...prev.openings, door('d1', 'own-n')] }).doc;
    expect(withDoor.openings.find((o) => o.id === 'd1')?.shared).toBeUndefined();
    // a circuit of the hall's objects is the hall's
    const circuit = { id: 'k1', name: 'תאורה', switch_entity_id: null, member_ids: [`${HOME}:trib`] } as unknown as GeometryDoc['circuits'][number];
    const withCircuit = guardShared(prev, { ...prev, circuits: [circuit] }).doc;
    expect((withCircuit.circuits[0] as { id: string; shared?: unknown }).id).toBe(`${HOME}:k1`);
    // a document without shared rooms passes untouched
    const plain = sample();
    const again = { ...plain, objects: [O('x', [0.3, 0.3])] };
    expect(guardShared(plain, again).doc).toBe(again);
  });

  test('a save lists the shared items it deletes (review M1); the floor\'s own deletions are not listed', () => {
    const base = mirrorDoc();
    expect(sharedDeleted(base, base)).toEqual([]);
    const gone: GeometryDoc = { ...base, objects: [], walls: base.walls.filter((w) => w.id !== 'own-n') };
    expect(sharedDeleted(base, gone)).toEqual([`${HOME}:trib`]);
    expect(sharedDeleted(null, gone)).toEqual([]);
    expect(sharedDeleted(sample(), gone)).toEqual([]);
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

  test('the volume of the hall from its two outlines, on each floor', () => {
    const [up] = sharedVolumes(mirrorDoc());
    expect(up).toMatchObject({ zoneId: 'zhall', lower: LOWER, upper: UPPER, lowerElev: -3, upperElev: 0, topElev: 2.8, lowerWalls: true, upperWalls: false });
    const [down] = sharedVolumes(homeDoc());
    expect(down).toMatchObject({ lower: LOWER, upper: UPPER, lowerElev: 0, upperElev: 3, topElev: 5.8, lowerWalls: false, upperWalls: true });
    // no other outline (a room shared before the two-outline model) or no datum: no volume
    expect(sharedVolumes({ shared_spaces: [{ ...mirrorDoc().shared_spaces![0], other_polygon: [] }] })).toEqual([]);
  });

  test('3D on the upper floor: its plate open over the whole upper outline, the court\'s walls up to it, no slab anywhere inside', () => {
    const doc = mirrorDoc();
    const W0 = doc.dimensions.width_px;
    const H0 = doc.dimensions.height_px;
    const desc = buildScene({ doc, width: W0, height: H0, anchors: [], entityStates: {}, circuitStates: {} });
    const scale = desc.scale_m_per_px;
    const at = (x: number, y: number): [number, number] => [x * W0 * scale, y * H0 * scale];
    const plates = desc.parts.filter((p) => p.kind === 'floor' && p.shape === 'box' && p.level_id === 'L0');
    const covers = (pt: [number, number]) => plates.some((p) => Math.abs(p.position[0] - pt[0]) <= p.size[0] / 2 && Math.abs(p.position[2] - pt[1]) <= p.size[2] / 2);
    expect(covers(at(0.3, 0.3)), 'open over the court').toBe(false);
    expect(covers(at(0.12, 0.12)), 'open over the step too: the upper plate\'s opening is the whole upper outline').toBe(false);
    expect(covers(at(0.8, 0.8))).toBe(true);
    const court = desc.parts.filter((p) => p.kind === 'floor' && p.level_id === `${HOME}:L0`);
    expect(court.length).toBeGreaterThan(0);
    expect(court[0].position[1]).toBeCloseTo(-3 - 0.025, 3);
    const lower = desc.parts.filter((p) => p.id.startsWith('vol:zhall#lower.'));
    expect(lower.length).toBe(4);
    for (const w of lower) {
      expect(w.size[1]).toBeCloseTo(3, 3); // from the court (-3) up to floor 0
      expect(w.position[1]).toBeCloseTo(-1.5, 3);
    }
    expect(desc.parts.some((p) => p.id.startsWith('vol:zhall#upper.')), 'floor 0 stands its own walls along its own outline').toBe(false);
    // owner 2026-09-30: nothing horizontal is generated inside the room - the step between the outlines stays open
    expect(slabsInside(desc.parts, doc, -3)).toEqual([]);
  });

  test('3D on the court\'s floor: its walls rise to the upper level, the wider upper outline from there to the ceiling', () => {
    const doc = homeDoc();
    const desc = buildScene({ doc, width: doc.dimensions.width_px, height: doc.dimensions.height_px, anchors: [], entityStates: {}, circuitStates: {} });
    const own = desc.parts.find((p) => p.kind === 'wall' && p.userData.id === 'hw1')!;
    expect(own.size[1]).toBeCloseTo(3, 3);
    const upper = desc.parts.filter((p) => p.id.startsWith('vol:zhall#upper.'));
    expect(upper.length).toBe(4);
    for (const w of upper) {
      expect(w.size[1]).toBeCloseTo(2.8, 3);
      expect(w.position[1]).toBeCloseTo(3 + 1.4, 3);
    }
    expect(desc.parts.some((p) => p.id.startsWith('vol:zhall#lower.'))).toBe(false);
    expect(slabsInside(desc.parts, doc, 0)).toEqual([]);
  });

  test('the tribune rises from the court through the upper floor\'s level: an entry row exactly there, rows below and above it, the door of the upper floor onto it', () => {
    // the rule alone: 4.5 m of rows from -3 (nominal 0.5 m steps) through the level 0
    const lay = tribuneLayout(-3, 4.5, 9, undefined, 0);
    expect(lay).toMatchObject({ rows: 9, entry: 5 });
    expect(-3 + lay.step * (lay.entry! + 1)).toBeCloseTo(0, 9);
    // a nominal step that does not divide the rise: the rows share it evenly, the entry row still tops out at the level
    const odd = tribuneLayout(-3, 4.4, 10, 0.44, 0);
    expect(-3 + odd.step * (odd.entry! + 1)).toBeCloseTo(0, 9);
    expect(odd.rows).toBeGreaterThan(odd.entry! + 1);
    expect(tribuneLayout(0, 1.5, 3, undefined, null).entry).toBeNull(); // not in a shared space: as before
    expect(tribuneLayout(-3, 1.5, 3, undefined, 0).entry).toBeNull(); // below the upper level: as before

    const doc = mirrorDoc();
    const W0 = doc.dimensions.width_px;
    const H0 = doc.dimensions.height_px;
    const { scale } = effectiveScale(doc);
    const d = 5; // metres deep: its back edge on floor 0's outline wall (y = 0.1), where floor 0's door opens onto it
    const cy = 0.1 + d / scale / H0 / 2;
    const tall = O(`${HOME}:grand`, [0.3, cy], { level_id: `${HOME}:L0`, item_id: 'tribune.stepped', size: { w_m: 8, d_m: d, h_m: 4.5 }, params: { rows: 9 }, shared: MARK });
    const door: GeomOpening = { id: 'door-trib', wall_id: 'own-n', t: 0.5, kind: 'door', width_m: 1, height_m: 2.1, sill_m: 0, swing: 'right', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual' };
    const withTribune: GeometryDoc = { ...doc, objects: [...doc.objects, tall], openings: [door] }; // the sample's own doors elsewhere left out
    expect(sharedUpperLevel(withTribune, tall)).toBe(0);
    const [entrance] = tribuneEntrances(withTribune);
    expect(entrance).toMatchObject({ objectId: `${HOME}:grand`, openingId: 'door-trib', elevation: 0 });
    expect(entrance.point[0]).toBeCloseTo(0.3, 6);
    const catalog = (id: string) => (id === 'tribune.stepped' ? ({ shape: 'stepped', color_token: 'furniture', role: 'furniture' } as never) : undefined);
    const desc = buildScene({ doc: withTribune, width: W0, height: H0, anchors: [], entityStates: {}, circuitStates: {}, catalog });
    const rows = desc.parts.filter((p) => /^obj:.*:grand#\d+$/.test(p.id)).map((p) => ({ top: p.position[1] + p.size[1] / 2 }));
    expect(rows.length).toBe(9);
    const entryRow = rows[5];
    expect(entryRow.top).toBeCloseTo(0, 6); // the entry row's top IS the upper floor's level
    expect(rows.filter((r) => r.top < -1e-6).length).toBe(5); // rows below it
    expect(rows.filter((r) => r.top > 1e-6).length).toBe(3); // and rows above it
    const landing = desc.parts.find((p) => p.id === `obj:${HOME}:grand#landing`)!;
    expect(landing.position[1] + landing.size[1] / 2).toBeCloseTo(0.02, 6);
    expect(desc.parts.some((p) => p.id === `obj:${HOME}:grand#entry`), 'the threshold from the door to the landing').toBe(true);
    // the tribune and its landing are the user's object: still no generated slab inside the room
    expect(slabsInside(desc.parts, withTribune, -3)).toEqual([]);
  });

  test('under the upper level on the home floor an item is the floor\'s own unless marked as the room\'s content', () => {
    const doc = homeDoc();
    expect(overhangZone(doc, O('locker', [0.12, 0.3]))).toBe('zhall'); // inside the upper outline, outside the court
    expect(overhangZone(doc, O('seat', [0.3, 0.3]))).toBeNull(); // on the court: the room's by geometry
    expect(overhangZone(doc, O('far', [0.8, 0.8]))).toBeNull();
    expect(sharedUpperLevel(doc, O('locker', [0.12, 0.3]))).toBeNull();
    expect(sharedUpperLevel(doc, O('rows', [0.12, 0.3], { shared_space_id: 'zhall' }))).toBe(3);
  });

  test('the editor\'s hint names the other floor; search opens a shared room on the floor the person is on', () => {
    const doc = mirrorDoc();
    expect(sharedHint(doc, doc.objects[0])).toBe('חלל משותף · השינוי יופיע גם בקומה ‎-1');
    expect(sharedHint(doc, { shared: { ...MARK, readonly: true } })).toContain('ערוך אותו שם');
    const r = { kind: 'zone' as const, id: 'zhall', title: 'אולם', subtitle: '', route: '/explore/floors/fh?zone=zhall', floor_id: 'fh', floor_ids: ['fh', 'f0'] };
    expect(routeFor(r, '/explore/floors/f0')).toBe('/explore/floors/f0?zone=zhall');
    expect(routeFor(r, '/explore/floors/f9')).toBe('/explore/floors/fh?zone=zhall');
    expect(routeFor({ ...r, floor_ids: undefined }, '/explore/floors/f0')).toBe('/explore/floors/fh?zone=zhall');
  });
});
