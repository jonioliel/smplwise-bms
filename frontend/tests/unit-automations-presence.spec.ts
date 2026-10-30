import { test, expect } from '@playwright/test';
import { parseCondition, parseTrigger, emitBlock, triggerSentence, conditionSentence } from '../src/api/automations';

// PRESENCE-2280: the cockpit's building-empty trigger and room-occupied condition (the client twin of services/building_presence_blocks.py).
const A = 'binary_sensor.shelly_presence_lobby';
const B = 'binary_sensor.shelly_motion_hall';
const on = { presenceSensors: [A, B], uid: () => 'u' };
const trig = { trigger: 'template', value_template: `{{ ['${A}', '${B}'] | reject('is_state', 'off') | list | count == 0 }}`, for: { hours: 0, minutes: 15, seconds: 0 } };
const cond = (mode: 'occupied' | 'empty') => ({
  condition: 'template',
  value_template: mode === 'occupied' ? `{{ ['${A}'] | select('is_state', 'on') | list | count > 0 }}` : `{{ ['${A}'] | reject('is_state', 'off') | list | count == 0 }}`,
});

test('the building-empty trigger is typed only while presence sensors are tagged, and round-trips byte for byte', () => {
  const b = parseTrigger(trig, on);
  expect(b).toMatchObject({ kind: 'typed', type: 'building_empty', sensors: [A, B], minutes: 15 });
  expect(emitBlock(b, 'trigger', on)).toEqual(trig);
  expect(triggerSentence(b, on)).toBe('כשהמבנה ריק במשך 15 דקות');
  expect(parseTrigger(trig, { uid: () => 'u' })).toMatchObject({ kind: 'locked' });
});

test('a changed trigger is rebuilt in the same shape', () => {
  const b = { ...parseTrigger(trig, on), minutes: 1 } as never;
  const out = emitBlock(b, 'trigger', on) as { for: unknown; value_template: string };
  expect(out.for).toEqual({ hours: 0, minutes: 1, seconds: 0 });
  expect(out.value_template).toContain("reject('is_state', 'off')");
  expect(triggerSentence(b, on)).toBe('כשהמבנה ריק במשך דקה');
});

test('hand-edited templates and odd durations stay locked', () => {
  expect(parseTrigger({ ...trig, value_template: trig.value_template.replace('== 0', '== 1') }, on)).toMatchObject({ kind: 'locked' });
  expect(parseTrigger({ ...trig, for: { hours: 0, minutes: 0, seconds: 30 } }, on)).toMatchObject({ kind: 'locked' });
  expect(parseTrigger({ ...trig, to: 'x' }, on)).toMatchObject({ kind: 'locked' });
});

test('the room-occupied condition reads both modes, says "במבנה" for every tagged sensor, and is locked when off', () => {
  for (const mode of ['occupied', 'empty'] as const) {
    const b = parseCondition(cond(mode), { presenceSensors: [A], uid: () => 'u' });
    expect(b).toMatchObject({ kind: 'typed', type: 'room_occupied', mode, sensors: [A] });
    expect(emitBlock(b, 'condition', { presenceSensors: [A] })).toEqual(cond(mode));
  }
  const b = parseCondition(cond('empty'), { presenceSensors: [A], uid: () => 'u' });
  expect(conditionSentence(b, { presenceSensors: [A] })).toBe('אין נוכחות במבנה');
  expect(conditionSentence(b, { presenceSensors: [A, B] })).toBe('אין נוכחות באזור שנבחר');
  expect(parseCondition(cond('empty'), { uid: () => 'u' })).toMatchObject({ kind: 'locked' });
});
