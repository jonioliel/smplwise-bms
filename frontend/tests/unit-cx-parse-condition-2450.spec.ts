import { test } from '@playwright/test';
import { parseCondition, type ModelContext } from '../src/api/automations';
import { expectRecorded } from './cx-record';

// CR-FE-COMPLEXITY-2450: characterisation of parseCondition (api/automations.ts) before its split. Every raw condition below goes through
// every context, top level and inside a group; the answers must equal the record taken from the unsplit function
// (tests/fixtures/cx/parse-condition.json). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-parse-condition-2450.spec.ts --workers=1

const A = 'binary_sensor.presence_lobby';
const SHABBAT = 'binary_sensor.shabbat';
const WHO = 'binary_sensor.someone_home';
const OCC = `{{ ['${A}'] | select('is_state', 'on') | list | count > 0 }}`;
const EMPTY = `{{ ['${A}'] | reject('is_state', 'off') | list | count == 0 }}`;

const RAWS: unknown[] = [
  // not an object / no type / preflight
  'state', '{{ is_state("a.b", "on") }}', null, 3, {}, { condition: 4 }, { condition: 'state', entity_id: 'lock.a', state: 'on', code: '1' },
  { condition: 'state', entity_id: 'light.a', state: 'on', enabled: false }, { condition: 'state', entity_id: 'light.a', state: 'on', enabled: 'x' },
  { condition: 'device', device_id: 'd', domain: 'light', type: 'is_on' },
  // template / room occupied
  { condition: 'template', value_template: OCC }, { condition: 'template', value_template: EMPTY }, { condition: 'template', value_template: '{{ true }}' },
  { condition: 'template', value_template: OCC, alias: 'x' }, { condition: 'template', value_template: OCC, extra: 1 },
  { condition: 'state', entity_id: 'light.a', state: '{{ s }}' },
  // state, shabbat, presence
  { condition: 'state', entity_id: 'light.a', state: 'on' }, { condition: 'state', entity_id: ['light.a', 'light.b'], state: ['on', 'off'] },
  { condition: 'state', entity_id: 'light.a', state: 'on', for: { minutes: 5 } }, { condition: 'state', entity_id: 'light.a', state: 'on', for: 'x' },
  { condition: 'state', entity_id: 'light.a', state: [] }, { condition: 'state', entity_id: 'light.a', state: 1 }, { condition: 'state', entity_id: 'light.a' },
  { condition: 'state', entity_id: 'Bad Id', state: 'on' }, { condition: 'state', entity_id: 'light.a', state: 'on', attribute: 'x' },
  { condition: 'state', entity_id: SHABBAT, state: 'on' }, { condition: 'state', entity_id: SHABBAT, state: 'off' }, { condition: 'state', entity_id: SHABBAT, state: 'unknown' },
  { condition: 'state', entity_id: SHABBAT, state: 'on', for: { minutes: 1 } }, { condition: 'state', entity_id: [SHABBAT, 'light.a'], state: 'on' },
  { condition: 'state', entity_id: WHO, state: 'on' }, { condition: 'state', entity_id: WHO, state: 'off' }, { condition: 'state', entity_id: WHO, state: ['on'] },
  // numeric_state
  { condition: 'numeric_state', entity_id: 'sensor.t', above: 20 }, { condition: 'numeric_state', entity_id: 'sensor.t', below: 5, above: -1 },
  { condition: 'numeric_state', entity_id: 'sensor.t', above: 'x' }, { condition: 'numeric_state', entity_id: 'sensor.t', for: { minutes: 1 } },
  { condition: 'numeric_state', entity_id: 'sensor.t' },
  // time / sun
  { condition: 'time', after: '08:00', before: '20:00' }, { condition: 'time', weekday: ['mon', 'fri'] }, { condition: 'time', weekday: 'sat' },
  { condition: 'time', weekday: ['funday'] }, { condition: 'time', after: '24:00' }, { condition: 'time', before: 9 }, { condition: 'time' },
  { condition: 'time', after: 'input_datetime.x' }, { condition: 'time', after: '08:00', extra: 1 },
  { condition: 'sun', after: 'sunset' }, { condition: 'sun', before: 'sunrise', after: 'sunset' }, { condition: 'sun', after: 'noon' }, { condition: 'sun', after_offset: '01:00' },
  // trigger
  { condition: 'trigger', id: 'door' }, { condition: 'trigger', id: ['a', 'b'] }, { condition: 'trigger', id: [] }, { condition: 'trigger', id: 3 }, { condition: 'trigger' },
  // groups
  { condition: 'and', conditions: [{ condition: 'state', entity_id: 'light.a', state: 'on' }, { condition: 'sun', after: 'sunset' }] },
  { condition: 'or', conditions: [{ condition: 'trigger', id: 'x' }, { condition: 'and', conditions: [] }, '{{ t }}'] },
  { condition: 'not', conditions: [] }, { condition: 'not', conditions: 'x' }, { condition: 'and', conditions: [], alias: 'g' }, { condition: 'and', conditions: [], extra: 1 },
  { condition: 'or', conditions: [{ condition: 'state', entity_id: 'light.a', state: '{{ x }}' }] },
  { condition: 'and', conditions: [{ condition: 'state', entity_id: 'lock.a', state: 'on', code: '1' }] },
  // unknown
  { condition: 'zone', entity_id: 'person.a', zone: 'zone.home' }, { condition: 'Weird' },
];

const names = (id: string) => ({ 'light.a': 'מנורה', 'sensor.t': 'מדחום' })[id] ?? id;
const CONTEXTS: Array<[string, Omit<ModelContext, 'uid'>]> = [
  ['plain', {}],
  ['full', { presenceSensors: [A], shabbatSensor: SHABBAT, presenceEntity: WHO, names }],
  ['no-template-text', { templateText: false, shabbatSensor: SHABBAT }],
];

test('parseCondition: every answer equals the record of the unsplit function', () => {
  const out = CONTEXTS.flatMap(([label, base]) =>
    [false, true].flatMap((inGroup) => {
      let n = 0;
      const ctx: ModelContext = { ...base, uid: () => `u${++n}` };
      return RAWS.map((raw) => ({ ctx: label, inGroup, raw, block: parseCondition(raw, ctx, inGroup) }));
    }),
  );
  expectRecorded('parse-condition', out);
});
