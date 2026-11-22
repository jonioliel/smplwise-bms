import { test } from '@playwright/test';
import { parseTrigger, type ModelContext } from '../src/api/automations';
import { expectRecorded } from './cx-record';

// CR-FE-COMPLEXITY-2450: characterisation of parseTrigger (api/automations.ts) before its split. Every raw trigger below goes through
// every context; the answers must equal the record taken from the unsplit function (tests/fixtures/cx/parse-trigger.json). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-parse-trigger-2450.spec.ts --workers=1

const A = 'binary_sensor.presence_lobby';
const B = 'binary_sensor.motion_hall';
const EMPTY_TPL = `{{ ['${A}', '${B}'] | reject('is_state', 'off') | list | count == 0 }}`;
const zha = (extra: Record<string, unknown> = {}) => ({ trigger: 'device', device_id: 'dev_living', domain: 'zha', type: 'remote_button_double_press', subtype: 'button_1', ...extra });

const RAWS: unknown[] = [
  // not an object / no type / preflight
  'state', '{{ is_state("a.b", "on") }}', null, 5, [], {}, { trigger: 5 }, { platform: null },
  { trigger: 'state', entity_id: 'light.a', password: 'x' }, { trigger: 'state', entity_id: 'lock.a', code: '1234' },
  { trigger: 'state', entity_id: 'light.a', enabled: false }, { trigger: 'state', entity_id: 'light.a', continue_on_error: true },
  { trigger: 'state', entity_id: 'light.a', enabled: 'yes' }, { trigger: 'state', entity_id: 'light.a', enabled: true },
  // device (wall buttons)
  zha(), zha({ id: 'double' }), zha({ discovery_id: 'd1', id: 'x' }), zha({ discovery_id: 7 }), zha({ id: 3 }), zha({ subtype: 'button_13' }), zha({ type: 'nope' }),
  zha({ extra_key: 1 }), zha({ device_id: '' }), zha({ subtype: '{{ x }}' }), { trigger: 'device', device_id: 'x', domain: 'wall_switch', type: 'button_1_short' },
  { platform: 'device', device_id: 'dev_living', domain: 'zha', type: 'remote_button_long_press', subtype: 'button_3', metadata: {}, alias: 'a' },
  // template / building empty
  { trigger: 'template', value_template: EMPTY_TPL, for: { hours: 0, minutes: 15, seconds: 0 } },
  { trigger: 'template', value_template: EMPTY_TPL, for: { hours: 0, minutes: 0, seconds: 30 } },
  { trigger: 'template', value_template: EMPTY_TPL, for: '00:05:00', id: 'empty' },
  { trigger: 'template', value_template: EMPTY_TPL, for: { hours: 1, minutes: 0, seconds: 0 }, id: 4 },
  { trigger: 'template', value_template: EMPTY_TPL },
  { trigger: 'template', value_template: EMPTY_TPL.replace('== 0', '== 1'), for: { minutes: 5 } },
  { trigger: 'template', value_template: EMPTY_TPL, for: { minutes: 5 }, to: 'x' },
  { trigger: 'template', value_template: '{{ true }}' },
  // purpose / templates / ids
  { trigger: 'light.turned_on', entity_id: 'light.a' }, { trigger: 'state', entity_id: 'light.a', to: '{{ x }}' },
  { trigger: 'state', entity_id: 'light.a', id: 7 }, { trigger: 'state', entity_id: 'light.a', id: 'door' },
  // state
  { trigger: 'state', entity_id: ['binary_sensor.front_door'], to: 'on', for: { hours: 0, minutes: 5, seconds: 0 }, id: 'door' },
  { platform: 'state', entity_id: 'person.yoni', to: 'home', for: '00:10:00' },
  { trigger: 'state', entity_id: 'person.yoni', from: null, to: null }, { trigger: 'state', entity_id: 'person.yoni', from: 'home' },
  { trigger: 'state', entity_id: ['light.a', 'light.b'], to: 'on' }, { trigger: 'state', entity_id: 'light.a', from: 3 },
  { trigger: 'state', entity_id: 'light.a', to: 'on', for: 'soon' }, { trigger: 'state', entity_id: 'Not An Id' },
  { trigger: 'state', entity_id: 'light.a', attribute: 'brightness' }, { trigger: 'state', entity_id: 'light.a', for: { minutes: -1 } },
  { trigger: 'state', entity_id: 'light.a', for: { days: 1 } }, { trigger: 'state', entity_id: 'light.a', for: 90 },
  // numeric_state
  { trigger: 'numeric_state', entity_id: 'sensor.bed_temp', above: 26 }, { trigger: 'numeric_state', entity_id: 'sensor.t', below: -3.5, for: { minutes: 2 } },
  { trigger: 'numeric_state', entity_id: 'sensor.t', above: 1, below: 9 }, { trigger: 'numeric_state', entity_id: 'sensor.t', above: '26' },
  { trigger: 'numeric_state', entity_id: 'sensor.t', below: null, above: null }, { trigger: 'numeric_state', entity_id: 'sensor.t', value_template: 'x' },
  { trigger: 'numeric_state', entity_id: 'sensor.t', above: Infinity }, { trigger: 'numeric_state', entity_id: 'sensor.t', above: 1, for: 'x' },
  // time / time_pattern
  { trigger: 'time', at: '06:30' }, { trigger: 'time', at: '23:59:59' }, { trigger: 'time', at: '25:00' }, { trigger: 'time' },
  { trigger: 'time', at: 'input_datetime.wake' }, { trigger: 'time', at: '06:30', id: 'morning' }, { trigger: 'time', at: '06:30', weekday: 'mon' },
  { trigger: 'time_pattern', minutes: '/15' }, { trigger: 'time_pattern', hours: 2, minutes: 0, seconds: '30' }, { trigger: 'time_pattern' },
  { trigger: 'time_pattern', seconds: { x: 1 } }, { trigger: 'time_pattern', hours: null, every: 1 },
  // sun / homeassistant
  { trigger: 'sun', event: 'sunset', offset: '-00:20:00' }, { trigger: 'sun', event: 'sunrise', offset: 600 }, { trigger: 'sun', event: 'sunrise' },
  { trigger: 'sun', event: 'sunrise', offset: 30 }, { trigger: 'sun', event: 'sunrise', offset: '+01:30' }, { trigger: 'sun', event: 'sunrise', offset: '1:30:15' },
  { trigger: 'sun', event: 'noon' }, { trigger: 'sun', event: 'sunset', offset: null, id: 's' }, { trigger: 'sun', event: 'sunset', offset: [] },
  { trigger: 'homeassistant', event: 'start' }, { trigger: 'homeassistant', event: 'shutdown' }, { trigger: 'homeassistant', event: 'start', extra: 1 },
  // known but untyped / unknown
  { trigger: 'event', event_type: 'x' }, { trigger: 'zone', entity_id: 'person.a' }, { trigger: 'Weird-Type' }, { trigger: 'mqtt', topic: '{{ t }}' },
];

const names = (id: string) => ({ 'light.a': 'מנורה', 'person.yoni': 'יוני', 'sensor.bed_temp': 'טמפרטורה' })[id] ?? id;
const CONTEXTS: Array<[string, Omit<ModelContext, 'uid'>]> = [
  ['plain', {}],
  ['full', { wallButtons: true, presenceSensors: [A, B], names, deviceName: (id) => (id === 'dev_living' ? 'מפסק סלון' : null) }],
  ['no-template-text', { templateText: false, presenceSensors: [A] }],
];

test('parseTrigger: every answer equals the record of the unsplit function', () => {
  const out = CONTEXTS.flatMap(([label, base]) => {
    let n = 0;
    const ctx: ModelContext = { ...base, uid: () => `u${++n}` };
    return RAWS.map((raw) => ({ ctx: label, raw, block: parseTrigger(raw, ctx) }));
  });
  expectRecorded('parse-trigger', out);
});
