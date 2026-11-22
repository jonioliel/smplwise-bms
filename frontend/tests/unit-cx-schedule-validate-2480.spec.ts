import { test } from '@playwright/test';
import type { ArgSpec, ConditionView, DraftAction, DraftSlot, ScheduleDraft } from '../src/api/schedules';
import { validateDraft, type EntityMeta, type MetaMap } from '../src/screens/schedule-edit-logic';
import { expectRecorded } from './cx-record';

// COMPLEXITY-3-2480: characterisation of the schedule editor's validateDraft (screens/schedule-edit-logic.ts) before its per-action check
// was split out. Every action below (devices in and out of the catalogue, not selectable, a refused service, a code in the data, every
// argument type with missing / wrong-type / out-of-range / not-a-choice values, script variables, temperatures under the device's
// minimum, alarm panels and locks that need a code) in a one-slot draft, the same draft "as loaded" or not, plus the draft-level rules
// (name, days, dates, slots, times, overlaps, conditions, locked conditions, track); the answers must equal the record taken from the
// unsplit function (tests/fixtures/cx/schedule-validate.json), one line each. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-schedule-validate-2480.spec.ts --workers=1

const SUN = { sunrise: 390, sunset: 1095 };
const meta = (id: string, over: Partial<EntityMeta> = {}): EntityMeta => ({
  entity_id: id, name: id, domain: id.split('.')[0], class: null, sensitive: false, area_name: null, floor_name: null, attributes: {}, actions: [], selectable: true, reason: null, ...over,
});
const spec = (name: string, type: ArgSpec['type'], o: Partial<ArgSpec> = {}): ArgSpec => ({ name, type, required: false, ...o });
const svc = (service: string, args: ArgSpec[] = []) => ({ service, label: service, lowering: false, args }) as unknown as EntityMeta['actions'][number];
const M: MetaMap = new Map([
  ['light.a', meta('light.a', { actions: [svc('light.turn_on', [spec('brightness_pct', 'int', { min: 1, max: 100 }), spec('color_name', 'enum', { choices: ['red', 'blue'], label: 'צבע' })]), svc('light.turn_off')] })],
  ['light.free', meta('light.free')],
  ['light.blocked', meta('light.blocked', { selectable: false, reason: { path: '', code: 'entity_not_allowed', message: 'לא בתחום' } as never })],
  ['light.blocked-noreason', meta('light.blocked-noreason', { selectable: false })],
  ['climate.c', meta('climate.c', { attributes: { min_temp: 16, max_temp: 30 }, actions: [svc('climate.set_temperature', [spec('temperature', 'float', { required: true, min: 7, max: 35 }), spec('hvac_mode', 'enum', { choices: ['heat', 'cool'] })])] })],
  ['climate.nomax', meta('climate.nomax', { attributes: { min_temp: '18' }, actions: [svc('climate.set_temperature', [spec('temperature', 'float')])] })],
  ['cover.k', meta('cover.k', { actions: [svc('cover.set_cover_position', [spec('position', 'int', { required: true, min: 0, max: 100 })])] })],
  ['script.s', meta('script.s', { actions: [svc('script.turn_on', [spec('variables', 'vars', { fields: [spec('room', 'str', { required: true, label: 'חדר' }), spec('level', 'int')] })])] })],
  ['script.nofields', meta('script.nofields', { actions: [svc('script.turn_on', [spec('variables', 'vars')])] })],
  ['input_text.t', meta('input_text.t', { actions: [svc('input_text.set_value', [spec('value', 'str', { required: true, choices: [] })])] })],
  ['alarm_control_panel.house', meta('alarm_control_panel.house', { attributes: { code_arm_required: false } })],
  ['alarm_control_panel.coded', meta('alarm_control_panel.coded', { attributes: { code_arm_required: true, code_format: 'number' } })],
  ['alarm_control_panel.disarm-code', meta('alarm_control_panel.disarm-code', { attributes: { code_format: 'number' } })],
  ['lock.door', meta('lock.door')],
  ['lock.coded', meta('lock.coded', { attributes: { code_format: 'number' } })],
]);
const act = (service: string, entity_id: string | null, data: Record<string, unknown> = {}): DraftAction => ({ service, entity_id, data });
const ACTIONS: DraftAction[] = [
  act('light.turn_on', null), act('light.turn_on', 'light.unknown'), act('light.turn_on', 'light.free', { anything: 1 }), act('light.turn_on', 'light.blocked'),
  act('light.turn_on', 'light.blocked-noreason'), act('light.toggle', 'light.a'), act('light.turn_off', 'light.a', { code: '1' }), act('light.turn_on', 'light.a'),
  act('light.turn_on', 'light.a', { brightness_pct: 50 }), act('light.turn_on', 'light.a', { brightness_pct: 0 }), act('light.turn_on', 'light.a', { brightness_pct: 101 }),
  act('light.turn_on', 'light.a', { brightness_pct: '50' }), act('light.turn_on', 'light.a', { brightness_pct: NaN }), act('light.turn_on', 'light.a', { brightness_pct: null, color_name: '' }),
  act('light.turn_on', 'light.a', { color_name: 'green' }), act('light.turn_on', 'light.a', { color_name: 'red' }), act('light.turn_on', 'light.a', { color_name: 3 }),
  act('climate.set_temperature', 'climate.c'), act('climate.set_temperature', 'climate.c', { temperature: 22 }), act('climate.set_temperature', 'climate.c', { temperature: 12 }),
  act('climate.set_temperature', 'climate.c', { temperature: 5 }), act('climate.set_temperature', 'climate.c', { temperature: 40 }), act('climate.set_temperature', 'climate.c', { temperature: 22, hvac_mode: 'off' }),
  act('climate.set_temperature', 'climate.c', { temperature: 22, hvac_mode: 'dry' }), act('climate.set_temperature', 'climate.nomax', { temperature: 10 }), act('climate.set_temperature', 'climate.nomax', { temperature: '10' }),
  act('cover.set_cover_position', 'cover.k', { position: 50 }), act('cover.set_cover_position', 'cover.k', {}), act('cover.set_cover_position', 'cover.k', { position: -5 }),
  act('script.turn_on', 'script.s'), act('script.turn_on', 'script.s', { variables: { room: 'סלון' } }), act('script.turn_on', 'script.s', { variables: { room: '', level: 2, extra: 1 } }),
  act('script.turn_on', 'script.nofields', { variables: { a: 1 } }), act('input_text.set_value', 'input_text.t', { value: 'x' }), act('input_text.set_value', 'input_text.t', { value: '' }),
  act('alarm_control_panel.alarm_arm_away', 'alarm_control_panel.house'), act('alarm_control_panel.alarm_arm_away', 'alarm_control_panel.coded'),
  act('alarm_control_panel.alarm_arm_home', 'alarm_control_panel.coded'), act('alarm_control_panel.alarm_disarm', 'alarm_control_panel.coded'),
  act('alarm_control_panel.alarm_disarm', 'alarm_control_panel.disarm-code'), act('alarm_control_panel.alarm_disarm', 'alarm_control_panel.house'),
  act('lock.lock', 'lock.door'), act('lock.unlock', 'lock.coded'), act('lock.lock', 'lock.coded', { code: '1234' }), act('lock.open', 'lock.coded'),
];
const slot = (start: string, stop: string | null, ...actions: DraftAction[]): DraftSlot => ({ start, stop, actions });
const draft = (o: Partial<ScheduleDraft> = {}): ScheduleDraft => ({
  name: 'ערב', weekdays: ['mon'] as never, start_date: null, end_date: null, repeat: 'repeat' as never, tags: [], conditions: { items: [], type: null, track: false }, slots: [slot('07:00:00', '08:00:00', act('light.turn_off', 'light.a'))], ...o,
});
const lc = (o: Partial<ConditionView>): ConditionView => ({ entity_id: 'sensor.t', attribute: '', match_type: 'above', value: 20, name: 'חום', locked: true, ...o }) as unknown as ConditionView;
const DRAFTS: Array<[string, ScheduleDraft]> = [
  ['base', draft()], ['no-name', draft({ name: '  ' })], ['null-name', draft({ name: null })], ['long-name', draft({ name: 'א'.repeat(81) })], ['no-days', draft({ weekdays: [] })],
  ['dates-order', draft({ start_date: '2026-12-01', end_date: '2026-11-01' })], ['dates-ok', draft({ start_date: '2026-11-01', end_date: '2026-12-01' })], ['no-slots', draft({ slots: [] })],
  ['many-slots', draft({ slots: Array.from({ length: 49 }, (_, i) => slot(`${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}:00`, null, act('light.turn_off', 'light.a'))) })],
  ['single', draft({ repeat: 'single' as never })], ['bad-start', draft({ slots: [slot('25:00:00', null, act('light.turn_off', 'light.a'))] })],
  ['bad-stop', draft({ slots: [slot('07:00:00', 'x', act('light.turn_off', 'light.a'))] })], ['stop-before', draft({ slots: [slot('09:00:00', '08:00:00', act('light.turn_off', 'light.a'))] })],
  ['stop-midnight', draft({ slots: [slot('09:00:00', '00:00:00', act('light.turn_off', 'light.a'))] })], ['sun', draft({ slots: [slot('sunset+00:30:00', 'sunrise+00:00:00', act('light.turn_off', 'light.a'))] })],
  ['no-actions', draft({ slots: [slot('07:00:00', null)] })], ['many-actions', draft({ slots: [slot('07:00:00', null, ...Array.from({ length: 21 }, () => act('light.turn_off', 'light.a')))] })],
  ['overlap', draft({ slots: [slot('07:00:00', '09:00:00', act('light.turn_off', 'light.a')), slot('08:00:00', '10:00:00', act('light.turn_off', 'light.a')), slot('08:30:00', null, act('light.turn_off', 'light.a'))] })],
  ['conditions', draft({ conditions: { type: 'and' as never, track: true, items: [
    { entity_id: '', attribute: '', match_type: 'is' as never, value: '' }, { entity_id: 'sensor.t', attribute: '', match_type: 'above' as never, value: 'x' },
    { entity_id: 'sensor.t', attribute: '', match_type: 'below' as never, value: NaN }, { entity_id: 'sensor.t', attribute: '', match_type: 'not' as never, value: 'v'.repeat(101) },
    { entity_id: 'sensor.t', attribute: '', match_type: 'above' as never, value: 20 },
  ] } })],
  ['track-open', draft({ conditions: { type: 'or' as never, track: true, items: [] }, slots: [slot('07:00:00', null, act('light.turn_off', 'light.a'))] })],
  ['too-many-conditions', draft({ conditions: { type: 'and' as never, track: false, items: Array.from({ length: 11 }, () => ({ entity_id: 'sensor.t', attribute: '', match_type: 'is' as never, value: 'on' })) } })],
];

test('schedule validateDraft: every answer equals the record of the unsplit function', () => {
  const line = (r: ReturnType<typeof validateDraft>) => [...r.errors.map((p) => `E ${p.path} ${p.code} ${p.message}`), ...r.warnings.map((p) => `W ${p.path} ${p.code} ${p.message}`)].join(' | ');
  const base = { meta: M, sun: SUN, lockedConditions: [] as ConditionView[] };
  const out: string[] = [];
  for (const [k, d] of DRAFTS) {
    out.push(`${k} create: ${line(validateDraft(d, { ...base, creating: true, original: null }))}`);
    out.push(`${k} edit: ${line(validateDraft(d, { ...base, creating: false, original: d, maxSlots: 60, lockedConditions: [lc({}), lc({ locked: false, entity_id: 'x' }), lc({ value: 'on', match_type: 'is' as never })] }))}`);
  }
  ACTIONS.forEach((a, i) => {
    const d = draft({ slots: [slot('07:00:00', '08:00:00', a)] });
    out.push(`action ${i} new: ${line(validateDraft(d, { ...base, creating: true, original: null }))}`);
    out.push(`action ${i} loaded: ${line(validateDraft(d, { ...base, creating: false, original: d }))}`);
    out.push(`action ${i} loaded-other: ${line(validateDraft(d, { ...base, creating: false, original: draft({ slots: [slot('07:00:00', null, { ...a, data: { ...a.data, z: 1 } })] }) }))}`);
  });
  expectRecorded('schedule-validate', out);
});
