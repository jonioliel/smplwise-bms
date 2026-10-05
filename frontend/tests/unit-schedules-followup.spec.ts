import { test, expect } from '@playwright/test';
import { ScheduleDemoStore } from '../src/api/schedules-mock';
import { ALL_CLASSES, CLASS_LABEL, SENSITIVE_CLASSES, actionLabel, offActionFor, scheduleSettingsOf, type ScheduleDraft } from '../src/api/schedules';
import { actionTone } from '../src/screens/schedules-logic';

/**
 * Schedules: the owner's decisions of 2026-10-04 on the client side (SCHEDULER_API.md §15): disarming allowed by default, the per-script
 * "allowed in schedules" mark (the demo store mirrors the server), and sirens / media players / numbers / selects as schedule actions.
 */

const draftOf = (service: string, entity: string, data: Record<string, unknown> = {}): ScheduleDraft => ({
  name: 'בדיקה', weekdays: ['daily'], start_date: null, end_date: null, repeat: 'repeat', tags: [], conditions: { items: [], type: null, track: false },
  slots: [{ start: '06:15:00', stop: null, actions: [{ service, entity_id: entity, data }] }],
});

test('the four new classes have Hebrew labels and tones; a siren is sensitive', () => {
  for (const c of ['siren', 'media', 'number', 'select'] as const) {
    expect(ALL_CLASSES).toContain(c);
    expect(CLASS_LABEL[c]).toBeTruthy();
    expect(actionTone({ service: 'x.y', class: c, supported: true })).toBe(c);
  }
  expect(SENSITIVE_CLASSES).toContain('siren');
  expect(SENSITIVE_CLASSES).not.toContain('media');
  expect(actionTone({ service: 'siren.turn_off', class: 'siren', supported: true })).toBe('off');
  expect(actionTone({ service: 'media_player.turn_off', class: 'media', supported: true })).toBe('off');
});

test('the new actions read in words', () => {
  expect(actionLabel({ service: 'media_player.volume_set', data: { volume_level: 0.3 } })).toBe('עוצמת שמע 30%');
  expect(actionLabel({ service: 'media_player.select_source', data: { source: 'רדיו' } })).toBe('החלפת מקור: רדיו');
  expect(actionLabel({ service: 'siren.turn_on', data: { tone: 'אש', duration: 60 } })).toBe('הפעלת צופר: אש · 60 ש׳');
  expect(actionLabel({ service: 'siren.turn_on', data: {} })).toBe('הפעלת צופר');
  expect(actionLabel({ service: 'number.set_value', data: { value: 55 } })).toBe('קביעת ערך 55');
  expect(actionLabel({ service: 'select.select_option', data: { option: 'ארוכה' } })).toBe('בחירה: ארוכה');
  expect(offActionFor({ service: 'siren.turn_on', entity_id: 'siren.y', data: { tone: 'אש' } })).toEqual({ service: 'siren.turn_off', entity_id: 'siren.y', data: {} });
});

test('disarming is allowed when nothing was stored; a stored restriction reads as stored', () => {
  expect(scheduleSettingsOf({}).allowDisarm).toBe(true);
  expect(scheduleSettingsOf({ 'schedules.allow_disarm': 'false' }).allowDisarm).toBe(false);
  expect(scheduleSettingsOf({ 'schedules.allow_disarm': 'true' }).allowDisarm).toBe(true);
});

test('the demo catalogue: a siren\'s tones, a player\'s sources, a number\'s range, a select\'s options - from the entity', async () => {
  const store = new ScheduleDemoStore();
  const cat = new Map((await store.catalog({})).entities.map((e) => [e.entity_id, e]));
  const siren = cat.get('siren.yard')!;
  expect(siren.sensitive).toBe(true);
  expect(siren.actions.find((a) => a.service === 'siren.turn_on')!.args.find((a) => a.name === 'tone')!.choices).toEqual(['אש', 'פריצה']);
  const player = cat.get('media_player.lobby_speaker')!;
  expect(player.actions.find((a) => a.service === 'media_player.select_source')!.args[0].choices).toEqual(['רדיו', 'Spotify']);
  expect(player.actions.find((a) => a.service === 'media_player.volume_set')!.args[0].max).toBe(0.6);
  expect(cat.get('number.boiler_temp')!.actions[0].args[0]).toMatchObject({ min: 40, max: 70, step: 5 });
  expect(cat.get('select.irrigation_program')!.actions[0].args[0].choices).toEqual(['קצרה', 'ארוכה', 'כבויה']);
});

test('an unmarked disarming script is listed disabled with the reason; the administrator\'s mark makes it schedulable, undo removes it', async () => {
  const store = new ScheduleDemoStore();
  let night = (await store.catalog({})).entities.find((e) => e.entity_id === 'script.night_alarm')!;
  expect(night.selectable).toBe(false);
  expect(night.reason?.code).toBe('script_not_approved');
  expect(night.approval).toMatchObject({ required: true, approved: false });
  await expect(store.create(draftOf('script.turn_on', 'script.night_alarm'), true, true)).rejects.toMatchObject({ code: 'script_not_approved' });
  const list = await store.scripts();
  expect(list.can_mark).toBe(true);
  expect(list.scripts.find((s) => s.entity_id === 'script.morning_routine')!.approval.required).toBe(false);
  const r = await store.markScript('script.night_alarm', false);
  expect(r.approval).toMatchObject({ required: true, approved: true });
  expect(r.approval.by?.username).toBe('joni');
  night = (await store.catalog({})).entities.find((e) => e.entity_id === 'script.night_alarm')!;
  expect(night.selectable).toBe(true);
  await expect(store.markScript('script.morning_routine', false)).rejects.toMatchObject({ code: 'mark_not_needed' });
  await store.markScript('script.night_alarm', true);
  await expect(store.markScript('script.night_alarm', true)).rejects.toMatchObject({ code: 'not_marked' });
});

test('only the administrator persona marks a script', async () => {
  const store = new ScheduleDemoStore();
  store.persona = 'manager';
  await expect(store.markScript('script.night_alarm', false)).rejects.toMatchObject({ status: 403 });
  expect((await store.scripts()).can_mark).toBe(false);
});
