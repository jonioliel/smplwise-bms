import { test, expect } from '@playwright/test';
import {
  answer, buildPlan, buildingForToken, DEFAULT_SPEC, detect, emptyState, exceptionOrder, health, hitsOf, itemKey, kindOk, leaveAllUnassigned,
  levelFromName, manualImpact, MAPPING_SETTINGS_DEFAULT, mergeTokens, moveRule, questions, recommended, resolve, ruleCounts, settingsOf,
  stateOf, subsetPlan, suggestSpec, summarize, tableRows, tokenize, TABLE_RULE,
  type MapItem, type MappingSettings, type MappingState, type MarkSpec, type Rule,
} from '../src/api/mapping-engine';
import { demoMapping } from '../src/api/mapping-demo';
import { siteModel } from '../src/api/home-site';
import { demoSite } from '../src/screens/home-site-demo';
import type { DeviceCounts, DeviceTree } from '../src/api/devices';

// MAPPING-ASSIST-2330: the mapping assistant's engine - tokenizer per position / separator / kind, detection %, the token table, floor
// inheritance, the exceptions, rule priority, manual-wins, the apply plan and the health card.
//   npx playwright test -c playwright.unit.config.ts tests/unit-mapping-assist-2330.spec.ts

const spec = (o: Partial<MarkSpec> = {}): MarkSpec => ({ ...DEFAULT_SPEC, ...o });
const S = (o: Partial<MappingSettings> = {}): MappingSettings => ({ ...MAPPING_SETTINGS_DEFAULT, ...o });
const demo = () => demoMapping();
const ctxOf = (d = demo(), s = S()) => ({ buildings: d.buildings, settings: s });
const byName = (items: MapItem[], name: string) => items.find((x) => x.name === name)!;

test('tokenize: the mark at the start, with each separator chip, and a minus sign is not a separator', () => {
  const s = spec();
  expect(tokenize({ name: 'א · לובי' }, s)).toEqual({ token: 'א', sep: '·', rest: 'לובי' });
  expect(tokenize({ name: 'א·לובי' }, s)?.token).toBe('א');
  expect(tokenize({ name: 'ג-גג' }, s)).toEqual({ token: 'ג', sep: '-', rest: 'גג' });
  expect(tokenize({ name: 'ד : קומה 2' }, s)).toEqual({ token: 'ד', sep: ':', rest: 'קומה 2' });
  expect(tokenize({ name: 'משותף · חניון -1' }, s)).toEqual({ token: 'משותף', sep: '·', rest: 'חניון -1' });
  expect(tokenize({ name: 'חניון -1' }, s)).toBeNull(); // "-1" is a level
  expect(tokenize({ name: 'קומה טכנית' }, s)).toBeNull();
  expect(tokenize({ name: 'B2-לובי' }, s)?.token).toBe('B2');
  // only the chosen separators count
  expect(tokenize({ name: 'ג-גג' }, spec({ seps: ['·'] }))).toBeNull();
  expect(tokenize({ name: 'א / לובי' }, spec({ seps: ['/'] }))?.token).toBe('א'); // "אחר…": a custom separator
  // a space separator splits at the first word
  expect(tokenize({ name: 'צפון לובי ראשי' }, spec({ seps: [' '] }))).toEqual({ token: 'צפון', sep: ' ', rest: 'לובי ראשי' });
  // nothing left after the mark = not a mark
  expect(tokenize({ name: 'א ·' }, s)).toBeNull();
});

test('tokenize: end, label and a word inside the name', () => {
  expect(tokenize({ name: 'לובי · א' }, spec({ position: 'end' }))).toEqual({ token: 'א', sep: '·', rest: 'לובי' });
  expect(tokenize({ name: 'חדר מכונות - 2' }, spec({ position: 'end' }))?.token).toBe('2');
  expect(tokenize({ name: 'לובי צפון' }, spec({ position: 'end', seps: [' '] }))?.token).toBe('צפון');
  expect(tokenize({ name: 'לובי', labels: ['בניין א'] }, spec({ position: 'label' }))?.token).toBe('בניין א');
  expect(tokenize({ name: 'לובי', labels: [] }, spec({ position: 'label' }))).toBeNull();
  expect(tokenize({ name: 'לובי בניין צפון' }, spec({ position: 'word' }))).toEqual({ token: 'צפון', sep: '', rest: 'לובי' });
  expect(tokenize({ name: 'מחסן מגדל 2' }, spec({ position: 'word', marker: 'מגדל' }))?.token).toBe('2');
  expect(tokenize({ name: 'לובי צפון' }, spec({ position: 'word' }))).toBeNull();
});

test('tokenize: the token kind - letter, number, word, anything up to the separator', () => {
  expect(kindOk('א', 'letter')).toBe(true);
  expect(kindOk('אב', 'letter')).toBe(false);
  expect(kindOk('12', 'number')).toBe(true);
  expect(kindOk('B2', 'number')).toBe(false);
  expect(kindOk('צפון', 'word')).toBe(true);
  expect(kindOk('בניין צפון', 'word')).toBe(false);
  expect(kindOk('בניין צפון', 'any')).toBe(true);
  expect(kindOk('x'.repeat(13), 'any')).toBe(false);
  expect(tokenize({ name: '12 · מחסן' }, spec({ kind: 'number' }))?.token).toBe('12');
  expect(tokenize({ name: 'א · לובי' }, spec({ kind: 'number' }))).toBeNull();
  expect(tokenize({ name: 'משותף · גינה' }, spec({ kind: 'letter' }))).toBeNull();
  expect(tokenize({ name: 'משותף · גינה' }, spec({ kind: 'word' }))?.token).toBe('משותף');
  // the first separator that leaves a valid token wins
  expect(tokenize({ name: 'חדר ישיבות · א' }, spec({ position: 'end', kind: 'letter' }))?.token).toBe('א');
});

test('detection: the demo has 169 names; "start" explains 96% and is pre-selected, with the separators it uses', () => {
  const d = demo();
  expect(d.items.length).toBe(169);
  expect(d.items.filter((x) => x.kind === 'floor').length).toBe(28);
  const det = detect(d.items, spec());
  expect(det.marked).toBe(163);
  expect(det.pct).toBe(96);
  expect(det.unmarked.map((x) => x.name).sort()).toEqual(['חדר אשפה', 'מאגר מים', 'מחסן אופניים', 'מכונות מעלית', 'משאבות מים', 'קומה טכנית'].sort());
  expect(det.sepUse['-']).toBe(5);
  expect(det.sepUse[':']).toBe(5);
  expect(det.tokens.map((t) => t.token)).toEqual(['א', 'ב', 'ג', 'ד', 'משותף', 'ה', 'מ']);
  const a = det.tokens.find((t) => t.token === 'א')!;
  expect([a.floors, a.areas]).toEqual([8, 48]);
  expect(a.seps['-']).toBe(1);
  const sug = suggestSpec(d.items);
  expect(sug.spec.position).toBe('start');
  expect(sug.spec.seps).toEqual(['·', '-', ':']);
  expect(sug.pct).toBe(96);
  expect(sug.alternatives.label).toBeLessThan(sug.pct);
  expect(sug.alternatives.word).toBe(0);
  // a site marked at the end of the name is detected as such
  const ends: MapItem[] = ['לובי · א', 'משרדים · א', 'לובי · ב', 'גינה'].map((name, i) => ({ id: `x${i}`, kind: 'area', name }));
  expect(suggestSpec(ends).spec.position).toBe('end');
  expect(suggestSpec(ends).pct).toBe(75);
  expect(detect([], spec()).pct).toBe(0);
});

test('the token table: existing buildings by name, unknown marks are questions, merge by choosing the same building and by drag', () => {
  const d = demo();
  expect(buildingForToken('א', d.buildings)?.id).toBe('bA');
  expect(buildingForToken('משותף', d.buildings)?.id).toBe('bS');
  expect(buildingForToken('בניין ב', d.buildings)?.id).toBe('bB');
  expect(buildingForToken('ה', d.buildings)).toBeNull();
  let st = emptyState();
  const det = detect(d.items, st.spec);
  let rows = tableRows(det, st, d.buildings);
  expect(rows.find((r) => r.token === 'א')!.target).toEqual({ t: 'b', id: 'bA' });
  expect(rows.find((r) => r.token === 'מ')!.target).toBeUndefined();
  expect(rows.find((r) => r.token === 'ה')!.target).toBeUndefined();
  expect(rows.some((r) => r.merged)).toBe(false);
  // 5C: choosing the same building marks the second row "מאוחד"
  st = { ...st, tokens: { ...st.tokens, מ: { t: 'b', id: 'bS' } } };
  rows = tableRows(det, st, d.buildings);
  expect(rows.find((r) => r.token === 'מ')!.merged).toBe(true);
  expect(rows.find((r) => r.token === 'משותף')!.merged).toBe(false);
  // ... and by drag: "ה" dropped on "ד"
  const dragged = mergeTokens(st, 'ה', 'ד', d.buildings);
  expect(dragged.tokens['ה']).toEqual({ t: 'b', id: 'bD' });
  expect(tableRows(det, dragged, d.buildings).find((r) => r.token === 'ה')!.merged).toBe(true);
  // a token added by hand is listed with no names yet
  const manual = tableRows(det, { ...st, manual_tokens: ['A'], tokens: { ...st.tokens, A: { t: 'b', id: 'bA' } } }, d.buildings);
  const rowA = manual.find((r) => r.token === 'A')!;
  expect(rowA.manual && rowA.merged).toBe(true);
  expect(rowA.stat.floors + rowA.stat.areas).toBe(0);
});

test('resolution: floor inheritance (2A) and its setting; the exceptions as questions (one per unknown mark)', () => {
  const d = demo();
  const st = emptyState();
  const res = resolve(d.items, st, ctxOf(d));
  const trash = res.get(itemKey(byName(d.items, 'חדר אשפה')))!;
  expect(trash).toMatchObject({ to: { t: 'b', id: 'bA' }, src: 'floor', open: false });
  const off = resolve(d.items, st, ctxOf(d, S({ floor_inherit: 'off' })));
  const trashOff = off.get(itemKey(byName(d.items, 'חדר אשפה')))!;
  expect(trashOff.open).toBe(true);
  expect(trashOff.conflict!.options[0]).toEqual({ t: 'b', id: 'bA' }); // still recommended, but asked
  const qs = questions(d.items, res);
  const tokens = qs.filter((q) => q.kind === 'unknown_token');
  expect(tokens.map((q) => [q.token, q.count])).toEqual(expect.arrayContaining([['מ', 3], ['ה', 3]]));
  expect(qs.find((q) => q.item?.name === 'קומה טכנית')!.kind).toBe('no_mark');
  expect(qs.find((q) => q.item?.name === 'ג · חדר ישיבות גדול')!.kind).toBe('label');
  expect(qs.find((q) => q.item?.name === 'א · חדר דיירים ב')!.conflict.options).toEqual([{ t: 'b', id: 'bA' }, { t: 'b', id: 'bB' }]);
  // a name without a mark whose label names a building: the label is the recommended answer
  expect(qs.find((q) => q.item?.name === 'משאבות מים')!.conflict.options[0]).toEqual({ t: 'b', id: 'bS' });
  expect(qs.length).toBe(9);
  expect(qs[0].item!.kind).toBe('floor'); // floors first
  // answering the token question sets the table for all three names of "מ"
  const st2 = answer(st, qs.find((q) => q.token === 'מ')!, { t: 'b', id: 'bS' });
  expect(st2.tokens['מ']).toEqual({ t: 'b', id: 'bS' });
  const res2 = resolve(d.items, st2, ctxOf(d));
  expect(questions(d.items, res2).length).toBe(8);
  expect(res2.get(itemKey(byName(d.items, 'מ · גנרטור')))!.to).toEqual({ t: 'b', id: 'bS' });
  // "השאר את כולם לא משויך"
  const all = leaveAllUnassigned(st2, questions(d.items, res2));
  expect(questions(d.items, resolve(d.items, all, ctxOf(d))).length).toBe(0);
});

test('a mark that disagrees with its floor: the floor is the recommended answer; 4A option order follows the setting', () => {
  const items: MapItem[] = [
    { id: 'f1', kind: 'floor', name: 'ב · קומה 2', level: 2 },
    { id: 'a1', kind: 'area', name: 'ג · חדר ישיבות', floorId: 'f1' },
    { id: 'a2', kind: 'area', name: 'ב · לובי', floorId: 'f1' },
  ];
  const bs = [{ id: 'bB', name: 'בניין ב' }, { id: 'bC', name: 'בניין ג' }];
  const res = resolve(items, emptyState(), { buildings: bs, settings: S() });
  expect(res.get('a:a1')).toMatchObject({ open: true, conflict: { kind: 'floor', options: [{ t: 'b', id: 'bB' }, { t: 'b', id: 'bC' }] } });
  expect(res.get('a:a2')).toMatchObject({ open: false, src: 'rule', to: { t: 'b', id: 'bB' } });
  expect(exceptionOrder(S())).toEqual(['new', 'existing', 'none']);
  expect(exceptionOrder(S({ new_token: 'existing_first' }))).toEqual(['existing', 'new', 'none']);
  expect(exceptionOrder(S({ new_token: 'unassigned_first' }))).toEqual(['none', 'new', 'existing']);
  const r = resolve([{ id: 'f', kind: 'floor', name: 'ה · קומה 1', level: 1 }], emptyState(), { buildings: bs, settings: S() }).get('f:f')!;
  expect(r.conflict!.options[0]).toEqual({ t: 'new', name: 'בניין ה' });
  const r2 = resolve([{ id: 'f', kind: 'floor', name: 'ה · קומה 1', level: 1 }], emptyState(), { buildings: bs, settings: S({ new_token: 'unassigned_first' }) }).get('f:f')!;
  expect(r2.conflict!.options[0]).toEqual({ t: 'none' });
});

test('advanced rules: order is priority, kinds mix, per-rule counts, a regex group goes through the table', () => {
  const d = demo();
  const contains: Rule = { id: 'r1', kind: 'contains', value: 'חניון', to: { t: 'b', id: 'bS' }, on: true };
  const tableFirst: MappingState = { ...emptyState(), advanced: true, rules: [{ ...TABLE_RULE }, contains] };
  const containsFirst: MappingState = { ...tableFirst, rules: moveRule(tableFirst.rules, 1, 0) };
  expect(containsFirst.rules.map((r) => r.id)).toEqual(['r1', 'table']);
  const bike = byName(d.items, 'א · חניון אופניים');
  const a = resolve(d.items, tableFirst, ctxOf(d)).get(itemKey(bike))!;
  const b = resolve(d.items, containsFirst, ctxOf(d)).get(itemKey(bike))!;
  expect(a.conflict!.kind).toBe('rules');
  expect(recommended(a)).toEqual({ t: 'b', id: 'bA' });
  expect(recommended(b)).toEqual({ t: 'b', id: 'bS' });
  const counts = ruleCounts(d.items, containsFirst, d.buildings);
  expect(counts.r1.floors).toBe(2); // "משותף · חניון -1 / -2"
  expect(counts.r1.areas).toBe(1); // "א · חניון אופניים"
  expect(counts.table.floors).toBe(23); // 28 - the two parking floors - "מ", "ה" (no building yet) - "קומה טכנית"
  // a disabled rule is skipped
  expect(hitsOf(bike, { ...containsFirst, rules: [{ ...contains, on: false }, { ...TABLE_RULE }] }, d.buildings).map((h) => h.rule.id)).toEqual(['table']);
  // label / starts / ends / regex
  const mixed: MappingState = {
    ...emptyState(), advanced: true,
    rules: [
      { id: 'l', kind: 'label', value: 'משותף', to: { t: 'b', id: 'bS' }, on: true },
      { id: 's', kind: 'starts', value: 'קומה טכנית', to: { t: 'b', id: 'bA' }, on: true },
      { id: 'e', kind: 'ends', value: 'מים', to: { t: 'b', id: 'bB' }, on: true },
      { id: 'x', kind: 'regex', value: '^B(\\d)-', to: null, on: true },
      { id: 'bad', kind: 'regex', value: '([', to: { t: 'b', id: 'bA' }, on: true },
    ],
  };
  const m = resolve([...d.items, { id: 'z', kind: 'area', name: 'B2-לובי', floorId: null }], { ...mixed, tokens: { '2': { t: 'b', id: 'bB' } } }, ctxOf(d));
  expect(m.get(itemKey(byName(d.items, 'משאבות מים')))!.to).toEqual({ t: 'b', id: 'bS' }); // the label rule first
  expect(m.get(itemKey(byName(d.items, 'מאגר מים')))!.to).toEqual({ t: 'b', id: 'bB' });
  expect(m.get(itemKey(byName(d.items, 'קומה טכנית')))!.to).toEqual({ t: 'b', id: 'bA' });
  expect(m.get('a:z')!.to).toEqual({ t: 'b', id: 'bB' }); // the regex group "2" through the table
});

test('manual decisions beat every rule forever, and a rule change reports how many manual answers it would have changed', () => {
  const d = demo();
  const lobby = d.items.find((x) => x.kind === 'area' && x.name.startsWith('א · '))!;
  const k = itemKey(lobby);
  const st: MappingState = { ...emptyState(), decisions: { [k]: { t: 'b', id: 'bC' } } };
  expect(resolve(d.items, st, ctxOf(d)).get(k)).toMatchObject({ to: { t: 'b', id: 'bC' }, src: 'manual', open: false });
  // the table moves "א" to ב: the manual answer stays, and 1 manual answer is reported
  const after: MappingState = { ...st, tokens: { א: { t: 'b', id: 'bB' } } };
  expect(resolve(d.items, after, ctxOf(d)).get(k)!.to).toEqual({ t: 'b', id: 'bC' });
  expect(manualImpact(d.items, st, after, ctxOf(d))).toBe(1);
  // a change that agrees with the manual answer, or touches nothing manual, reports 0
  expect(manualImpact(d.items, st, { ...st, tokens: { א: { t: 'b', id: 'bC' } } }, ctxOf(d))).toBe(0);
  expect(manualImpact(d.items, st, { ...st, tokens: { ב: { t: 'b', id: 'bD' } } }, ctxOf(d))).toBe(0);
});

test('the plan: existing floors by level / name, new buildings and floors, area overrides and area -> building rows; open items left alone', () => {
  const d = demo();
  let st: MappingState = { ...emptyState(), tokens: { מ: { t: 'b', id: 'bS' }, ה: { t: 'new', name: 'בניין ה' } } };
  st = answer(st, { key: itemKey(byName(d.items, 'ג · חדר ישיבות גדול')) }, { t: 'b', id: 'bC' });
  const res = resolve(d.items, st, ctxOf(d));
  const plan = buildPlan(d.items, res, d.buildings, d.floors, { floors: [], areas: [] });
  const fl = (name: string) => plan.floors.find((f) => f.ha_floor_id === byName(d.items, name).id)?.floor;
  expect(fl('א · קומה 3')).toBe('bA_f4'); // level 3
  expect(fl('ג-גג')).toBe('bC_f4'); // level 4 = "גג"
  expect(fl('ד : קומה 2')).toBe('bD_f2'); // no platform level: "קומה 2" in the name
  expect(fl('מ · חדר חשמל ראשי')).toBe('bS_f2'); // level 0 of the shared building
  expect(plan.new_buildings).toEqual([{ key: 'b1', name: 'בניין ה' }]);
  expect(plan.new_floors).toEqual([{ key: 'f1', building: 'new:b1', name: 'קומה 1', level: 1 }]);
  expect(fl('ה · קומה 1')).toBe('new:f1');
  expect(fl('קומה טכנית')).toBeUndefined(); // still open
  const ar = (name: string) => plan.areas.find((a) => a.area_id === byName(d.items, name).id);
  expect(ar('חדר אשפה')).toBeUndefined(); // follows its floor
  expect(ar('ג · חדר ישיבות גדול')).toEqual({ area_id: byName(d.items, 'ג · חדר ישיבות גדול').id, floor: 'bC_f2', building: null });
  expect(ar('א · חדר אשפה חיצוני')).toMatchObject({ floor: 'keep', building: 'bA' }); // no platform floor: the building only
  expect(ar('מחסן אופניים')).toBeUndefined(); // open
  expect(plan.items.length).toBe(169);
  // an existing row inside the building is kept; one in another building is replaced
  const row = byName(d.items, 'א · קומה 3');
  const p2 = buildPlan(d.items, res, d.buildings, d.floors, { floors: [{ ha_floor_id: row.id, floor_id: 'bA_f7' }], areas: [] });
  expect(p2.floors.find((f) => f.ha_floor_id === row.id)!.floor).toBe('bA_f7');
  const p3 = buildPlan(d.items, res, d.buildings, d.floors, { floors: [{ ha_floor_id: row.id, floor_id: 'bB_f1' }], areas: [] });
  expect(p3.floors.find((f) => f.ha_floor_id === row.id)!.floor).toBe('bA_f4');
  // "לא משויך" on purpose removes the floor row
  const none = answer(st, { key: itemKey(row) }, { t: 'none' });
  const p4 = buildPlan(d.items, resolve(d.items, none, ctxOf(d)), d.buildings, d.floors, { floors: [{ ha_floor_id: row.id, floor_id: 'bA_f4' }], areas: [] });
  expect(p4.floors.find((f) => f.ha_floor_id === row.id)!.floor).toBeNull();
  // a "new" building that exists by now is not created again
  const later = buildPlan(d.items, res, [...d.buildings, { id: 'bE', name: 'בניין ה' }], d.floors, { floors: [], areas: [] });
  expect(later.new_buildings).toEqual([]);
  expect(later.floors.find((f) => f.ha_floor_id === byName(d.items, 'ה · קומה 1').id)!.floor).toBe('new:f1');
  expect(later.new_floors[0].building).toBe('bE');
  expect(levelFromName('קרקע')).toBe(0);
  expect(levelFromName('חניון -1')).toBe(-1);
  expect(levelFromName('גג')).toBeNull();
});

test('summary per building and the health card: new names since the last apply, ready vs needing a decision; "אשר" applies only them', () => {
  const d = demo();
  const st: MappingState = { ...emptyState(), tokens: { מ: { t: 'b', id: 'bS' } } };
  const res = resolve(d.items, st, ctxOf(d));
  const sum = summarize(d.items, res, d.buildings, tableRows(detect(d.items, st.spec), st, d.buildings));
  const a = sum.buildings.find((b) => b.key === 'b:bA')!;
  expect(a.floors).toBe(8);
  expect(a.byFloor).toBe(1); // "חדר אשפה"
  expect(a.tokens).toEqual(['א']);
  expect(sum.buildings.find((b) => b.key === 'b:bS')!.tokens).toEqual(['משותף', 'מ']);
  expect(sum.open).toBe(questions(d.items, res).reduce((n, q) => n + q.count, 0));
  // health: the last apply saw everything but three names
  const fresh = [byName(d.items, 'ב · קומה 3'), byName(d.items, 'מחסן אופניים')];
  const seen = d.items.filter((x) => !fresh.includes(x)).map(itemKey);
  const h = health(d.items, res, seen);
  expect(h.fresh.length).toBe(2);
  expect(h.ready.map((x) => x.name)).toEqual(['ב · קומה 3']);
  expect(h.open.map((x) => x.name)).toEqual(['מחסן אופניים']);
  expect(health(d.items, res, null).fresh.length).toBe(0); // never applied: no card
  const plan = buildPlan(d.items, res, d.buildings, d.floors, { floors: [], areas: [] });
  const sub = subsetPlan(plan, new Set(h.ready.map(itemKey)));
  expect(sub.floors.map((f) => f.ha_floor_id)).toEqual([fresh[0].id]);
  expect(sub.areas).toEqual([]);
});

test('a stored state and settings read back safely', () => {
  const st = stateOf({ spec: { position: 'end', seps: ['-', 7], kind: 'nope' }, tokens: { א: { t: 'b', id: 'bA' }, x: { t: 'weird' } }, decisions: { 'a:1': { t: 'none' }, bad: { t: 'none' } }, rules: [{ id: 'r', kind: 'contains', value: 'חניון', to: { t: 'b', id: 'bS' } }], advanced: true });
  expect(st.spec).toEqual({ position: 'end', seps: ['-'], kind: 'any', marker: 'בניין' });
  expect(Object.keys(st.tokens)).toEqual(['א']);
  expect(Object.keys(st.decisions)).toEqual(['a:1']);
  expect(st.rules.map((r) => r.id)).toEqual(['table', 'r']); // the table rule is always there
  expect(stateOf(null)).toEqual(emptyState());
  expect(settingsOf({ floor_inherit: 'off', auto_insert: 'maybe' })).toEqual({ ...MAPPING_SETTINGS_DEFAULT, floor_inherit: 'off' });
});

test('the home site level consumes the area -> building rows: an area outside our floors counts in its building', () => {
  const Z: DeviceCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };
  const base = { floors: [], unassigned: { area_id: 'unassigned', name: '', counts: Z }, building: Z, building_climate: [], scoped: false, sync: { connected: true, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 0, entities: 0, started_at: null, ha_version: null } } as unknown as DeviceTree;
  const d = demoSite('', base);
  const before = siteModel(d.buildings, d.tree, d.links, d.siteName)!;
  const loose = before.unassigned[0];
  expect(loose).toBeTruthy();
  const after = siteModel(d.buildings, d.tree, { ...d.links, buildings: [{ area_id: loose.area_id, building_id: 'bD' }] }, d.siteName)!;
  const bD = after.buildings.find((b) => b.id === 'bD')!;
  expect(after.unassigned).toEqual([]);
  expect(bD.loose.map((a) => a.area_id)).toEqual([loose.area_id]);
  expect(bD.areaIds.has(loose.area_id)).toBe(true);
  expect(bD.counts.lights).toBe(before.buildings.find((b) => b.id === 'bD')!.counts.lights + loose.counts.lights);
  // a floor match always wins over a row naming another building
  const mapped = before.buildings[0].floors[0].areas[0];
  const again = siteModel(d.buildings, d.tree, { ...d.links, buildings: [{ area_id: mapped.area_id, building_id: 'bD' }] }, d.siteName)!;
  expect(again.buildings.find((b) => b.id === 'bD')!.loose).toEqual([]);
});