import { test, expect } from '@playwright/test';
import {
  AUTOMATION_SETTINGS_DEFAULT, CRITICAL_DATA, automationSettingsOf, automationSettingsPatch, buttonOf, emitBlock, parseAction, parseCondition, parseTrigger, pressOf, subtypeFor, typeFor,
  type AutomationDraft, type Block, type Item, type ModelContext,
} from '../src/api/automations';
import { applyMerge, conflictMove, conflictSlotIndex, extFlags, mergeCounts, mergeParts, precheckWarnings, saveMode, warningsHeading } from '../src/api/automations-ext';
import { STATE_FILTERS_OF, applyFilters, cardChips, stateCounts, withConflicts, NO_FILTERS } from '../src/screens/automations-logic';

// KAV079-295 ("הרחבת הקברניט", mockup r079): the client twins of the new typed blocks (wall-button trigger, "who is in the building", critical sound),
// the new settings keys, the pre-save warnings and the save mode, the manual three-way merge (owner answer 366) and the list's conflict filter / chips.
// No browser page.

const ON: ModelContext = { wallButtons: true, deviceName: (id) => (id === 'dev_living' ? 'מפסק סלון' : null) };
const zha = (extra: Record<string, unknown> = {}) => ({ trigger: 'device', device_id: 'dev_living', domain: 'zha', type: 'remote_button_double_press', subtype: 'button_1', ...extra });

test('a wall-button trigger is typed only with the switch on, and keeps the integration words', () => {
  expect(parseTrigger(zha(), {}).kind).toBe('locked');
  const b = parseTrigger(zha({ id: 'double', metadata: {} }), ON);
  expect(b.kind).toBe('typed');
  expect(b).toMatchObject({ type: 'button', button: 1, press: 'double', id: 'double', sentence: 'לחיצה כפולה על כפתור 1 · מפסק סלון' });
  expect(emitBlock(b, 'trigger', ON)).toEqual(zha({ id: 'double', metadata: {} }));  // unchanged: the stored raw
  const changed = { ...b, press: 'long', button: 3 } as Block;
  expect(emitBlock(changed, 'trigger', ON)).toEqual({ trigger: 'device', device_id: 'dev_living', domain: 'zha', type: 'remote_button_long_press', subtype: 'button_3', id: 'double', metadata: {} });
  expect(parseTrigger({ trigger: 'device', device_id: 'x', domain: 'wall_switch', type: 'button_1_short' }, ON).kind).toBe('locked');
  expect([pressOf('single_push'), buttonOf('button12'), buttonOf('turn_on'), typeFor('single', 'long'), subtypeFor('button1', 4)]).toEqual(['short', 12, null, 'long', 'button4']);
});

test('who is in the building and the critical sound', () => {
  const ctx: ModelContext = { presenceEntity: 'binary_sensor.anyone' };
  const c = parseCondition({ condition: 'state', entity_id: ['binary_sensor.anyone'], state: 'off' }, ctx);
  expect(c).toMatchObject({ type: 'presence', mode: 'nobody', sentence: 'אין אף אחד במבנה' });
  expect(emitBlock({ ...c, mode: 'someone' } as Block, 'condition', ctx)).toEqual({ condition: 'state', entity_id: ['binary_sensor.anyone'], state: 'on' });
  expect(parseCondition({ condition: 'state', entity_id: ['binary_sensor.anyone'], state: 'off' }, {})).toMatchObject({ type: 'state' });
  const step = { action: 'notify.mobile_app_owner', data: { message: 'הצפה', data: JSON.parse(JSON.stringify(CRITICAL_DATA)) } };
  const a = parseAction(step, {});
  expect(a).toMatchObject({ kind: 'typed', role: 'notify', critical: true, data: { message: 'הצפה' } });
  expect(a.sentence.endsWith('עם צליל קריטי')).toBe(true);
  expect(emitBlock(a, 'action', {})).toEqual(step);
  expect(emitBlock({ ...a, critical: false } as Block, 'action', {})).toEqual({ action: 'notify.mobile_app_owner', data: { message: 'הצפה' } });
  expect(parseAction({ action: 'notify.mobile_app_owner', data: { message: 'x', data: { push: {} } } }, {}).kind).toBe('locked');
});

test('the new settings keys read with defaults and travel only when changed', () => {
  const d = automationSettingsOf({});
  expect([d.wall_buttons_editable, d.precheck_enabled, d.device_test_enabled, d.save_with_warnings, d.conflict_window_min, d.button_reuse, d.device_test_end, d.presence_entity])
    .toEqual([false, false, false, true, 10, 'warn', 'ask', '']);
  const s = automationSettingsOf({ 'automations.wall_buttons_editable': 'true', 'automations.conflict_window_min': 300, 'automations.device_test_end': 'keep' });
  expect([s.wall_buttons_editable, s.conflict_window_min, s.device_test_end]).toEqual([true, 10, 'keep']);  // out of range -> default
  const body = automationSettingsPatch(AUTOMATION_SETTINGS_DEFAULT, { ...AUTOMATION_SETTINGS_DEFAULT, precheck_enabled: true, wall_double_ms: 450, button_reuse: 'error' });
  expect(body).toEqual({ 'automations.precheck_enabled': 'true', 'automations.wall_double_ms': 450, 'automations.button_reuse': 'error' });
});

test('pre-save warnings and the save mode', () => {
  const warnings = [{ path: 'actions.0', code: 'conflict', message: 'התנגשות' }, { path: '', code: 'sensitive', message: 'פעולה רגישה' }, { path: 'actions.0', code: 'device_unavailable', message: 'x' }];
  expect(precheckWarnings({ warnings }).map((w) => w.code)).toEqual(['conflict', 'device_unavailable']);
  const f = extFlags({ ext: { ...extFlags(null), precheck: true } });
  expect(saveMode(precheckWarnings({ warnings }), f)).toBe('with_warnings');
  expect(saveMode(precheckWarnings({ warnings }), { ...f, save_with_warnings: false })).toBe('blocked');
  expect(saveMode([], f)).toBe('save');
  expect(saveMode(precheckWarnings({ warnings }), { ...f, precheck: false })).toBe('save');
  expect([warningsHeading(1), warningsHeading(2)]).toEqual(['אזהרה אחת', '2 אזהרות']);
  expect(extFlags(null).wall_buttons).toBe(false);
});

const t = (uid: string, at: string): Block => ({ uid, kind: 'typed', raw: null, sentence: `בשעה ${at}`, type: 'time', at } as Block);
const step = (uid: string, sentence: string, action: string): Block => ({ uid, kind: 'typed', raw: null, sentence, type: 'service', action, entity_ids: ['light.salon'], data: {}, role: 'device' } as Block);
const draft = (alias: string, trig: Block[], acts: Block[]): AutomationDraft => ({ alias, description: '', mode: 'single', max: null, triggers: trig as AutomationDraft['triggers'], conditions: [], actions: acts as AutomationDraft['actions'] });

test('the manual merge: one-sided changes are taken, a part changed on both sides is pre-marked with the other version and waits', () => {
  const base = draft('מפסק', [t('a', '07:00')], [step('s1', 'הדלק', 'light.turn_on'), step('s2', 'כבה', 'light.turn_off')]);
  const mine = draft('מפסק', [t('a', '07:15')], [step('s1', 'הדלק', 'light.turn_on'), step('s2', 'שלי', 'switch.turn_off')]);
  const theirs = draft('מפסק סלון', [t('a', '07:00')], [step('s1', 'הדלק', 'light.turn_on'), step('s2', 'שלה', 'fan.turn_off')]);
  const parts = mergeParts({ base, mine, theirs, ctx: {} });
  const by = Object.fromEntries(parts.map((p) => [p.key, p]));
  expect(by['alias']).toMatchObject({ changed: 'theirs', pick: 'theirs' });
  expect(by['triggers.0']).toMatchObject({ changed: 'mine', pick: 'mine' });
  expect(by['actions.0']).toMatchObject({ changed: 'none' });
  expect(by['actions.1']).toMatchObject({ changed: 'both', pick: 'theirs', mine: 'שלי', theirs: 'שלה' });
  expect(mergeCounts(parts)).toEqual({ mine: 1, theirs: 2, pending: 1 });
  const merged = applyMerge({ mine, theirs }, parts);
  expect([merged.alias, (merged.triggers[0] as { at: string }).at, (merged.actions[1] as { action: string }).action]).toEqual(['מפסק סלון', '07:15', 'fan.turn_off']);
  const mineAll = applyMerge({ mine, theirs }, parts.map((p) => ({ ...p, pick: 'mine' as const })));
  expect((mineAll.actions[1] as { action: string }).action).toBe('switch.turn_off');
});

test('the list: the conflict filter only with the checks on, counts and chips', () => {
  const item = (id: string, extra: Partial<Item> = {}): Item => ({
    kind: 'automation', id, config_id: id, entity_id: `automation.${id}`, name: id, description: '', icon: null, source: 'ui', state: 'on', sentence: '', floors: [], areas: [], targets: [],
    sensitive: false, sensitive_classes: [], locked_count: 0, unknown_effects: false, mode: 'single', extras: [], labels: [], category: null, last_run: null, runs_7d: null, created_via: 'arx',
    owner: null, updated_at: null, revision: 'r', pinned: false, favourite: false, hidden: false, can: { edit: true, code_view: false, toggle: true, run: true, delete: true, copy: true },
    read_only: null, warnings: [], ...extra,
  });
  expect(STATE_FILTERS_OF(false).map((f) => f.id)).not.toContain('conflict');
  expect(STATE_FILTERS_OF(true).map((f) => f.id)).toEqual(['all', 'on', 'off', 'sensitive', 'conflict', 'attention']);
  const items = withConflicts([item('a'), item('b', { wall_button: true })], [{ kind: 'automation', id: 'a', count: 2 }, { kind: 'schedule', id: 'b', count: 1 }]);
  expect(items.map((i) => i.conflicts)).toEqual([2, 0]);
  expect(stateCounts(items).conflict).toBe(1);
  expect(applyFilters(items, { ...NO_FILTERS, state: 'conflict' }, 'automation').map((i) => i.id)).toEqual(['a']);
  expect(cardChips(items[0]).map((c) => c.label)).toContain('התנגשות אפשרית · 2');
  expect(cardChips(items[1]).map((c) => c.label)).toContain('כפתור קיר · ניתן לעריכה');
});

test('the schedule editor moves a conflicting slot just outside the window, on the side it is already on', () => {
  expect(conflictSlotIndex({ path: 'slots.2' })).toBe(2);
  expect(conflictSlotIndex({ path: 'triggers.0' })).toBeNull();
  expect(conflictMove({ mine_at: '07:10', other_at: '07:00', window_min: 15 })).toEqual({ to: '07:16', delta: 6 });
  expect(conflictMove({ mine_at: '06:55', other_at: '07:00', window_min: 15 })).toEqual({ to: '06:44', delta: -11 });
  expect(conflictMove({ mine_at: '00:05', other_at: '23:58', window_min: 10 })).toEqual({ to: '00:09', delta: 4 });  // across midnight
  expect(conflictMove({ mine_at: 'x', other_at: '07:00', window_min: 15 })).toBeNull();
});
