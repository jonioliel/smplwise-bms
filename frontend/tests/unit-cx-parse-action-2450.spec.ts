import { test } from '@playwright/test';
import { CRITICAL_DATA, parseAction, type ModelContext } from '../src/api/automations';
import { expectRecorded } from './cx-record';

// CR-FE-COMPLEXITY-2450: characterisation of parseAction (api/automations.ts) before its split. Every raw action below goes through every
// context; the answers must equal the record taken from the unsplit function (tests/fixtures/cx/parse-action.json). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-parse-action-2450.spec.ts --workers=1

const ON = { action: 'light.turn_on', target: { entity_id: ['light.hall'] } };
const RAWS: unknown[] = [
  // not an object / preflight
  'light.turn_on', '{{ x }}', null, 7, [], {}, { ...ON, enabled: false }, { ...ON, continue_on_error: true }, { ...ON, enabled: 'no' }, { ...ON, enabled: true },
  { action: 'lock.unlock', target: { entity_id: 'lock.front' }, data: { code: '1234' } }, { action: 'light.turn_on', data: { api_key: 'x' } },
  // choose
  { choose: [{ conditions: [{ condition: 'sun', after: 'sunset' }], sequence: [ON] }], default: [{ delay: { seconds: 5 } }] },
  { choose: [{ conditions: { condition: 'trigger', id: 'a' }, sequence: ON }] }, { choose: [] }, { choose: 'x' }, { choose: [{ conditions: [], sequence: [], alias: 'x' }] },
  { choose: [5] }, { choose: [], extra: 1 }, { choose: [{ conditions: [{ condition: 'state', entity_id: 'lock.a', state: 'on', code: '1' }], sequence: [] }] },
  // if
  { if: [{ condition: 'sun', after: 'sunset' }], then: [ON], else: [{ stop: 'done' }] }, { if: [], then: [] }, { if: { condition: 'trigger', id: 'x' }, then: ON },
  { if: [], else: [] }, { if: [], then: [], extra: 1 },
  // repeat
  { repeat: { count: 3, sequence: [ON] } }, { repeat: { count: 0, sequence: [] } }, { repeat: { count: 2.5, sequence: [] } }, { repeat: { count: '3', sequence: [] } },
  { repeat: { while: [], sequence: [] } }, { repeat: 'x' }, { repeat: { count: 1, sequence: [] }, alias: 'r' }, { repeat: { count: 1 }, extra: 1 },
  // delay / stop
  { delay: { hours: 0, minutes: 5, seconds: 0 } }, { delay: '00:00:30' }, { delay: 45 }, { delay: 'later' }, { delay: { days: 1 } }, { delay: null }, { delay: { seconds: 1 }, extra: 1 },
  { stop: 'enough' }, { stop: 3 }, { stop: 'x', error: true },
  // condition as a step
  { condition: 'sun', after: 'sunset' }, { condition: 'state', entity_id: 'light.a', state: '{{ x }}' }, { condition: 'Weird' }, { condition: 'trigger', id: 'a', action: 'x.y' },
  // device
  { type: 'turn_on', device_id: 'd', domain: 'light' }, { type: 'turn_on', device_id: 'd', domain: 'light', entity_id: 'light.a' },
  // service calls
  { variables: { a: 1 } }, { wait_template: '{{ x }}' }, { action: 5 }, { service: 'light.turn_on', entity_id: 'light.hall' }, ON,
  { action: 'light.turn_on', target: { entity_id: 'light.hall' }, data: { brightness_pct: 40 } }, { action: 'light.turn_on', target: { entity_id: '{{ e }}' } },
  { action: 'light.turn_on', target: { area_id: 'salon' } }, { action: 'light.turn_on', target: 'light.hall' }, { action: 'light.turn_on', target: { entity_id: 'Bad Id' } },
  { action: 'light.turn_on', data: 'x' }, { action: 'light.turn_on', data: { entity_id: 'light.a' } }, { action: 'light.turn_on', response_variable: 'r' },
  { action: 'light.turn_on' }, { action: 'light.turn_on', entity_id: ['light.a', 'light.b'], data: { transition: 2 } },
  { action: 'notify.mobile_app_yoni', data: { message: 'שלום', title: 't' } }, { action: 'notify.mobile_app_yoni', data: { message: 'x', data: CRITICAL_DATA } },
  { action: 'notify.mobile_app_yoni', data: { message: 'x', data: { push: { sound: 'default' } } } }, { action: 'notify.other_target', data: { message: 'x' } },
  { action: 'scene.turn_on', target: { entity_id: 'scene.salon_off' } }, { action: 'script.morning' }, { action: 'script.turn_on', target: { entity_id: 'script.morning' } },
  { action: 'script.toggle', target: { entity_id: 'script.morning' } }, { action: 'automation.trigger', target: { entity_id: 'automation.a' } },
  { action: 'automation.reload' }, { action: 'homeassistant.restart' }, { action: 'shell_command.x' }, { action: 'scheduler.turn_off', target: { entity_id: 'switch.schedule_x' } },
  { action: 'lock.unlock', target: { entity_id: 'lock.front' } }, { action: 'alarm_control_panel.alarm_arm_away', target: { entity_id: 'alarm_control_panel.home' } },
  { action: 'Light.Turn_On' }, { action: 'light.turn_on', target: { entity_id: [] } },
];

const names = (id: string) => ({ 'light.hall': 'תאורת מסדרון', 'scene.salon_off': 'סלון כבוי', 'script.morning': 'בוקר' })[id] ?? id;
const CONTEXTS: Array<[string, Omit<ModelContext, 'uid'>]> = [
  ['plain', {}],
  ['full', { names, notifyName: (a) => (a === 'notify.mobile_app_yoni' ? 'הטלפון של יוני' : null), allowedActions: ['light.turn_on', 'light.turn_off', 'lock.unlock', 'notify.mobile_app_yoni', 'alarm_control_panel.alarm_arm_away'] }],
  ['no-template-text', { templateText: false, allowedActions: new Set(['notify.other_target', 'scheduler.turn_off']) }],
];

test('parseAction: every answer equals the record of the unsplit function', () => {
  const out = CONTEXTS.flatMap(([label, base]) => {
    let n = 0;
    const ctx: ModelContext = { ...base, uid: () => `u${++n}` };
    return RAWS.map((raw) => ({ ctx: label, raw, block: parseAction(raw, ctx) }));
  });
  expectRecorded('parse-action', out);
});
