import { test, expect } from '@playwright/test';
import {
  autoAdded, autoNoticeText, buildPlan, emptyState, health, itemKey, levelAnswerOf, levelQuestions, levelWaiting, MAPPING_SETTINGS_DEFAULT,
  resolve, stateOf, subsetPlan,
  type BuildingRef, type CurrentLinks, type LevelAnswer, type MapItem, type MappingState, type OurFloor, type Plan,
} from '../src/api/mapping-engine';

// MAPPING-IMPROVE-2351: the assistant's "קומות ללא מפלס" step (a floor with no level and no number in its name is asked about instead of
// landing on a new floor of level 0), its persistence in the state, the health card (a floor waiting for its level is not "אשר"-ed), the
// pruned "אשר" subset and the background auto-insert notice.
//   npx playwright test -c playwright.unit.config.ts tests/unit-mapping-improve-2351.spec.ts

const B: BuildingRef[] = [{ id: 'bA', name: 'בניין א' }, { id: 'bB', name: 'בניין ב' }];
const OURS: OurFloor[] = [
  { id: 'a2', building_id: 'bA', name: 'קומה 2', level: 2 },
  { id: 'a3', building_id: 'bA', name: 'קומה 3', level: 3 },
  { id: 'b1', building_id: 'bB', name: 'קומה 1', level: 1 },
];
const NO_LINKS: CurrentLinks = { floors: [], areas: [], buildings: [] };
const ITEMS: MapItem[] = [
  { id: 'hg', kind: 'floor', name: 'א · גלריה', level: null }, // no level anywhere: asked
  { id: 'hm', kind: 'floor', name: 'ב · מרתף', level: null }, // no level anywhere: asked
  { id: 'h2', kind: 'floor', name: 'א · קומה 2', level: null }, // the level is in the name: not asked
  { id: 'h3', kind: 'floor', name: 'א · משהו', level: 3 }, // the home system's level: not asked
  { id: 'hq', kind: 'floor', name: 'ב · קומה 1 ', level: null }, // in the name
  { id: 'hz', kind: 'floor', name: 'ז · גג', level: null }, // an unknown mark: open, so not asked (yet)
  { id: 'reading', kind: 'area', name: 'פינת קריאה', floorId: 'hg' },
];
const state = (o: Partial<MappingState> = {}): MappingState => ({ ...emptyState(), spec: { position: 'start', seps: ['·'], kind: 'any', marker: 'בניין' }, ...o });
const ctx = { buildings: B, settings: MAPPING_SETTINGS_DEFAULT };
const plan = (st: MappingState) => buildPlan(ITEMS, resolve(ITEMS, st, ctx), B, OURS, NO_LINKS, st.levels);
const newFloorOf = (p: Plan, hid: string) => {
  const ref = p.floors.find((f) => f.ha_floor_id === hid)?.floor ?? '';
  return p.new_floors.find((f) => `new:${f.key}` === ref);
};

test('levels step: only the resolved floors with no level anywhere are asked, each with its building and its name without the mark', () => {
  const st = state();
  const qs = levelQuestions(ITEMS, resolve(ITEMS, st, ctx), B, OURS, NO_LINKS, st.levels);
  expect(qs.map((q) => q.id).sort()).toEqual(['hg', 'hm']);
  expect(qs.find((q) => q.id === 'hg')).toEqual({ id: 'hg', building: 'bA', rest: 'גלריה', answer: undefined });
  expect(qs.find((q) => q.id === 'hm')?.building).toBe('bB');
  // unanswered = exactly the behaviour before: a new floor of level 0
  expect(newFloorOf(plan(st), 'hg')).toMatchObject({ building: 'bA', name: 'גלריה', level: 0 });
  // a floor whose existing row already sits in its building, or an existing floor of the same name, is not asked about
  const links: CurrentLinks = { floors: [{ ha_floor_id: 'hg', floor_id: 'a3' }], areas: [] };
  expect(levelQuestions(ITEMS, resolve(ITEMS, st, ctx), B, OURS, links, {}).map((q) => q.id)).toEqual(['hm']);
  const named: OurFloor[] = [...OURS, { id: 'gal', building_id: 'bA', name: 'גלריה', level: 9 }];
  expect(levelQuestions(ITEMS, resolve(ITEMS, st, ctx), B, named, NO_LINKS, {}).map((q) => q.id)).toEqual(['hm']);
});

test('levels step: a level, "זהה לקומה קיימת" and "דלג" each shape the plan; answers stay listed with their value', () => {
  const lv: Record<string, LevelAnswer> = { hg: { t: 'level', level: 7 }, hm: { t: 'floor', id: 'b1' } };
  const p = plan(state({ levels: lv }));
  expect(newFloorOf(p, 'hg')).toMatchObject({ building: 'bA', name: 'גלריה', level: 7 });
  expect(p.floors).toContainEqual({ ha_floor_id: 'hm', floor: 'b1' });
  // a level that one of our floors already has = that floor
  expect(plan(state({ levels: { hg: { t: 'level', level: 3 } } })).floors).toContainEqual({ ha_floor_id: 'hg', floor: 'a3' });
  // "זהה לקומה קיימת" of ANOTHER building is ignored (the floor's building wins), falling back to the old behaviour
  expect(newFloorOf(plan(state({ levels: { hg: { t: 'floor', id: 'b1' } } })), 'hg')?.level).toBe(0);
  // skip: level 0, as before
  expect(newFloorOf(plan(state({ levels: { hg: { t: 'skip' } } })), 'hg')?.level).toBe(0);
  const qs = levelQuestions(ITEMS, resolve(ITEMS, state({ levels: lv }), ctx), B, OURS, NO_LINKS, lv);
  expect(qs.find((q) => q.id === 'hg')?.answer).toEqual({ t: 'level', level: 7 });
  expect(levelWaiting(ITEMS, resolve(ITEMS, state(), ctx), B, OURS, NO_LINKS, { hg: { t: 'skip' } })).toEqual(new Set(['f:hm']));
});

test('levels step: the answers persist in the stored state (read back safely, junk dropped)', () => {
  const raw = JSON.parse(JSON.stringify(state({ levels: { hg: { t: 'level', level: 7 }, hm: { t: 'floor', id: 'b1' }, hz: { t: 'skip' } } })));
  raw.levels.bad = { t: 'level', level: 'x' };
  raw.levels.far = { t: 'level', level: 9999 };
  raw.levels.odd = { t: 'what' };
  expect(stateOf(raw).levels).toEqual({ hg: { t: 'level', level: 7 }, hm: { t: 'floor', id: 'b1' }, hz: { t: 'skip' } });
  expect(stateOf({}).levels).toEqual({}); // a state stored before 2351
  expect(emptyState().levels).toEqual({});
  expect(levelAnswerOf({ t: 'level', level: -2 })).toEqual({ t: 'level', level: -2 });
  expect(levelAnswerOf({ t: 'level', level: 1.5 })).toBeNull();
});

test('health: a new floor still waiting for its level needs the assistant, not "אשר"', () => {
  const st = state();
  const res = resolve(ITEMS, st, ctx);
  const seen = ITEMS.filter((x) => x.id === 'h3').map(itemKey);
  const waiting = levelWaiting(ITEMS, res, B, OURS, NO_LINKS, st.levels);
  const h = health(ITEMS, res, seen, waiting);
  expect(h.ready.map(itemKey)).not.toContain('f:hg');
  expect(h.open.map(itemKey)).toEqual(expect.arrayContaining(['f:hg', 'f:hm', 'f:hz']));
  expect(h.ready.map(itemKey)).toEqual(expect.arrayContaining(['f:h2', 'f:hq']));
  // answered: ready again
  const h2 = health(ITEMS, res, seen, levelWaiting(ITEMS, res, B, OURS, NO_LINKS, { hg: { t: 'level', level: 7 }, hm: { t: 'skip' } }));
  expect(h2.ready.map(itemKey)).toEqual(expect.arrayContaining(['f:hg', 'f:hm']));
});

test('"אשר" subset carries only the new buildings / floors its rows name', () => {
  const st = state({ tokens: { ז: { t: 'new', name: 'בניין ז' } } });
  const full = plan(st);
  expect(full.new_buildings.map((b) => b.name)).toEqual(['בניין ז']);
  const sub = subsetPlan(full, new Set(['f:h2']));
  expect(sub.floors).toEqual([{ ha_floor_id: 'h2', floor: 'a2' }]);
  expect(sub.new_floors).toEqual([]);
  expect(sub.new_buildings).toEqual([]);
  const withZ = subsetPlan(full, new Set(['f:hz']));
  expect(withZ.new_buildings.map((b) => b.name)).toEqual(['בניין ז']);
  expect(withZ.new_floors).toHaveLength(1);
});

test('the auto-insert notice counts the "auto" versions at the head only', () => {
  const v = (kind: string, summary: Record<string, unknown>) => ({ kind, summary });
  expect(autoAdded([v('auto', { auto_added: 3, auto_areas: 2, auto_floors: 1 }), v('auto', { auto_added: 2, auto_areas: 2, auto_floors: 0 }), v('apply', {}), v('auto', { auto_added: 9, auto_areas: 9 })]))
    .toEqual({ areas: 4, floors: 1 });
  expect(autoNoticeText({ versions: [v('auto', { auto_added: 4, auto_areas: 4, auto_floors: 0 })] })).toBe('נוספו אוטומטית 4 אזורים');
  expect(autoNoticeText({ versions: [v('auto', { auto_added: 1, auto_areas: 1, auto_floors: 0 })] })).toBe('נוסף אוטומטית אזור אחד');
  expect(autoNoticeText({ versions: [v('auto', { auto_added: 1, auto_areas: 0, auto_floors: 1 })] })).toBe('נוספה אוטומטית קומה אחת');
  expect(autoNoticeText({ versions: [v('auto', { auto_added: 3, auto_areas: 2, auto_floors: 1 })] })).toBe('נוספו אוטומטית 2 אזורים וקומה אחת');
  expect(autoNoticeText({ versions: [v('confirm', { confirmed: 3 })] })).toBe('');
  expect(autoNoticeText({ versions: [] })).toBe('');
  // a client-side auto version from before 2351 (summary.confirmed only)
  expect(autoAdded([v('auto', { confirmed: 2 })])).toEqual({ areas: 2, floors: 0 });
});
