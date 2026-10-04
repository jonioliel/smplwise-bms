import { test, expect } from '@playwright/test';
import { ScheduleDemoStore } from '../src/api/schedules-mock';
import { ALL_CLASSES, CLASS_LABEL, actionLabel, offActionFor, scheduleSettingsPatch, SCHEDULE_SETTINGS_DEFAULT, type ArgSpec, type ScheduleDraft } from '../src/api/schedules';
import { actionForIntent, defaultDataFor, isSensitiveAction, metaFromCatalog, validateDraft, type EntityMeta } from '../src/screens/schedule-edit-logic';
import { actionTone } from '../src/screens/schedules-logic';

/**
 * Schedules: more actions (owner request 2026-10-04) - the client side: the new classes and their labels, a script's variables
 * (form defaults and the client's mirror of the server's checks), per-entity sensitivity of an alarm script, the demo store's
 * acknowledgement of a review warning bound to the content, and the typed confirmation of `schedules.allow_disarm`.
 */

const vars: ArgSpec = {
  name: 'variables', type: 'vars', required: false, label: 'משתני הסקריפט',
  fields: [
    { name: 'minutes', label: 'דקות', type: 'int', min: 1, max: 60, required: true },
    { name: 'room', label: 'חדר', type: 'enum', choices: ['סלון', 'משרדים'], required: false },
  ],
};

const script: EntityMeta = {
  entity_id: 'script.morning', name: 'שגרת בוקר', domain: 'script', class: 'script', sensitive: false, area_name: 'סלון', floor_name: null, attributes: {},
  actions: [{ service: 'script.turn_on', label: 'הפעלת סקריפט', lowering: false, args: [vars] }], selectable: true, reason: null,
};

const draftWith = (data: Record<string, unknown>): ScheduleDraft => ({
  name: 'בוקר', weekdays: ['daily'], start_date: null, end_date: null, repeat: 'repeat', tags: [], conditions: { items: [], type: null, track: false },
  slots: [{ start: '06:15:00', stop: null, actions: [{ service: 'script.turn_on', entity_id: 'script.morning', data }] }],
});

test('the new classes have Hebrew labels and tones of their own', () => {
  for (const c of ['script', 'scene', 'helper', 'humidifier', 'vacuum'] as const) {
    expect(ALL_CLASSES).toContain(c);
    expect(CLASS_LABEL[c]).toBeTruthy();
    expect(actionTone({ service: 'x.y', class: c, supported: true })).toBe(c);
  }
  expect(actionTone({ service: 'vacuum.return_to_base', class: 'vacuum', supported: true })).toBe('off');
});

test('a script reads as a script, with its variables counted; the others in words', () => {
  expect(actionLabel({ service: 'script.turn_on', data: {} })).toBe('הפעלת סקריפט');
  expect(actionLabel({ service: 'script.turn_on', data: { variables: { minutes: 5, room: 'סלון' } } })).toBe('הפעלת סקריפט · 2 משתנים');
  expect(actionLabel({ service: 'script.morning', data: { minutes: 5 } })).toBe('הפעלת סקריפט · משתנה אחד'); // the older stored form
  expect(actionLabel({ service: 'input_select.select_option', data: { option: 'away' } })).toBe('בחירה: away');
  expect(actionLabel({ service: 'humidifier.set_humidity', data: { humidity: 45 } })).toBe('לחות יעד 45%');
  expect(offActionFor({ service: 'vacuum.start', entity_id: 'vacuum.r', data: {} })).toEqual({ service: 'vacuum.return_to_base', entity_id: 'vacuum.r', data: {} });
});

test('a script\'s required variables start filled; the client checks the fields like the server', () => {
  expect(defaultDataFor([vars], script)).toEqual({ variables: { minutes: 1 } });
  expect(actionForIntent({ kind: 'on' }, script)).toEqual({ service: 'script.turn_on', entity_id: 'script.morning', data: {} });
  const meta = new Map([[script.entity_id, script]]);
  const ctx = { creating: true, meta, sun: null, original: null, lockedConditions: [] };
  expect(validateDraft(draftWith({ variables: { minutes: 10 } }), ctx).errors).toEqual([]);
  expect(validateDraft(draftWith({}), ctx).errors.map((e) => e.code)).toEqual(['required']);
  expect(validateDraft(draftWith({ variables: { minutes: 10, speed: 2 } }), ctx).errors.map((e) => e.code)).toEqual(['argument_not_allowed']);
});

test('an alarm script is sensitive by what it drives, not by its class', () => {
  const a = { service: 'script.turn_on', entity_id: 'script.night', data: {} };
  expect(isSensitiveAction(a, 'script', { ...script, sensitive: true })).toBe(true);
  expect(isSensitiveAction(a, 'script', script)).toBe(false);
});

test('the demo catalogue offers scripts with their fields, and disarming only after the typed decision', async () => {
  const store = new ScheduleDemoStore();
  let cat = (await store.catalog({})).entities;
  const morning = cat.find((e) => e.entity_id === 'script.morning_routine')!;
  expect(morning.actions[0].args[0].type).toBe('vars');
  expect(morning.actions[0].args[0].fields?.map((f) => f.name)).toEqual(['minutes', 'room', 'loud']);
  expect(cat.find((e) => e.entity_id === 'script.night_alarm')!.sensitive).toBe(true);
  expect(cat.find((e) => e.entity_id === 'alarm_control_panel.house')!.actions.map((a) => a.service)).not.toContain('alarm_control_panel.alarm_disarm');
  await expect(store.saveSettings({ ...store.settings, allowDisarm: true }, 'לא')).rejects.toMatchObject({ code: 'confirm_required' });
  await store.saveSettings({ ...store.settings, allowDisarm: true }, 'אפשר נטרול');
  cat = (await store.catalog({})).entities;
  expect(cat.find((e) => e.entity_id === 'alarm_control_panel.house')!.actions.map((a) => a.service)).toContain('alarm_control_panel.alarm_disarm');
  expect(metaFromCatalog(cat).get('script.morning_routine')!.class).toBe('script');
});

test('the settings patch carries the typed word only when switching disarming on', () => {
  const from = { ...SCHEDULE_SETTINGS_DEFAULT };
  expect(scheduleSettingsPatch(from, { ...from, allowDisarm: true }, 'אפשר נטרול')).toEqual({ 'schedules.allow_disarm': 'true', 'schedules.allow_disarm_confirm': 'אפשר נטרול' });
  expect(scheduleSettingsPatch({ ...from, allowDisarm: true }, from)).toEqual({ 'schedules.allow_disarm': 'false' });
});

test('the older script form is a script action: shown editable, never the "original platform" read-only', async () => {
  const store = new ScheduleDemoStore();
  const s = await store.get('a0f4c9');
  expect(s.read_only).toBeNull();
  expect(s.slots[0].actions[0]).toMatchObject({ service: 'script.turn_on', entity_id: 'script.morning_routine', data: { variables: { minutes: 10 } }, supported: true, class: 'script' });
  expect(s.display_name).toContain('שגרת בוקר');
  const unsupported = await store.get('6e2d90');
  expect(unsupported.read_only?.reasons.map((r) => r.code)).toContain('unsupported_content');
});

test('acknowledging a review warning silences it until the content changes; undo brings it back', async () => {
  const store = new ScheduleDemoStore();
  const before = (await store.review()).items.find((i) => i.schedule.id === '6e2d90')!;
  expect(before.issues).toContain('unsupported_content');
  const attention = (await store.status()).counts.attention;
  const r = await store.acknowledge('6e2d90', 'unsupported_content', false);
  expect(r.acknowledged).toBe(true);
  const after = (await store.review()).items.find((i) => i.schedule.id === '6e2d90')!;
  expect(after.issues).not.toContain('unsupported_content');
  expect(after.acknowledged?.[0].issue).toBe('unsupported_content');
  expect((await store.status()).counts.attention).toBe(attention - 1);
  await store.acknowledge('6e2d90', 'unsupported_content', true);
  expect((await store.review()).items.find((i) => i.schedule.id === '6e2d90')!.issues).toContain('unsupported_content');
  await expect(store.acknowledge('3f9a1c', 'no_owner_sensitive', false)).rejects.toMatchObject({ code: 'issue_not_present' });
});
