import { test, expect } from '@playwright/test';
import { stateLabel } from '../src/api/ha';
import { climateRange } from '../src/api/devices';
import { BULK_KINDS, BULK_KIND_LABEL } from '../src/api/device-bulk';
import { emptyDraft, type ConditionView, type DraftSlot, type ScheduleDraft } from '../src/api/schedules';
import {
  activePreset,
  addCondition,
  addEntitiesToSlots,
  applyPreset,
  clearConditions,
  compareDrafts,
  actionForIntent,
  climateModeFor,
  defaultDataFor,
  describeCondition,
  serviceWord,
  timeFromParts,
  timeParts,
  entitiesOf,
  estimateSun,
  groupActions,
  intentOfAction,
  loweringSummary,
  mirrorAction,
  motzashDraft,
  newCondition,
  newSlotActions,
  normalizeConditions,
  planSplit,
  removeCondition,
  removeEntityFromSlots,
  sameDraft,
  setGroupAction,
  slotOfPath,
  stateChoices,
  updateCondition,
  validateDraft,
  type EntityMeta,
  type IntentSlot,
  type MetaMap,
} from '../src/screens/schedule-edit-logic';
import { QUICK_DAYS, QUICK_TIMES, TEMPLATES, quickActions, quickDraft, quickSentence, resolveDraft, withPreset } from '../src/screens/schedule-templates';

// CR-014 S4: the rules of the schedule editor that are not geometry - action groups, how a device joins a slot,
// validation, the day split, the condition builder and the presets, templates and the three-tap quick create. Node only.

const SUN = { sunrise: 390, sunset: 1095 };
const SENSOR = 'binary_sensor.shabbat_mode';

const meta = (id: string, name: string, over: Partial<EntityMeta> = {}): EntityMeta => ({
  entity_id: id,
  name,
  domain: id.split('.')[0],
  class: ({ light: 'light', switch: 'switch', climate: 'climate', cover: 'cover', fan: 'fan', alarm_control_panel: 'alarm', lock: 'lock' } as Record<string, EntityMeta['class']>)[id.split('.')[0]] ?? null,
  sensitive: ['alarm_control_panel', 'lock'].includes(id.split('.')[0]),
  area_name: null,
  floor_name: null,
  attributes: {},
  actions: [],
  selectable: true,
  reason: null,
  ...over,
});

const M: MetaMap = new Map([
  ['light.a', meta('light.a', 'תאורה א')],
  ['light.b', meta('light.b', 'תאורה ב')],
  ['switch.s', meta('switch.s', 'מתג')],
  ['climate.c', meta('climate.c', 'מזגן', { attributes: { min_temp: 16, max_temp: 30 } })],
  ['cover.k', meta('cover.k', 'תריס')],
  ['alarm_control_panel.house', meta('alarm_control_panel.house', 'אזעקה', { attributes: { code_arm_required: false } })],
  ['alarm_control_panel.coded', meta('alarm_control_panel.coded', 'אזעקה עם קוד', { attributes: { code_arm_required: true, code_format: 'number' } })],
  ['lock.door', meta('lock.door', 'מנעול')],
  ['cover.gate', meta('cover.gate', 'שער', { class: 'door', sensitive: true })],
]);

const slot = (start: string, stop: string | null, ...actions: DraftSlot['actions']): DraftSlot => ({ start, stop, actions });
const act = (service: string, entity_id: string | null, data: Record<string, unknown> = {}) => ({ service, entity_id, data });

const ctx = (over: Partial<Parameters<typeof validateDraft>[1]> = {}) => ({ creating: true, meta: M, sun: SUN, original: null, lockedConditions: [] as ConditionView[], ...over });
const draft = (over: Partial<ScheduleDraft> = {}): ScheduleDraft => ({ ...emptyDraft(), name: 'בדיקה', slots: [slot('07:00:00', '08:00:00', act('light.turn_on', 'light.a'))], ...over });

test.describe('action groups and devices in slots', () => {
  test('entities that do the same thing form one group', () => {
    const g = groupActions([act('light.turn_on', 'light.a', { brightness: 100 }), act('light.turn_on', 'light.b', { brightness: 100 }), act('light.turn_on', 'light.c', { brightness: 50 }), act('script.x', null)]);
    expect(g.map((x) => x.entities)).toEqual([['light.a', 'light.b'], ['light.c'], [null]]);
  });

  test('changing a group changes every one of its devices and nothing else', () => {
    const actions = [act('light.turn_on', 'light.a'), act('light.turn_on', 'light.b'), act('light.turn_off', 'light.c')];
    const g = groupActions(actions)[0];
    const next = setGroupAction(actions, g, 'light.turn_on', { brightness: 128 });
    expect(next.map((a) => a.data)).toEqual([{ brightness: 128 }, { brightness: 128 }, {}]);
    expect(next[2].service).toBe('light.turn_off');
  });

  test('a device added to the schedule mirrors each slot; a device removed leaves every slot', () => {
    const slots: IntentSlot[] = [slot('07:00:00', '08:00:00', act('light.turn_on', 'light.a', { brightness: 204 })), slot('08:00:00', null, act('light.turn_off', 'light.a'))];
    const added = addEntitiesToSlots(slots, [M.get('light.b')!, M.get('switch.s')!]);
    expect(added[0].actions.map((a) => [a.service, a.entity_id, a.data])).toEqual([
      ['light.turn_on', 'light.a', { brightness: 204 }],
      ['light.turn_on', 'light.b', { brightness: 204 }],
      ['switch.turn_on', 'switch.s', {}],
    ]);
    expect(added[1].actions.map((a) => a.service)).toEqual(['light.turn_off', 'light.turn_off', 'switch.turn_off']);
    expect(entitiesOf(added)).toEqual(['light.a', 'light.b', 'switch.s']);
    const removed = removeEntityFromSlots(added, 'light.b');
    expect(entitiesOf(removed)).toEqual(['light.a', 'switch.s']);
    // adding the same device twice changes nothing
    expect(addEntitiesToSlots(added, [M.get('light.b')!])).toEqual(added);
  });

  test('a template slot resolves its intent per kind of device', () => {
    const slots: IntentSlot[] = [{ start: '07:00:00', stop: '18:00:00', actions: [], intent: { kind: 'climate', mode: 'cool', temp: 23 } }, { start: '18:00:00', stop: null, actions: [], intent: { kind: 'off' } }];
    const r = addEntitiesToSlots(slots, [M.get('climate.c')!, M.get('light.a')!]);
    expect(r[0].actions.map((a) => [a.service, a.data])).toEqual([
      ['climate.set_temperature', { hvac_mode: 'cool', temperature: 23 }],
      ['light.turn_on', {}],
    ]);
    expect(r[1].actions.map((a) => a.service)).toEqual(['climate.turn_off', 'light.turn_off']);
  });

  test('an empty slot without an intent does the plain "on" for a device that joins', () => {
    const r = addEntitiesToSlots([{ start: '08:00:00', stop: '09:00:00', actions: [] } as IntentSlot], [M.get('light.a')!, M.get('cover.k')!]);
    expect(r[0].actions.map((a) => [a.service, a.entity_id])).toEqual([
      ['light.turn_on', 'light.a'],
      ['cover.open_cover', 'cover.k'],
    ]);
    // devices chosen before any slot has an action count for a slot drawn afterwards
    const drawn = newSlotActions([], M, () => 0, ['light.a', 'climate.c']);
    expect(drawn.map((a) => a.service)).toEqual(['light.turn_on', 'climate.set_temperature']);
  });

  test('a device whose catalogue does not offer the service gets no such action', () => {
    const noOn = meta('light.z', 'תאורה ז', { actions: [{ service: 'light.turn_off', label: 'כיבוי', lowering: false, args: [] }] });
    expect(mirrorAction(act('light.turn_on', 'light.a'), noOn)).toBeNull();
    expect(mirrorAction(act('light.turn_off', 'light.a'), noOn)?.entity_id).toBe('light.z');
  });

  test('intents are read back from existing actions', () => {
    expect(intentOfAction(act('light.turn_on', 'light.a', { brightness: 204 }))).toEqual({ kind: 'level', pct: 80 });
    expect(intentOfAction(act('cover.set_cover_position', 'cover.k', { position: 10 }))).toEqual({ kind: 'cover_pos', pos: 10 });
    expect(intentOfAction(act('climate.set_temperature', 'climate.c', { hvac_mode: 'heat', temperature: 22 }))).toEqual({ kind: 'climate', mode: 'heat', temp: 22 });
    expect(intentOfAction(act('alarm_control_panel.alarm_arm_home', 'alarm_control_panel.house'))).toBeNull();
  });

  test('a new slot does the opposite of the last one, for every device', () => {
    const slots = [slot('07:00:00', '08:00:00', act('light.turn_on', 'light.a')), slot('08:00:00', '09:00:00', act('light.turn_off', 'light.a')), slot('09:00:00', '10:00:00', act('light.turn_on', 'light.a'), act('switch.turn_on', 'switch.s'))];
    const start = (s: DraftSlot) => Number(s.start.slice(0, 2)) * 60;
    expect(newSlotActions(slots, M, start).map((a) => a.service)).toEqual(['light.turn_off', 'switch.turn_off']);
    expect(newSlotActions([], M, start)).toEqual([]);
  });
});

test.describe('validation', () => {
  test('a clean draft is valid; a new one needs a name, a slot and an action per slot', () => {
    expect(validateDraft(draft(), ctx()).errors).toEqual([]);
    const bad = validateDraft(draft({ name: '  ', slots: [slot('07:00:00', '08:00:00')] }), ctx());
    expect(bad.errors.map((e) => e.path)).toEqual(['name', 'slots[0].actions']);
    expect(validateDraft(draft({ slots: [] }), ctx()).errors.map((e) => e.code)).toEqual(['required']);
    // an existing schedule may keep an empty name
    expect(validateDraft(draft({ name: '' }), ctx({ creating: false })).errors).toEqual([]);
  });

  test('times, order and overlaps', () => {
    const r = validateDraft(draft({ slots: [slot('08:00:00', '07:00:00', act('light.turn_on', 'light.a')), slot('06:30:00', '07:30:00', act('light.turn_on', 'light.a')), slot('25:00:00', null, act('light.turn_on', 'light.a'))] }), ctx());
    const codes = r.errors.map((e) => e.code);
    expect(codes).toContain('order');
    expect(codes).toContain('time');
    expect(validateDraft(draft({ slots: [slot('06:00:00', '08:00:00', act('light.turn_on', 'light.a')), slot('07:00:00', '09:00:00', act('light.turn_off', 'light.a'))] }), ctx()).errors.map((e) => e.code)).toEqual(['slots_overlap']);
    // contiguous slots (stop == next start) and an end-of-day stop are fine
    expect(validateDraft(draft({ slots: [slot('06:00:00', '08:00:00', act('light.turn_on', 'light.a')), slot('08:00:00', '00:00:00', act('light.turn_off', 'light.a'))] }), ctx()).errors).toEqual([]);
  });

  test('arguments follow the device (range, required, no code)', () => {
    const climate = meta('climate.c', 'מזגן', { actions: [{ service: 'climate.set_temperature', label: 'x', lowering: false, args: [{ name: 'temperature', type: 'float', min: 16, max: 30, required: true }] }] });
    const m2: MetaMap = new Map(M).set('climate.c', climate);
    const hot = validateDraft(draft({ slots: [slot('07:00:00', null, act('climate.set_temperature', 'climate.c', { temperature: 45 }))] }), ctx({ meta: m2 }));
    expect(hot.errors.map((e) => e.code)).toEqual(['out_of_range']);
    const none = validateDraft(draft({ slots: [slot('07:00:00', null, act('climate.set_temperature', 'climate.c', {}))] }), ctx({ meta: m2 }));
    expect(none.errors.map((e) => e.code)).toEqual(['required']);
    const notOffered = validateDraft(draft({ slots: [slot('07:00:00', null, act('climate.set_fan_mode', 'climate.c', {}))] }), ctx({ meta: m2 }));
    expect(notOffered.errors.map((e) => e.code)).toEqual(['action_not_allowed']);
    const code = validateDraft(draft({ slots: [slot('07:00:00', null, act('lock.lock', 'lock.door', { code: '1234' }))] }), ctx());
    expect(code.errors.map((e) => e.code)).toContain('code_not_allowed');
  });

  test('a panel or lock that needs a code cannot be scheduled for a new action; an unchanged one only warns', () => {
    const armCoded = draft({ slots: [slot('23:00:00', null, act('alarm_control_panel.alarm_arm_home', 'alarm_control_panel.coded'))] });
    const fresh = validateDraft(armCoded, ctx());
    expect(fresh.errors.map((e) => e.code)).toEqual(['alarm_code_needed']);
    expect(fresh.errors[0].message).toBe('לוח האזעקה דורש קוד לפעולה זו. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותה.');
    const unchanged = validateDraft(armCoded, ctx({ creating: false, original: armCoded }));
    expect(unchanged.errors).toEqual([]);
    expect(unchanged.warnings.map((w) => w.code)).toEqual(['alarm_may_need_code']);
    const free = validateDraft(draft({ slots: [slot('23:00:00', null, act('alarm_control_panel.alarm_arm_home', 'alarm_control_panel.house'))] }), ctx());
    expect(free.errors).toEqual([]);
    const disarm = validateDraft(draft({ slots: [slot('07:00:00', null, act('alarm_control_panel.alarm_disarm', 'alarm_control_panel.coded'))] }), ctx());
    expect(disarm.errors.map((e) => e.code)).toEqual(['alarm_code_needed']);
    const lockCode: MetaMap = new Map(M).set('lock.door', meta('lock.door', 'מנעול', { attributes: { code_format: '^\\d{4}$' } }));
    const locked = validateDraft(draft({ slots: [slot('22:00:00', null, act('lock.lock', 'lock.door'))] }), ctx({ meta: lockCode }));
    expect(locked.errors[0].message).toBe('המנעול דורש קוד. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותו.');
  });

  test('a device the server refuses (unmarked switch) is refused here too, unless it is already on the schedule', () => {
    const boiler = meta('switch.boiler', 'דוד', { selectable: false, reason: { code: 'switch_not_marked', message: 'המתג לא סומן כבטוח לפעולה קבוצתית.' } });
    const m2: MetaMap = new Map(M).set('switch.boiler', boiler);
    const d = draft({ slots: [slot('07:00:00', null, act('switch.turn_on', 'switch.boiler'))] });
    expect(validateDraft(d, ctx({ meta: m2 })).errors.map((e) => e.code)).toEqual(['switch_not_marked']);
    expect(validateDraft(d, ctx({ meta: m2, creating: false, original: d })).errors).toEqual([]);
  });

  test('conditions: locked ones must stay, a number is needed for above / below, tracking needs a window', () => {
    const locked: ConditionView = { entity_id: 'sensor.outdoor_temperature', name: 'טמפרטורה בחוץ', attribute: 'state', match_type: 'above', value: 26, readable: false, state: null, available: null, locked: true };
    const kept = draft({ conditions: { items: [{ entity_id: locked.entity_id, attribute: 'state', match_type: 'above', value: 26 }], type: 'or', track: false } });
    expect(validateDraft(kept, ctx({ lockedConditions: [locked] })).errors).toEqual([]);
    const dropped = validateDraft(draft(), ctx({ lockedConditions: [locked] }));
    expect(dropped.errors.map((e) => e.code)).toEqual(['condition_locked']);
    const numeric = draft({ conditions: { items: [{ entity_id: 'sensor.t', attribute: 'state', match_type: 'above', value: 'abc' }], type: 'or', track: true } });
    const r = validateDraft({ ...numeric, slots: [slot('07:00:00', null, act('light.turn_on', 'light.a'))] }, ctx());
    expect(r.errors.map((e) => e.code)).toEqual(['type']);
    expect(r.warnings.map((w) => w.code)).toEqual(['track_needs_window']);
  });

  test('other rules: single warns, dates in order, path → slot', () => {
    expect(validateDraft(draft({ repeat: 'single' }), ctx()).warnings.map((w) => w.code)).toEqual(['single_deletes']);
    expect(validateDraft(draft({ start_date: '2026-10-10', end_date: '2026-10-01' }), ctx()).errors.map((e) => e.path)).toEqual(['end_date']);
    expect(slotOfPath('slots[2].actions[0].data.temperature')).toBe(2);
    expect(slotOfPath('name')).toBe(-1);
    expect(sameDraft(draft(), { ...draft(), name: ' בדיקה ' })).toBe(true);
    expect(sameDraft(draft(), draft({ repeat: 'pause' }))).toBe(false);
  });
});

test.describe('the day split (decision 6a)', () => {
  const base = draft({ weekdays: ['sun', 'mon', 'tue', 'wed', 'thu'] });
  const other = [slot('09:00:00', '10:00:00', act('light.turn_on', 'light.a'))];

  test('the chosen days leave; the rest keep the linked slots', () => {
    const p = planSplit(base, base, { days: ['tue'], slots: other });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.days).toEqual(['tue']);
    expect(p.remaining).toEqual(['sun', 'mon', 'wed', 'thu']);
    expect(p.afterSplit.weekdays).toEqual(['sun', 'mon', 'wed', 'thu']);
    expect(p.originalUpdate).toBeNull(); // nothing else changed: the split step already left the original as it is
    expect(p.created.weekdays).toEqual(['tue']);
    expect(p.created.slots).toEqual(other);
  });

  test('other edits to the linked days are written to the original after the split', () => {
    const edited = { ...base, name: 'שם חדש' };
    const p = planSplit(edited, base, { days: ['tue', 'wed'], slots: other });
    expect(p.ok && p.originalUpdate?.name).toBe('שם חדש');
    expect(p.ok && p.originalUpdate?.weekdays).toEqual(['sun', 'mon', 'thu']);
    expect(p.ok && p.created.name).toBe('שם חדש');
  });

  test('a split needs explicit days and a strict, non-empty subset', () => {
    expect(planSplit(base, base, { days: ['sun', 'mon', 'tue', 'wed', 'thu'], slots: other }).ok).toBe(false);
    expect(planSplit(base, base, { days: [], slots: other }).ok).toBe(false);
    expect(planSplit(base, base, { days: ['sat'], slots: other }).ok).toBe(false); // sat is not one of the schedule's days
    const wd = draft({ weekdays: ['workday'] });
    const r = planSplit(wd, wd, { days: ['sun'], slots: other });
    expect(!r.ok && r.error).toBe('לא ניתן לפצל תזמון לפי ימי עבודה או סוף שבוע; בחרו ימים מפורשים תחילה.');
    // "daily" expands to seven days; all seven days back to daily
    const daily = draft({ weekdays: ['daily'] });
    const d = planSplit(daily, daily, { days: ['fri', 'sat'], slots: other });
    expect(d.ok && d.remaining).toEqual(['sun', 'mon', 'tue', 'wed', 'thu']);
    expect(d.ok && d.created.weekdays).toEqual(['fri', 'sat']);
  });
});

test.describe('conditions and presets', () => {
  test('the presets use the configured sensor in the verified form', () => {
    const only = applyPreset(emptyDraft().conditions, 'only_holy_days', SENSOR);
    expect(only).toEqual({ items: [{ entity_id: SENSOR, attribute: 'state', match_type: 'is', value: 'on' }], type: 'or', track: false });
    const not = applyPreset(only, 'not_holy_days', SENSOR);
    expect(not.items[0].value).toBe('off');
    expect(activePreset(not, SENSOR)).toBe('not_holy_days');
    expect(activePreset(only, SENSOR)).toBe('only_holy_days');
    expect(activePreset(only, null)).toBeNull();
    expect(clearConditions(only)).toEqual({ items: [], type: null, track: false });
  });

  test('a locked condition survives a preset and a clear', () => {
    const lockedItem = { entity_id: 'sensor.outdoor_temperature', attribute: 'state', match_type: 'above' as const, value: 26 };
    const block = { items: [lockedItem], type: 'or' as const, track: true };
    const withPreset = applyPreset(block, 'only_holy_days', SENSOR, [lockedItem.entity_id]);
    expect(withPreset.items).toHaveLength(2);
    expect(withPreset.items[0]).toEqual(lockedItem);
    expect(withPreset.type).toBe('or');
    expect(clearConditions(withPreset, [lockedItem.entity_id]).items).toEqual([lockedItem]);
  });

  test('adding: one condition is "or", two default to "and"; removing back to one is "or", to none clears everything', () => {
    const cand = { entity_id: 'binary_sensor.office_occupancy', name: 'נוכחות', domain: 'binary_sensor' as const, device_class: null, state: 'on', unit: null, numeric: false, suggested_shabbat: false };
    const one = addCondition({ items: [], type: null, track: true }, newCondition(cand));
    expect(one).toEqual({ items: [{ entity_id: cand.entity_id, attribute: 'state', match_type: 'is', value: 'on' }], type: 'or', track: true });
    const num = newCondition({ ...cand, entity_id: 'sensor.t', domain: 'sensor', numeric: true, state: '27.4' });
    expect(num).toEqual({ entity_id: 'sensor.t', attribute: 'state', match_type: 'above', value: 27 });
    const two = addCondition(one, num);
    expect(two.type).toBe('and');
    expect(updateCondition(two, 1, { match_type: 'below', value: 15 }).items[1]).toMatchObject({ match_type: 'below', value: 15 });
    expect(removeCondition(two, 0).type).toBe('or');
    expect(removeCondition(removeCondition(two, 0), 0)).toEqual({ items: [], type: null, track: false });
    expect(normalizeConditions({ items: [], type: 'and', track: true })).toEqual({ items: [], type: null, track: false });
    expect(newCondition({ ...cand, entity_id: 'sun.sun', domain: 'sun', state: 'above_horizon' }).value).toBe('above_horizon');
    expect(stateChoices(cand).map((c) => c.value)).toEqual(['on', 'off']);
    expect(stateChoices({ ...cand, numeric: true })).toEqual([]);
  });

  test('conditions read in Hebrew', () => {
    expect(describeCondition({ entity_id: 'x', attribute: 'state', match_type: 'is', value: 'on' }, 'איסור מלאכה')).toBe('איסור מלאכה פעיל');
    expect(describeCondition({ entity_id: 'x', attribute: 'state', match_type: 'is', value: 'off' }, 'איסור מלאכה')).toBe('איסור מלאכה כבוי');
    expect(describeCondition({ entity_id: 'x', attribute: 'state', match_type: 'not', value: 'on' }, 'נוכחות')).toBe('נוכחות כבוי');
    expect(describeCondition({ entity_id: 'x', attribute: 'state', match_type: 'above', value: 26 }, 'טמפרטורה בחוץ')).toBe('טמפרטורה בחוץ מעל 26');
  });

  test('"מוצאי שבת": Saturday, sunset + 40, the day-is-over condition', () => {
    const m = motzashDraft(SENSOR);
    expect(m.weekdays).toEqual(['sat']);
    expect(m.start).toBe('sunset+00:40:00');
    expect(m.conditions.items[0]).toMatchObject({ entity_id: SENSOR, match_type: 'is', value: 'off' });
    expect(motzashDraft(SENSOR, 75).start).toBe('sunset+01:15:00');
  });
});

test.describe('templates and quick create', () => {
  const NOW = new Date(2026, 9, 1, 10, 0, 0); // Thursday 1 Oct 2026
  const tctx = { sensor: SENSOR, defaultRepeat: 'repeat' as const, now: NOW };

  test('every template is a valid shape once devices are chosen', () => {
    for (const t of TEMPLATES) {
      const built = t.build(tctx);
      const resolved = resolveDraft(built, [M.get('light.a')!]);
      if (t.id === 'blank') {
        expect(resolved.slots).toEqual([]);
        continue;
      }
      expect(resolved.slots.length, t.id).toBeGreaterThan(0);
      const name = resolved.name || 'x';
      const check = validateDraft({ ...resolved, name, slots: resolved.slots.map((s) => ({ ...s, actions: s.actions.length ? s.actions : [act('light.turn_on', 'light.a')] })) }, ctx());
      expect(check.errors, t.id).toEqual([]);
    }
  });

  test('the Shabbat templates carry the sensor; the once template is tomorrow and deletes itself', () => {
    const shabbat = TEMPLATES.find((t) => t.id === 'shabbat_climate')!.build(tctx);
    expect(shabbat.conditions.items[0].entity_id).toBe(SENSOR);
    expect(shabbat.slots).toHaveLength(3);
    const motzash = TEMPLATES.find((t) => t.id === 'motzash')!.build(tctx);
    expect(motzash.weekdays).toEqual(['sat']);
    expect(motzash.slots[0].start).toBe('sunset+00:40:00');
    const once = TEMPLATES.find((t) => t.id === 'once')!.build(tctx);
    expect(once.weekdays).toEqual(['fri']);
    expect(once.start_date).toBe('2026-10-02');
    expect(once.repeat).toBe('single');
    const sunset = TEMPLATES.find((t) => t.id === 'sunset')!.build(tctx);
    expect(sunset.slots.map((s) => [s.start, s.stop])).toEqual([
      ['sunrise+00:00:00', 'sunset+00:00:00'],
      ['sunset+00:00:00', '00:00:00'],
    ]);
  });

  test('a condition preset is laid over a template that has none of its own', () => {
    const weekly = TEMPLATES.find((t) => t.id === 'weekly')!.build(tctx);
    expect(withPreset(weekly, 'not_holy_days', SENSOR).conditions.items[0].value).toBe('off');
    expect(withPreset(weekly, null, SENSOR)).toBe(weekly);
    expect(withPreset(weekly, 'only_holy_days', null)).toBe(weekly);
    const shabbat = TEMPLATES.find((t) => t.id === 'shabbat_climate')!.build(tctx);
    expect(withPreset(shabbat, 'not_holy_days', SENSOR)).toBe(shabbat);
  });

  test('three taps make a one-slot schedule; the sentence says what will be created', () => {
    const light = M.get('light.a')!;
    const q = { entities: [light], action: null as never, time: null as never, days: null as never };
    expect(quickSentence({ entities: [], action: null, time: null, days: null })).toBe('בחרו התקנים כדי להתחיל.');
    expect(quickSentence({ ...q, action: null, time: null, days: null })).toBe('תאורה א: … · … · …');
    const actions = quickActions(light);
    expect(actions.map((a) => a.id)).toEqual(['on', 'off', 'level50']);
    const choice = { entities: [light, M.get('light.b')!], action: actions[0], time: QUICK_TIMES[0], days: QUICK_DAYS[1] };
    expect(quickSentence(choice)).toBe('תאורה א ותאורה ב: הדלקה · שקיעה · א׳–ה׳');
    const d = quickDraft(choice, 'repeat', NOW)!;
    expect(d.weekdays).toEqual(['sun', 'mon', 'tue', 'wed', 'thu']);
    expect(d.slots).toEqual([{ start: 'sunset+00:00:00', stop: null, actions: [act('light.turn_on', 'light.a'), act('light.turn_on', 'light.b')] }]);
    expect(d.name).toBe('תאורה א ועוד 1: הדלקה · שקיעה');
    expect(validateDraft(d, ctx()).errors).toEqual([]);
    const once = quickDraft({ ...choice, days: QUICK_DAYS[3] }, 'repeat', NOW, 'not_holy_days', SENSOR)!;
    expect(once).toMatchObject({ weekdays: ['fri'], repeat: 'single', start_date: '2026-10-02', end_date: '2026-10-02' });
    expect(once.conditions.items[0].value).toBe('off');
    expect(quickDraft({ ...choice, time: null }, 'repeat', NOW)).toBeNull();
  });

  test('quick actions exist for plain devices only', () => {
    expect(quickActions(M.get('climate.c')!).map((a) => a.label)).toEqual(['קירור 23°', 'חימום 22°', 'כיבוי']);
    expect(quickActions(M.get('cover.k')!).map((a) => a.id)).toEqual(['open', 'close', 'pos30']);
    expect(quickActions(M.get('alarm_control_panel.house')!)).toEqual([]);
    expect(quickActions(M.get('lock.door')!)).toEqual([]);
    expect(quickActions(undefined)).toEqual([]);
  });
});

test.describe('sensitive marks, sun estimate', () => {
  test('lowering summary names the devices and the times; arming alone is sensitive but lowers nothing', () => {
    const d = draft({
      slots: [slot('07:00:00', null, act('cover.open_cover', 'cover.gate'), act('lock.unlock', 'lock.door')), slot('23:30:00', null, act('alarm_control_panel.alarm_arm_home', 'alarm_control_panel.house'))],
    });
    const s = loweringSummary(d, M);
    expect(s.lowering).toBe(true);
    expect(s.sensitive).toBe(true);
    expect(s.entities).toEqual(['שער', 'מנעול']);
    expect(s.kinds).toEqual(['פותח', 'פותח נעילה']);
    expect(s.times).toBe('07:00');
    const arm = loweringSummary(draft({ slots: [slot('23:30:00', null, act('alarm_control_panel.alarm_arm_home', 'alarm_control_panel.house'))] }), M);
    expect(arm).toMatchObject({ lowering: false, sensitive: true, entities: [] });
    expect(loweringSummary(draft({ slots: [slot('08:00:00', null, act('cover.close_cover', 'cover.gate'))] }), M).lowering).toBe(false);
    expect(loweringSummary(draft({ slots: [slot('08:00:00', null, act('cover.set_cover_position', 'cover.gate', { position: 40 }))] }), M).lowering).toBe(true);
    expect(loweringSummary(draft({ slots: [slot('08:00:00', null, act('alarm_control_panel.alarm_disarm', 'alarm_control_panel.house'))] }), M).kinds).toEqual(['מנטרל']);
    expect(loweringSummary(draft(), M)).toMatchObject({ lowering: false, sensitive: false });
  });

  test('the sun times are read back from the preview of a sun-anchored slot', () => {
    const d = draft({ slots: [slot('sunset+00:30:00', null, act('light.turn_on', 'light.a')), slot('07:00:00', null, act('light.turn_off', 'light.a'))] });
    const at = new Date(2026, 9, 2, 18, 42, 0).toISOString(); // local 18:42 = sunset 18:12 + 30
    const est = estimateSun(d, [{ at, slot_index: 0 }, { at: new Date(2026, 9, 2, 7, 0).toISOString(), slot_index: 1 }], SUN);
    expect(est.sunset).toBe(18 * 60 + 12);
    expect(est.sunrise).toBe(SUN.sunrise);
    expect(estimateSun(d, [], SUN)).toEqual(SUN);
  });
});

test.describe('the slot panel and the conflict dialog', () => {
  test('the panel\'s time controls round-trip the stored strings', () => {
    expect(timeParts('07:30:00')).toEqual({ kind: 'fixed', time: '07:30', offset: 0 });
    expect(timeParts('sunset+00:40:00')).toEqual({ kind: 'sunset', time: '00:00', offset: 40 });
    expect(timeParts('sunrise-00:15:00')).toEqual({ kind: 'sunrise', time: '00:00', offset: -15 });
    expect(timeParts('00:00:00', true).kind).toBe('end');
    expect(timeParts('00:00:00', false)).toEqual({ kind: 'fixed', time: '00:00', offset: 0 });
    expect(timeParts(null, true).kind).toBe('none');
    expect(timeFromParts({ kind: 'fixed', time: '8:05', offset: 0 })).toBe('08:05:00');
    expect(timeFromParts({ kind: 'sunset', time: '', offset: 90 })).toBe('sunset+01:30:00');
    expect(timeFromParts({ kind: 'sunrise', time: '', offset: -15 })).toBe('sunrise-00:15:00');
    expect(timeFromParts({ kind: 'end', time: '', offset: 0 })).toBe('00:00:00');
    expect(timeFromParts({ kind: 'none', time: '', offset: 0 })).toBeNull();
    for (const raw of ['06:45:00', 'sunset+00:30:00', 'sunrise+02:00:00']) expect(timeFromParts(timeParts(raw))).toBe(raw);
  });

  test('a chosen service starts with sensible arguments', () => {
    const climate = meta('climate.c', 'מזגן', { attributes: { min_temp: 16, max_temp: 30 } });
    expect(defaultDataFor([{ name: 'temperature', type: 'float', min: 16, max: 30, required: true }, { name: 'hvac_mode', type: 'enum', choices: ['cool', 'heat'], required: false }], climate)).toEqual({ temperature: 23 });
    expect(defaultDataFor([{ name: 'hvac_mode', type: 'enum', choices: ['heat', 'cool'], required: true }], climate)).toEqual({ hvac_mode: 'cool' });
    expect(defaultDataFor([{ name: 'position', type: 'int', min: 0, max: 100, required: true }], undefined)).toEqual({ position: 50 });
    expect(defaultDataFor([{ name: 'brightness', type: 'int', min: 0, max: 255, required: false }], undefined)).toEqual({});
    const cold = meta('climate.d', 'מזגן ב', { attributes: { min_temp: 25, max_temp: 30 } });
    expect(defaultDataFor([{ name: 'temperature', type: 'float', required: true }], cold)).toEqual({ temperature: 25 });
  });

  test('a climate that offers only off + heat_cool is never scheduled with a mode it lacks (thermostat with only off + heat_cool)', () => {
    const thermostat = meta('climate.t', 'תרמוסטט', { attributes: { hvac_modes: ['off', 'heat_cool'], min_temp: 5, max_temp: 95 } });
    const duct = meta('climate.u', 'מזגן תעלה', { attributes: { hvac_modes: ['off', 'auto', 'cool', 'dry', 'fan_only'], min_temp: 18, max_temp: 30 } });
    const heatOnly = meta('climate.v', 'חימום', { attributes: { hvac_modes: ['off', 'fan_only'] } });
    expect(climateModeFor('cool', thermostat)).toBe('heat_cool');
    expect(climateModeFor('heat', thermostat)).toBe('heat_cool');
    expect(climateModeFor('cool', duct)).toBe('cool');
    expect(climateModeFor('heat', duct)).toBe('auto'); // no heat: the entity's own automatic mode, not a mode it lacks
    expect(climateModeFor('heat', heatOnly)).toBeUndefined();
    expect(actionForIntent({ kind: 'on' }, thermostat)?.data).toEqual({ hvac_mode: 'heat_cool', temperature: 23 });
    expect(actionForIntent({ kind: 'climate', mode: 'cool', temp: 23 }, duct)?.data).toEqual({ hvac_mode: 'cool', temperature: 23 });
    expect(actionForIntent({ kind: 'climate', mode: 'cool', temp: 23 }, meta('climate.w', 'מזגן', { attributes: { min_temp: 25, max_temp: 30 } }))?.data).toEqual({ hvac_mode: 'cool', temperature: 25 });
    expect(actionForIntent({ kind: 'on' }, heatOnly)?.data).toEqual({ temperature: 23 });
    // a required hvac_mode starts with a real mode, not "off", when the entity offers one
    expect(defaultDataFor([{ name: 'hvac_mode', type: 'enum', choices: ['off', 'heat_cool'], required: true }], thermostat)).toEqual({ hvac_mode: 'heat_cool' });
  });

  test('the climate controls keep to the own target range of the entity', () => {
    expect(climateRange({ min_temp: 5, max_temp: 95, target_temp_step: 0.5 })).toEqual({ min: 5, max: 95, step: 0.5 }); // a heating thermostat: 45 is reachable
    expect(climateRange({ min_temp: 5, max_temp: 43, target_temp_step: 1 })).toEqual({ min: 5, max: 43, step: 1 }); // a heat pump targeting 36
    expect(climateRange({ min_temp: 18, max_temp: 30, target_temp_step: null })).toEqual({ min: 18, max: 30, step: 1 }); // no step reported: one degree
    expect(climateRange({ min_temp: 5, max_temp: 45, target_temp_step: undefined })).toEqual({ min: 5, max: 45, step: 1 }); // a wide range keeps the one-degree step
    expect(climateRange({})).toEqual({ min: 5, max: 35, step: 1 });
  });

  test('heating has its own off action, next to (not inside) the air-conditioning one', () => {
    expect(BULK_KIND_LABEL.climate_off).toBe('כבה מיזוג');
    expect(BULK_KIND_LABEL.heating_off).toBe('כבה חימום');
    expect(BULK_KINDS.indexOf('heating_off')).toBe(BULK_KINDS.indexOf('climate_off') + 1);
  });

  test('a climate in heat_cool reads in words, not as the raw mode', () => {
    const climate = (state: string) => ({ domain: 'climate', state, unit: null, device_class: null, attributes: { current_temperature: 24.7 } });
    expect(stateLabel(climate('heat_cool'))).toBe('חימום/קירור · 24.7°');
    expect(stateLabel(climate('off'))).toBe('כבוי · 24.7°');
  });

  test('service words fall back to the server label', () => {
    expect(serviceWord('climate.set_temperature', 'יעד °')).toBe('טמפרטורת יעד');
    expect(serviceWord('light.turn_on')).toBe('הדלקה');
    expect(serviceWord('humidifier.set_humidity', 'לחות')).toBe('לחות');
    expect(serviceWord('x.y')).toBe('x.y');
  });

  test('the comparison lists only what differs, in words', () => {
    const names = (id: string | null) => (id ? M.get(id)?.name ?? id : 'ללא התקן');
    const days = (d: ScheduleDraft['weekdays']) => d.join(',');
    const mine = draft({ name: 'שלי', repeat: 'pause', slots: [slot('07:00:00', '08:00:00', act('light.turn_on', 'light.a'))] });
    const theirs = draft({ name: 'שלהם', slots: [slot('07:00:00', '09:00:00', act('light.turn_on', 'light.a'))] });
    const diff = compareDrafts(mine, theirs, names, days);
    expect(diff.map((d) => d.label)).toEqual(['שם', 'חזרה', 'משבצות']);
    expect(diff[0]).toEqual({ label: 'שם', mine: 'שלי', theirs: 'שלהם' });
    expect(diff[2].mine).toContain('07:00–08:00');
    expect(diff[2].theirs).toContain('07:00–09:00');
    expect(compareDrafts(mine, mine, names, days)).toEqual([]);
  });
});
