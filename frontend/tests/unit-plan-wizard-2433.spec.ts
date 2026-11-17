import { test, expect } from '@playwright/test';
import { fromResult } from '../src/map/candidates';
import { buildPrimitives } from '../src/map/geometry';
import { DEMO_ENTITIES, demoBaseDoc, demoDetect, demoRooms } from '../src/plan-wizard/wizard-demo';
import {
  FURNITURE_SIZE, KITS, WIZARD_DEFAULTS, WIZARD_TAG, applyKit, bandCounts, bandOf, detectedChoice, guessRoomType, kitOf, normalizePrefs, placeByArea, reviewQueue, selection,
} from '../src/plan-wizard/wizard-model';

// PLAN3D-R28-WIZARD-2433: the pure part of the plan wizard (src/plan-wizard/wizard-model.ts) on the round 28 sample house. Node only.

test('the choices: the recommended defaults, garbage reads as the default, the thresholds stay ordered', () => {
  expect(normalizePrefs(null)).toEqual(WIZARD_DEFAULTS);
  expect(WIZARD_DEFAULTS).toMatchObject({ auto_accept: 80, review_min: 50, unreviewed: 'as_detected', kit: 'apartment' });
  expect(normalizePrefs({ auto_accept: 90, review_min: 30, unreviewed: 'reject', kit: 'office', furniture: false, auto_place: false, x: 1 }))
    .toEqual({ auto_accept: 90, review_min: 30, unreviewed: 'reject', kit: 'office', furniture: false, auto_place: false });
  expect(normalizePrefs({ auto_accept: 40, review_min: 60 })).toMatchObject({ auto_accept: 80, review_min: 50 }); // crossed: back to the defaults
  expect(normalizePrefs({ auto_accept: 100, kit: 'parking', furniture: 'yes' })).toEqual(WIZARD_DEFAULTS);
  // PLAN3D-R32-ANSWERS-2438 (owner Q-MAP-10 a): the six kits of the mockup, each a stored choice
  expect(KITS.map((k) => k.id)).toEqual(['apartment', 'office', 'lobby', 'technical', 'commercial', 'empty']);
  for (const k of KITS) expect(normalizePrefs({ kit: k.id }).kit).toBe(k.id);
  for (const k of KITS) for (const items of Object.values(k.furniture)) for (const id of items) expect(FURNITURE_SIZE[id], `${k.id}: ${id}`).toBeTruthy();
  expect(bandOf(0.8, WIZARD_DEFAULTS)).toBe('sure');
  expect(bandOf(0.795, WIZARD_DEFAULTS)).toBe('sure'); // rounded to a whole percent, as shown
  expect(bandOf(0.5, WIZARD_DEFAULTS)).toBe('check');
  expect(bandOf(0.49, WIZARD_DEFAULTS)).toBe('doubt');
});

test('the sample house (8 walls, 19 openings) reviews as 19 sure, 5 to check, 3 in doubt; the least sure first', () => {
  const set = fromResult(demoDetect());
  expect(bandCounts(set, WIZARD_DEFAULTS)).toEqual({ sure: 19, check: 5, doubt: 3 });
  const q = reviewQueue(set, WIZARD_DEFAULTS);
  expect(q.length).toBe(8);
  expect(q[0]).toMatchObject({ id: 'auto-d-liv-kit', kind: 'passage', band: 'doubt' });
  expect(q.map((x) => x.confidence)).toEqual([...q.map((x) => x.confidence)].sort((a, b) => a - b));
  expect(detectedChoice(set, 'auto-d-liv-kit')).toBe('passage');
  expect(detectedChoice(set, 'auto-g-w3')).toBe('railing');
});

test('what goes in: sure always, to-check as the choice says, doubt only when approved, an opening never without its wall', () => {
  const set = fromResult(demoDetect());
  const plain = selection(set, {}, WIZARD_DEFAULTS);
  expect(plain.accepted).toContain('auto-win-kit-e'); // 0.75, skipped: in as detected
  expect(plain.accepted).not.toContain('auto-d-liv-kit'); // 0.45: not without an approval
  expect(plain.accepted).not.toContain('auto-g-w3');
  expect(plain.rejected).toMatchObject({ byDoubt: 3, byPolicy: 0 });
  const strict = selection(set, {}, { ...WIZARD_DEFAULTS, unreviewed: 'reject' });
  expect(strict.accepted).not.toContain('auto-win-kit-e');
  expect(strict.rejected.byPolicy).toBe(5);
  // the reviewer's word: the gap is a sliding door; the railing stays a railing
  const told = selection(set, { 'auto-d-liv-kit': 'sliding', 'auto-g-w3': 'railing' }, WIZARD_DEFAULTS);
  expect(told.accepted).toEqual(expect.arrayContaining(['auto-d-liv-kit', 'auto-g-w5', 'auto-g-w3']));
  expect(told.edits['auto-d-liv-kit']).toEqual({ kind: 'door', swing: 'sliding', height_m: 2.1, sill_m: 0 });
  expect(told.edits['auto-g-w3']).toBeUndefined(); // already a railing: no edit
  // "not a wall" takes its openings out, even the sure ones
  const noWall = selection(set, { 'auto-g-w1': 'none' }, WIZARD_DEFAULTS);
  expect(noWall.accepted).not.toContain('auto-g-w1');
  expect(noWall.accepted).not.toContain('auto-d-hall-liv');
  expect(noWall.rejected.orphans).toBe(3);
  // every accepted opening's wall is accepted too (the server refuses an orphan)
  for (const s of [plain, strict, told, noWall]) {
    const ids = new Set(s.accepted);
    for (const o of set.openings) if (ids.has(o.id)) expect(ids.has(o.wall_id)).toBe(true);
  }
});

test('a kit gives each room its floor and fitting starter furniture; another kit replaces only the wizard furniture', () => {
  const set = fromResult(demoDetect());
  const base = { ...demoBaseDoc(), walls: set.walls, openings: set.openings, objects: [{ id: 'mine', item_id: 'chair.basic', level_id: 'L0', position: [0.5, 0.5] as [number, number], rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual' as const, locked: false }] };
  const types = ['entrance', 'stairs', 'corridor', 'living', 'kitchen', 'office', 'wc', 'service'];
  const rooms = demoRooms().map((r, i) => ({ id: `z${i}`, typeId: types[i], polygon: r.polygon, level_id: 'L0' }));
  const flat = applyKit(base, rooms, kitOf('apartment'), true, 0.012);
  expect(flat.levels[0].floor_material_id).toBe('oak');
  expect(flat.rooms.find((r) => r.id === 'z3')).toMatchObject({ floor_material_id: 'oak', tags: ['living'] });
  expect(flat.rooms.find((r) => r.id === 'z4')?.floor_material_id).toBe('tiles_grey');
  const mine = flat.objects.filter((o) => o.tags?.includes(WIZARD_TAG));
  expect(mine.map((o) => o.item_id)).toEqual(expect.arrayContaining(['sofa.3', 'table.side', 'table.dining', 'table.desk', 'chair.office']));
  expect(mine.some((o) => o.item_id === 'toilet.standard')).toBe(true); // the 1.5 x 2.8 m toilet still holds a toilet
  expect(flat.objects.some((o) => o.id === 'mine')).toBe(true);
  expect(flat.schema_version).toBe('2.2'); // room materials are document 2.2 fields
  const office = applyKit(flat, rooms, kitOf('office'), true, 0.012);
  expect(office.objects.filter((o) => o.tags?.includes(WIZARD_TAG)).some((o) => o.item_id === 'sofa.3')).toBe(false);
  expect(office.rooms.find((r) => r.id === 'z3')?.floor_material_id).toBe('carpet');
  const empty = applyKit(office, rooms, kitOf('empty'), true, 0.012);
  expect(empty.objects.map((o) => o.id)).toEqual(['mine']);
  // every starter item lies inside its room
  for (const o of mine) {
    const room = rooms.find((r) => o.id.startsWith(`wz-${r.id}-`))!;
    const xs = room.polygon.map((p) => p.x);
    expect(o.position[0]).toBeGreaterThan(Math.min(...xs));
    expect(o.position[0]).toBeLessThan(Math.max(...xs));
  }
});

test('devices by area: a lock at its room door, a light at the centre, no area = by hand', () => {
  const set = fromResult(demoDetect());
  const doc = { ...demoBaseDoc(), walls: set.walls, openings: set.openings };
  const gaps = buildPrimitives(doc, 1000, 900).filter((p): p is Extract<typeof p, { gap: unknown }> => 'gap' in p);
  const openings = gaps.map((p) => ({ id: p.id, kind: doc.openings.find((o) => o.id === p.id)!.kind, x: (p.gap[0][0] + p.gap[1][0]) / 2000, y: (p.gap[0][1] + p.gap[1][1]) / 1800 }));
  const areaOf: Record<string, string> = { כניסה: 'hall', סלון: 'living', מטבח: 'kitchen', 'חדר עבודה': 'office', מסדרון: 'corridor' };
  const rooms = demoRooms().map((r, i) => ({ id: `z${i}`, name: r.name, area_id: areaOf[r.name] ?? null, polygon: r.polygon }));
  const out = placeByArea(DEMO_ENTITIES, rooms, openings);
  const by = (id: string) => out.find((p) => p.entity_id === id)!;
  expect(by('lock.front')).toMatchObject({ where: 'door', room: 'כניסה' });
  expect(by('cover.living_terrace')).toMatchObject({ where: 'window', room: 'סלון' });
  expect(by('light.living')).toMatchObject({ where: 'centre', room: 'סלון' });
  expect(by('light.floor_lamp')).toMatchObject({ where: 'manual', x: null });
  expect(out.filter((p) => p.where === 'manual').length).toBe(2);
  // markers of one room never stack
  const living = out.filter((p) => p.room === 'סלון' && p.where === 'centre');
  expect(new Set(living.map((p) => `${p.x},${p.y}`)).size).toBe(living.length);
  expect(placeByArea(DEMO_ENTITIES, rooms, openings, false).every((p) => p.where === 'manual')).toBe(true);
});

test('a typed name suggests the room type', () => {
  expect(guessRoomType('חדר שינה הורים')).toBe('bedroom');
  expect(guessRoomType('מטבחון')).toBe('kitchen');
  expect(guessRoomType('שירותי אורחים')).toBe('wc');
  expect(guessRoomType('')).toBeNull();
  expect(guessRoomType('חדר 7')).toBeNull();
});
